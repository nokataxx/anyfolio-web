import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
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
    const fileType = ext === "xls" ? "xlsx" : ext
    if (fileType !== "md" && fileType !== "pdf" && fileType !== "xlsx") {
      return { error: "Only .md, .pdf, and .xlsx/.xls files are supported" }
    }

    const storagePath = `${user.id}/${folderId}/${crypto.randomUUID()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from("anyfolio-files")
      .upload(storagePath, file)

    if (uploadError) return { error: uploadError.message }

    const { error: dbError } = await supabase.from("anyfolio_files").insert({
      user_id: user.id,
      folder_id: folderId,
      name: file.name,
      type: fileType as "md" | "pdf" | "xlsx",
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
