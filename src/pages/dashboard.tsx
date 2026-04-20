import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react"
import { ArrowUp, Eye, Pencil, Save } from "lucide-react"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { UploadDialog } from "@/components/upload-dialog"
import { ContentSearchDialog } from "@/components/content-search-dialog"
import { ViewerErrorBoundary } from "@/components/viewer-error-boundary"
import type {
  MarkdownViewerHandle,
  MarkdownViewerStatus,
} from "@/components/file-viewer/markdown-viewer"

// Viewers carry heavy deps (react-pdf, xlsx, jszip, etc.) — load on demand
const MarkdownViewer = lazy(() =>
  import("@/components/file-viewer/markdown-viewer").then((m) => ({ default: m.MarkdownViewer })),
)
const PdfViewer = lazy(() =>
  import("@/components/file-viewer/pdf-viewer").then((m) => ({ default: m.PdfViewer })),
)
const ExcelViewer = lazy(() =>
  import("@/components/file-viewer/excel-viewer").then((m) => ({ default: m.ExcelViewer })),
)
const PptxViewer = lazy(() =>
  import("@/components/file-viewer/pptx-viewer").then((m) => ({ default: m.PptxViewer })),
)
const ImageViewer = lazy(() =>
  import("@/components/file-viewer/image-viewer").then((m) => ({ default: m.ImageViewer })),
)

function ViewerFallback() {
  return (
    <div className="flex h-full items-center justify-center p-8 text-muted-foreground">
      Loading viewer…
    </div>
  )
}
import { Button } from "@/components/ui/button"
import { useFolders } from "@/hooks/use-folders"
import { useFiles } from "@/hooks/use-files"
import { useAllFiles } from "@/hooks/use-all-files"
import type { FileRecord } from "@/lib/types"

export function DashboardPage() {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null)

  const [searchOpen, setSearchOpen] = useState(false)
  const pendingHighlightRef = useRef<string | null>(null)
  const [highlightTrigger, setHighlightTrigger] = useState(0)
  const [pdfInitialPage, setPdfInitialPage] = useState<number | undefined>(undefined)
  const [pdfHighlightQuery, setPdfHighlightQuery] = useState<string | undefined>(undefined)

  const contentRef = useRef<HTMLDivElement>(null)
  const [showScrollTop, setShowScrollTop] = useState(false)

  const markdownViewerRef = useRef<MarkdownViewerHandle>(null)
  const [markdownStatus, setMarkdownStatus] = useState<MarkdownViewerStatus>({
    mode: "view",
    isDirty: false,
    saving: false,
    ready: false,
  })

  const handleScroll = useCallback(() => {
    const el = contentRef.current
    if (el) setShowScrollTop(el.scrollTop > 300)
  }, [])

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    el.addEventListener("scroll", handleScroll, { passive: true })
    return () => el.removeEventListener("scroll", handleScroll)
  }, [handleScroll])

  const scrollToTop = () => {
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" })
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Scroll to and highlight matching text after search navigation
  useEffect(() => {
    const pending = pendingHighlightRef.current
    if (!pending) return
    pendingHighlightRef.current = null
    const query = pending

    let cancelled = false
    let attempts = 0

    function tryFind() {
      if (cancelled || attempts >= 30) return
      const container = contentRef.current
      if (!container) { attempts++; setTimeout(tryFind, 300); return }

      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
      const queryLower = query.toLowerCase()

      while (walker.nextNode()) {
        const node = walker.currentNode as Text
        const text = node.textContent ?? ""
        const index = text.toLowerCase().indexOf(queryLower)
        if (index === -1) continue

        const range = document.createRange()
        range.setStart(node, index)
        range.setEnd(node, index + query.length)

        const rect = range.getBoundingClientRect()
        const containerRect = container.getBoundingClientRect()

        container.scrollTo({
          top: container.scrollTop + rect.top - containerRect.top - container.clientHeight / 3,
          behavior: "smooth",
        })

        // Overlay highlight that fades out
        const highlight = document.createElement("div")
        highlight.style.cssText = [
          "position:absolute",
          "pointer-events:none",
          "z-index:10",
          "border-radius:2px",
          "background:rgba(250,204,21,0.45)",
          "transition:opacity 0.5s",
          `top:${rect.top - containerRect.top + container.scrollTop}px`,
          `left:${rect.left - containerRect.left + container.scrollLeft}px`,
          `width:${rect.width}px`,
          `height:${rect.height}px`,
        ].join(";")
        container.appendChild(highlight)

        setTimeout(() => { highlight.style.opacity = "0" }, 2000)
        setTimeout(() => highlight.remove(), 2500)
        return
      }

      // Content not rendered yet — retry
      attempts++
      setTimeout(tryFind, 300)
    }

    setTimeout(tryFind, 300)
    return () => { cancelled = true }
  }, [highlightTrigger])

  const { folders, createFolder, deleteFolder, renameFolder, moveFolder } = useFolders()
  const { files, uploadFile, deleteFile, renameFile, moveFile, updateFileContent } = useFiles(selectedFolderId)
  const { allFiles, refetch: refetchAllFiles } = useAllFiles()

  const handleSelectFolder = (id: string | null) => {
    setSelectedFolderId(id)
    setSelectedFile(null)
  }

  const handleSelectFile = (file: FileRecord) => {
    setPdfInitialPage(undefined)
    setPdfHighlightQuery(undefined)
    setSelectedFile(file)
  }

  const handleNavigateToFile = (file: FileRecord) => {
    setPdfInitialPage(undefined)
    setPdfHighlightQuery(undefined)
    setSelectedFolderId(file.folder_id)
    setSelectedFile(file)
  }

  const handleDeleteFile = async (file: FileRecord) => {
    if (selectedFile?.id === file.id) {
      setSelectedFile(null)
    }
    const result = await deleteFile(file)
    await refetchAllFiles()
    return result
  }

  const handleRenameFile = async (file: FileRecord, newName: string) => {
    const result = await renameFile(file, newName)
    if (!result?.error && selectedFile?.id === file.id) {
      setSelectedFile({ ...file, name: newName.trim() })
    }
    await refetchAllFiles()
    return result
  }

  const handleMoveFile = async (fileId: string, newFolderId: string | null) => {
    const result = await moveFile(fileId, newFolderId)
    await refetchAllFiles()
    return result
  }

  const handleMoveFolder = async (folderId: string, newParentId: string | null) => {
    return await moveFolder(folderId, newParentId)
  }

  const handleUpdateFileContent: typeof updateFileContent = async (file, content, options) => {
    const result = await updateFileContent(file, content, options)
    if (result.error === null) {
      await refetchAllFiles()
      if (selectedFile?.id === file.id) {
        setSelectedFile({ ...file, updated_at: result.updatedAt })
      }
    }
    return result
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          folders={folders}
          files={files}
          allFiles={allFiles}
          selectedFolderId={selectedFolderId}
          selectedFileId={selectedFile?.id ?? null}
          onSelectFolder={handleSelectFolder}
          onSelectFile={handleSelectFile}
          onNavigateToFile={handleNavigateToFile}
          onCreateFolder={createFolder}
          onDeleteFolder={deleteFolder}
          onRenameFolder={renameFolder}
          onDeleteFile={handleDeleteFile}
          onRenameFile={handleRenameFile}
          onMoveFile={handleMoveFile}
          onMoveFolder={handleMoveFolder}
        />
        <main className="flex flex-1 flex-col overflow-hidden">
          <div className="flex h-10 items-center gap-2 border-b px-4">
            <span className="flex-1 text-sm text-muted-foreground">
              {selectedFile
                ? selectedFile.name.replace(/\.[^.]+$/, "")
                : "Select a file to view"}
            </span>
            {selectedFile?.type === "md" && (
              markdownStatus.mode === "view" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => markdownViewerRef.current?.enterEdit()}
                  disabled={!markdownStatus.ready}
                >
                  <Pencil className="size-4" />
                  Edit
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => markdownViewerRef.current?.tryExitEdit()}
                    disabled={markdownStatus.saving}
                  >
                    <Eye className="size-4" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => markdownViewerRef.current?.save()}
                    disabled={!markdownStatus.isDirty || markdownStatus.saving}
                  >
                    <Save className="size-4" />
                    {markdownStatus.saving ? "Saving..." : "Save"}
                  </Button>
                </>
              )
            )}
            <UploadDialog folderId={selectedFolderId} onUpload={async (file, fId) => {
              const result = await uploadFile(file, fId)
              if (!result.error) await refetchAllFiles()
              return result
            }} />
          </div>
          <div ref={contentRef} className="relative flex-1 overflow-auto">
            {selectedFile ? (
              <ViewerErrorBoundary resetKey={selectedFile.id}>
                <Suspense fallback={<ViewerFallback />}>
                  {selectedFile.type === "md" ? (
                    <MarkdownViewer
                      ref={markdownViewerRef}
                      file={selectedFile}
                      allFiles={allFiles}
                      onNavigateToFile={handleNavigateToFile}
                      onSaveContent={handleUpdateFileContent}
                      onStatusChange={setMarkdownStatus}
                    />
                  ) : selectedFile.type === "xlsx" ? (
                    <ExcelViewer file={selectedFile} />
                  ) : selectedFile.type === "pptx" ? (
                    <PptxViewer file={selectedFile} />
                  ) : selectedFile.type === "image" ? (
                    <ImageViewer file={selectedFile} />
                  ) : (
                    <PdfViewer file={selectedFile} initialPage={pdfInitialPage} highlightQuery={pdfHighlightQuery} />
                  )}
                </Suspense>
              </ViewerErrorBoundary>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <p>Select a file to view its contents</p>
              </div>
            )}
            {showScrollTop && (
              <Button
                variant="outline"
                size="icon"
                className="fixed bottom-6 right-6 z-50 rounded-full shadow-lg"
                onClick={scrollToTop}
              >
                <ArrowUp className="size-4" />
              </Button>
            )}
          </div>
        </main>
      </div>
      <ContentSearchDialog
        allFiles={allFiles}
        folders={folders}
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onSelectFile={(file, query, pdfPage) => {
          handleNavigateToFile(file)
          if (file.type === "pdf" && pdfPage) {
            setPdfInitialPage(pdfPage)
            setPdfHighlightQuery(query)
          } else {
            pendingHighlightRef.current = query
            setHighlightTrigger((n) => n + 1)
          }
          setSearchOpen(false)
        }}
      />
    </div>
  )
}
