import { useState } from "react"
import {
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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type SidebarHeaderProps = {
  compact: boolean
  onToggleCompact: () => void
  onCreateFolder: (name: string) => Promise<void> | void
}

export function SidebarHeader({
  compact,
  onToggleCompact,
  onCreateFolder,
}: SidebarHeaderProps) {
  const [newFolderName, setNewFolderName] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)

  const handleSubmit = async () => {
    if (!newFolderName.trim()) return
    await onCreateFolder(newFolderName.trim())
    setNewFolderName("")
    setDialogOpen(false)
  }

  return (
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
                  handleSubmit()
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
