import { useCallback, useState } from "react"
import { Upload } from "lucide-react"
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
  onUpload: (file: File, folderId: string) => Promise<{ error: string | null }>
}

export function UploadDialog({ folderId, onUpload }: UploadDialogProps) {
  const [open, setOpen] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isPptx = (name: string) => /\.pptx?$/i.test(name)

  const handleFiles = useCallback(
    async (fileList: FileList) => {
      if (!folderId) {
        setError("Please select a folder first")
        return
      }

      setUploading(true)
      setError(null)
      setStatusMessage(null)

      for (const file of Array.from(fileList)) {
        if (isPptx(file.name)) {
          setStatusMessage(`Converting ${file.name} to PDF...`)
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
        <Button variant="outline" size="sm" disabled={!folderId}>
          <Upload className="size-4" />
          Upload
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
          <DialogDescription>
            Upload .md, .pdf, .xlsx, or .pptx files to the selected folder.
            PowerPoint files will be automatically converted to PDF.
          </DialogDescription>
        </DialogHeader>
        <div
          className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25"
          }`}
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
          <Upload className="mb-2 size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Drag & drop .md, .pdf, .xlsx, or .pptx files here
          </p>
          <p className="mb-4 text-xs text-muted-foreground">or</p>
          <Button
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => {
              const input = document.createElement("input")
              input.type = "file"
              input.multiple = true
              input.accept = ".md,.pdf,.xlsx,.xls,.pptx,.ppt"
              input.onchange = () => {
                if (input.files?.length) {
                  handleFiles(input.files)
                }
              }
              input.click()
            }}
          >
            {uploading ? (statusMessage ?? "Uploading...") : "Choose Files"}
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  )
}
