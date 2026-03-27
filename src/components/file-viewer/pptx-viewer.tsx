import { useCallback, useEffect, useRef, useState } from "react"
import JSZip from "jszip"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import type { FileRecord } from "@/lib/types"

type PptxViewerProps = {
  file: FileRecord
}

// --- Types ---

type TextRun = {
  text: string
  bold: boolean
  italic: boolean
  fontSize: number | null // in pt
  color: string | null // hex
}

type TextParagraph = {
  runs: TextRun[]
  align: "left" | "center" | "right" | null
}

type SlideShape = {
  kind: "text"
  x: number // percentage of slide width
  y: number
  w: number
  h: number
  placeholder: string | null // "title" | "body" | "ctrTitle" | "subTitle" | etc.
  paragraphs: TextParagraph[]
} | {
  kind: "image"
  x: number
  y: number
  w: number
  h: number
  blobUrl: string
}

type SlideSize = {
  w: number // EMU
  h: number // EMU
}

type SlideData = {
  index: number
  shapes: SlideShape[]
  bgColor: string | null
}

// --- XML Parsing Helpers ---

function attr(el: Element, name: string): string | null {
  return el.getAttribute(name)
}

function emuToPercent(emu: string | null, base: number): number {
  if (!emu) return 0
  return (parseInt(emu, 10) / base) * 100
}

function parseColor(rPr: Element): string | null {
  const solidFill = rPr.getElementsByTagName("a:solidFill")[0]
  if (!solidFill) return null
  const srgb = solidFill.getElementsByTagName("a:srgbClr")[0]
  if (srgb) return `#${attr(srgb, "val") ?? "000000"}`
  return null
}

function parseTextRun(rEl: Element): TextRun {
  const rPr = rEl.getElementsByTagName("a:rPr")[0]
  const tEl = rEl.getElementsByTagName("a:t")[0]
  const text = tEl?.textContent ?? ""

  let bold = false
  let italic = false
  let fontSize: number | null = null
  let color: string | null = null

  if (rPr) {
    bold = attr(rPr, "b") === "1"
    italic = attr(rPr, "i") === "1"
    const sz = attr(rPr, "sz")
    if (sz) fontSize = parseInt(sz, 10) / 100 // hundredths of pt → pt
    color = parseColor(rPr)
  }

  return { text, bold, italic, fontSize, color }
}

function parseParagraph(pEl: Element): TextParagraph {
  const pPr = pEl.getElementsByTagName("a:pPr")[0]
  let align: TextParagraph["align"] = null
  if (pPr) {
    const algn = attr(pPr, "algn")
    if (algn === "ctr") align = "center"
    else if (algn === "r") align = "right"
    else if (algn === "l") align = "left"
  }

  const runs: TextRun[] = []
  for (let i = 0; i < pEl.childNodes.length; i++) {
    const child = pEl.childNodes[i]
    if (child.nodeType !== 1) continue
    const el = child as Element
    if (el.tagName === "a:r") {
      runs.push(parseTextRun(el))
    } else if (el.tagName === "a:br") {
      runs.push({ text: "\n", bold: false, italic: false, fontSize: null, color: null })
    }
  }

  return { runs, align }
}

async function parseSlideSize(zip: JSZip): Promise<SlideSize> {
  const xml = await zip.file("ppt/presentation.xml")?.async("text")
  if (xml) {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xml, "application/xml")
    const sldSz = doc.getElementsByTagName("p:sldSz")[0]
    if (sldSz) {
      const cx = attr(sldSz, "cx")
      const cy = attr(sldSz, "cy")
      if (cx && cy) return { w: parseInt(cx, 10), h: parseInt(cy, 10) }
    }
  }
  // Default: 10" x 7.5" (4:3)
  return { w: 9144000, h: 6858000 }
}

function parseShapes(
  doc: Document,
  rels: Map<string, string>,
  blobUrls: Map<string, string>,
  slideSize: SlideSize,
): SlideShape[] {
  const shapes: SlideShape[] = []

  // Text shapes (p:sp)
  const spElements = doc.getElementsByTagName("p:sp")
  for (let i = 0; i < spElements.length; i++) {
    const sp = spElements[i]

    // Position
    const xfrm = sp.getElementsByTagName("a:xfrm")[0]
    const off = xfrm?.getElementsByTagName("a:off")[0]
    const ext = xfrm?.getElementsByTagName("a:ext")[0]

    const x = emuToPercent(off ? attr(off, "x") : null, slideSize.w)
    const y = emuToPercent(off ? attr(off, "y") : null, slideSize.h)
    const w = emuToPercent(ext ? attr(ext, "cx") : null, slideSize.w)
    const h = emuToPercent(ext ? attr(ext, "cy") : null, slideSize.h)

    // Placeholder type
    const phEl = sp.getElementsByTagName("p:ph")[0]
    const placeholder = phEl ? (attr(phEl, "type") ?? "body") : null

    // Text body
    const txBody = sp.getElementsByTagName("p:txBody")[0]
    if (!txBody) continue

    const paragraphs: TextParagraph[] = []
    const pEls = txBody.getElementsByTagName("a:p")
    for (let j = 0; j < pEls.length; j++) {
      // Only direct children of txBody
      if (pEls[j].parentElement === txBody) {
        paragraphs.push(parseParagraph(pEls[j]))
      }
    }

    // Skip shapes with no text
    const hasText = paragraphs.some((p) => p.runs.some((r) => r.text.trim()))
    if (!hasText) continue

    shapes.push({ kind: "text", x, y, w, h, placeholder, paragraphs })
  }

  // Image shapes (p:pic)
  const picElements = doc.getElementsByTagName("p:pic")
  for (let i = 0; i < picElements.length; i++) {
    const pic = picElements[i]

    const xfrm = pic.getElementsByTagName("a:xfrm")[0]
    const off = xfrm?.getElementsByTagName("a:off")[0]
    const ext = xfrm?.getElementsByTagName("a:ext")[0]

    const x = emuToPercent(off ? attr(off, "x") : null, slideSize.w)
    const y = emuToPercent(off ? attr(off, "y") : null, slideSize.h)
    const w = emuToPercent(ext ? attr(ext, "cx") : null, slideSize.w)
    const h = emuToPercent(ext ? attr(ext, "cy") : null, slideSize.h)

    const blip = pic.getElementsByTagName("a:blip")[0]
    const rEmbed = blip ? attr(blip, "r:embed") : null
    if (!rEmbed) continue

    const target = rels.get(rEmbed)
    if (!target) continue

    const mediaPath = `ppt/media/${target.split("/").pop()}`
    const blobUrl = blobUrls.get(mediaPath)
    if (!blobUrl) continue

    shapes.push({ kind: "image", x, y, w, h, blobUrl })
  }

  return shapes
}

function parseSlideBgColor(doc: Document): string | null {
  const bg = doc.getElementsByTagName("p:bg")[0]
  if (!bg) return null
  const srgb = bg.getElementsByTagName("a:srgbClr")[0]
  if (srgb) return `#${attr(srgb, "val") ?? "FFFFFF"}`
  return null
}

async function parseRelationships(zip: JSZip, slideIndex: number): Promise<Map<string, string>> {
  const rels = new Map<string, string>()
  const relsPath = `ppt/slides/_rels/slide${slideIndex}.xml.rels`
  const relsXml = await zip.file(relsPath)?.async("text")
  if (!relsXml) return rels

  const parser = new DOMParser()
  const doc = parser.parseFromString(relsXml, "application/xml")
  const relEls = doc.getElementsByTagName("Relationship")
  for (let i = 0; i < relEls.length; i++) {
    const id = attr(relEls[i], "Id")
    const target = attr(relEls[i], "Target")
    if (id && target) rels.set(id, target)
  }
  return rels
}

async function extractMedia(zip: JSZip): Promise<Map<string, string>> {
  const blobUrls = new Map<string, string>()
  const mediaFiles: string[] = []
  zip.forEach((path) => {
    if (path.startsWith("ppt/media/")) mediaFiles.push(path)
  })

  for (const path of mediaFiles) {
    const blob = await zip.file(path)?.async("blob")
    if (blob) {
      const ext = path.split(".").pop()?.toLowerCase() ?? ""
      const mimeMap: Record<string, string> = {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        svg: "image/svg+xml",
        webp: "image/webp",
        emf: "image/emf",
        wmf: "image/wmf",
        tiff: "image/tiff",
        tif: "image/tiff",
      }
      const mime = mimeMap[ext] ?? "application/octet-stream"
      const typed = new Blob([blob], { type: mime })
      blobUrls.set(path, URL.createObjectURL(typed))
    }
  }
  return blobUrls
}

// --- Component ---

export function PptxViewer({ file }: PptxViewerProps) {
  const [slides, setSlides] = useState<SlideData[]>([])
  const [slideSize, setSlideSize] = useState<SlideSize>({ w: 9144000, h: 6858000 })
  const [currentSlide, setCurrentSlide] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [scale, setScale] = useState(1)
  const blobUrlsRef = useRef<string[]>([])
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Design size in px (EMU → px at 96dpi: 1 inch = 914400 EMU = 96 px)
  const designW = slideSize.w / 914400 * 96
  const designH = slideSize.h / 914400 * 96

  const recalcScale = useCallback(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const padding = 48 // p-6 on each side
    const available = wrapper.clientWidth - padding
    setScale(Math.min(1, available / designW))
  }, [designW])

  useEffect(() => {
    recalcScale()
    const observer = new ResizeObserver(recalcScale)
    if (wrapperRef.current) observer.observe(wrapperRef.current)
    return () => observer.disconnect()
  }, [recalcScale])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setError(null)
      setLoading(true)
      setSlides([])
      setCurrentSlide(0)

      const { data, error } = await supabase.storage
        .from("anyfolio-files")
        .download(file.storage_path)

      if (cancelled) return

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      try {
        const buffer = await data.arrayBuffer()
        if (cancelled) return

        const zip = await JSZip.loadAsync(buffer)

        // Read actual slide dimensions from presentation.xml
        const size = await parseSlideSize(zip)
        if (cancelled) return
        setSlideSize(size)

        // Find slide files
        const slideFiles: { name: string; index: number }[] = []
        zip.forEach((path) => {
          const match = path.match(/^ppt\/slides\/slide(\d+)\.xml$/)
          if (match) {
            slideFiles.push({ name: path, index: parseInt(match[1], 10) })
          }
        })
        slideFiles.sort((a, b) => a.index - b.index)

        // Extract all media as blob URLs
        const blobUrls = await extractMedia(zip)
        if (cancelled) {
          blobUrls.forEach((url) => URL.revokeObjectURL(url))
          return
        }
        blobUrlsRef.current = [...blobUrls.values()]

        const parser = new DOMParser()
        const parsed: SlideData[] = []

        for (const sf of slideFiles) {
          const xml = await zip.file(sf.name)?.async("text")
          if (cancelled) return
          if (!xml) continue

          const doc = parser.parseFromString(xml, "application/xml")
          const rels = await parseRelationships(zip, sf.index)
          if (cancelled) return

          const shapes = parseShapes(doc, rels, blobUrls, size)
          const bgColor = parseSlideBgColor(doc)
          parsed.push({ index: sf.index, shapes, bgColor })
        }

        setSlides(parsed)
      } catch {
        setError("Failed to parse PowerPoint file")
      } finally {
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
      for (const url of blobUrlsRef.current) {
        URL.revokeObjectURL(url)
      }
      blobUrlsRef.current = []
    }
  }, [file.storage_path])

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-destructive">
        {error}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        Loading...
      </div>
    )
  }

  if (slides.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        No slides found
      </div>
    )
  }

  const slide = slides[currentSlide]

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 flex items-center justify-center gap-2 border-b bg-background/80 px-4 py-2 backdrop-blur">
        <Button
          variant="outline"
          size="icon-sm"
          disabled={currentSlide <= 0}
          onClick={() => setCurrentSlide((s) => s - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm tabular-nums">
          {currentSlide + 1} / {slides.length}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={currentSlide >= slides.length - 1}
          onClick={() => setCurrentSlide((s) => s + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <div ref={wrapperRef} className="flex items-center justify-center p-6">
        <div
          className="overflow-hidden rounded-lg border shadow-sm"
          style={{
            width: `${designW * scale}px`,
            height: `${designH * scale}px`,
          }}
        >
          <div
            className="relative origin-top-left"
            style={{
              width: `${designW}px`,
              height: `${designH}px`,
              transform: `scale(${scale})`,
              backgroundColor: slide.bgColor ?? undefined,
            }}
          >
            {slide.shapes.map((shape, i) =>
              shape.kind === "image" ? (
                <img
                  key={i}
                  src={shape.blobUrl}
                  alt=""
                  className="absolute object-contain"
                  style={{
                    left: `${shape.x}%`,
                    top: `${shape.y}%`,
                    width: `${shape.w}%`,
                    height: `${shape.h}%`,
                  }}
                />
              ) : (
                <div
                  key={i}
                  className="absolute overflow-hidden"
                  style={{
                    left: `${shape.x}%`,
                    top: `${shape.y}%`,
                    width: `${shape.w}%`,
                    height: `${shape.h}%`,
                  }}
                >
                  {shape.paragraphs.map((para, pi) => {
                    const hasContent = para.runs.some((r) => r.text.trim())
                    if (!hasContent) return <div key={pi} className="h-2" />
                    return (
                      <p
                        key={pi}
                        className="leading-snug"
                        style={{ textAlign: para.align ?? undefined }}
                      >
                        {para.runs.map((run, ri) => {
                          const isTitle = shape.placeholder === "title" || shape.placeholder === "ctrTitle"
                          const defaultPt = isTitle ? 36 : 18
                          const pt = run.fontSize ?? defaultPt
                          return (
                            <span
                              key={ri}
                              style={{
                                fontSize: `${pt}px`,
                                fontWeight: run.bold || isTitle ? "bold" : undefined,
                                fontStyle: run.italic ? "italic" : undefined,
                                color: run.color ?? undefined,
                              }}
                            >
                              {run.text}
                            </span>
                          )
                        })}
                      </p>
                    )
                  })}
                </div>
              )
            )}
            {slide.shapes.length === 0 && (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                (Empty slide)
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
