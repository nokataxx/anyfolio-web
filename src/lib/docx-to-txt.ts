import mammoth from "mammoth"

export async function convertDocxToTxt(file: File): Promise<File> {
  const buffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer: buffer })
  const txtName = file.name.replace(/\.docx?$/i, ".txt")
  return new File([result.value], txtName, { type: "text/plain" })
}
