import { Upload } from "lucide-react"
import { Button } from "@/components/ui/button"

const ACCEPT =
  ".md,.pdf,.xlsx,.xls,.pptx,.ppt,.docx,.doc,.txt,.png,.jpg,.jpeg,.gif,.webp,.svg"

type UploadButtonProps = {
  folderId: string | null
  onFiles: (files: FileList | File[], folderId: string | null) => void
}

export function UploadButton({ folderId, onFiles }: UploadButtonProps) {
  const openPicker = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.multiple = true
    input.accept = ACCEPT
    input.onchange = () => {
      if (input.files?.length) {
        onFiles(input.files, folderId)
      }
    }
    input.click()
  }

  return (
    <Button variant="outline" size="sm" onClick={openPicker}>
      <Upload className="size-4" />
      <span className="hidden sm:inline">Upload</span>
    </Button>
  )
}
