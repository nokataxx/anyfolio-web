import { useState } from "react"
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
  onFiles: (files: FileList | File[], folderId: string | null) => void
}

export function UploadDialog({ folderId, onFiles }: UploadDialogProps) {
  const [open, setOpen] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  function handleFiles(files: FileList | File[]) {
    if (!files.length) return
    onFiles(files, folderId)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="size-4" />
          <span className="hidden sm:inline">Upload</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
          <DialogDescription>
            Upload .md, .pdf, .xlsx, .pptx, .docx, .txt, or image files to the selected folder.
            PowerPoint files are converted to PDF; Word (.docx/.doc) and .txt files are converted to Markdown.
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
