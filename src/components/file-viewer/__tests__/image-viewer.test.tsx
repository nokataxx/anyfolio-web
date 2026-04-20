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

import { ImageViewer } from "../image-viewer"

describe("ImageViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:mock-url"),
      revokeObjectURL: vi.fn(),
    })
  })

  it("shows loading state initially", () => {
    mockState.supabase.storage.download.mockReturnValue(new Promise(() => {}))
    render(<ImageViewer file={makeFile({ type: "image", name: "photo.png" })} />)
    expect(screen.getByText("Loading...")).toBeInTheDocument()
  })

  it("renders an <img> with createObjectURL result after download", async () => {
    const blob = new Blob(["fake image"], { type: "image/png" })
    mockState.supabase.storage.download.mockResolvedValue({
      data: blob,
      error: null,
    })

    render(<ImageViewer file={makeFile({ type: "image", name: "photo.png" })} />)

    await waitFor(() => {
      const img = screen.getByRole("img") as HTMLImageElement
      expect(img.src).toBe("blob:mock-url")
      expect(img.alt).toBe("photo.png")
    })
  })

  it("renders error on download failure", async () => {
    mockState.supabase.storage.download.mockResolvedValue({
      data: null,
      error: { message: "Not found" },
    })

    render(<ImageViewer file={makeFile({ type: "image" })} />)

    await waitFor(() => {
      expect(screen.getByText("Not found")).toBeInTheDocument()
    })
  })
})
