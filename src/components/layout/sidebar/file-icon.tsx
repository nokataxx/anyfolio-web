import {
  FileText,
  FileType,
  FileSpreadsheet,
  Image,
  Presentation,
} from "lucide-react"

export function fileIcon(type: string) {
  if (type === "md") return <FileText className="size-4 shrink-0 text-muted-foreground" />
  if (type === "xlsx") return <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" />
  if (type === "pptx") return <Presentation className="size-4 shrink-0 text-muted-foreground" />
  if (type === "image") return <Image className="size-4 shrink-0 text-muted-foreground" />
  return <FileType className="size-4 shrink-0 text-muted-foreground" />
}
