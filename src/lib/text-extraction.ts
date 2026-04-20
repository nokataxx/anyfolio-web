import { pdfjs } from "react-pdf"
import Encoding from "encoding-japanese"
import { supabase } from "@/lib/supabase"
import type { FileRecord } from "@/lib/types"

const textCache = new Map<string, string>()
const pdfPageTextsCache = new Map<string, string[]>()

export function clearTextCache(): void {
  textCache.clear()
  pdfPageTextsCache.clear()
}

export function isTextCached(storagePath: string): boolean {
  return textCache.has(storagePath)
}

/** Returns per-page text array for PDFs (undefined for non-PDF files) */
export function getPdfPageTexts(storagePath: string): string[] | undefined {
  return pdfPageTextsCache.get(storagePath)
}

export type ExtractionResult = {
  text: string
  pages?: string[] // per-page texts for PDFs
}

/** Extract text from a Blob (for upload-time extraction, no download needed) */
export async function extractTextFromBlob(
  blob: Blob,
  fileType: string,
): Promise<ExtractionResult> {
  switch (fileType) {
    case "md": {
      const buffer = await blob.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      const detected = Encoding.detect(bytes)
      const unicodeArray = Encoding.convert(bytes, {
        to: "UNICODE",
        from: detected || "AUTO",
      })
      return { text: Encoding.codeToString(unicodeArray) }
    }
    case "pdf": {
      const buffer = await blob.arrayBuffer()
      const pdf = await pdfjs.getDocument({ data: buffer }).promise
      const pages: string[] = []
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "))
      }
      return { text: pages.join("\n"), pages }
    }
    case "xlsx": {
      const { read, utils } = await import("xlsx")
      const buffer = await blob.arrayBuffer()
      const wb = read(buffer, { type: "array" })
      return { text: wb.SheetNames.map((name) => utils.sheet_to_csv(wb.Sheets[name])).join("\n") }
    }
    default:
      return { text: "" }
  }
}

export async function extractText(file: FileRecord): Promise<string> {
  const cached = textCache.get(file.storage_path)
  if (cached !== undefined) return cached

  const { data, error } = await supabase.storage
    .from("anyfolio-files")
    .download(file.storage_path)

  if (error || !data) throw new Error(error?.message ?? "Download failed")

  let text: string

  switch (file.type) {
    case "md": {
      const buffer = await data.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      const detected = Encoding.detect(bytes)
      const unicodeArray = Encoding.convert(bytes, {
        to: "UNICODE",
        from: detected || "AUTO",
      })
      text = Encoding.codeToString(unicodeArray)
      break
    }
    case "pdf": {
      const buffer = await data.arrayBuffer()
      const pdf = await pdfjs.getDocument({ data: buffer }).promise
      const pages: string[] = []
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "))
      }
      pdfPageTextsCache.set(file.storage_path, pages)
      text = pages.join("\n")
      break
    }
    case "xlsx": {
      const { read, utils } = await import("xlsx")
      const buffer = await data.arrayBuffer()
      const wb = read(buffer, { type: "array" })
      text = wb.SheetNames.map((name) => utils.sheet_to_csv(wb.Sheets[name])).join("\n")
      break
    }
    default:
      text = ""
  }

  textCache.set(file.storage_path, text)
  return text
}
