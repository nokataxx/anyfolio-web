import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowUp } from "lucide-react"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { MarkdownViewer } from "@/components/file-viewer/markdown-viewer"
import { PdfViewer } from "@/components/file-viewer/pdf-viewer"
import { UploadDialog } from "@/components/upload-dialog"
import { Button } from "@/components/ui/button"
import { useFolders } from "@/hooks/use-folders"
import { useFiles } from "@/hooks/use-files"
import type { FileRecord } from "@/lib/types"

export function DashboardPage() {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null)

  const contentRef = useRef<HTMLDivElement>(null)
  const [showScrollTop, setShowScrollTop] = useState(false)

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

  const { folders, createFolder, deleteFolder } = useFolders()
  const { files, uploadFile, deleteFile } = useFiles(selectedFolderId)

  const handleSelectFolder = (id: string | null) => {
    setSelectedFolderId(id)
    setSelectedFile(null)
  }

  const handleSelectFile = (file: FileRecord) => {
    setSelectedFile(file)
  }

  const handleDeleteFile = async (file: FileRecord) => {
    if (selectedFile?.id === file.id) {
      setSelectedFile(null)
    }
    return await deleteFile(file)
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          folders={folders}
          files={files}
          selectedFolderId={selectedFolderId}
          selectedFileId={selectedFile?.id ?? null}
          onSelectFolder={handleSelectFolder}
          onSelectFile={handleSelectFile}
          onCreateFolder={createFolder}
          onDeleteFolder={deleteFolder}
          onDeleteFile={handleDeleteFile}
        />
        <main className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b px-4 py-2">
            <span className="flex-1 text-sm text-muted-foreground">
              {selectedFile
                ? selectedFile.name
                : selectedFolderId
                  ? "Select a file to view"
                  : "Select a folder"}
            </span>
            <UploadDialog folderId={selectedFolderId} onUpload={uploadFile} />
          </div>
          <div ref={contentRef} className="relative flex-1 overflow-auto">
            {selectedFile ? (
              selectedFile.type === "md" ? (
                <MarkdownViewer file={selectedFile} />
              ) : (
                <PdfViewer file={selectedFile} />
              )
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
    </div>
  )
}
