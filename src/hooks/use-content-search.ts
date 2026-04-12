import { useEffect, useMemo, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { backfillContentText } from "@/lib/backfill-content-text"
import type { FileRecord, Folder } from "@/lib/types"

export type SearchResult = {
  file: FileRecord
  folderName: string | null
  matchContext: string
  matchIndex: number
  query: string
  pdfPage?: number
}

type ContentSearchState = {
  query: string
  setQuery: (q: string) => void
  results: SearchResult[]
  isSearching: boolean
}

const DEBOUNCE_MS = 300
const MAX_RESULTS = 50

export function useContentSearch(
  allFiles: FileRecord[],
  folders: Folder[],
  enabled: boolean,
): ContentSearchState {
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
  const abortRef = useRef(0)

  const folderMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const f of folders) m.set(f.id, f.name)
    return m
  }, [folders])

  // Backfill content_text for existing files (runs once per session)
  useEffect(() => {
    if (enabled && allFiles.length > 0) {
      backfillContentText(allFiles)
    }
  }, [enabled, allFiles])

  // Debounce query
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  // Reset when dialog closes
  useEffect(() => {
    if (!enabled) {
      setQuery("")
      setDebouncedQuery("")
      setResults([])
    }
  }, [enabled])

  // Execute server-side search via RPC
  useEffect(() => {
    if (!enabled || !debouncedQuery.trim()) {
      setResults([])
      setIsSearching(false)
      return
    }

    const requestId = ++abortRef.current
    setIsSearching(true)

    supabase
      .rpc("search_file_contents", {
        search_query: debouncedQuery,
        max_results: MAX_RESULTS,
      })
      .then(({ data, error }) => {
        if (abortRef.current !== requestId) return
        setIsSearching(false)

        if (error || !data) {
          setResults([])
          return
        }

        const mapped: SearchResult[] = data.map(
          (row: {
            file_id: string
            file_user_id: string
            file_folder_id: string | null
            file_name: string
            file_type: string
            file_storage_path: string
            file_created_at: string
            file_updated_at: string
            match_context: string
            match_index: number
            pdf_page: number | null
          }) => {
            const file: FileRecord = {
              id: row.file_id,
              user_id: row.file_user_id,
              folder_id: row.file_folder_id,
              name: row.file_name,
              type: row.file_type as FileRecord["type"],
              storage_path: row.file_storage_path,
              created_at: row.file_created_at,
              updated_at: row.file_updated_at,
            }
            return {
              file,
              folderName: file.folder_id ? (folderMap.get(file.folder_id) ?? null) : null,
              matchContext: row.match_context ?? "",
              matchIndex: row.match_index,
              query: debouncedQuery,
              pdfPage: row.pdf_page ?? undefined,
            }
          },
        )

        setResults(mapped)
      })
  }, [enabled, debouncedQuery, folderMap])

  return { query, setQuery, results, isSearching }
}
