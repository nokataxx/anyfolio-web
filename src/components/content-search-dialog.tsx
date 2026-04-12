import { useCallback, useEffect, useRef, useState } from "react"
import { FileSpreadsheet, FileText, Search, File } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useContentSearch, type SearchResult } from "@/hooks/use-content-search"
import { cn } from "@/lib/utils"
import type { FileRecord, Folder } from "@/lib/types"

type ContentSearchDialogProps = {
  allFiles: FileRecord[]
  folders: Folder[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectFile: (file: FileRecord, query: string, pdfPage?: number) => void
}

function fileIcon(type: FileRecord["type"]) {
  switch (type) {
    case "md":
    case "txt":
      return <FileText className="size-4 shrink-0 text-muted-foreground" />
    case "xlsx":
      return <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" />
    default:
      return <File className="size-4 shrink-0 text-muted-foreground" />
  }
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  const lower = text.toLowerCase()
  const qLower = query.toLowerCase()
  const parts: { text: string; highlight: boolean }[] = []
  let lastIndex = 0

  let idx = lower.indexOf(qLower)
  while (idx !== -1) {
    if (idx > lastIndex) parts.push({ text: text.slice(lastIndex, idx), highlight: false })
    parts.push({ text: text.slice(idx, idx + query.length), highlight: true })
    lastIndex = idx + query.length
    idx = lower.indexOf(qLower, lastIndex)
  }
  if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex), highlight: false })

  return (
    <>
      {parts.map((part, i) =>
        part.highlight ? (
          <mark key={i} className="bg-yellow-200 text-foreground dark:bg-yellow-800">{part.text}</mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  )
}

function ResultItem({
  result,
  isSelected,
  onClick,
  onMouseEnter,
}: {
  result: SearchResult
  isSelected: boolean
  onClick: () => void
  onMouseEnter: () => void
}) {
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isSelected) ref.current?.scrollIntoView({ block: "nearest" })
  }, [isSelected])

  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left transition-colors",
        isSelected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
      )}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      <div className="flex items-center gap-2">
        {fileIcon(result.file.type)}
        <span className="truncate text-sm font-medium">{result.file.name}</span>
        {result.folderName && (
          <span className="truncate text-xs text-muted-foreground">— {result.folderName}</span>
        )}
      </div>
      <p className="truncate pl-6 text-xs text-muted-foreground">
        <HighlightedText text={result.matchContext} query={result.query} />
      </p>
    </button>
  )
}

export function ContentSearchDialog({
  allFiles,
  folders,
  open,
  onOpenChange,
  onSelectFile,
}: ContentSearchDialogProps) {
  const { query, setQuery, results, isExtracting, extractionProgress } = useContentSearch(
    allFiles,
    folders,
    open,
  )
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [results])

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      // Small delay to ensure dialog is rendered
      const timer = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(timer)
    }
  }, [open])

  const handleSelect = useCallback(
    (result: SearchResult) => {
      onSelectFile(result.file, result.query, result.pdfPage)
    },
    [onSelectFile],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.nativeEvent.isComposing) return
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
          break
        case "ArrowUp":
          e.preventDefault()
          setSelectedIndex((i) => Math.max(i - 1, 0))
          break
        case "Enter":
          e.preventDefault()
          if (results[selectedIndex]) handleSelect(results[selectedIndex])
          break
      }
    },
    [results, selectedIndex, handleSelect],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(500px,80vh)] flex-col gap-0 p-0 sm:max-w-lg" showCloseButton={false}>
        <DialogTitle className="sr-only">Search file contents</DialogTitle>
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search file contents…"
            className="h-10 border-0 shadow-none focus-visible:ring-0"
          />
        </div>
        {isExtracting && (
          <div className="border-b px-3 py-1.5 text-xs text-muted-foreground">
            Indexing files… ({extractionProgress.done}/{extractionProgress.total})
          </div>
        )}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {!query.trim() ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                Type to search file contents
              </p>
            ) : results.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                {isExtracting ? "Indexing files…" : "No matches found"}
              </p>
            ) : (
              results.map((result, i) => (
                <ResultItem
                  key={`${result.file.id}-${result.matchIndex}`}
                  result={result}
                  isSelected={i === selectedIndex}
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setSelectedIndex(i)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
