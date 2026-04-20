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

// Build a minimal PPTX zip's file map using JSZip mocks
vi.mock("jszip", () => {
  const zipFiles = new Map<string, { async: (kind: string) => Promise<string | Blob> }>()
  const zipObject = {
    file: (path: string) => zipFiles.get(path),
    forEach: (cb: (path: string) => void) => {
      zipFiles.forEach((_v, path) => cb(path))
    },
  }
  const JSZip = {
    loadAsync: vi.fn().mockResolvedValue(zipObject),
  }
  ;(JSZip as unknown as { __setFiles: typeof setZipFiles }).__setFiles = setZipFiles

  function setZipFiles(files: Record<string, string>) {
    zipFiles.clear()
    for (const [path, content] of Object.entries(files)) {
      zipFiles.set(path, {
        async: async (kind: string) => {
          if (kind === "text") return content
          return new Blob([content])
        },
      })
    }
  }
  return { default: JSZip }
})

import JSZip from "jszip"
import { PptxViewer } from "../pptx-viewer"

function slideXml(text: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree>
    <p:sp>
      <p:spPr><a:xfrm>
        <a:off x="0" y="0"/><a:ext cx="9144000" cy="6858000"/>
      </a:xfrm></p:spPr>
      <p:txBody>
        <a:p><a:r><a:rPr sz="2400" b="1"/><a:t>${text}</a:t></a:r></a:p>
      </p:txBody>
    </p:sp>
  </p:spTree></p:cSld>
</p:sld>`
}

const presentationXml = `<?xml version="1.0"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldSz cx="9144000" cy="6858000"/>
</p:presentation>`

describe("PptxViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:pptx-media"),
      revokeObjectURL: vi.fn(),
    })
  })

  it("shows loading initially", () => {
    mockState.supabase.storage.download.mockReturnValue(new Promise(() => {}))
    render(<PptxViewer file={makeFile({ type: "pptx" })} />)
    expect(screen.getByText("Loading...")).toBeInTheDocument()
  })

  it("renders parsed slides with text content", async () => {
    mockState.supabase.storage.download.mockResolvedValue({
      data: new Blob(["zip bytes"]),
      error: null,
    })
    ;(JSZip as unknown as { __setFiles: (f: Record<string, string>) => void }).__setFiles({
      "ppt/presentation.xml": presentationXml,
      "ppt/slides/slide1.xml": slideXml("First slide"),
      "ppt/slides/slide2.xml": slideXml("Second slide"),
    })

    render(<PptxViewer file={makeFile({ type: "pptx" })} />)

    await waitFor(() => {
      expect(screen.getByText("First slide")).toBeInTheDocument()
    })
    // The counter is in a <span> — find it by role via its tag
    const counter = document.querySelector("span.tabular-nums")
    expect(counter?.textContent).toBe("1 / 2")
  })

  it("navigates to the next slide when next button is clicked", async () => {
    mockState.supabase.storage.download.mockResolvedValue({
      data: new Blob(["zip"]),
      error: null,
    })
    ;(JSZip as unknown as { __setFiles: (f: Record<string, string>) => void }).__setFiles({
      "ppt/presentation.xml": presentationXml,
      "ppt/slides/slide1.xml": slideXml("Slide A"),
      "ppt/slides/slide2.xml": slideXml("Slide B"),
    })

    render(<PptxViewer file={makeFile({ type: "pptx" })} />)

    await waitFor(() => expect(screen.getByText("Slide A")).toBeInTheDocument())

    const buttons = screen.getAllByRole("button")
    await userEvent.click(buttons[1]) // next
    await waitFor(() => expect(screen.getByText("Slide B")).toBeInTheDocument())
  })

  it("shows 'No slides found' when presentation has no slides", async () => {
    mockState.supabase.storage.download.mockResolvedValue({
      data: new Blob(["zip"]),
      error: null,
    })
    ;(JSZip as unknown as { __setFiles: (f: Record<string, string>) => void }).__setFiles({
      "ppt/presentation.xml": presentationXml,
    })

    render(<PptxViewer file={makeFile({ type: "pptx" })} />)

    await waitFor(() => {
      expect(screen.getByText("No slides found")).toBeInTheDocument()
    })
  })

  it("renders error on download failure", async () => {
    mockState.supabase.storage.download.mockResolvedValue({
      data: null,
      error: { message: "Download failed" },
    })

    render(<PptxViewer file={makeFile({ type: "pptx" })} />)

    await waitFor(() => {
      expect(screen.getByText("Download failed")).toBeInTheDocument()
    })
  })
})
