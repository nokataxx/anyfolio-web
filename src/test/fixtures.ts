import type { FileRecord, Folder } from "@/lib/types"

export function makeFile(overrides: Partial<FileRecord> = {}): FileRecord {
  return {
    id: "file-1",
    user_id: "test-user-id",
    folder_id: null,
    name: "file.md",
    type: "md",
    storage_path: "test-user-id/root/file-1.md",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}

export function makeFolder(overrides: Partial<Folder> = {}): Folder {
  return {
    id: "folder-1",
    user_id: "test-user-id",
    name: "Folder",
    parent_id: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}
