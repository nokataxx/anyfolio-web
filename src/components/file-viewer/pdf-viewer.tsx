import { useCallback, useEffect, useRef, useState } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import type { FileRecord } from "@/lib/types"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString()

type PdfViewerProps = {
  file: FileRecord
  initialPage?: number
  highlightQuery?: string
}

function findAndHighlightInContainer(container: HTMLElement, query: string) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  const queryLower = query.toLowerCase()

  // PDF text layer splits text across many <span>s.
  // Collect consecutive text nodes and search across their concatenated text.
  const textNodes: Text[] = []
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text)
  if (textNodes.length === 0) return

  // Build concatenated string with node boundary info
  let concat = ""
  const nodeOffsets: { node: Text; start: number }[] = []
  for (const node of textNodes) {
    nodeOffsets.push({ node, start: concat.length })
    concat += node.textContent ?? ""
  }

  const matchStart = concat.toLowerCase().indexOf(queryLower)
  if (matchStart === -1) return

  const matchEnd = matchStart + query.length

  // Find which nodes overlap with [matchStart, matchEnd)
  const ranges: Range[] = []
  for (let i = 0; i < nodeOffsets.length; i++) {
    const nodeStart = nodeOffsets[i].start
    const nodeText = nodeOffsets[i].node.textContent ?? ""
    const nodeEnd = nodeStart + nodeText.length
    if (nodeEnd <= matchStart) continue
    if (nodeStart >= matchEnd) break

    const range = document.createRange()
    range.setStart(nodeOffsets[i].node, Math.max(0, matchStart - nodeStart))
    range.setEnd(nodeOffsets[i].node, Math.min(nodeText.length, matchEnd - nodeStart))
    ranges.push(range)
  }

  if (ranges.length === 0) return

  // Scroll parent (the outer scroll container) to the match
  const scrollParent = container.closest("[class*='overflow-auto']") as HTMLElement | null
  if (scrollParent) {
    const firstRect = ranges[0].getBoundingClientRect()
    const parentRect = scrollParent.getBoundingClientRect()
    scrollParent.scrollTo({
      top: scrollParent.scrollTop + firstRect.top - parentRect.top - scrollParent.clientHeight / 3,
      behavior: "smooth",
    })
  }

  // Create highlight overlays
  const pageContainer = container.closest(".react-pdf__Page") as HTMLElement | null ?? container
  for (const range of ranges) {
    const rect = range.getBoundingClientRect()
    const baseRect = pageContainer.getBoundingClientRect()

    const highlight = document.createElement("div")
    highlight.className = "pdf-search-highlight"
    highlight.style.cssText = [
      "position:absolute",
      "pointer-events:none",
      "z-index:10",
      "border-radius:2px",
      "background:rgba(250,204,21,0.45)",
      "transition:opacity 0.5s",
      `top:${rect.top - baseRect.top}px`,
      `left:${rect.left - baseRect.left}px`,
      `width:${rect.width}px`,
      `height:${rect.height}px`,
    ].join(";")
    pageContainer.appendChild(highlight)

    setTimeout(() => { highlight.style.opacity = "0" }, 2500)
    setTimeout(() => highlight.remove(), 3000)
  }
}

export function PdfViewer({ file, initialPage, highlightQuery }: PdfViewerProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [pageNumber, setPageNumber] = useState(initialPage ?? 1)
  const [scale, setScale] = useState(1.2)
  const [error, setError] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const panState = useRef<{ active: boolean; startX: number; startY: number; scrollX: number; scrollY: number }>({
    active: false, startX: 0, startY: 0, scrollX: 0, scrollY: 0,
  })

  const initialPageRef = useRef(initialPage)
  initialPageRef.current = initialPage

  const highlightQueryRef = useRef(highlightQuery)
  highlightQueryRef.current = highlightQuery

  useEffect(() => {
    if (initialPage != null && initialPage >= 1) {
      setPageNumber(initialPage)
    }
  }, [initialPage])

  const handleTextLayerSuccess = useCallback(() => {
    const query = highlightQueryRef.current
    if (!query) return
    highlightQueryRef.current = undefined
    // Wait a frame for the text layer DOM to finalize
    requestAnimationFrame(() => {
      const container = containerRef.current
      if (!container) return
      const textLayer = container.querySelector(".react-pdf__Page__textContent")
      if (textLayer) {
        findAndHighlightInContainer(textLayer as HTMLElement, query)
      }
    })
  }, [])

  const getScrollParent = useCallback((): HTMLElement | null => {
    let el = containerRef.current?.parentElement ?? null
    while (el) {
      const { overflow, overflowX, overflowY } = getComputedStyle(el)
      if ([overflow, overflowX, overflowY].some((v) => v === "auto" || v === "scroll")) return el
      el = el.parentElement
    }
    return null
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const onWheel = (e: WheelEvent) => {
      if (!e.altKey) return
      const rect = container.getBoundingClientRect()
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      ) return
      e.preventDefault()
      e.stopPropagation()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      setScale((s) => Math.min(3, Math.max(0.5, s + delta)))
    }

    document.addEventListener("wheel", onWheel, { passive: false })

    return () => {
      document.removeEventListener("wheel", onWheel)
    }
  }, [pdfUrl])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 2) return
      const scrollParent = getScrollParent()
      if (!scrollParent) return
      panState.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        scrollX: scrollParent.scrollLeft,
        scrollY: scrollParent.scrollTop,
      }
      document.body.classList.add("grabbing")
      e.preventDefault()
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!panState.current.active) return
      const scrollParent = getScrollParent()
      if (!scrollParent) return
      const dx = e.clientX - panState.current.startX
      const dy = e.clientY - panState.current.startY
      scrollParent.scrollLeft = panState.current.scrollX - dx
      scrollParent.scrollTop = panState.current.scrollY - dy
    }

    const onMouseUp = (e: MouseEvent) => {
      if (e.button !== 2 || !panState.current.active) return
      panState.current.active = false
      document.body.classList.remove("grabbing")
    }

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault()
    }

    container.addEventListener("mousedown", onMouseDown)
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
    container.addEventListener("contextmenu", onContextMenu)

    return () => {
      document.body.classList.remove("grabbing")
      container.removeEventListener("mousedown", onMouseDown)
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
      container.removeEventListener("contextmenu", onContextMenu)
    }
  }, [getScrollParent, pdfUrl])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setError(null)
      setPageNumber(initialPageRef.current ?? 1)

      const { data, error } = await supabase.storage
        .from("anyfolio-files")
        .download(file.storage_path)

      if (cancelled) return

      if (error) {
        setError(error.message)
        return
      }

      const url = URL.createObjectURL(data)
      setPdfUrl(url)
    }

    load()
    return () => {
      cancelled = true
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.storage_path])

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-destructive">
        {error}
      </div>
    )
  }

  if (!pdfUrl) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        Loading...
      </div>
    )
  }

  return (
    <div ref={containerRef} className="inline-flex min-h-full min-w-full flex-col items-center">
      <div className="sticky top-0 z-10 flex w-full items-center justify-center gap-2 border-b bg-background/80 px-4 py-2 backdrop-blur">
        <Button
          variant="outline"
          size="icon-sm"
          disabled={pageNumber <= 1}
          onClick={() => setPageNumber((p) => p - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm tabular-nums">
          {pageNumber} / {numPages}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={pageNumber >= numPages}
          onClick={() => setPageNumber((p) => p + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
        <div className="ml-4 flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
          >
            <ZoomOut className="size-4" />
          </Button>
          <span className="w-12 text-center text-sm tabular-nums">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setScale((s) => Math.min(3, s + 0.2))}
          >
            <ZoomIn className="size-4" />
          </Button>
        </div>
      </div>
      <div className="p-4">
        <Document
          file={pdfUrl}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          loading={
            <div className="text-muted-foreground">Loading PDF...</div>
          }
        >
          <Page pageNumber={pageNumber} scale={scale} onRenderTextLayerSuccess={handleTextLayerSuccess} />
        </Document>
      </div>
    </div>
  )
}
