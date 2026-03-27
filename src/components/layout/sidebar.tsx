import { useState } from "react"
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderPlus,
  FileText,
  FileType,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import type { Folder as FolderType, FileRecord } from "@/lib/types"

type SidebarProps = {
  folders: FolderType[]
  files: FileRecord[]
  selectedFolderId: string | null
  selectedFileId: string | null
  onSelectFolder: (id: string | null) => void
  onSelectFile: (file: FileRecord) => void
  onCreateFolder: (name: string, parentId: string | null) => Promise<{ error: string | null } | undefined>
  onDeleteFolder: (id: string) => Promise<{ error: string | null } | undefined>
  onDeleteFile: (file: FileRecord) => Promise<{ error: string | null } | undefined>
}

function FolderTree({
  folders,
  files,
  parentId,
  selectedFolderId,
  selectedFileId,
  onSelectFolder,
  onSelectFile,
  onCreateFolder,
  onDeleteFolder,
  onDeleteFile,
  depth = 0,
}: SidebarProps & { parentId: string | null; depth?: number }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const children = folders.filter((f) => f.parent_id === parentId)

  const folderFiles =
    selectedFolderId && parentId === null
      ? []
      : files.filter(
          (f) =>
            children.some((c) => c.id === f.folder_id) === false &&
            f.folder_id === parentId
        )

  return (
    <>
      {children.map((folder) => {
        const isExpanded = expanded[folder.id] ?? false
        const isSelected = selectedFolderId === folder.id
        const childFiles = files.filter((f) => f.folder_id === folder.id)

        return (
          <div key={folder.id}>
            <div
              className={`group flex items-center gap-1 rounded-md px-2 py-1 text-sm cursor-pointer hover:bg-muted ${
                isSelected ? "bg-muted font-medium" : ""
              }`}
              style={{ paddingLeft: `${depth * 16 + 8}px` }}
              onClick={() => {
                onSelectFolder(folder.id)
                setExpanded((prev) => ({ ...prev, [folder.id]: !prev[folder.id] }))
              }}
            >
              {isExpanded ? (
                <ChevronDown className="size-3.5 shrink-0" />
              ) : (
                <ChevronRight className="size-3.5 shrink-0" />
              )}
              <Folder className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate flex-1">{folder.name}</span>
              <button
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteFolder(folder.id)
                }}
              >
                <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
            {isExpanded && (
              <>
                {childFiles.map((file) => (
                  <div
                    key={file.id}
                    className={`group flex items-center gap-1 rounded-md px-2 py-1 text-sm cursor-pointer hover:bg-muted ${
                      selectedFileId === file.id ? "bg-muted font-medium" : ""
                    }`}
                    style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
                    onClick={() => onSelectFile(file)}
                  >
                    {file.type === "md" ? (
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <FileType className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate flex-1">{file.name}</span>
                    <button
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteFile(file)
                      }}
                    >
                      <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                ))}
                <FolderTree
                  folders={folders}
                  files={files}
                  parentId={folder.id}
                  selectedFolderId={selectedFolderId}
                  selectedFileId={selectedFileId}
                  onSelectFolder={onSelectFolder}
                  onSelectFile={onSelectFile}
                  onCreateFolder={onCreateFolder}
                  onDeleteFolder={onDeleteFolder}
                  onDeleteFile={onDeleteFile}
                  depth={depth + 1}
                />
              </>
            )}
          </div>
        )
      })}
      {depth === 0 && folderFiles.length > 0 && folderFiles.map((file) => (
        <div
          key={file.id}
          className={`group flex items-center gap-1 rounded-md px-2 py-1 text-sm cursor-pointer hover:bg-muted ${
            selectedFileId === file.id ? "bg-muted font-medium" : ""
          }`}
          style={{ paddingLeft: "8px" }}
          onClick={() => onSelectFile(file)}
        >
          {file.type === "md" ? (
            <FileText className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <FileType className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate flex-1">{file.name}</span>
        </div>
      ))}
    </>
  )
}

export function Sidebar(props: SidebarProps) {
  const [newFolderName, setNewFolderName] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    await props.onCreateFolder(newFolderName.trim(), props.selectedFolderId)
    setNewFolderName("")
    setDialogOpen(false)
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r bg-sidebar">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-medium">Folders</span>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon-xs">
              <FolderPlus className="size-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Folder</DialogTitle>
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
      </div>
      <ScrollArea className="flex-1 p-2">
        <FolderTree {...props} parentId={null} />
      </ScrollArea>
    </aside>
  )
}
