import { useEffect, useRef, useState } from "react"
import { Upload } from "lucide-react"

type GlobalDropUploadProps = {
  folderId: string | null
  onFiles: (files: FileList | File[], folderId: string | null) => void
}

function hasExternalFiles(e: DragEvent) {
  return Array.from(e.dataTransfer?.types ?? []).includes("Files")
}

// Skip when a Radix dialog is already open — its own drop zone handles it
function anotherDialogOpen() {
  return document.querySelector('[role="dialog"][data-state="open"]') !== null
}

export function GlobalDropUpload({ folderId, onFiles }: GlobalDropUploadProps) {
  const [dragging, setDragging] = useState(false)

  const dragCounterRef = useRef(0)
  const folderIdRef = useRef(folderId)
  const onFilesRef = useRef(onFiles)
  useEffect(() => {
    folderIdRef.current = folderId
    onFilesRef.current = onFiles
  }, [folderId, onFiles])

  useEffect(() => {
    function onDragEnter(e: DragEvent) {
      if (!hasExternalFiles(e) || anotherDialogOpen()) return
      e.preventDefault()
      dragCounterRef.current += 1
      setDragging(true)
    }

    function onDragOver(e: DragEvent) {
      if (!hasExternalFiles(e) || anotherDialogOpen()) return
      // preventDefault on dragover is required for drop to fire
      e.preventDefault()
    }

    function onDragLeave(e: DragEvent) {
      if (!hasExternalFiles(e)) return
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1)
      if (dragCounterRef.current === 0) setDragging(false)
    }

    function onDrop(e: DragEvent) {
      if (!hasExternalFiles(e) || anotherDialogOpen()) return
      e.preventDefault()
      dragCounterRef.current = 0
      setDragging(false)

      const files = e.dataTransfer?.files
      if (!files || !files.length) return
      onFilesRef.current(files, folderIdRef.current)
    }

    document.addEventListener("dragenter", onDragEnter)
    document.addEventListener("dragover", onDragOver)
    document.addEventListener("dragleave", onDragLeave)
    document.addEventListener("drop", onDrop)
    return () => {
      document.removeEventListener("dragenter", onDragEnter)
      document.removeEventListener("dragover", onDragOver)
      document.removeEventListener("dragleave", onDragLeave)
      document.removeEventListener("drop", onDrop)
    }
  }, [])

  if (!dragging) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-60 flex items-center justify-center bg-primary/10 backdrop-blur-[2px]">
      <div className="rounded-xl bg-background/95 px-8 py-6 shadow-xl">
        <div className="flex items-center gap-3">
          <Upload className="size-6 text-primary" />
          <p className="text-base font-medium">Drop files to upload</p>
        </div>
      </div>
    </div>
  )
}
