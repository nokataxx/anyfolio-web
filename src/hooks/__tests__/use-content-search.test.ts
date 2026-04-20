import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"
import { createSupabaseMock } from "@/test/supabase-mock"
import type { FileRecord, Folder } from "@/lib/types"

const mockState = createSupabaseMock()

vi.mock("@/lib/supabase", () => ({
  get supabase() {
    return mockState.supabase
  },
}))

vi.mock("@/lib/backfill-content-text", () => ({
  backfillContentText: vi.fn().mockResolvedValue(undefined),
}))

import { useContentSearch } from "../use-content-search"
import { backfillContentText } from "@/lib/backfill-content-text"

const folders: Folder[] = [
  {
    id: "folder-1",
    user_id: "test-user-id",
    name: "Documents",
    parent_id: null,
    created_at: "2026-01-01T00:00:00Z",
  },
]

const allFiles: FileRecord[] = [
  {
    id: "file-1",
    user_id: "test-user-id",
    folder_id: "folder-1",
    name: "Note.md",
    type: "md",
    storage_path: "test-user-id/folder-1/file-1.md",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
]

const rpcRow = {
  file_id: "file-1",
  file_user_id: "test-user-id",
  file_folder_id: "folder-1",
  file_name: "Note.md",
  file_type: "md",
  file_storage_path: "test-user-id/folder-1/file-1.md",
  file_created_at: "2026-01-01T00:00:00Z",
  file_updated_at: "2026-01-01T00:00:00Z",
  match_context: "hello world",
  match_index: 0,
  pdf_page: null,
}

describe("useContentSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockState.resetTableBuilders()
    mockState.supabase.rpc.mockResolvedValue({ data: [rpcRow], error: null })
  })

  it("returns empty state when disabled", () => {
    const { result } = renderHook(() =>
      useContentSearch(allFiles, folders, false),
    )

    expect(result.current.query).toBe("")
    expect(result.current.results).toEqual([])
    expect(result.current.isSearching).toBe(false)
  })

  it("triggers backfill when enabled with files", async () => {
    vi.useRealTimers()
    renderHook(() => useContentSearch(allFiles, folders, true))

    await waitFor(() => {
      expect(backfillContentText).toHaveBeenCalledWith(allFiles)
    })
  })

  it("does not trigger backfill when allFiles is empty", () => {
    renderHook(() => useContentSearch([], folders, true))
    expect(backfillContentText).not.toHaveBeenCalled()
  })

  it("debounces search — no RPC call before debounce expires", async () => {
    const { result } = renderHook(() =>
      useContentSearch(allFiles, folders, true),
    )

    act(() => {
      result.current.setQuery("hello")
    })

    // Advance only partway; RPC should not fire yet
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(mockState.supabase.rpc).not.toHaveBeenCalled()
  })

  it("calls RPC with the query after debounce", async () => {
    const { result } = renderHook(() =>
      useContentSearch(allFiles, folders, true),
    )

    act(() => {
      result.current.setQuery("hello")
    })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    await vi.waitFor(() => {
      expect(mockState.supabase.rpc).toHaveBeenCalledWith("search_file_contents", {
        search_query: "hello",
        max_results: 50,
      })
    })
  })

  it("maps RPC rows to SearchResult with folder name resolved", async () => {
    const { result } = renderHook(() =>
      useContentSearch(allFiles, folders, true),
    )

    act(() => {
      result.current.setQuery("hello")
    })
    act(() => {
      vi.advanceTimersByTime(300)
    })

    await vi.waitFor(() => {
      expect(result.current.results.length).toBe(1)
    })

    const r = result.current.results[0]
    expect(r.file.id).toBe("file-1")
    expect(r.folderName).toBe("Documents")
    expect(r.matchContext).toBe("hello world")
    expect(r.query).toBe("hello")
  })

  it("returns empty results when RPC errors", async () => {
    mockState.supabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "RPC failed" },
    })

    const { result } = renderHook(() =>
      useContentSearch(allFiles, folders, true),
    )

    act(() => {
      result.current.setQuery("hello")
    })
    act(() => {
      vi.advanceTimersByTime(300)
    })

    await vi.waitFor(() => {
      expect(result.current.isSearching).toBe(false)
    })
    expect(result.current.results).toEqual([])
  })

  it("resets state when enabled flips from true to false", async () => {
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useContentSearch(allFiles, folders, enabled),
      { initialProps: { enabled: true } },
    )

    act(() => {
      result.current.setQuery("hello")
    })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    await vi.waitFor(() => expect(result.current.results.length).toBe(1))

    rerender({ enabled: false })

    expect(result.current.query).toBe("")
    expect(result.current.results).toEqual([])
  })
})
