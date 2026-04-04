import { useCallback, useState } from "react"
import { Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

type UploadDialogProps = {
  folderId: string | null
  onUpload: (file: File, folderId: string | null) => Promise<{ error: string | null }>
}

export function UploadDialog({ folderId, onUpload }: UploadDialogProps) {
  const [open, setOpen] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isPptx = (name: string) => /\.pptx?$/i.test(name)
  const isDocx = (name: string) => /\.docx?$/i.test(name)

  const handleFiles = useCallback(
    async (fileList: FileList) => {
      setUploading(true)
      setError(null)
      setStatusMessage(null)

      for (const file of Array.from(fileList)) {
        if (isPptx(file.name)) {
          setStatusMessage(`Converting ${file.name} to PDF...`)
        } else if (isDocx(file.name)) {
          setStatusMessage(`Converting ${file.name} to text...`)
        } else {
          setStatusMessage(`Uploading ${file.name}...`)
        }
        const result = await onUpload(file, folderId)
        if (result.error) {
          setError(result.error)
          setUploading(false)
          setStatusMessage(null)
          return
        }
      }

      setUploading(false)
      setStatusMessage(null)
      setOpen(false)
    },
    [folderId, onUpload]
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="size-4" />
          Upload
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
          <DialogDescription>
            Upload .md, .pdf, .xlsx, .pptx, .docx, .txt, or image files to the selected folder.
            PowerPoint files are converted to PDF, Word files are converted to text.
          </DialogDescription>
        </DialogHeader>
        <div
          className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25"
          } ${uploading ? "pointer-events-none opacity-60" : ""}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            if (e.dataTransfer.files.length) {
              handleFiles(e.dataTransfer.files)
            }
          }}
        >
          {uploading ? (
            <>
              <Loader2 className="mb-2 size-8 animate-spin text-primary" />
              <p className="text-sm font-medium text-foreground">
                {statusMessage ?? "Uploading..."}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Please wait while the file is being processed.
              </p>
            </>
          ) : (
            <>
              <Upload className="mb-2 size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drag & drop files here (.md, .pdf, .xlsx, .pptx, .docx, .txt, images)
              </p>
              <p className="mb-4 text-xs text-muted-foreground">or</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const input = document.createElement("input")
                  input.type = "file"
                  input.multiple = true
                  input.accept = ".md,.pdf,.xlsx,.xls,.pptx,.ppt,.docx,.doc,.txt,.png,.jpg,.jpeg,.gif,.webp,.svg"
                  input.onchange = () => {
                    if (input.files?.length) {
                      handleFiles(input.files)
                    }
                  }
                  input.click()
                }}
              >
                Choose Files
              </Button>
            </>
          )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  )
}
