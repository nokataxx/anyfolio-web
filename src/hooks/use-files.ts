import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { FileRecord } from "@/lib/types"

async function loadFiles(folderId: string | null) {
  let query = supabase
    .from("anyfolio_files")
    .select("*")
    .order("name")
  if (folderId) {
    query = query.eq("folder_id", folderId)
  } else {
    query = query.is("folder_id", null)
  }
  const { data, error } = await query
  return { data, error }
}

export function useFiles(folderId: string | null) {
  const [files, setFiles] = useState<FileRecord[]>([])
  const [loading, setLoading] = useState(false)

  const fetchFiles = useCallback(async () => {
    setLoading(true)
    const { data, error } = await loadFiles(folderId)
    if (!error && data) {
      setFiles(data)
    }
    setLoading(false)
  }, [folderId])

  useEffect(() => {
    let cancelled = false
    loadFiles(folderId).then(({ data, error }) => {
      if (cancelled) return
      if (!error && data) setFiles(data)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [folderId])

  const uploadFile = async (file: File, folderId: string | null) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    const ext = file.name.split(".").pop()?.toLowerCase()
    const imageExts = ["png", "jpg", "jpeg", "gif", "webp", "svg"]
    const isDocx = ext === "docx" || ext === "doc"
    const fileType = ext === "xls" ? "xlsx" : ext === "ppt" ? "pptx" : isDocx ? "docx" : imageExts.includes(ext ?? "") ? "image" : ext
    if (fileType !== "md" && fileType !== "pdf" && fileType !== "xlsx" && fileType !== "pptx" && fileType !== "image" && fileType !== "txt" && fileType !== "docx") {
      return { error: "Only .md, .pdf, .xlsx/.xls, .pptx/.ppt, .docx/.doc, .txt, and image files are supported" }
    }

    let uploadTarget = file
    let finalType: "md" | "pdf" | "xlsx" | "pptx" | "image" = fileType === "txt" || fileType === "docx"
      ? "md"
      : (fileType as "md" | "pdf" | "xlsx" | "pptx" | "image")
    let finalExt = ext
    if (fileType === "docx") {
      try {
        if (ext === "docx") {
          const { convertDocxToMd } = await import("@/lib/docx-to-md")
          uploadTarget = await convertDocxToMd(file)
        } else {
          const { convertDocxToTxt } = await import("@/lib/docx-to-txt")
          const txtFile = await convertDocxToTxt(file)
          const mdName = txtFile.name.replace(/\.txt$/i, ".md")
          uploadTarget = new File([txtFile], mdName, { type: "text/markdown" })
        }
        finalType = "md"
        finalExt = "md"
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error"
        return { error: `Failed to convert Word document: ${msg}` }
      }
    }
    if (fileType === "pptx") {
      try {
        const { convertPptxToPdf } = await import("@/lib/pptx-to-pdf")
        uploadTarget = await convertPptxToPdf(file)
        finalType = "pdf"
        finalExt = "pdf"
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error"
        return { error: `Failed to convert PowerPoint to PDF: ${msg}` }
      }
    }
    if (fileType === "txt") {
      const mdName = file.name.replace(/\.txt$/i, ".md")
      uploadTarget = new File([file], mdName, { type: "text/markdown" })
      finalType = "md"
      finalExt = "md"
    }

    const storagePath = folderId
      ? `${user.id}/${folderId}/${crypto.randomUUID()}.${finalExt}`
      : `${user.id}/root/${crypto.randomUUID()}.${finalExt}`

    const { error: uploadError } = await supabase.storage
      .from("anyfolio-files")
      .upload(storagePath, uploadTarget)

    if (uploadError) return { error: uploadError.message }

    const displayName = fileType === "pptx"
      ? file.name.replace(/\.pptx?$/i, ".pdf")
      : ext === "docx" || ext === "doc"
        ? file.name.replace(/\.docx?$/i, ".md")
        : ext === "txt"
          ? file.name.replace(/\.txt$/i, ".md")
          : file.name

    // Extract text content for fulltext search
    let contentText: string | null = null
    let contentPages: string[] | null = null
    try {
      const { extractTextFromBlob } = await import("@/lib/text-extraction")
      const extraction = await extractTextFromBlob(uploadTarget, finalType)
      if (extraction.text) contentText = extraction.text
      if (extraction.pages) contentPages = extraction.pages
    } catch {
      // Non-fatal: file is uploaded but search won't find its content
    }

    const { error: dbError } = await supabase.from("anyfolio_files").insert({
      user_id: user.id,
      folder_id: folderId ?? null,
      name: displayName,
      type: finalType,
      storage_path: storagePath,
      content_text: contentText,
      content_pages: contentPages,
    })

    if (dbError) return { error: dbError.message }

    await fetchFiles()
    return { error: null }
  }

  const deleteFile = async (fileRecord: FileRecord) => {
    const { error: storageError } = await supabase.storage
      .from("anyfolio-files")
      .remove([fileRecord.storage_path])

    if (storageError) return { error: storageError.message }

    const { error: dbError } = await supabase
      .from("anyfolio_files")
      .delete()
      .eq("id", fileRecord.id)

    if (dbError) return { error: dbError.message }

    await fetchFiles()
    return { error: null }
  }

  const renameFile = async (fileRecord: FileRecord, newName: string) => {
    const trimmed = newName.trim()
    if (!trimmed) return { error: "Name cannot be empty" }

    const { error: dbError } = await supabase
      .from("anyfolio_files")
      .update({ name: trimmed })
      .eq("id", fileRecord.id)

    if (dbError) return { error: dbError.message }

    await fetchFiles()
    return { error: null }
  }

  const moveFile = async (fileId: string, newFolderId: string | null) => {
    const { error: dbError } = await supabase
      .from("anyfolio_files")
      .update({ folder_id: newFolderId })
      .eq("id", fileId)

    if (dbError) return { error: dbError.message }

    await fetchFiles()
    return { error: null }
  }

  const updateFileContent = async (
    fileRecord: FileRecord,
    content: string,
    options: { expectedUpdatedAt: string; overwrite?: boolean },
  ): Promise<
    | { error: null; updatedAt: string }
    | { error: string; conflict?: boolean; latestUpdatedAt?: string }
  > => {
    if (!options.overwrite) {
      const { data: current, error: fetchError } = await supabase
        .from("anyfolio_files")
        .select("updated_at")
        .eq("id", fileRecord.id)
        .single()
      if (fetchError) return { error: fetchError.message }
      if (current.updated_at !== options.expectedUpdatedAt) {
        return {
          error: "CONFLICT",
          conflict: true,
          latestUpdatedAt: current.updated_at,
        }
      }
    }

    const blob = new Blob([content], { type: "text/markdown" })
    const { error: uploadError } = await supabase.storage
      .from("anyfolio-files")
      .upload(fileRecord.storage_path, blob, {
        upsert: true,
        contentType: "text/markdown",
      })
    if (uploadError) return { error: uploadError.message }

    let contentText: string | null = null
    try {
      const { extractTextFromBlob } = await import("@/lib/text-extraction")
      const extraction = await extractTextFromBlob(blob, fileRecord.type)
      if (extraction.text) contentText = extraction.text
    } catch {
      // Non-fatal: storage is updated but search index may be stale
    }

    const { data: updated, error: dbError } = await supabase
      .from("anyfolio_files")
      .update({ content_text: contentText, updated_at: new Date().toISOString() })
      .eq("id", fileRecord.id)
      .select("updated_at")
      .single()
    if (dbError) return { error: dbError.message }

    await fetchFiles()
    return { error: null, updatedAt: (updated as { updated_at: string }).updated_at }
  }

  return {
    files,
    loading,
    uploadFile,
    deleteFile,
    renameFile,
    moveFile,
    updateFileContent,
    refetch: fetchFiles,
  }
}
