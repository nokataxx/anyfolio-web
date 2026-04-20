import { useEffect, useRef } from "react"
import {
  ChevronDown,
  ChevronRight,
  Folder,
  Pencil,
  Trash2,
} from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { Folder as FolderType } from "@/lib/types"
import { DRAG_ID_MIME, DRAG_TYPE_MIME } from "./types"

type FolderItemProps = {
  folder: FolderType
  depth: number
  compact: boolean
  isSelected: boolean
  isExpanded: boolean
  isEditing: boolean
  isDragOver: boolean
  editName: string
  onEditNameChange: (v: string) => void
  onStartEditing: (folder: FolderType) => void
  onCancelEditing: () => void
  onSubmitRename: () => void | Promise<void>
  onToggleExpand: () => void
  onSelect: () => void
  onDelete: () => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
}

export function FolderItem({
  folder,
  depth,
  compact,
  isSelected,
  isExpanded,
  isEditing,
  isDragOver,
  editName,
  onEditNameChange,
  onStartEditing,
  onCancelEditing,
  onSubmitRename,
  onToggleExpand,
  onSelect,
  onDelete,
  onDragOver,
  onDragLeave,
  onDrop,
}: FolderItemProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing])

  const item = (
    <div
      className={`group flex items-center gap-1 rounded-md px-2 py-1 text-sm cursor-pointer hover:bg-muted ${
        isSelected ? "bg-primary/15 font-medium text-primary" : ""
      } ${compact ? "justify-center px-0" : ""} ${isDragOver ? "ring-2 ring-primary bg-primary/10" : ""}`}
      style={compact ? undefined : { paddingLeft: `${depth * 16 + 8}px` }}
      draggable={!isEditing}
      onDragStart={(e) => {
        e.stopPropagation()
        e.dataTransfer.setData(DRAG_TYPE_MIME, "folder")
        e.dataTransfer.setData(DRAG_ID_MIME, folder.id)
        e.dataTransfer.effectAllowed = "move"
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={(e) => {
        e.stopPropagation()
        if (!isEditing) {
          onSelect()
          onToggleExpand()
        }
      }}
    >
      {!compact && (
        isExpanded ? (
          <ChevronDown className="size-3.5 shrink-0" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0" />
        )
      )}
      <Folder className="size-4 shrink-0 text-muted-foreground" />
      {!compact && (
        <>
          {isEditing ? (
            <input
              ref={inputRef}
              className="flex-1 min-w-0 bg-transparent border border-border rounded px-1 text-sm outline-none focus:ring-1 focus:ring-ring"
              value={editName}
              onChange={(e) => onEditNameChange(e.target.value)}
              onBlur={onSubmitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSubmitRename()
                if (e.key === "Escape") onCancelEditing()
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="truncate flex-1">{folder.name}</span>
          )}
          {!isEditing && (
            <>
              <button
                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation()
                  onStartEditing(folder)
                }}
              >
                <Pencil className="size-3.5 text-muted-foreground hover:text-foreground" />
              </button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Folder</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete &quot;{folder.name}&quot;? All files in this folder will also be deleted.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={onDelete}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </>
      )}
    </div>
  )

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{item}</TooltipTrigger>
        <TooltipContent side="right">{folder.name}</TooltipContent>
      </Tooltip>
    )
  }

  return item
}
