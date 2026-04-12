import { describe, it, expect, beforeEach, vi } from "vitest"

// Mock react-pdf before importing the module under test
vi.mock("react-pdf", () => ({
  pdfjs: {
    getDocument: vi.fn(),
  },
}))

vi.mock("encoding-japanese", () => ({
  default: {
    detect: vi.fn().mockReturnValue("UTF8"),
    convert: vi.fn().mockImplementation((bytes: Uint8Array) => Array.from(bytes)),
    codeToString: vi.fn().mockImplementation((arr: number[]) =>
      new TextDecoder().decode(new Uint8Array(arr)),
    ),
  },
}))

vi.mock("@/lib/supabase", () => ({
  supabase: {
    storage: {
      from: vi.fn(),
    },
  },
}))

import {
  clearTextCache,
  isTextCached,
  getPdfPageTexts,
  extractTextFromBlob,
} from "../text-extraction"

describe("text-extraction", () => {
  beforeEach(() => {
    clearTextCache()
  })

  describe("clearTextCache", () => {
    it("clears the cache without errors", () => {
      expect(() => clearTextCache()).not.toThrow()
    })
  })

  describe("isTextCached / getPdfPageTexts", () => {
    it("returns false for uncached paths", () => {
      expect(isTextCached("some/path.md")).toBe(false)
    })

    it("returns undefined for uncached PDF page texts", () => {
      expect(getPdfPageTexts("some/path.pdf")).toBeUndefined()
    })
  })

  describe("extractTextFromBlob", () => {
    it("extracts text from md files", async () => {
      const blob = new Blob(["# Hello World"], { type: "text/markdown" })
      const result = await extractTextFromBlob(blob, "md")
      expect(result.text).toContain("Hello World")
    })

    it("extracts text from txt files", async () => {
      const blob = new Blob(["plain text content"], { type: "text/plain" })
      const result = await extractTextFromBlob(blob, "txt")
      expect(result.text).toContain("plain text content")
    })

    it("returns empty string for unsupported file types", async () => {
      const blob = new Blob(["data"])
      const result = await extractTextFromBlob(blob, "unknown")
      expect(result.text).toBe("")
    })
  })
})
