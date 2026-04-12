import { describe, it, expect } from "vitest"
import {
  attr,
  emuToPercent,
  directChild,
  parseDirectFillColor,
  hasNoFill,
  parseShapeStyle,
  parseTextRun,
  parseParagraph,
  parseParagraphs,
  escapeHtml,
} from "../pptx-helpers"

/** Helper to parse XML string into a Document and return the root element */
function xml(s: string): Element {
  const doc = new DOMParser().parseFromString(s, "application/xml")
  return doc.documentElement
}

describe("attr", () => {
  it("returns attribute value", () => {
    const el = xml('<el foo="bar" />')
    expect(attr(el, "foo")).toBe("bar")
  })

  it("returns null for missing attribute", () => {
    const el = xml("<el />")
    expect(attr(el, "missing")).toBeNull()
  })
})

describe("emuToPercent", () => {
  it("converts EMU to percentage", () => {
    // 4572000 / 9144000 * 100 = 50
    expect(emuToPercent("4572000", 9144000)).toBe(50)
  })

  it("returns 0 for null input", () => {
    expect(emuToPercent(null, 9144000)).toBe(0)
  })

  it("returns 0 for empty string", () => {
    expect(emuToPercent("", 9144000)).toBe(0)
  })

  it("handles 0 EMU value", () => {
    expect(emuToPercent("0", 9144000)).toBe(0)
  })

  it("handles full-width EMU", () => {
    expect(emuToPercent("9144000", 9144000)).toBe(100)
  })
})

describe("directChild", () => {
  it("finds a direct child by tag name", () => {
    const el = xml("<root><child /><other /></root>")
    const child = directChild(el, "child")
    expect(child).not.toBeNull()
    expect(child!.tagName).toBe("child")
  })

  it("returns null when tag is not found", () => {
    const el = xml("<root><child /></root>")
    expect(directChild(el, "missing")).toBeNull()
  })

  it("does not find nested elements", () => {
    const el = xml("<root><wrapper><deep /></wrapper></root>")
    expect(directChild(el, "deep")).toBeNull()
  })
})

describe("parseDirectFillColor", () => {
  it("parses srgbClr fill color", () => {
    const el = xml(`
      <parent xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <a:solidFill><a:srgbClr val="FF0000" /></a:solidFill>
      </parent>
    `)
    expect(parseDirectFillColor(el)).toBe("#FF0000")
  })

  it("returns null when no solidFill exists", () => {
    const el = xml("<parent />")
    expect(parseDirectFillColor(el)).toBeNull()
  })

  it("defaults to #000000 when val is missing", () => {
    const el = xml(`
      <parent xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <a:solidFill><a:srgbClr /></a:solidFill>
      </parent>
    `)
    expect(parseDirectFillColor(el)).toBe("#000000")
  })
})

describe("hasNoFill", () => {
  it("returns true when a:noFill is present", () => {
    const el = xml(`
      <parent xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <a:noFill />
      </parent>
    `)
    expect(hasNoFill(el)).toBe(true)
  })

  it("returns false when a:noFill is absent", () => {
    const el = xml("<parent />")
    expect(hasNoFill(el)).toBe(false)
  })
})

describe("parseShapeStyle", () => {
  it("parses fill color from spPr", () => {
    const el = xml(`
      <sp xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
          xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <p:spPr>
          <a:solidFill><a:srgbClr val="00FF00" /></a:solidFill>
        </p:spPr>
      </sp>
    `)
    const style = parseShapeStyle(el)
    expect(style.fillColor).toBe("#00FF00")
    expect(style.borderColor).toBeNull()
    expect(style.borderWidth).toBe(0)
  })

  it("parses border from a:ln", () => {
    const el = xml(`
      <sp xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
          xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <p:spPr>
          <a:noFill />
          <a:ln w="25400">
            <a:solidFill><a:srgbClr val="0000FF" /></a:solidFill>
          </a:ln>
        </p:spPr>
      </sp>
    `)
    const style = parseShapeStyle(el)
    expect(style.fillColor).toBeNull()
    expect(style.borderColor).toBe("#0000FF")
    expect(style.borderWidth).toBe(2) // 25400 / 12700 = 2
  })

  it("returns empty style when no spPr", () => {
    const el = xml("<sp />")
    const style = parseShapeStyle(el)
    expect(style).toEqual({ fillColor: null, borderColor: null, borderWidth: 0 })
  })
})

describe("parseTextRun", () => {
  it("parses text content", () => {
    const el = xml(`
      <a:r xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <a:t>Hello</a:t>
      </a:r>
    `)
    const run = parseTextRun(el)
    expect(run.text).toBe("Hello")
    expect(run.bold).toBe(false)
    expect(run.italic).toBe(false)
  })

  it("parses bold and italic", () => {
    const el = xml(`
      <a:r xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <a:rPr b="1" i="1" />
        <a:t>styled</a:t>
      </a:r>
    `)
    const run = parseTextRun(el)
    expect(run.bold).toBe(true)
    expect(run.italic).toBe(true)
  })

  it("parses font size (hundredths of point to pt)", () => {
    const el = xml(`
      <a:r xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <a:rPr sz="2400" />
        <a:t>big</a:t>
      </a:r>
    `)
    const run = parseTextRun(el)
    expect(run.fontSize).toBe(24)
  })

  it("returns empty text when a:t is missing", () => {
    const el = xml(`
      <a:r xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
      </a:r>
    `)
    const run = parseTextRun(el)
    expect(run.text).toBe("")
  })
})

describe("parseParagraph", () => {
  it("parses alignment from pPr", () => {
    const el = xml(`
      <a:p xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <a:pPr algn="ctr" />
        <a:r><a:t>centered</a:t></a:r>
      </a:p>
    `)
    const para = parseParagraph(el)
    expect(para.align).toBe("center")
    expect(para.runs).toHaveLength(1)
    expect(para.runs[0].text).toBe("centered")
  })

  it("handles right alignment", () => {
    const el = xml(`
      <a:p xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <a:pPr algn="r" />
      </a:p>
    `)
    expect(parseParagraph(el).align).toBe("right")
  })

  it("handles line breaks as a:br", () => {
    const el = xml(`
      <a:p xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <a:r><a:t>before</a:t></a:r>
        <a:br />
        <a:r><a:t>after</a:t></a:r>
      </a:p>
    `)
    const para = parseParagraph(el)
    expect(para.runs).toHaveLength(3)
    expect(para.runs[1].text).toBe("\n")
  })

  it("returns null align when no pPr", () => {
    const el = xml(`
      <a:p xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <a:r><a:t>text</a:t></a:r>
      </a:p>
    `)
    expect(parseParagraph(el).align).toBeNull()
  })
})

describe("parseParagraphs", () => {
  it("parses multiple paragraphs from txBody", () => {
    const el = xml(`
      <p:txBody xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
                xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <a:p><a:r><a:t>First</a:t></a:r></a:p>
        <a:p><a:r><a:t>Second</a:t></a:r></a:p>
      </p:txBody>
    `)
    const paras = parseParagraphs(el)
    expect(paras).toHaveLength(2)
    expect(paras[0].runs[0].text).toBe("First")
    expect(paras[1].runs[0].text).toBe("Second")
  })
})

describe("escapeHtml", () => {
  it("escapes &, <, >", () => {
    expect(escapeHtml("a & b < c > d")).toBe("a &amp; b &lt; c &gt; d")
  })

  it("returns empty string unchanged", () => {
    expect(escapeHtml("")).toBe("")
  })

  it("leaves safe text unchanged", () => {
    expect(escapeHtml("hello world")).toBe("hello world")
  })
})
