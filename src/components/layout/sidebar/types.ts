import type { Folder as FolderType, FileRecord } from "@/lib/types"

export type SidebarProps = {
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

export const DRAG_TYPE_MIME = "application/x-anyfolio-type"
export const DRAG_ID_MIME = "application/x-anyfolio-id"

export type DragItemKind = "file" | "folder"
