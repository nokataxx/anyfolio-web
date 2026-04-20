import { describe, it, expect, vi } from "vitest"
import { convertDocxToMd } from "../docx-to-md"

const mammothMock = vi.hoisted(() => ({
  convertToHtml: vi.fn(),
}))

vi.mock("mammoth", () => ({
  default: mammothMock,
}))

describe("convertDocxToMd", () => {
  it("returns a File with .md extension", async () => {
    mammothMock.convertToHtml.mockResolvedValue({ value: "<p>hello</p>", messages: [] })
    const input = new File(["dummy"], "document.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })

    const result = await convertDocxToMd(input)

    expect(result).toBeInstanceOf(File)
    expect(result.name).toBe("document.md")
    expect(result.type).toBe("text/markdown")
  })

  it("converts headings to ATX-style Markdown", async () => {
    mammothMock.convertToHtml.mockResolvedValue({
      value: "<h1>Title</h1><h2>Subtitle</h2>",
      messages: [],
    })
    const input = new File(["dummy"], "test.docx")

    const result = await convertDocxToMd(input)
    const text = await result.text()

    expect(text).toContain("# Title")
    expect(text).toContain("## Subtitle")
  })

  it("converts bold and italic to Markdown", async () => {
    mammothMock.convertToHtml.mockResolvedValue({
      value: "<p><strong>bold</strong> and <em>italic</em></p>",
      messages: [],
    })
    const input = new File(["dummy"], "test.docx")

    const result = await convertDocxToMd(input)
    const text = await result.text()

    expect(text).toContain("**bold**")
    expect(text).toContain("*italic*")
  })

  it("converts unordered lists with dash marker", async () => {
    mammothMock.convertToHtml.mockResolvedValue({
      value: "<ul><li>one</li><li>two</li></ul>",
      messages: [],
    })
    const input = new File(["dummy"], "test.docx")

    const result = await convertDocxToMd(input)
    const text = await result.text()

    expect(text).toContain("-   one")
    expect(text).toContain("-   two")
  })

  it("converts links to Markdown syntax", async () => {
    mammothMock.convertToHtml.mockResolvedValue({
      value: '<p><a href="https://example.com">example</a></p>',
      messages: [],
    })
    const input = new File(["dummy"], "test.docx")

    const result = await convertDocxToMd(input)
    const text = await result.text()

    expect(text).toContain("[example](https://example.com)")
  })

  it("replaces both .docx and .doc extensions with .md", async () => {
    mammothMock.convertToHtml.mockResolvedValue({ value: "<p>x</p>", messages: [] })

    const docx = await convertDocxToMd(new File(["x"], "file.docx"))
    expect(docx.name).toBe("file.md")

    const doc = await convertDocxToMd(new File(["x"], "legacy.doc"))
    expect(doc.name).toBe("legacy.md")
  })
})
