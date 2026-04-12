import { describe, it, expect, vi } from "vitest"
import { convertDocxToTxt } from "../docx-to-txt"

vi.mock("mammoth", () => ({
  default: {
    extractRawText: vi.fn().mockResolvedValue({ value: "extracted text content" }),
  },
}))

describe("convertDocxToTxt", () => {
  it("returns a File with .txt extension", async () => {
    const input = new File(["dummy"], "document.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })

    const result = await convertDocxToTxt(input)

    expect(result).toBeInstanceOf(File)
    expect(result.name).toBe("document.txt")
    expect(result.type).toBe("text/plain")
  })

  it("converts .doc extension to .txt", async () => {
    const input = new File(["dummy"], "legacy.doc", {
      type: "application/msword",
    })

    const result = await convertDocxToTxt(input)
    expect(result.name).toBe("legacy.txt")
  })

  it("preserves the extracted text content", async () => {
    const input = new File(["dummy"], "test.docx")

    const result = await convertDocxToTxt(input)
    const text = await result.text()

    expect(text).toBe("extracted text content")
  })
})
