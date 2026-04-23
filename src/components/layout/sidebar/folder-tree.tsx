import { useState } from "react"
import { FileItem } from "./file-item"
import { FolderItem } from "./folder-item"
import type { Folder as FolderType } from "@/lib/types"
import { DRAG_ID_MIME, DRAG_TYPE_MIME, type SidebarProps } from "./types"

type FolderTreeProps = SidebarProps & {
  parentId: string | null
  compact: boolean
  depth?: number
}

export function FolderTree({
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
  onDownloadFile,
  onCreateFile,
  onMoveFile,
  onMoveFolder,
  depth = 0,
}: FolderTreeProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editFolderName, setEditFolderName] = useState("")
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)

  const handleDrop = async (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverFolderId(null)
    const itemType = e.dataTransfer.getData(DRAG_TYPE_MIME)
    const itemId = e.dataTransfer.getData(DRAG_ID_MIME)
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

  const startEditing = (folder: FolderType) => {
    setEditFolderName(folder.name)
    setEditingFolderId(folder.id)
  }

  return (
    <>
      {children.map((folder) => {
        const isExpanded = expanded[folder.id] ?? false
        const isSelected = selectedFolderId === folder.id && !selectedFileId
        const isEditing = editingFolderId === folder.id
        const childFiles = allFiles.filter((f) => f.folder_id === folder.id)
        const isDragOver = dragOverFolderId === folder.id

        return (
          <div key={folder.id}>
            <FolderItem
              folder={folder}
              depth={depth}
              compact={compact}
              isSelected={isSelected}
              isExpanded={isExpanded}
              isEditing={isEditing}
              isDragOver={isDragOver}
              editName={editFolderName}
              onEditNameChange={setEditFolderName}
              onStartEditing={startEditing}
              onCancelEditing={() => setEditingFolderId(null)}
              onSubmitRename={() => handleFolderRenameSubmit(folder.id, folder.name)}
              onToggleExpand={() =>
                setExpanded((prev) => ({ ...prev, [folder.id]: !prev[folder.id] }))
              }
              onSelect={() => onSelectFolder(folder.id)}
              onDelete={() => onDeleteFolder(folder.id)}
              onDragOver={(e) => handleDragOver(e, folder.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, folder.id)}
            />
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
                    onDownloadFile={onDownloadFile}
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
                  onDownloadFile={onDownloadFile}
                  onCreateFile={onCreateFile}
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
          onDownloadFile={onDownloadFile}
        />
      ))}
    </>
  )
}
