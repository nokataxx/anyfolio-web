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

import { MarkdownViewer } from "../markdown-viewer"

const fileA = makeFile({ id: "a", name: "Note.md", type: "md" })
const fileB = makeFile({ id: "b", name: "Other.md", type: "md" })

describe("MarkdownViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows loading initially", () => {
    mockState.supabase.storage.download.mockReturnValue(new Promise(() => {}))
    render(
      <MarkdownViewer
        file={fileA}
        allFiles={[fileA, fileB]}
        onNavigateToFile={vi.fn()}
      />,
    )
    expect(screen.getByText("Loading...")).toBeInTheDocument()
  })

  it("renders headings and paragraphs from markdown", async () => {
    const blob = new Blob(["# Title\n\nSome paragraph text."], {
      type: "text/markdown",
    })
    mockState.supabase.storage.download.mockResolvedValue({
      data: blob,
      error: null,
    })

    render(
      <MarkdownViewer
        file={fileA}
        allFiles={[fileA, fileB]}
        onNavigateToFile={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1, name: "Title" }),
      ).toBeInTheDocument()
    })
    expect(screen.getByText("Some paragraph text.")).toBeInTheDocument()
  })

  it("renders external link with target=_blank", async () => {
    const blob = new Blob(["See [external](https://example.com) for info"], {
      type: "text/markdown",
    })
    mockState.supabase.storage.download.mockResolvedValue({
      data: blob,
      error: null,
    })

    render(
      <MarkdownViewer
        file={fileA}
        allFiles={[fileA, fileB]}
        onNavigateToFile={vi.fn()}
      />,
    )

    await waitFor(() => {
      const link = screen.getByRole("link", { name: "external" })
      expect(link).toHaveAttribute("target", "_blank")
      expect(link).toHaveAttribute("href", "https://example.com")
    })
  })

  it("renders download error", async () => {
    mockState.supabase.storage.download.mockResolvedValue({
      data: null,
      error: { message: "Storage error" },
    })

    render(
      <MarkdownViewer
        file={fileA}
        allFiles={[fileA]}
        onNavigateToFile={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText("Storage error")).toBeInTheDocument()
    })
  })
})
