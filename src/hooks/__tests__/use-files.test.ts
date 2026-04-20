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

vi.mock("@/lib/pptx-to-pdf", () => ({
  convertPptxToPdf: vi.fn(async (file: File) => {
    const pdfName = file.name.replace(/\.pptx?$/i, ".pdf")
    return new File(["pdf bytes"], pdfName, { type: "application/pdf" })
  }),
}))

vi.mock("@/lib/docx-to-txt", () => ({
  convertDocxToTxt: vi.fn(async (file: File) => {
    const txtName = file.name.replace(/\.docx?$/i, ".txt")
    return new File(["plain text"], txtName, { type: "text/plain" })
  }),
}))

vi.mock("@/lib/docx-to-md", () => ({
  convertDocxToMd: vi.fn(async (file: File) => {
    const mdName = file.name.replace(/\.docx?$/i, ".md")
    return new File(["# markdown"], mdName, { type: "text/markdown" })
  }),
}))

vi.mock("@/lib/text-extraction", () => ({
  extractTextFromBlob: vi.fn().mockResolvedValue({ text: "extracted" }),
}))

import { useFiles } from "../use-files"

const sampleFiles: FileRecord[] = [
  {
    id: "file-1",
    user_id: "test-user-id",
    folder_id: "folder-1",
    name: "Existing.md",
    type: "md",
    storage_path: "test-user-id/folder-1/file-1.md",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
]

describe("useFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.resetTableBuilders()
    mockState.setNextResponse({ data: sampleFiles, error: null })
    // Reset storage defaults
    mockState.supabase.storage.upload.mockResolvedValue({ data: null, error: null })
    mockState.supabase.storage.remove.mockResolvedValue({ data: null, error: null })
  })

  it("loads files scoped to the given folder id (eq filter)", async () => {
    const { result } = renderHook(() => useFiles("folder-1"))

    await waitFor(() => {
      expect(result.current.files).toEqual(sampleFiles)
    })

    const loadBuilder = mockState.getTableBuilders()[0]
    expect(loadBuilder.eq).toHaveBeenCalledWith("folder_id", "folder-1")
  })

  it("loads files at root using is(null) filter", async () => {
    renderHook(() => useFiles(null))

    await waitFor(() => {
      expect(mockState.getTableBuilders()[0]?.is).toHaveBeenCalledWith(
        "folder_id",
        null,
      )
    })
  })

  it("uploadFile rejects unsupported extensions", async () => {
    const { result } = renderHook(() => useFiles(null))
    await waitFor(() => expect(result.current.files.length).toBeGreaterThan(0))

    const badFile = new File(["x"], "data.csv", { type: "text/csv" })
    let res: { error: string | null } | undefined
    await act(async () => {
      res = await result.current.uploadFile(badFile, null)
    })

    expect(res?.error).toContain("supported")
    expect(mockState.supabase.storage.upload).not.toHaveBeenCalled()
  })

  it("uploadFile returns auth error when user is not logged in", async () => {
    mockState.supabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
    })

    const { result } = renderHook(() => useFiles(null))
    await waitFor(() => expect(result.current.files.length).toBeGreaterThan(0))

    const file = new File(["x"], "note.md", { type: "text/markdown" })
    let res: { error: string | null } | undefined
    await act(async () => {
      res = await result.current.uploadFile(file, null)
    })

    expect(res?.error).toBe("Not authenticated")
  })

  it("uploadFile: md file uploads, inserts DB row, and refetches", async () => {
    const { result } = renderHook(() => useFiles(null))
    await waitFor(() => expect(result.current.files.length).toBeGreaterThan(0))

    const file = new File(["# hi"], "note.md", { type: "text/markdown" })
    await act(async () => {
      await result.current.uploadFile(file, null)
    })

    expect(mockState.supabase.storage.upload).toHaveBeenCalledOnce()
    const insertBuilder = mockState
      .getTableBuilders()
      .find((b) => b.insert.mock.calls.length > 0)
    const insertedRow = insertBuilder?.insert.mock.calls[0][0] as {
      name: string
      type: string
      content_text: string | null
    }
    expect(insertedRow.name).toBe("note.md")
    expect(insertedRow.type).toBe("md")
    expect(insertedRow.content_text).toBe("extracted")
  })

  it("uploadFile: docx converts to md and renames", async () => {
    const { result } = renderHook(() => useFiles(null))
    await waitFor(() => expect(result.current.files.length).toBeGreaterThan(0))

    const docxFile = new File(["docx bytes"], "report.docx")
    await act(async () => {
      await result.current.uploadFile(docxFile, null)
    })

    const insertBuilder = mockState
      .getTableBuilders()
      .find((b) => b.insert.mock.calls.length > 0)
    const insertedRow = insertBuilder?.insert.mock.calls[0][0] as {
      name: string
      type: string
      storage_path: string
    }
    expect(insertedRow.name).toBe("report.md")
    expect(insertedRow.type).toBe("md")
    expect(insertedRow.storage_path).toMatch(/\.md$/)
  })

  it("uploadFile: txt converts to md and renames", async () => {
    const { result } = renderHook(() => useFiles(null))
    await waitFor(() => expect(result.current.files.length).toBeGreaterThan(0))

    const txtFile = new File(["plain content"], "memo.txt", { type: "text/plain" })
    await act(async () => {
      await result.current.uploadFile(txtFile, null)
    })

    const insertBuilder = mockState
      .getTableBuilders()
      .find((b) => b.insert.mock.calls.length > 0)
    const insertedRow = insertBuilder?.insert.mock.calls[0][0] as {
      name: string
      type: string
      storage_path: string
    }
    expect(insertedRow.name).toBe("memo.md")
    expect(insertedRow.type).toBe("md")
    expect(insertedRow.storage_path).toMatch(/\.md$/)
  })

  it("uploadFile: legacy .doc converts to md via text extraction", async () => {
    const { result } = renderHook(() => useFiles(null))
    await waitFor(() => expect(result.current.files.length).toBeGreaterThan(0))

    const docFile = new File(["doc bytes"], "legacy.doc")
    await act(async () => {
      await result.current.uploadFile(docFile, null)
    })

    const insertBuilder = mockState
      .getTableBuilders()
      .find((b) => b.insert.mock.calls.length > 0)
    const insertedRow = insertBuilder?.insert.mock.calls[0][0] as {
      name: string
      type: string
      storage_path: string
    }
    expect(insertedRow.name).toBe("legacy.md")
    expect(insertedRow.type).toBe("md")
    expect(insertedRow.storage_path).toMatch(/\.md$/)
  })

  it("uploadFile: pptx converts to pdf and renames", async () => {
    const { result } = renderHook(() => useFiles(null))
    await waitFor(() => expect(result.current.files.length).toBeGreaterThan(0))

    const pptxFile = new File(["pptx bytes"], "slides.pptx")
    await act(async () => {
      await result.current.uploadFile(pptxFile, null)
    })

    const insertBuilder = mockState
      .getTableBuilders()
      .find((b) => b.insert.mock.calls.length > 0)
    const insertedRow = insertBuilder?.insert.mock.calls[0][0] as {
      name: string
      type: string
    }
    expect(insertedRow.name).toBe("slides.pdf")
    expect(insertedRow.type).toBe("pdf")
  })

  it("uploadFile: image extension is detected", async () => {
    const { result } = renderHook(() => useFiles(null))
    await waitFor(() => expect(result.current.files.length).toBeGreaterThan(0))

    const img = new File(["png bytes"], "photo.png", { type: "image/png" })
    await act(async () => {
      await result.current.uploadFile(img, null)
    })

    const insertBuilder = mockState
      .getTableBuilders()
      .find((b) => b.insert.mock.calls.length > 0)
    expect(
      (insertBuilder?.insert.mock.calls[0][0] as { type: string }).type,
    ).toBe("image")
  })

  it("uploadFile: xls is normalized to xlsx type", async () => {
    const { result } = renderHook(() => useFiles(null))
    await waitFor(() => expect(result.current.files.length).toBeGreaterThan(0))

    const xls = new File(["xls bytes"], "sheet.xls")
    await act(async () => {
      await result.current.uploadFile(xls, null)
    })

    const insertBuilder = mockState
      .getTableBuilders()
      .find((b) => b.insert.mock.calls.length > 0)
    expect(
      (insertBuilder?.insert.mock.calls[0][0] as { type: string }).type,
    ).toBe("xlsx")
  })

  it("uploadFile: storage upload error propagates", async () => {
    mockState.supabase.storage.upload.mockResolvedValueOnce({
      data: null,
      error: { message: "Storage full" },
    })

    const { result } = renderHook(() => useFiles(null))
    await waitFor(() => expect(result.current.files.length).toBeGreaterThan(0))

    const file = new File(["x"], "note.md")
    let res: { error: string | null } | undefined
    await act(async () => {
      res = await result.current.uploadFile(file, null)
    })

    expect(res?.error).toBe("Storage full")
  })

  it("deleteFile removes from storage and DB", async () => {
    const { result } = renderHook(() => useFiles(null))
    await waitFor(() => expect(result.current.files.length).toBeGreaterThan(0))

    await act(async () => {
      await result.current.deleteFile(sampleFiles[0])
    })

    expect(mockState.supabase.storage.remove).toHaveBeenCalledWith([
      sampleFiles[0].storage_path,
    ])
    const deleteBuilder = mockState
      .getTableBuilders()
      .find((b) => b.delete.mock.calls.length > 0)
    expect(deleteBuilder?.eq).toHaveBeenCalledWith("id", sampleFiles[0].id)
  })

  it("renameFile rejects empty names", async () => {
    const { result } = renderHook(() => useFiles(null))
    await waitFor(() => expect(result.current.files.length).toBeGreaterThan(0))

    let res: { error: string | null } | undefined
    await act(async () => {
      res = await result.current.renameFile(sampleFiles[0], "   ")
    })

    expect(res?.error).toBe("Name cannot be empty")
  })

  it("moveFile updates folder_id", async () => {
    const { result } = renderHook(() => useFiles(null))
    await waitFor(() => expect(result.current.files.length).toBeGreaterThan(0))

    await act(async () => {
      await result.current.moveFile("file-1", "folder-2")
    })

    const updateBuilder = mockState
      .getTableBuilders()
      .find((b) => b.update.mock.calls.length > 0)
    expect(updateBuilder?.update).toHaveBeenCalledWith({ folder_id: "folder-2" })
    expect(updateBuilder?.eq).toHaveBeenCalledWith("id", "file-1")
  })

  it("updateFileContent: saves when updated_at matches", async () => {
    const { result } = renderHook(() => useFiles(null))
    await waitFor(() => expect(result.current.files.length).toBeGreaterThan(0))

    mockState.setNextResponse({
      data: { updated_at: "2026-01-01T00:00:00Z" },
      error: null,
    })

    let saveResult: Awaited<ReturnType<typeof result.current.updateFileContent>> | null = null
    await act(async () => {
      saveResult = await result.current.updateFileContent(
        sampleFiles[0],
        "# edited",
        { expectedUpdatedAt: "2026-01-01T00:00:00Z" },
      )
    })

    expect(saveResult!.error).toBeNull()
    expect(mockState.supabase.storage.upload).toHaveBeenCalledWith(
      sampleFiles[0].storage_path,
      expect.any(Blob),
      expect.objectContaining({ upsert: true, contentType: "text/markdown" }),
    )
    const updateBuilder = mockState
      .getTableBuilders()
      .find((b) => b.update.mock.calls.length > 0)
    const updatePayload = updateBuilder?.update.mock.calls[0][0] as {
      content_text: string
      updated_at: string
    }
    expect(updatePayload.content_text).toBe("extracted")
    expect(updatePayload.updated_at).toBeTruthy()
  })

  it("updateFileContent: returns conflict when updated_at differs", async () => {
    const { result } = renderHook(() => useFiles(null))
    await waitFor(() => expect(result.current.files.length).toBeGreaterThan(0))

    mockState.setNextResponse({
      data: { updated_at: "2026-02-02T00:00:00Z" },
      error: null,
    })

    let saveResult: Awaited<ReturnType<typeof result.current.updateFileContent>> | null = null
    await act(async () => {
      saveResult = await result.current.updateFileContent(
        sampleFiles[0],
        "# edited",
        { expectedUpdatedAt: "2026-01-01T00:00:00Z" },
      )
    })

    const conflictResult = saveResult as unknown as {
      error: string
      conflict?: boolean
      latestUpdatedAt?: string
    }
    expect(conflictResult.error).toBe("CONFLICT")
    expect(conflictResult.conflict).toBe(true)
    expect(mockState.supabase.storage.upload).not.toHaveBeenCalled()
  })

  it("updateFileContent: overwrite skips conflict check", async () => {
    const { result } = renderHook(() => useFiles(null))
    await waitFor(() => expect(result.current.files.length).toBeGreaterThan(0))

    const beforeFromCount = mockState.getTableBuilders().length

    await act(async () => {
      await result.current.updateFileContent(sampleFiles[0], "# edited", {
        expectedUpdatedAt: "2026-01-01T00:00:00Z",
        overwrite: true,
      })
    })

    // With overwrite, the pre-update SELECT(updated_at).single() (no update()) is skipped.
    // The final UPDATE-then-SELECT chain is still expected.
    const preconditionSelects = mockState
      .getTableBuilders()
      .slice(beforeFromCount)
      .filter(
        (b) =>
          b.select.mock.calls.length > 0 &&
          b.single.mock.calls.length > 0 &&
          b.update.mock.calls.length === 0,
      )
    expect(preconditionSelects).toHaveLength(0)
    expect(mockState.supabase.storage.upload).toHaveBeenCalled()
  })
})
