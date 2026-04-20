import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"
import { createSupabaseMock } from "@/test/supabase-mock"
import type { FileRecord } from "@/lib/types"

const mockState = createSupabaseMock()

vi.mock("@/lib/supabase", () => ({
  get supabase() {
    return mockState.supabase
  },
}))

import { useAllFiles } from "../use-all-files"

const sampleFiles: FileRecord[] = [
  {
    id: "file-1",
    user_id: "test-user-id",
    folder_id: null,
    name: "Root.md",
    type: "md",
    storage_path: "test-user-id/root/file-1.md",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "file-2",
    user_id: "test-user-id",
    folder_id: "folder-1",
    name: "Doc.pdf",
    type: "pdf",
    storage_path: "test-user-id/folder-1/file-2.pdf",
    created_at: "2026-01-02T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
  },
]

describe("useAllFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.resetTableBuilders()
    mockState.setNextResponse({ data: sampleFiles, error: null })
  })

  it("loads all files on mount regardless of folder", async () => {
    const { result } = renderHook(() => useAllFiles())

    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.allFiles).toEqual(sampleFiles)
    expect(mockState.supabase.from).toHaveBeenCalledWith("anyfolio_files")
  })

  it("handles errors gracefully (allFiles stays empty)", async () => {
    mockState.setNextResponse({ data: null, error: { message: "DB error" } })
    const { result } = renderHook(() => useAllFiles())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.allFiles).toEqual([])
  })

  it("refetch re-queries the database", async () => {
    const { result } = renderHook(() => useAllFiles())
    await waitFor(() => expect(result.current.loading).toBe(false))

    const initialCallCount = mockState.supabase.from.mock.calls.length

    await act(async () => {
      await result.current.refetch()
    })

    expect(mockState.supabase.from.mock.calls.length).toBeGreaterThan(initialCallCount)
  })
})
