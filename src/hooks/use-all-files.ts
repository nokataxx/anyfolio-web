import { useCallback, useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { FileRecord } from "@/lib/types"

async function loadAllFiles() {
  const { data, error } = await supabase
    .from("anyfolio_files")
    .select("*")
    .order("name")
  return { data, error }
}

export function useAllFiles() {
  const [allFiles, setAllFiles] = useState<FileRecord[]>([])
  const [loading, setLoading] = useState(true)
  const mounted = useRef(false)

  const fetchAllFiles = useCallback(async () => {
    const { data, error } = await loadAllFiles()
    if (!error && data) {
      setAllFiles(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      loadAllFiles().then(({ data, error }) => {
        if (!error && data) setAllFiles(data)
        setLoading(false)
      })
    }
  }, [])

  return { allFiles, loading, refetch: fetchAllFiles }
}
