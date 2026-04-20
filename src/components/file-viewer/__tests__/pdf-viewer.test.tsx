import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createSupabaseMock } from "@/test/supabase-mock"
import { makeFile } from "@/test/fixtures"
import { useEffect } from "react"

const mockState = createSupabaseMock()

vi.mock("@/lib/supabase", () => ({
  get supabase() {
    return mockState.supabase
  },
}))

// Mock react-pdf — replace Document and Page with simple stubs
vi.mock("react-pdf", () => {
  return {
    pdfjs: { GlobalWorkerOptions: { workerSrc: "" } },
    Document: ({
      children,
      onLoadSuccess,
    }: {
      children: React.ReactNode
      onLoadSuccess?: (info: { numPages: number }) => void
    }) => {
      // Simulate async load completion
      useEffect(() => {
        onLoadSuccess?.({ numPages: 3 })
      }, [onLoadSuccess])
      return <div data-testid="pdf-document">{children}</div>
    },
    Page: ({ pageNumber }: { pageNumber: number }) => (
      <div data-testid="pdf-page">Page {pageNumber}</div>
    ),
  }
})

// Mock the CSS imports (vitest usually handles these but be explicit)
vi.mock("react-pdf/dist/Page/AnnotationLayer.css", () => ({}))
vi.mock("react-pdf/dist/Page/TextLayer.css", () => ({}))

import { PdfViewer } from "../pdf-viewer"

describe("PdfViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:mock-pdf"),
      revokeObjectURL: vi.fn(),
    })
  })

  it("shows loading while download pending", () => {
    mockState.supabase.storage.download.mockReturnValue(new Promise(() => {}))
    render(<PdfViewer file={makeFile({ type: "pdf" })} />)
    expect(screen.getByText("Loading...")).toBeInTheDocument()
  })

  it("renders PDF document and page 1 after load", async () => {
    mockState.supabase.storage.download.mockResolvedValue({
      data: new Blob(["pdf bytes"]),
      error: null,
    })

    render(<PdfViewer file={makeFile({ type: "pdf" })} />)

    await waitFor(() => {
      expect(screen.getByTestId("pdf-page")).toHaveTextContent("Page 1")
    })
    await waitFor(() => {
      // Text is split across spans, so use a flexible matcher
      expect(
        screen.getByText((_, el) => el?.textContent === "1 / 3"),
      ).toBeInTheDocument()
    })
  })

  it("navigates to next page when the next button is clicked", async () => {
    mockState.supabase.storage.download.mockResolvedValue({
      data: new Blob(["pdf bytes"]),
      error: null,
    })

    render(<PdfViewer file={makeFile({ type: "pdf" })} />)

    await waitFor(() => {
      expect(
        screen.getByText((_, el) => el?.textContent === "1 / 3"),
      ).toBeInTheDocument()
    })

    const buttons = screen.getAllByRole("button")
    // Nav buttons: [prev, next, zoomOut, zoomIn]
    const nextBtn = buttons[1]
    await userEvent.click(nextBtn)

    expect(
      screen.getByText((_, el) => el?.textContent === "2 / 3"),
    ).toBeInTheDocument()
  })

  it("disables prev button on the first page", async () => {
    mockState.supabase.storage.download.mockResolvedValue({
      data: new Blob(["pdf"]),
      error: null,
    })

    render(<PdfViewer file={makeFile({ type: "pdf" })} />)

    await waitFor(() => {
      expect(
        screen.getByText((_, el) => el?.textContent === "1 / 3"),
      ).toBeInTheDocument()
    })

    const buttons = screen.getAllByRole("button")
    expect(buttons[0]).toBeDisabled() // prev disabled at page 1
  })

  it("honors initialPage prop", async () => {
    mockState.supabase.storage.download.mockResolvedValue({
      data: new Blob(["pdf"]),
      error: null,
    })

    render(<PdfViewer file={makeFile({ type: "pdf" })} initialPage={2} />)

    await waitFor(() => {
      expect(
        screen.getByText((_, el) => el?.textContent === "2 / 3"),
      ).toBeInTheDocument()
    })
  })

  it("renders error on download failure", async () => {
    mockState.supabase.storage.download.mockResolvedValue({
      data: null,
      error: { message: "PDF not found" },
    })

    render(<PdfViewer file={makeFile({ type: "pdf" })} />)

    await waitFor(() => {
      expect(screen.getByText("PDF not found")).toBeInTheDocument()
    })
  })
})
