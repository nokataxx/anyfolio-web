import { useEffect, useRef, useState } from "react"
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderPlus,
  FileText,
  FileType,
  FileSpreadsheet,
  Image,
  Presentation,
  Pencil,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { Folder as FolderType, FileRecord } from "@/lib/types"

type SidebarProps = {
  folders: FolderType[]
  files: FileRecord[]
  allFiles: FileRecord[]
  selectedFolderId: string | null
  selectedFileId: string | null
  onSelectFolder: (id: string | null) => void
  onSelectFile: (file: FileRecord) => void
  onNavigateToFile: (file: FileRecord) => void
  onCreateFolder: (name: string, parentId: string | null) => Promise<{ error: string | null } | undefined>
  onDeleteFolder: (id: string) => Promise<{ error: string | null } | undefined>
  onRenameFolder: (id: string, newName: string) => Promise<{ error: string | null } | undefined>
  onDeleteFile: (file: FileRecord) => Promise<{ error: string | null } | undefined>
  onRenameFile: (file: FileRecord, newName: string) => Promise<{ error: string | null } | undefined>
  onMoveFile: (fileId: string, newFolderId: string | null) => Promise<{ error: string | null } | undefined>
  onMoveFolder: (folderId: string, newParentId: string | null) => Promise<{ error: string | null } | undefined>
}

function fileIcon(type: string) {
  if (type === "md") return <FileText className="size-4 shrink-0 text-muted-foreground" />
  if (type === "xlsx") return <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" />
  if (type === "pptx") return <Presentation className="size-4 shrink-0 text-muted-foreground" />
  if (type === "image") return <Image className="size-4 shrink-0 text-muted-foreground" />
  return <FileType className="size-4 shrink-0 text-muted-foreground" />
}

function FileItem({
  file,
  depth,
  isSelected,
  compact,
  onSelectFile,
  onDeleteFile,
  onRenameFile,
}: {
  file: FileRecord
  depth: number
  isSelected: boolean
  compact: boolean
  onSelectFile: (file: FileRecord) => void
  onDeleteFile: (file: FileRecord) => Promise<{ error: string | null } | undefined>
  onRenameFile: (file: FileRecord, newName: string) => Promise<{ error: string | null } | undefined>
}) {
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
        e.dataTransfer.setData("application/x-anyfolio-type", "file")
        e.dataTransfer.setData("application/x-anyfolio-id", file.id)
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

function FolderTree({
  folders,
  files,
  allFiles,
  parentId,
  selectedFolderId,
  selectedFileId,
  compact,
  onSelectFolder,
  onSelectFile,
  onNavigateToFile,
  onCreateFolder,
  onDeleteFolder,
  onRenameFolder,
  onDeleteFile,
  onRenameFile,
  onMoveFile,
  onMoveFolder,
  depth = 0,
}: SidebarProps & { parentId: string | null; compact: boolean; depth?: number }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editFolderName, setEditFolderName] = useState("")
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const handleDrop = async (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverFolderId(null)
    const itemType = e.dataTransfer.getData("application/x-anyfolio-type")
    const itemId = e.dataTransfer.getData("application/x-anyfolio-id")
    if (!itemType || !itemId) return
    if (itemType === "file") {
      await onMoveFile(itemId, targetFolderId)
    } else if (itemType === "folder") {
      if (itemId === targetFolderId) return
      await onMoveFolder(itemId, targetFolderId)
    }
  }

  const handleDragOver = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = "move"
    setDragOverFolderId(folderId)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverFolderId(null)
  }

  useEffect(() => {
    if (editingFolderId) {
      folderInputRef.current?.focus()
      folderInputRef.current?.select()
    }
  }, [editingFolderId])

  const handleFolderRenameSubmit = async (folderId: string, originalName: string) => {
    if (editFolderName.trim() && editFolderName.trim() !== originalName) {
      await onRenameFolder(folderId, editFolderName.trim())
    }
    setEditingFolderId(null)
  }

  const children = folders.filter((f) => f.parent_id === parentId)

  const folderFiles =
    parentId === null
      ? allFiles.filter((f) => f.folder_id === null)
      : allFiles.filter((f) => f.folder_id === parentId)

  return (
    <>
      {children.map((folder) => {
        const isExpanded = expanded[folder.id] ?? false
        const isSelected = selectedFolderId === folder.id && !selectedFileId
        const isEditing = editingFolderId === folder.id
        const childFiles = allFiles.filter((f) => f.folder_id === folder.id)

        const isDragOver = dragOverFolderId === folder.id

        const folderItem = (
          <div
            className={`group flex items-center gap-1 rounded-md px-2 py-1 text-sm cursor-pointer hover:bg-muted ${
              isSelected ? "bg-primary/15 font-medium text-primary" : ""
            } ${compact ? "justify-center px-0" : ""} ${isDragOver ? "ring-2 ring-primary bg-primary/10" : ""}`}
            style={compact ? undefined : { paddingLeft: `${depth * 16 + 8}px` }}
            draggable={!isEditing}
            onDragStart={(e) => {
              e.stopPropagation()
              e.dataTransfer.setData("application/x-anyfolio-type", "folder")
              e.dataTransfer.setData("application/x-anyfolio-id", folder.id)
              e.dataTransfer.effectAllowed = "move"
            }}
            onDragOver={(e) => handleDragOver(e, folder.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, folder.id)}
            onClick={(e) => {
              e.stopPropagation()
              if (!isEditing) {
                onSelectFolder(folder.id)
                setExpanded((prev) => ({ ...prev, [folder.id]: !prev[folder.id] }))
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
                    ref={folderInputRef}
                    className="flex-1 min-w-0 bg-transparent border border-border rounded px-1 text-sm outline-none focus:ring-1 focus:ring-ring"
                    value={editFolderName}
                    onChange={(e) => setEditFolderName(e.target.value)}
                    onBlur={() => handleFolderRenameSubmit(folder.id, folder.name)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleFolderRenameSubmit(folder.id, folder.name)
                      if (e.key === "Escape") setEditingFolderId(null)
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
                        setEditFolderName(folder.name)
                        setEditingFolderId(folder.id)
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
                            onClick={() => onDeleteFolder(folder.id)}
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

        return (
          <div key={folder.id}>
            {compact ? (
              <Tooltip>
                <TooltipTrigger asChild>{folderItem}</TooltipTrigger>
                <TooltipContent side="right">{folder.name}</TooltipContent>
              </Tooltip>
            ) : (
              folderItem
            )}
            {isExpanded && (
              <>
                {childFiles.map((file) => (
                  <FileItem
                    key={file.id}
                    file={file}
                    depth={depth + 1}
                    isSelected={selectedFileId === file.id}
                    compact={compact}
                    onSelectFile={onSelectFile}
                    onDeleteFile={onDeleteFile}
                    onRenameFile={onRenameFile}
                  />
                ))}
                <FolderTree
                  folders={folders}
                  files={files}
                  allFiles={allFiles}
                  parentId={folder.id}
                  selectedFolderId={selectedFolderId}
                  selectedFileId={selectedFileId}
                  compact={compact}
                  onSelectFolder={onSelectFolder}
                  onSelectFile={onSelectFile}
                  onNavigateToFile={onNavigateToFile}
                  onCreateFolder={onCreateFolder}
                  onDeleteFolder={onDeleteFolder}
                  onRenameFolder={onRenameFolder}
                  onDeleteFile={onDeleteFile}
                  onRenameFile={onRenameFile}
                  onMoveFile={onMoveFile}
                  onMoveFolder={onMoveFolder}
                  depth={depth + 1}
                />
              </>
            )}
          </div>
        )
      })}
      {depth === 0 && folderFiles.length > 0 && folderFiles.map((file) => (
        <FileItem
          key={file.id}
          file={file}
          depth={0}
          isSelected={selectedFileId === file.id}
          compact={compact}
          onSelectFile={onSelectFile}
          onDeleteFile={onDeleteFile}
          onRenameFile={onRenameFile}
        />
      ))}
    </>
  )
}

function SearchResultItem({
  file,
  folderName,
  isSelected,
  onSelect,
}: {
  file: FileRecord
  folderName: string
  isSelected: boolean
  onSelect: (file: FileRecord) => void
}) {
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

export function Sidebar(props: SidebarProps) {
  const [newFolderName, setNewFolderName] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [compact, setCompact] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [rootDragOver, setRootDragOver] = useState(false)

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    await props.onCreateFolder(newFolderName.trim(), props.selectedFolderId)
    setNewFolderName("")
    setDialogOpen(false)
  }

  const folderNameMap = new Map(props.folders.map((f) => [f.id, f.name]))

  const searchResults = searchQuery.trim()
    ? props.allFiles.filter((f) =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : []

  return (
    <TooltipProvider>
      <aside
        className={`flex shrink-0 flex-col border-r bg-sidebar transition-[width] duration-200 ${
          compact ? "w-12" : "w-64"
        }`}
      >
        <div className={`flex h-10 items-center border-b ${compact ? "justify-center px-1" : "justify-between px-3"}`}>
          {!compact && <span className="text-sm font-medium">Folders</span>}
          <div className={`flex items-center ${compact ? "gap-0" : "gap-0.5"}`}>
            {!compact && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon-xs">
                    <FolderPlus className="size-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New Folder</DialogTitle>
                    <DialogDescription>
                      Create a new folder to organize your files.
                    </DialogDescription>
                  </DialogHeader>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      handleCreateFolder()
                    }}
                    className="space-y-4"
                  >
                    <Input
                      placeholder="Folder name"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      autoFocus
                    />
<Button type="submit" className="w-full">
                      Create
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-xs" onClick={() => setCompact((v) => !v)}>
                  {compact ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {compact ? "Expand sidebar" : "Collapse sidebar"}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        {!compact && (
          <div className="relative px-2 pt-2">
            <Search className="absolute left-4 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-7 pr-7 text-sm"
            />
            {searchQuery && (
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearchQuery("")}
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        )}
        <ScrollArea
          className={`flex-1 ${compact ? "p-1" : "p-2"} ${rootDragOver ? "bg-primary/5" : ""}`}
          onClick={() => {
            props.onSelectFolder(null)
          }}
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = "move"
            setRootDragOver(true)
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            setRootDragOver(false)
          }}
          onDrop={async (e) => {
            e.preventDefault()
            setRootDragOver(false)
            const itemType = e.dataTransfer.getData("application/x-anyfolio-type")
            const itemId = e.dataTransfer.getData("application/x-anyfolio-id")
            if (!itemType || !itemId) return
            if (itemType === "file") {
              await props.onMoveFile(itemId, null)
            } else if (itemType === "folder") {
              await props.onMoveFolder(itemId, null)
            }
          }}
        >
          <div>
            {searchQuery.trim() ? (
              searchResults.length > 0 ? (
                searchResults.map((file) => (
                  <SearchResultItem
                    key={file.id}
                    file={file}
                    folderName={file.folder_id ? folderNameMap.get(file.folder_id) ?? "" : ""}
                    isSelected={props.selectedFileId === file.id}
                    onSelect={(f) => {
                      props.onNavigateToFile(f)
                      setSearchQuery("")
                    }}
                  />
                ))
              ) : (
                <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                  No files found
                </p>
              )
            ) : (
              <FolderTree {...props} parentId={null} compact={compact} />
            )}
          </div>
        </ScrollArea>
      </aside>
    </TooltipProvider>
  )
}
