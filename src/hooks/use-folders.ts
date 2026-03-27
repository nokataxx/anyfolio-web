import { useCallback, useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { Folder } from "@/lib/types"

async function loadFolders() {
  const { data, error } = await supabase
    .from("anyfolio_folders")
    .select("*")
    .order("name")
  return { data, error }
}

export function useFolders() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(true)
  const mounted = useRef(false)

  const fetchFolders = useCallback(async () => {
    const { data, error } = await loadFolders()
    if (!error && data) {
      setFolders(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      loadFolders().then(({ data, error }) => {
        if (!error && data) setFolders(data)
        setLoading(false)
      })
    }
  }, [])

  const createFolder = async (name: string, parentId: string | null) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from("anyfolio_folders").insert({
      name,
      parent_id: parentId,
      user_id: user.id,
    })

    if (!error) {
      await fetchFolders()
    }
    return { error: error?.message ?? null }
  }

  const deleteFolder = async (id: string) => {
    const { error } = await supabase.from("anyfolio_folders").delete().eq("id", id)
    if (!error) {
      await fetchFolders()
    }
    return { error: error?.message ?? null }
  }

  const renameFolder = async (id: string, newName: string) => {
    const trimmed = newName.trim()
    if (!trimmed) return { error: "Name cannot be empty" }

    const { error } = await supabase
      .from("anyfolio_folders")
      .update({ name: trimmed })
      .eq("id", id)

    if (!error) {
      await fetchFolders()
    }
    return { error: error?.message ?? null }
  }

  return { folders, loading, createFolder, deleteFolder, renameFolder, refetch: fetchFolders }
}
