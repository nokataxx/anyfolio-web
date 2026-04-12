// --- Types ---

export type TextRun = {
  text: string
  bold: boolean
  italic: boolean
  fontSize: number | null
  color: string | null
}

export type TextParagraph = {
  runs: TextRun[]
  align: "left" | "center" | "right" | null
}

export type ShapeStyle = {
  fillColor: string | null
  borderColor: string | null
  borderWidth: number // in px
}

export type SlideShape =
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

export type SlideSize = { w: number; h: number } // EMU

export type SlideData = {
  shapes: SlideShape[]
  bgColor: string | null
}

// --- XML Helpers ---

export function attr(el: Element, name: string): string | null {
  return el.getAttribute(name)
}

export function emuToPercent(emu: string | null, base: number): number {
  if (!emu) return 0
  return (parseInt(emu, 10) / base) * 100
}

export function directChild(parent: Element, tagName: string): Element | null {
  for (let i = 0; i < parent.children.length; i++) {
    if (parent.children[i].tagName === tagName) return parent.children[i]
  }
  return null
}

/** Read a:solidFill only from direct children of the given element */
export function parseDirectFillColor(parent: Element): string | null {
  const solidFill = directChild(parent, "a:solidFill")
  if (!solidFill) return null
  const srgb = solidFill.getElementsByTagName("a:srgbClr")[0]
  if (srgb) return `#${attr(srgb, "val") ?? "000000"}`
  return null
}

/** Check if the element explicitly declares no fill */
export function hasNoFill(parent: Element): boolean {
  return directChild(parent, "a:noFill") !== null
}

export function parseShapeStyle(sp: Element): ShapeStyle {
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

export function parseTextRun(rEl: Element): TextRun {
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

export function parseParagraph(pEl: Element): TextParagraph {
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

export function parseParagraphs(txBody: Element): TextParagraph[] {
  const paragraphs: TextParagraph[] = []
  const pEls = txBody.getElementsByTagName("a:p")
  for (let j = 0; j < pEls.length; j++) {
    if (pEls[j].parentElement === txBody) {
      paragraphs.push(parseParagraph(pEls[j]))
    }
  }
  return paragraphs
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}
