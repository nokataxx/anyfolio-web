import mammoth from "mammoth"
import TurndownService from "turndown"

export async function convertDocxToMd(file: File): Promise<File> {
  const buffer = await file.arrayBuffer()
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buffer })

  const turndown = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
  })

  const markdown = turndown.turndown(html)
  const mdName = file.name.replace(/\.docx?$/i, ".md")
  return new File([markdown], mdName, { type: "text/markdown" })
}
