import JSZip from "jszip"
import html2canvas from "html2canvas"
import { jsPDF } from "jspdf"

// --- Types ---

type TextRun = {
  text: string
  bold: boolean
  italic: boolean
  fontSize: number | null
  color: string | null
}

type TextParagraph = {
  runs: TextRun[]
  align: "left" | "center" | "right" | null
}

type ShapeStyle = {
  fillColor: string | null
  borderColor: string | null
  borderWidth: number // in px
}

type SlideShape =
  | {
      kind: "box"
      x: number
      y: number
      w: number
      h: number
      style: ShapeStyle
      placeholder: string | null
      paragraphs: TextParagraph[]
    }
  | {
      kind: "image"
      x: number
      y: number
      w: number
      h: number
      blobUrl: string
    }
  | {
      kind: "line"
      x: number
      y: number
      w: number
      h: number
      style: ShapeStyle
    }

type SlideSize = { w: number; h: number } // EMU

type SlideData = {
  shapes: SlideShape[]
  bgColor: string | null
}

// --- XML Helpers ---

function attr(el: Element, name: string): string | null {
  return el.getAttribute(name)
}

function emuToPercent(emu: string | null, base: number): number {
  if (!emu) return 0
  return (parseInt(emu, 10) / base) * 100
}

function directChild(parent: Element, tagName: string): Element | null {
  for (let i = 0; i < parent.children.length; i++) {
    if (parent.children[i].tagName === tagName) return parent.children[i]
  }
  return null
}

/** Read a:solidFill only from direct children of the given element */
function parseDirectFillColor(parent: Element): string | null {
  const solidFill = directChild(parent, "a:solidFill")
  if (!solidFill) return null
  const srgb = solidFill.getElementsByTagName("a:srgbClr")[0]
  if (srgb) return `#${attr(srgb, "val") ?? "000000"}`
  return null
}

/** Check if the element explicitly declares no fill */
function hasNoFill(parent: Element): boolean {
  return directChild(parent, "a:noFill") !== null
}

function parseShapeStyle(sp: Element): ShapeStyle {
  const spPr =
    sp.getElementsByTagName("p:spPr")[0] ??
    sp.getElementsByTagName("p:cxnSpPr")[0] ??
    null

  let fillColor: string | null = null
  let borderColor: string | null = null
  let borderWidth = 0

  if (spPr) {
    // Only read fill from spPr's direct children, not from nested a:ln etc.
    if (!hasNoFill(spPr)) {
      fillColor = parseDirectFillColor(spPr)
    }

    const ln = directChild(spPr, "a:ln")
    if (ln && !hasNoFill(ln)) {
      borderColor = parseDirectFillColor(ln)
      const w = attr(ln, "w")
      if (w) borderWidth = Math.max(1, Math.round(parseInt(w, 10) / 12700)) // EMU → px
      if (borderColor && borderWidth === 0) borderWidth = 1
    }
  }

  return { fillColor, borderColor, borderWidth }
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
    if (sz) fontSize = parseInt(sz, 10) / 100
    color = parseDirectFillColor(rPr)
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

function parseParagraphs(txBody: Element): TextParagraph[] {
  const paragraphs: TextParagraph[] = []
  const pEls = txBody.getElementsByTagName("a:p")
  for (let j = 0; j < pEls.length; j++) {
    if (pEls[j].parentElement === txBody) {
      paragraphs.push(parseParagraph(pEls[j]))
    }
  }
  return paragraphs
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
  return { w: 9144000, h: 6858000 }
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

// --- Shape parsing ---

function parseXfrm(
  el: Element,
  slideSize: SlideSize,
): { x: number; y: number; w: number; h: number } | null {
  const xfrm = el.getElementsByTagName("a:xfrm")[0]
  if (!xfrm) return null
  const off = xfrm.getElementsByTagName("a:off")[0]
  const ext = xfrm.getElementsByTagName("a:ext")[0]
  return {
    x: emuToPercent(off ? attr(off, "x") : null, slideSize.w),
    y: emuToPercent(off ? attr(off, "y") : null, slideSize.h),
    w: emuToPercent(ext ? attr(ext, "cx") : null, slideSize.w),
    h: emuToPercent(ext ? attr(ext, "cy") : null, slideSize.h),
  }
}

function parseSp(
  sp: Element,
  slideSize: SlideSize,
): SlideShape | null {
  const pos = parseXfrm(sp, slideSize)
  if (!pos) return null

  const style = parseShapeStyle(sp)
  const phEl = sp.getElementsByTagName("p:ph")[0]
  const placeholder = phEl ? (attr(phEl, "type") ?? "body") : null

  const txBody = sp.getElementsByTagName("p:txBody")[0]
  const paragraphs = txBody ? parseParagraphs(txBody) : []

  const hasText = paragraphs.some((p) => p.runs.some((r) => r.text.trim()))
  const hasVisual = style.fillColor || style.borderColor

  // Skip shapes that have nothing to render
  if (!hasText && !hasVisual) return null

  return {
    kind: "box",
    ...pos,
    style,
    placeholder,
    paragraphs,
  }
}

function parsePic(
  pic: Element,
  rels: Map<string, string>,
  blobUrls: Map<string, string>,
  slideSize: SlideSize,
): SlideShape | null {
  const pos = parseXfrm(pic, slideSize)
  if (!pos) return null

  const blip = pic.getElementsByTagName("a:blip")[0]
  const rEmbed = blip ? attr(blip, "r:embed") : null
  if (!rEmbed) return null

  const target = rels.get(rEmbed)
  if (!target) return null

  const mediaPath = `ppt/media/${target.split("/").pop()}`
  const blobUrl = blobUrls.get(mediaPath)
  if (!blobUrl) return null

  return { kind: "image", ...pos, blobUrl }
}

function parseCxnSp(
  cxn: Element,
  slideSize: SlideSize,
): SlideShape | null {
  const pos = parseXfrm(cxn, slideSize)
  if (!pos) return null

  const style = parseShapeStyle(cxn)
  if (!style.borderColor) style.borderColor = "#000000"
  if (style.borderWidth === 0) style.borderWidth = 1

  return { kind: "line", ...pos, style }
}

/** Parse shapes from a container element (slide tree or group shape) */
function parseShapesFromContainer(
  container: Element,
  rels: Map<string, string>,
  blobUrls: Map<string, string>,
  slideSize: SlideSize,
  offsetX: number,
  offsetY: number,
): SlideShape[] {
  const shapes: SlideShape[] = []

  for (let i = 0; i < container.children.length; i++) {
    const child = container.children[i]
    const tag = child.tagName

    if (tag === "p:sp") {
      const shape = parseSp(child, slideSize)
      if (shape) {
        shape.x += offsetX
        shape.y += offsetY
        shapes.push(shape)
      }
    } else if (tag === "p:pic") {
      const shape = parsePic(child, rels, blobUrls, slideSize)
      if (shape) {
        shape.x += offsetX
        shape.y += offsetY
        shapes.push(shape)
      }
    } else if (tag === "p:cxnSp") {
      const shape = parseCxnSp(child, slideSize)
      if (shape) {
        shape.x += offsetX
        shape.y += offsetY
        shapes.push(shape)
      }
    } else if (tag === "p:grpSp") {
      // Group shape — compute group offset then recurse
      const grpXfrm = directChild(
        child.getElementsByTagName("p:grpSpPr")[0] ?? child,
        "a:xfrm",
      )
      let gx = offsetX
      let gy = offsetY
      if (grpXfrm) {
        const off = grpXfrm.getElementsByTagName("a:off")[0]
        if (off) {
          gx += emuToPercent(attr(off, "x"), slideSize.w)
          gy += emuToPercent(attr(off, "y"), slideSize.h)
        }
        // Child offset is the group's child-origin, which offsets children negatively
        const chOff = grpXfrm.getElementsByTagName("a:chOff")[0]
        if (chOff) {
          gx -= emuToPercent(attr(chOff, "x"), slideSize.w)
          gy -= emuToPercent(attr(chOff, "y"), slideSize.h)
        }
      }
      shapes.push(
        ...parseShapesFromContainer(child, rels, blobUrls, slideSize, gx, gy),
      )
    }
  }

  return shapes
}

function parseShapes(
  doc: Document,
  rels: Map<string, string>,
  blobUrls: Map<string, string>,
  slideSize: SlideSize,
): SlideShape[] {
  // The slide's shape tree lives under p:cSld > p:spTree
  const spTree =
    doc.getElementsByTagName("p:spTree")[0] ?? doc.documentElement
  return parseShapesFromContainer(spTree, rels, blobUrls, slideSize, 0, 0)
}

function parseSlideBgColor(doc: Document): string | null {
  const bg = doc.getElementsByTagName("p:bg")[0]
  if (!bg) return null
  const srgb = bg.getElementsByTagName("a:srgbClr")[0]
  if (srgb) return `#${attr(srgb, "val") ?? "FFFFFF"}`
  return null
}

// --- Build slide HTML ---

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function buildShapeHtml(shape: SlideShape): string {
  if (shape.kind === "image") {
    return `<img src="${shape.blobUrl}" style="
      position:absolute; object-fit:contain;
      left:${shape.x}%; top:${shape.y}%;
      width:${shape.w}%; height:${shape.h}%;" />`
  }

  if (shape.kind === "line") {
    // Render line as a thin rotated div
    // For simplicity, render as a bordered box
    const isHorizontal = shape.w >= shape.h
    let style = `position:absolute;
      left:${shape.x}%; top:${shape.y}%;
      width:${shape.w}%; height:${shape.h}%;`
    if (isHorizontal) {
      style += `border-top:${shape.style.borderWidth}px solid ${shape.style.borderColor ?? "#000"};`
    } else {
      style += `border-left:${shape.style.borderWidth}px solid ${shape.style.borderColor ?? "#000"};`
    }
    return `<div style="${style}"></div>`
  }

  // kind === "box"
  let boxStyle = `position:absolute; overflow:hidden;
    left:${shape.x}%; top:${shape.y}%;
    width:${shape.w}%; height:${shape.h}%;`

  if (shape.style.fillColor) {
    boxStyle += `background:${shape.style.fillColor};`
  }
  if (shape.style.borderColor) {
    boxStyle += `border:${shape.style.borderWidth}px solid ${shape.style.borderColor};`
  }

  let html = `<div style="${boxStyle}">`

  const isTitle =
    shape.placeholder === "title" || shape.placeholder === "ctrTitle"

  for (const para of shape.paragraphs) {
    const hasContent = para.runs.some((r) => r.text.trim())
    if (!hasContent) {
      html += '<div style="height:0.5em"></div>'
      continue
    }

    const alignStyle = para.align ? `text-align:${para.align};` : ""
    html += `<p style="margin:0; line-height:1.35; ${alignStyle}">`

    for (const run of para.runs) {
      if (run.text === "\n") {
        html += "<br>"
        continue
      }
      const defaultPt = isTitle ? 36 : 18
      const pt = run.fontSize ?? defaultPt
      let style = `font-size:${pt}px;`
      if (run.bold || isTitle) style += "font-weight:bold;"
      if (run.italic) style += "font-style:italic;"
      if (run.color) style += `color:${run.color};`
      html += `<span style="${style}">${escapeHtml(run.text)}</span>`
    }

    html += "</p>"
  }

  html += "</div>"
  return html
}

function buildSlideHtml(
  slide: SlideData,
  designW: number,
  designH: number,
): string {
  const fontFamily =
    '"Geist", "Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif'

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { width: ${designW}px; height: ${designH}px; overflow: hidden;
  background: ${slide.bgColor ?? "#ffffff"}; font-family: ${fontFamily};
  color: #000; }
</style></head><body>`

  for (const shape of slide.shapes) {
    html += buildShapeHtml(shape)
  }

  html += "</body></html>"
  return html
}

// --- Render a slide inside an isolated iframe and capture with html2canvas ---

function captureSlideToCanvas(
  slide: SlideData,
  designW: number,
  designH: number,
): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe")
    iframe.style.cssText = `
      position: fixed; left: -99999px; top: 0;
      width: ${designW}px; height: ${designH}px;
      border: none; opacity: 0; pointer-events: none;
    `
    document.body.appendChild(iframe)

    const cleanup = () => {
      document.body.removeChild(iframe)
    }

    iframe.onload = async () => {
      try {
        const iframeDoc = iframe.contentDocument
        if (!iframeDoc) throw new Error("Cannot access iframe document")

        const body = iframeDoc.body

        // Wait for all images to load
        const imgs = body.querySelectorAll("img")
        if (imgs.length > 0) {
          await Promise.all(
            Array.from(imgs).map(
              (img) =>
                new Promise<void>((resolve) => {
                  if (img.complete) return resolve()
                  img.onload = () => resolve()
                  img.onerror = () => resolve()
                }),
            ),
          )
        }

        // Let layout settle
        await new Promise<void>((r) =>
          iframe.contentWindow!.requestAnimationFrame(() =>
            iframe.contentWindow!.requestAnimationFrame(() => r()),
          ),
        )

        // Capture with html2canvas
        const canvas = await html2canvas(body, {
          width: designW,
          height: designH,
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: slide.bgColor ?? "#ffffff",
          logging: false,
          windowWidth: designW,
          windowHeight: designH,
        })

        cleanup()
        resolve(canvas)
      } catch (err) {
        cleanup()
        reject(err)
      }
    }

    iframe.onerror = () => {
      cleanup()
      reject(new Error("Failed to load iframe"))
    }

    // Write HTML into the iframe
    const htmlContent = buildSlideHtml(slide, designW, designH)
    const iframeDoc = iframe.contentDocument
    if (!iframeDoc) {
      cleanup()
      reject(new Error("Cannot access iframe document"))
      return
    }
    iframeDoc.open()
    iframeDoc.write(htmlContent)
    iframeDoc.close()
  })
}

// --- Public API ---

export async function convertPptxToPdf(file: File): Promise<File> {
  const buffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(buffer)

  const slideSize = await parseSlideSize(zip)

  // Collect slide XML paths
  const slideFiles: { name: string; index: number }[] = []
  zip.forEach((path) => {
    const match = path.match(/^ppt\/slides\/slide(\d+)\.xml$/)
    if (match) {
      slideFiles.push({ name: path, index: parseInt(match[1], 10) })
    }
  })
  slideFiles.sort((a, b) => a.index - b.index)

  if (slideFiles.length === 0) {
    throw new Error("No slides found in PowerPoint file")
  }

  // Extract media as blob URLs
  const blobUrls = await extractMedia(zip)

  // Parse all slides
  const domParser = new DOMParser()
  const slides: SlideData[] = []
  for (const sf of slideFiles) {
    const xml = await zip.file(sf.name)?.async("text")
    if (!xml) continue
    const doc = domParser.parseFromString(xml, "application/xml")
    const rels = await parseRelationships(zip, sf.index)
    const shapes = parseShapes(doc, rels, blobUrls, slideSize)
    const bgColor = parseSlideBgColor(doc)
    slides.push({ shapes, bgColor })
  }

  // Design size in px (EMU → px at 96 dpi)
  const designW = (slideSize.w / 914400) * 96
  const designH = (slideSize.h / 914400) * 96

  // Page size in pt for jsPDF (EMU → pt at 72 dpi)
  const pageW = (slideSize.w / 914400) * 72
  const pageH = (slideSize.h / 914400) * 72

  const pdf = new jsPDF({
    orientation: pageW > pageH ? "landscape" : "portrait",
    unit: "pt",
    format: [pageW, pageH],
    compress: true,
  })

  try {
    for (let si = 0; si < slides.length; si++) {
      if (si > 0) pdf.addPage([pageW, pageH], pageW > pageH ? "landscape" : "portrait")

      const canvas = await captureSlideToCanvas(slides[si], designW, designH)

      const imgData = canvas.toDataURL("image/jpeg", 0.85)
      pdf.addImage(imgData, "JPEG", 0, 0, pageW, pageH, undefined, "FAST")
    }
  } finally {
    blobUrls.forEach((url) => URL.revokeObjectURL(url))
  }

  const pdfBlob = pdf.output("blob")
  const pdfName = file.name.replace(/\.pptx?$/i, ".pdf")
  return new File([pdfBlob], pdfName, { type: "application/pdf" })
}
