import type { FileRecord } from "@/lib/types"
import { fileIcon } from "./file-icon"

type SearchResultItemProps = {
  file: FileRecord
  folderName: string
  isSelected: boolean
  onSelect: (file: FileRecord) => void
}

export function SearchResultItem({
  file,
  folderName,
  isSelected,
  onSelect,
}: SearchResultItemProps) {
  return (
    <div
      className={`flex items-center gap-2 rounded-md px-2 py-1 text-sm cursor-pointer hover:bg-muted ${
        isSelected ? "bg-primary/15 font-medium text-primary" : ""
      }`}
      onClick={(e) => { e.stopPropagation(); onSelect(file) }}
    >
      {fileIcon(file.type)}
      <div className="flex min-w-0 flex-col">
        <span className="truncate">
          {file.name.replace(/\.[^.]+$/, "")}
          <span className="text-muted-foreground/60">{file.name.match(/\.[^.]+$/)?.[0]}</span>
        </span>
        <span className="truncate text-xs text-muted-foreground">{folderName}</span>
      </div>
    </div>
  )
}
