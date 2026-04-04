import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { convertPptxToPdf } from "@/lib/pptx-to-pdf"
import type { FileRecord } from "@/lib/types"

async function loadFiles(folderId: string) {
  const { data, error } = await supabase
    .from("anyfolio_files")
    .select("*")
    .eq("folder_id", folderId)
    .order("name")
  return { data, error }
}

export function useFiles(folderId: string | null) {
  const [files, setFiles] = useState<FileRecord[]>([])
  const [loading, setLoading] = useState(false)

  const fetchFiles = useCallback(async () => {
    if (!folderId) {
      setFiles([])
      return
    }
    setLoading(true)
    const { data, error } = await loadFiles(folderId)
    if (!error && data) {
      setFiles(data)
    }
    setLoading(false)
  }, [folderId])

  useEffect(() => {
    if (!folderId) return
    let cancelled = false
    loadFiles(folderId).then(({ data, error }) => {
      if (cancelled) return
      if (!error && data) setFiles(data)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [folderId])

  const uploadFile = async (file: File, folderId: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    const ext = file.name.split(".").pop()?.toLowerCase()
    const imageExts = ["png", "jpg", "jpeg", "gif", "webp", "svg"]
    const fileType = ext === "xls" ? "xlsx" : ext === "ppt" ? "pptx" : imageExts.includes(ext ?? "") ? "image" : ext
    if (fileType !== "md" && fileType !== "pdf" && fileType !== "xlsx" && fileType !== "pptx" && fileType !== "image") {
      return { error: "Only .md, .pdf, .xlsx/.xls, .pptx/.ppt, and image files are supported" }
    }

    // Convert PPTX/PPT to PDF before uploading
    let uploadTarget = file
    let finalType: "md" | "pdf" | "xlsx" | "pptx" | "image" = fileType as "md" | "pdf" | "xlsx" | "pptx" | "image"
    let finalExt = ext
    if (fileType === "pptx") {
      try {
        uploadTarget = await convertPptxToPdf(file)
        finalType = "pdf"
        finalExt = "pdf"
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error"
        return { error: `Failed to convert PowerPoint to PDF: ${msg}` }
      }
    }

    const storagePath = `${user.id}/${folderId}/${crypto.randomUUID()}.${finalExt}`

    const { error: uploadError } = await supabase.storage
      .from("anyfolio-files")
      .upload(storagePath, uploadTarget)

    if (uploadError) return { error: uploadError.message }

    const displayName = fileType === "pptx"
      ? file.name.replace(/\.pptx?$/i, ".pdf")
      : file.name

    const { error: dbError } = await supabase.from("anyfolio_files").insert({
      user_id: user.id,
      folder_id: folderId,
      name: displayName,
      type: finalType,
      storage_path: storagePath,
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

  return { files, loading, uploadFile, deleteFile, renameFile, refetch: fetchFiles }
}
