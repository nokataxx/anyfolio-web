import { useEffect, useRef, useState } from "react"
import { Pencil, Trash2 } from "lucide-react"
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
import type { FileRecord } from "@/lib/types"
import { fileIcon } from "./file-icon"
import { DRAG_ID_MIME, DRAG_TYPE_MIME } from "./types"

type FileItemProps = {
  file: FileRecord
  depth: number
  isSelected: boolean
  compact: boolean
  onSelectFile: (file: FileRecord) => void
  onDeleteFile: (file: FileRecord) => Promise<{ error: string | null } | undefined>
  onRenameFile: (file: FileRecord, newName: string) => Promise<{ error: string | null } | undefined>
}

export function FileItem({
  file,
  depth,
  isSelected,
  compact,
  onSelectFile,
  onDeleteFile,
  onRenameFile,
}: FileItemProps) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(file.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const handleRenameSubmit = async () => {
    if (editName.trim() && editName.trim() !== file.name) {
      await onRenameFile(file, editName.trim())
    }
    setEditing(false)
  }

  const item = (
    <div
      className={`group flex items-center gap-1 rounded-md px-2 py-1 text-sm cursor-pointer hover:bg-muted ${
        isSelected ? "bg-primary/15 font-medium text-primary" : ""
      } ${compact ? "justify-center px-0" : ""}`}
      style={compact ? undefined : { paddingLeft: `${depth * 16 + 8}px` }}
      draggable={!editing}
      onDragStart={(e) => {
        e.stopPropagation()
        e.dataTransfer.setData(DRAG_TYPE_MIME, "file")
        e.dataTransfer.setData(DRAG_ID_MIME, file.id)
        e.dataTransfer.effectAllowed = "move"
      }}
      onClick={(e) => { e.stopPropagation(); if (!editing) onSelectFile(file) }}
    >
      {fileIcon(file.type)}
      {!compact && (
        <>
          {editing ? (
            <input
              ref={inputRef}
              className="flex-1 min-w-0 bg-transparent border border-border rounded px-1 text-sm outline-none focus:ring-1 focus:ring-ring"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameSubmit()
                if (e.key === "Escape") {
                  setEditName(file.name)
                  setEditing(false)
                }
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="truncate flex-1">
              {file.name.replace(/\.[^.]+$/, "")}
              <span className="text-muted-foreground/60">{file.name.match(/\.[^.]+$/)?.[0]}</span>
            </span>
          )}
          {!editing && (
            <>
              <button
                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation()
                  setEditName(file.name)
                  setEditing(true)
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
                    <AlertDialogTitle>Delete File</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete &quot;{file.name}&quot;? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => onDeleteFile(file)}
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
        <TooltipContent side="right">{file.name}</TooltipContent>
      </Tooltip>
    )
  }

  return item
}
