import { describe, it, expect, beforeEach, vi } from "vitest"
import { createSupabaseMock } from "@/test/supabase-mock"
import type { FileRecord } from "@/lib/types"

const mockState = createSupabaseMock()

vi.mock("@/lib/supabase", () => ({
  get supabase() {
    return mockState.supabase
  },
}))

vi.mock("@/lib/text-extraction", () => ({
  extractText: vi.fn().mockResolvedValue("extracted text"),
  getPdfPageTexts: vi.fn().mockReturnValue(["page 1 text"]),
}))

const allFiles: FileRecord[] = [
  {
    id: "file-1",
    user_id: "test-user-id",
    folder_id: null,
    name: "Note.md",
    type: "md",
    storage_path: "test-user-id/root/file-1.md",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "file-2",
    user_id: "test-user-id",
    folder_id: null,
    name: "Doc.pdf",
    type: "pdf",
    storage_path: "test-user-id/root/file-2.pdf",
    created_at: "2026-01-02T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
  },
  {
    id: "file-3",
    user_id: "test-user-id",
    folder_id: null,
    name: "photo.png",
    type: "image",
    storage_path: "test-user-id/root/file-3.png",
    created_at: "2026-01-03T00:00:00Z",
    updated_at: "2026-01-03T00:00:00Z",
  },
]

/**
 * Re-import the module with fresh internal state (backfillDone / backfillRunning
 * flags) for each test.
 */
async function importFresh() {
  vi.resetModules()
  const mod = await import("../backfill-content-text")
  return mod.backfillContentText
}

describe("backfillContentText", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.resetTableBuilders()
  })

  it("is a no-op when the select query returns no rows needing backfill", async () => {
    mockState.setNextResponse({ data: [], error: null })
    const backfillContentText = await importFresh()

    await backfillContentText(allFiles)

    // Only the initial select was called; no update queries issued
    const updateBuilders = mockState
      .getTableBuilders()
      .filter((b) => b.update.mock.calls.length > 0)
    expect(updateBuilders).toHaveLength(0)
  })

  it("is a no-op when select errors", async () => {
    mockState.setNextResponse({ data: null, error: { message: "DB error" } })
    const backfillContentText = await importFresh()

    await backfillContentText(allFiles)

    const updateBuilders = mockState
      .getTableBuilders()
      .filter((b) => b.update.mock.calls.length > 0)
    expect(updateBuilders).toHaveLength(0)
  })

  it("skips non-searchable file types (e.g. image)", async () => {
    // Only file-3 (image) is missing content_text — should be skipped
    mockState.setNextResponse({ data: [{ id: "file-3" }], error: null })
    const backfillContentText = await importFresh()

    await backfillContentText(allFiles)

    const updateBuilders = mockState
      .getTableBuilders()
      .filter((b) => b.update.mock.calls.length > 0)
    expect(updateBuilders).toHaveLength(0)
  })

  it("updates content_text for md files", async () => {
    mockState.setNextResponse({ data: [{ id: "file-1" }], error: null })
    const backfillContentText = await importFresh()

    await backfillContentText(allFiles)

    const updateBuilder = mockState
      .getTableBuilders()
      .find((b) => b.update.mock.calls.length > 0)
    expect(updateBuilder?.update).toHaveBeenCalledWith({
      content_text: "extracted text",
      content_pages: null,
    })
    expect(updateBuilder?.eq).toHaveBeenCalledWith("id", "file-1")
  })

  it("updates content_text AND content_pages for pdf files", async () => {
    mockState.setNextResponse({ data: [{ id: "file-2" }], error: null })
    const backfillContentText = await importFresh()

    await backfillContentText(allFiles)

    const updateBuilder = mockState
      .getTableBuilders()
      .find((b) => b.update.mock.calls.length > 0)
    expect(updateBuilder?.update).toHaveBeenCalledWith({
      content_text: "extracted text",
      content_pages: ["page 1 text"],
    })
  })

  it("subsequent calls are no-ops once done", async () => {
    mockState.setNextResponse({ data: [], error: null })
    const backfillContentText = await importFresh()

    await backfillContentText(allFiles)
    const firstCallCount = mockState.supabase.from.mock.calls.length

    await backfillContentText(allFiles)
    expect(mockState.supabase.from.mock.calls.length).toBe(firstCallCount)
  })

  it("continues processing when individual extractions fail", async () => {
    const { extractText } = await import("@/lib/text-extraction")
    vi.mocked(extractText).mockRejectedValueOnce(new Error("bad file"))

    mockState.setNextResponse({
      data: [{ id: "file-1" }, { id: "file-2" }],
      error: null,
    })
    const backfillContentText = await importFresh()

    await backfillContentText(allFiles)

    // Even though file-1 failed, file-2 should still be updated
    const updateBuilders = mockState
      .getTableBuilders()
      .filter((b) => b.update.mock.calls.length > 0)
    expect(updateBuilders.length).toBeGreaterThanOrEqual(1)
  })
})
