import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowUp } from "lucide-react"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { MarkdownViewer } from "@/components/file-viewer/markdown-viewer"
import { PdfViewer } from "@/components/file-viewer/pdf-viewer"
import { ExcelViewer } from "@/components/file-viewer/excel-viewer"
import { PptxViewer } from "@/components/file-viewer/pptx-viewer"
import { ImageViewer } from "@/components/file-viewer/image-viewer"
import { UploadDialog } from "@/components/upload-dialog"
import { Button } from "@/components/ui/button"
import { useFolders } from "@/hooks/use-folders"
import { useFiles } from "@/hooks/use-files"
import { useAllFiles } from "@/hooks/use-all-files"
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

  const { folders, createFolder, deleteFolder, renameFolder } = useFolders()
  const { files, uploadFile, deleteFile, renameFile } = useFiles(selectedFolderId)
  const { allFiles, refetch: refetchAllFiles } = useAllFiles()

  const handleSelectFolder = (id: string | null) => {
    setSelectedFolderId(id)
    setSelectedFile(null)
  }

  const handleSelectFile = (file: FileRecord) => {
    setSelectedFile(file)
  }

  const handleNavigateToFile = (file: FileRecord) => {
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

  return (
    <div className="flex h-screen flex-col bg-background">
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
        />
        <main className="flex flex-1 flex-col overflow-hidden">
          <div className="flex h-10 items-center gap-2 border-b px-4">
            <span className="flex-1 text-sm text-muted-foreground">
              {selectedFile
                ? selectedFile.name.replace(/\.[^.]+$/, "")
                : selectedFolderId
                  ? "Select a file to view"
                  : "Select a folder"}
            </span>
            <UploadDialog folderId={selectedFolderId} onUpload={async (file, folderId) => {
              const result = await uploadFile(file, folderId)
              if (!result.error) await refetchAllFiles()
              return result
            }} />
          </div>
          <div ref={contentRef} className="relative flex-1 overflow-auto">
            {selectedFile ? (
              selectedFile.type === "md" ? (
                <MarkdownViewer file={selectedFile} allFiles={allFiles} onNavigateToFile={handleNavigateToFile} />
              ) : selectedFile.type === "xlsx" ? (
                <ExcelViewer file={selectedFile} />
              ) : selectedFile.type === "pptx" ? (
                <PptxViewer file={selectedFile} />
              ) : selectedFile.type === "image" ? (
                <ImageViewer file={selectedFile} />
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
