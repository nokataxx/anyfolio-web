import { useEffect, useMemo, useRef, useState } from "react"
import { extractText, isTextCached, getPdfPageTexts } from "@/lib/text-extraction"
import type { FileRecord, Folder } from "@/lib/types"

export type SearchResult = {
  file: FileRecord
  folderName: string | null
  matchContext: string
  matchIndex: number
  query: string
  pdfPage?: number // 1-based page number for PDF matches
}

type ContentSearchState = {
  query: string
  setQuery: (q: string) => void
  results: SearchResult[]
  isExtracting: boolean
  extractionProgress: { done: number; total: number }
}

const SEARCHABLE_TYPES = new Set(["md", "txt", "pdf", "xlsx"])
const MAX_CONCURRENT = 3
const DEBOUNCE_MS = 300
const MAX_RESULTS = 50
const CONTEXT_CHARS = 30

function buildSnippet(text: string, index: number, queryLen: number): string {
  const start = Math.max(0, index - CONTEXT_CHARS)
  const end = Math.min(text.length, index + queryLen + CONTEXT_CHARS)
  let snippet = text.slice(start, end).replace(/\n/g, " ")
  if (start > 0) snippet = "…" + snippet
  if (end < text.length) snippet = snippet + "…"
  return snippet
}

export function useContentSearch(
  allFiles: FileRecord[],
  folders: Folder[],
  enabled: boolean,
): ContentSearchState {
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [extractedTexts, setExtractedTexts] = useState<Map<string, string>>(new Map())
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [isExtracting, setIsExtracting] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
  const abortRef = useRef(false)

  const folderMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const f of folders) m.set(f.id, f.name)
    return m
  }, [folders])

  const searchableFiles = useMemo(
    () => allFiles.filter((f) => SEARCHABLE_TYPES.has(f.type)),
    [allFiles],
  )

  // Extract texts when dialog opens
  useEffect(() => {
    if (!enabled) return
    abortRef.current = false

    const toExtract = searchableFiles.filter((f) => !isTextCached(f.storage_path))
    const alreadyCached = searchableFiles.filter((f) => isTextCached(f.storage_path))

    // Populate already-cached texts
    if (alreadyCached.length > 0) {
      const cached = new Map<string, string>()
      for (const f of alreadyCached) {
        // extractText returns from cache synchronously in terms of the Map,
        // but the function is async, so we call it
        extractText(f).then((text) => {
          cached.set(f.storage_path, text)
        })
      }
      // Kick off a microtask to collect them
      Promise.all(alreadyCached.map((f) => extractText(f).then((text) => [f.storage_path, text] as const)))
        .then((entries) => {
          if (abortRef.current) return
          setExtractedTexts((prev) => {
            const next = new Map(prev)
            for (const [path, text] of entries) next.set(path, text)
            return next
          })
        })
    }

    if (toExtract.length === 0) {
      setProgress({ done: searchableFiles.length, total: searchableFiles.length })
      setIsExtracting(false)
      return
    }

    setIsExtracting(true)
    setProgress({ done: alreadyCached.length, total: searchableFiles.length })

    let doneCount = alreadyCached.length

    async function run() {
      const queue = [...toExtract]
      const workers = Array.from({ length: MAX_CONCURRENT }, async () => {
        while (queue.length > 0 && !abortRef.current) {
          const file = queue.shift()!
          try {
            const text = await extractText(file)
            if (abortRef.current) return
            doneCount++
            setProgress({ done: doneCount, total: searchableFiles.length })
            setExtractedTexts((prev) => {
              const next = new Map(prev)
              next.set(file.storage_path, text)
              return next
            })
          } catch {
            doneCount++
            setProgress({ done: doneCount, total: searchableFiles.length })
          }
        }
      })
      await Promise.all(workers)
      if (!abortRef.current) setIsExtracting(false)
    }

    run()

    return () => {
      abortRef.current = true
    }
  }, [enabled, searchableFiles])

  // Debounce query
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  // Reset query when dialog closes
  useEffect(() => {
    if (!enabled) {
      setQuery("")
      setDebouncedQuery("")
    }
  }, [enabled])

  // Compute results
  const results = useMemo(() => {
    if (!debouncedQuery.trim()) return []
    const q = debouncedQuery.toLowerCase()
    const matches: SearchResult[] = []

    for (const file of searchableFiles) {
      if (matches.length >= MAX_RESULTS) break
      const text = extractedTexts.get(file.storage_path)
      if (!text) continue
      const lower = text.toLowerCase()
      const idx = lower.indexOf(q)
      if (idx === -1) continue

      // For PDFs, determine the 1-based page number from per-page texts
      let pdfPage: number | undefined
      if (file.type === "pdf") {
        const pageTexts = getPdfPageTexts(file.storage_path)
        if (pageTexts) {
          for (let i = 0; i < pageTexts.length; i++) {
            if (pageTexts[i].toLowerCase().includes(q)) {
              pdfPage = i + 1
              break
            }
          }
        }
      }

      matches.push({
        file,
        folderName: file.folder_id ? (folderMap.get(file.folder_id) ?? null) : null,
        matchContext: buildSnippet(text, idx, debouncedQuery.length),
        matchIndex: idx,
        query: debouncedQuery,
        pdfPage,
      })
    }

    return matches
  }, [debouncedQuery, extractedTexts, searchableFiles, folderMap])

  return { query, setQuery, results, isExtracting, extractionProgress: progress }
}
