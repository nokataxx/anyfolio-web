import { useState } from "react"
import {
  FilePlus,
  FolderPlus,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type SidebarHeaderProps = {
  compact: boolean
  onToggleCompact: () => void
  onCreateFolder: (name: string) => Promise<void> | void
  onCreateFile: (name: string) => Promise<{ error: string | null } | undefined | void>
}

export function SidebarHeader({
  compact,
  onToggleCompact,
  onCreateFolder,
  onCreateFile,
}: SidebarHeaderProps) {
  const [newFolderName, setNewFolderName] = useState("")
  const [folderDialogOpen, setFolderDialogOpen] = useState(false)
  const [newFileName, setNewFileName] = useState("")
  const [fileDialogOpen, setFileDialogOpen] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const handleFolderSubmit = async () => {
    if (!newFolderName.trim()) return
    await onCreateFolder(newFolderName.trim())
    setNewFolderName("")
    setFolderDialogOpen(false)
  }

  const handleFileSubmit = async () => {
    if (!newFileName.trim() || creating) return
    setCreating(true)
    setFileError(null)
    const result = await onCreateFile(newFileName.trim())
    setCreating(false)
    if (result && "error" in result && result.error) {
      setFileError(result.error)
      return
    }
    setNewFileName("")
    setFileDialogOpen(false)
  }

  return (
    <div className={`flex h-10 items-center border-b ${compact ? "justify-center px-1" : "justify-between px-3"}`}>
      {!compact && <span className="text-sm font-medium">Folders</span>}
      <div className={`flex items-center ${compact ? "gap-0" : "gap-0.5"}`}>
        {!compact && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setFileDialogOpen(true)}
                  aria-label="New Markdown file"
                >
                  <FilePlus className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">New Markdown file</TooltipContent>
            </Tooltip>
            <Dialog
              open={fileDialogOpen}
              onOpenChange={(open) => {
                setFileDialogOpen(open)
                if (!open) {
                  setNewFileName("")
                  setFileError(null)
                }
              }}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Markdown File</DialogTitle>
                  <DialogDescription>
                    Create an empty Markdown file in the currently selected folder.
                  </DialogDescription>
                </DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleFileSubmit()
                  }}
                  className="space-y-3"
                >
                  <Input
                    placeholder="File name (without .md)"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    autoFocus
                  />
                  {fileError && <p className="text-sm text-destructive">{fileError}</p>}
                  <Button type="submit" className="w-full" disabled={creating}>
                    {creating ? "Creating..." : "Create"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setFolderDialogOpen(true)}
                  aria-label="New folder"
                >
                  <FolderPlus className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">New folder</TooltipContent>
            </Tooltip>
            <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
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
                    handleFolderSubmit()
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
          </>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-xs" onClick={onToggleCompact}>
              {compact ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {compact ? "Expand sidebar" : "Collapse sidebar"}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
