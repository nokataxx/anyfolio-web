export type Folder = {
  id: string
  user_id: string
  name: string
  parent_id: string | null
  created_at: string
}

export type FileRecord = {
  id: string
  user_id: string
  folder_id: string
  name: string
  type: "md" | "pdf" | "xlsx"
  storage_path: string
  created_at: string
  updated_at: string
}
