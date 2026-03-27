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
}

export function PdfViewer({ file }: PdfViewerProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1.2)
  const [error, setError] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const panState = useRef<{ active: boolean; startX: number; startY: number; scrollX: number; scrollY: number }>({
    active: false, startX: 0, startY: 0, scrollX: 0, scrollY: 0,
  })

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
      container.style.cursor = "grabbing"
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
      container.style.cursor = ""
    }

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault()
    }

    container.addEventListener("mousedown", onMouseDown)
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
    container.addEventListener("contextmenu", onContextMenu)

    return () => {
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
      setPageNumber(1)

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
          <Page pageNumber={pageNumber} scale={scale} />
        </Document>
      </div>
    </div>
  )
}
