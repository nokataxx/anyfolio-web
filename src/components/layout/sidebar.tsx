import { useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { FolderTree } from "./sidebar/folder-tree"
import { SearchResultItem } from "./sidebar/search-result-item"
import { SidebarHeader } from "./sidebar/sidebar-header"
import { SidebarSearch } from "./sidebar/sidebar-search"
import {
  DRAG_ID_MIME,
  DRAG_TYPE_MIME,
  type SidebarProps,
} from "./sidebar/types"

export function Sidebar(props: SidebarProps) {
  const [compact, setCompact] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [rootDragOver, setRootDragOver] = useState(false)

  const folderNameMap = new Map(props.folders.map((f) => [f.id, f.name]))
  const { mobileOpen = false, onMobileClose } = props

  const searchResults = searchQuery.trim()
    ? props.allFiles.filter((f) =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : []

  return (
    <TooltipProvider>
      {/* Mobile-only backdrop when sidebar is open */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity md:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden="true"
        onClick={onMobileClose}
      />
      <aside
        className={cn(
          "flex flex-col border-r bg-sidebar",
          // Mobile: fixed overlay, slides in from the left
          "fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop (md+): revert to static inline width
          "md:static md:translate-x-0 md:shrink-0 md:transition-[width]",
          compact ? "md:w-12" : "md:w-64",
        )}
      >
        <SidebarHeader
          compact={compact}
          onToggleCompact={() => setCompact((v) => !v)}
          onCreateFolder={async (name) => {
            await props.onCreateFolder(name, props.selectedFolderId)
          }}
        />
        {!compact && (
          <SidebarSearch
            query={searchQuery}
            onChange={setSearchQuery}
            onClear={() => setSearchQuery("")}
          />
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
            const itemType = e.dataTransfer.getData(DRAG_TYPE_MIME)
            const itemId = e.dataTransfer.getData(DRAG_ID_MIME)
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
