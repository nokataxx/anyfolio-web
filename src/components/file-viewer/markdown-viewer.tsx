import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeSlug from "rehype-slug"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { MarkdownEditor } from "@/components/file-viewer/markdown-editor"
import remarkWikilink from "@/lib/remark-wikilink"
import { supabase } from "@/lib/supabase"
import type { FileRecord } from "@/lib/types"

type SaveResult =
  | { error: null; updatedAt: string }
  | { error: string; conflict?: boolean; latestUpdatedAt?: string }

export type MarkdownViewerStatus = {
  mode: "view" | "edit"
  isDirty: boolean
  saving: boolean
  ready: boolean
}

export type MarkdownViewerHandle = {
  enterEdit: () => void
  tryExitEdit: () => void
  save: () => void
}

type MarkdownViewerProps = {
  file: FileRecord
  allFiles: FileRecord[]
  onNavigateToFile: (file: FileRecord) => void
  onSaveContent?: (
    file: FileRecord,
    content: string,
    options: { expectedUpdatedAt: string; overwrite?: boolean },
  ) => Promise<SaveResult>
  onStatusChange?: (status: MarkdownViewerStatus) => void
  ref?: Ref<MarkdownViewerHandle>
}

function resolveWikiLink(target: string, allFiles: FileRecord[]): FileRecord | undefined {
  const normalized = target.toLowerCase().trim()
  return allFiles.find((f) => {
    const nameNoExt = f.name.replace(/\.[^.]+$/, "").toLowerCase()
    const nameFull = f.name.toLowerCase()
    return nameNoExt === normalized || nameFull === normalized
  })
}

export function MarkdownViewer({
  file,
  allFiles,
  onNavigateToFile,
  onSaveContent,
  onStatusChange,
  ref,
}: MarkdownViewerProps) {
  const [content, setContent] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<"view" | "edit">("view")
  const [editedContent, setEditedContent] = useState<string>("")
  const [mobilePane, setMobilePane] = useState<"editor" | "preview">("editor")
  const [prevFileId, setPrevFileId] = useState<string>(file.id)
  const [saving, setSaving] = useState(false)
  const [conflictOpen, setConflictOpen] = useState(false)
  const [snapshotUpdatedAt, setSnapshotUpdatedAt] = useState<string>(file.updated_at)

  if (prevFileId !== file.id) {
    setPrevFileId(file.id)
    setMode("view")
    setEditedContent("")
    setMobilePane("editor")
    setConflictOpen(false)
    setSnapshotUpdatedAt(file.updated_at)
  }

  const isDirty = mode === "edit" && editedContent !== content
  const ready = !loading && error === null

  const onStatusChangeRef = useRef(onStatusChange)
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange
  })
  useEffect(() => {
    onStatusChangeRef.current?.({ mode, isDirty, saving, ready })
  }, [mode, isDirty, saving, ready])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase.storage
        .from("anyfolio-files")
        .download(file.storage_path)

      if (cancelled) return

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      const text = await data.text()
      if (!cancelled) {
        setContent(text)
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [file.storage_path])

  const renderLink = useCallback(
    (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
      const { href, children } = props
      if (href?.startsWith("wikilink://")) {
        const target = decodeURIComponent(href.replace("wikilink://", ""))
        const resolved = resolveWikiLink(target, allFiles)
        if (resolved) {
          return (
            <button
              type="button"
              className="text-primary underline decoration-dotted cursor-pointer hover:decoration-solid"
              onClick={() => onNavigateToFile(resolved)}
            >
              {children}
            </button>
          )
        }
        return (
          <span className="text-muted-foreground cursor-not-allowed" title="File not found">
            {children}
          </span>
        )
      }
      return (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      )
    },
    [allFiles, onNavigateToFile]
  )

  const handleEnterEdit = useCallback(() => {
    if (!ready || !onSaveContent) return
    setEditedContent(content)
    setMode("edit")
    setMobilePane("editor")
    setSnapshotUpdatedAt(file.updated_at)
  }, [content, file.updated_at, onSaveContent, ready])

  const handleExitEdit = useCallback(() => {
    if (isDirty) {
      const ok = window.confirm("未保存の変更があります。破棄しますか?")
      if (!ok) return
    }
    setMode("view")
  }, [isDirty])

  const performSave = useCallback(
    async (overwrite: boolean) => {
      if (!onSaveContent) return
      setSaving(true)
      const result = await onSaveContent(file, editedContent, {
        expectedUpdatedAt: snapshotUpdatedAt,
        overwrite,
      })
      setSaving(false)

      if (result.error === null) {
        setContent(editedContent)
        setSnapshotUpdatedAt(result.updatedAt)
        toast.success("Saved")
        return
      }
      if (result.conflict) {
        setConflictOpen(true)
        return
      }
      toast.error(`Save failed: ${result.error}`)
    },
    [editedContent, file, onSaveContent, snapshotUpdatedAt],
  )

  const handleSave = useCallback(() => {
    if (!isDirty || saving) return
    void performSave(false)
  }, [isDirty, saving, performSave])

  const handleOverwrite = useCallback(() => {
    setConflictOpen(false)
    void performSave(true)
  }, [performSave])

  useImperativeHandle(
    ref,
    () => ({
      enterEdit: handleEnterEdit,
      tryExitEdit: handleExitEdit,
      save: handleSave,
    }),
    [handleEnterEdit, handleExitEdit, handleSave],
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        Loading...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-destructive">
        {error}
      </div>
    )
  }

  const previewBody = mode === "edit" ? editedContent : content

  const preview = (
    <article className="prose prose-neutral dark:prose-invert max-w-none p-6">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkWikilink]}
        rehypePlugins={[rehypeSlug]}
        components={{ a: renderLink }}
      >
        {previewBody}
      </ReactMarkdown>
    </article>
  )

  return (
    <div className="flex flex-col h-full min-h-0">
      {mode === "view" ? (
        <div className="flex-1 min-h-0 overflow-auto">{preview}</div>
      ) : (
        <>
          <div className="flex border-b md:hidden" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mobilePane === "editor"}
              className={cn(
                "flex-1 py-2 text-sm",
                mobilePane === "editor"
                  ? "border-b-2 border-primary font-medium"
                  : "text-muted-foreground",
              )}
              onClick={() => setMobilePane("editor")}
            >
              Editor
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mobilePane === "preview"}
              className={cn(
                "flex-1 py-2 text-sm",
                mobilePane === "preview"
                  ? "border-b-2 border-primary font-medium"
                  : "text-muted-foreground",
              )}
              onClick={() => setMobilePane("preview")}
            >
              Preview
            </button>
          </div>
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 min-h-0">
            <div
              className={cn(
                "min-h-0 md:block",
                mobilePane === "editor" ? "block" : "hidden",
              )}
            >
              <MarkdownEditor
                initialContent={editedContent}
                onChange={setEditedContent}
                onSave={handleSave}
              />
            </div>
            <div
              className={cn(
                "min-h-0 overflow-auto md:block md:border-l",
                mobilePane === "preview" ? "block" : "hidden",
              )}
            >
              {preview}
            </div>
          </div>
        </>
      )}

      <AlertDialog open={conflictOpen} onOpenChange={setConflictOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>他の端末で編集されています</AlertDialogTitle>
            <AlertDialogDescription>
              このファイルは別の場所で更新されています。このまま保存すると、その変更を上書きします。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleOverwrite}>上書き保存</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
