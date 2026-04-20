import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { createSupabaseMock } from "@/test/supabase-mock"
import { makeFile } from "@/test/fixtures"

const mockState = createSupabaseMock()

vi.mock("@/lib/supabase", () => ({
  get supabase() {
    return mockState.supabase
  },
}))

import { TextViewer } from "../text-viewer"

describe("TextViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows loading state initially", () => {
    mockState.supabase.storage.download.mockReturnValue(new Promise(() => {}))
    render(<TextViewer file={makeFile({ type: "txt", name: "a.txt" })} />)
    expect(screen.getByText("Loading...")).toBeInTheDocument()
  })

  it("renders downloaded text content", async () => {
    const blob = new Blob(["Hello world"], { type: "text/plain" })
    mockState.supabase.storage.download.mockResolvedValue({
      data: blob,
      error: null,
    })

    render(<TextViewer file={makeFile({ type: "txt" })} />)

    await waitFor(() => {
      expect(screen.getByText("Hello world")).toBeInTheDocument()
    })
  })

  it("renders error message on download failure", async () => {
    mockState.supabase.storage.download.mockResolvedValue({
      data: null,
      error: { message: "Network error" },
    })

    render(<TextViewer file={makeFile({ type: "txt" })} />)

    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument()
    })
  })
})
