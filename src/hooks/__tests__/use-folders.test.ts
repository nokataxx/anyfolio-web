import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"
import { createSupabaseMock } from "@/test/supabase-mock"
import type { Folder } from "@/lib/types"

const mockState = createSupabaseMock()

vi.mock("@/lib/supabase", () => ({
  get supabase() {
    return mockState.supabase
  },
}))

import { useFolders } from "../use-folders"

const sampleFolders: Folder[] = [
  {
    id: "folder-1",
    user_id: "test-user-id",
    name: "Documents",
    parent_id: null,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "folder-2",
    user_id: "test-user-id",
    name: "Photos",
    parent_id: null,
    created_at: "2026-01-02T00:00:00Z",
  },
  {
    id: "folder-3",
    user_id: "test-user-id",
    name: "Subfolder",
    parent_id: "folder-1",
    created_at: "2026-01-03T00:00:00Z",
  },
]

describe("useFolders", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.resetTableBuilders()
    mockState.setNextResponse({ data: sampleFolders, error: null })
  })

  it("loads folders on mount", async () => {
    const { result } = renderHook(() => useFolders())

    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.folders).toEqual(sampleFolders)
    expect(mockState.supabase.from).toHaveBeenCalledWith("anyfolio_folders")
  })

  it("handles errors gracefully (folders stays empty)", async () => {
    mockState.setNextResponse({ data: null, error: { message: "DB error" } })
    const { result } = renderHook(() => useFolders())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.folders).toEqual([])
  })

  it("createFolder inserts with current user id", async () => {
    const { result } = renderHook(() => useFolders())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.createFolder("New Folder", null)
    })

    const insertBuilder = mockState
      .getTableBuilders()
      .find((b) => b.insert.mock.calls.length > 0)
    expect(insertBuilder?.insert).toHaveBeenCalledWith({
      name: "New Folder",
      parent_id: null,
      user_id: "test-user-id",
    })
  })

  it("createFolder returns early when user is not authenticated", async () => {
    mockState.supabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
    })

    const { result } = renderHook(() => useFolders())
    await waitFor(() => expect(result.current.loading).toBe(false))

    let res: unknown
    await act(async () => {
      res = await result.current.createFolder("x", null)
    })

    expect(res).toBeUndefined()
  })

  it("deleteFolder calls delete with the given id", async () => {
    const { result } = renderHook(() => useFolders())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.deleteFolder("folder-1")
    })

    const deleteBuilder = mockState
      .getTableBuilders()
      .find((b) => b.delete.mock.calls.length > 0)
    expect(deleteBuilder?.eq).toHaveBeenCalledWith("id", "folder-1")
  })

  it("renameFolder rejects empty names", async () => {
    const { result } = renderHook(() => useFolders())
    await waitFor(() => expect(result.current.loading).toBe(false))

    let res: { error: string | null } | undefined
    await act(async () => {
      res = await result.current.renameFolder("folder-1", "   ")
    })

    expect(res?.error).toBe("Name cannot be empty")
  })

  it("renameFolder trims and updates", async () => {
    const { result } = renderHook(() => useFolders())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.renameFolder("folder-1", "  New Name  ")
    })

    const updateBuilder = mockState
      .getTableBuilders()
      .find((b) => b.update.mock.calls.length > 0)
    expect(updateBuilder?.update).toHaveBeenCalledWith({ name: "New Name" })
    expect(updateBuilder?.eq).toHaveBeenCalledWith("id", "folder-1")
  })

  it("moveFolder rejects moving into itself", async () => {
    const { result } = renderHook(() => useFolders())
    await waitFor(() => expect(result.current.loading).toBe(false))

    let res: { error: string | null } | undefined
    await act(async () => {
      res = await result.current.moveFolder("folder-1", "folder-1")
    })

    expect(res?.error).toBe("Cannot move folder into itself")
  })

  it("moveFolder rejects moving into a descendant", async () => {
    const { result } = renderHook(() => useFolders())
    await waitFor(() => expect(result.current.loading).toBe(false))

    // folder-3 has parent_id = folder-1; moving folder-1 into folder-3 should fail
    let res: { error: string | null } | undefined
    await act(async () => {
      res = await result.current.moveFolder("folder-1", "folder-3")
    })

    expect(res?.error).toBe("Cannot move folder into its own subfolder")
  })

  it("moveFolder updates parent_id when valid", async () => {
    const { result } = renderHook(() => useFolders())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.moveFolder("folder-2", "folder-1")
    })

    const updateBuilder = mockState
      .getTableBuilders()
      .find((b) => b.update.mock.calls.length > 0)
    expect(updateBuilder?.update).toHaveBeenCalledWith({ parent_id: "folder-1" })
    expect(updateBuilder?.eq).toHaveBeenCalledWith("id", "folder-2")
  })
})
