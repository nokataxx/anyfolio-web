import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createSupabaseMock } from "@/test/supabase-mock"
import { makeFile } from "@/test/fixtures"

const mockState = createSupabaseMock()

vi.mock("@/lib/supabase", () => ({
  get supabase() {
    return mockState.supabase
  },
}))

// Mock xlsx
const mockRead = vi.fn()
const mockSheetToJson = vi.fn()

vi.mock("xlsx", () => ({
  read: (...args: unknown[]) => mockRead(...args),
  utils: {
    sheet_to_json: (...args: unknown[]) => mockSheetToJson(...args),
  },
}))

import { ExcelViewer } from "../excel-viewer"

describe("ExcelViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows loading initially", () => {
    mockState.supabase.storage.download.mockReturnValue(new Promise(() => {}))
    render(<ExcelViewer file={makeFile({ type: "xlsx" })} />)
    expect(screen.getByText("Loading...")).toBeInTheDocument()
  })

  it("renders table rows from the first sheet", async () => {
    const blob = new Blob(["binary xlsx bytes"])
    mockState.supabase.storage.download.mockResolvedValue({
      data: blob,
      error: null,
    })
    mockRead.mockReturnValue({
      SheetNames: ["Sheet1"],
      Sheets: { Sheet1: {} },
    })
    mockSheetToJson.mockReturnValue([
      ["Name", "Age"],
      ["Alice", 30],
      ["Bob", 25],
    ])

    render(<ExcelViewer file={makeFile({ type: "xlsx" })} />)

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument()
    })
    expect(screen.getByText("Name")).toBeInTheDocument()
    expect(screen.getByText("30")).toBeInTheDocument()
  })

  it("does not render sheet tabs when only one sheet exists", async () => {
    const blob = new Blob(["x"])
    mockState.supabase.storage.download.mockResolvedValue({
      data: blob,
      error: null,
    })
    mockRead.mockReturnValue({
      SheetNames: ["Only"],
      Sheets: { Only: {} },
    })
    mockSheetToJson.mockReturnValue([["A"]])

    render(<ExcelViewer file={makeFile({ type: "xlsx" })} />)

    await waitFor(() => expect(screen.getByText("A")).toBeInTheDocument())
    // Tab button has text "Only" — it should NOT be present since only 1 sheet
    expect(screen.queryByRole("button", { name: "Only" })).toBeNull()
  })

  it("switches sheets when a tab is clicked", async () => {
    const blob = new Blob(["x"])
    mockState.supabase.storage.download.mockResolvedValue({
      data: blob,
      error: null,
    })
    mockRead.mockReturnValue({
      SheetNames: ["Sheet1", "Sheet2"],
      Sheets: { Sheet1: { a: 1 }, Sheet2: { b: 2 } },
    })
    mockSheetToJson.mockImplementation((sheet) => {
      if (sheet?.a === 1) return [["S1A"]]
      return [["S2B"]]
    })

    render(<ExcelViewer file={makeFile({ type: "xlsx" })} />)

    await waitFor(() => expect(screen.getByText("S1A")).toBeInTheDocument())

    await userEvent.click(screen.getByRole("button", { name: "Sheet2" }))

    await waitFor(() => expect(screen.getByText("S2B")).toBeInTheDocument())
    expect(screen.queryByText("S1A")).toBeNull()
  })

  it("renders error on download failure", async () => {
    mockState.supabase.storage.download.mockResolvedValue({
      data: null,
      error: { message: "Fetch failed" },
    })

    render(<ExcelViewer file={makeFile({ type: "xlsx" })} />)

    await waitFor(() => {
      expect(screen.getByText("Fetch failed")).toBeInTheDocument()
    })
  })
})
