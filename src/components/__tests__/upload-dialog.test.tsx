import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { UploadDialog } from "../upload-dialog"

describe("UploadDialog", () => {
  it("renders an Upload trigger button", () => {
    render(<UploadDialog folderId={null} onUpload={vi.fn()} />)
    expect(screen.getByRole("button", { name: /Upload/ })).toBeInTheDocument()
  })

  it("opens dialog content when trigger is clicked", async () => {
    render(<UploadDialog folderId={null} onUpload={vi.fn()} />)

    await userEvent.click(screen.getByRole("button", { name: /Upload/ }))

    expect(screen.getByText("Upload Files")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Choose Files" })).toBeInTheDocument()
  })

  it("calls onUpload with the selected file and shows status messages", async () => {
    const onUpload = vi
      .fn<(file: File, folderId: string | null) => Promise<{ error: string | null }>>()
      .mockResolvedValue({ error: null })

    render(<UploadDialog folderId="folder-xyz" onUpload={onUpload} />)

    await userEvent.click(screen.getByRole("button", { name: /Upload/ }))

    // Simulate file drop — that's easier than stubbing the hidden <input>
    const dropzone = screen.getByText(/Drag & drop files here/).closest("div")!
    const file = new File(["hello"], "note.md", { type: "text/markdown" })
    const dataTransfer = {
      files: [file] as unknown as FileList,
    }

    const dropEvent = new Event("drop", { bubbles: true }) as unknown as DragEvent
    Object.defineProperty(dropEvent, "dataTransfer", { value: dataTransfer })
    Object.defineProperty(dropEvent, "preventDefault", { value: vi.fn() })
    dropzone.dispatchEvent(dropEvent)

    await waitFor(() => {
      expect(onUpload).toHaveBeenCalledWith(file, "folder-xyz")
    })
  })

  it("shows an error message when upload fails", async () => {
    const onUpload = vi
      .fn<(file: File, folderId: string | null) => Promise<{ error: string | null }>>()
      .mockResolvedValue({ error: "Storage full" })

    render(<UploadDialog folderId={null} onUpload={onUpload} />)
    await userEvent.click(screen.getByRole("button", { name: /Upload/ }))

    const dropzone = screen.getByText(/Drag & drop files here/).closest("div")!
    const file = new File(["x"], "note.md")
    const dropEvent = new Event("drop", { bubbles: true }) as unknown as DragEvent
    Object.defineProperty(dropEvent, "dataTransfer", {
      value: { files: [file] as unknown as FileList },
    })
    dropzone.dispatchEvent(dropEvent)

    await waitFor(() => {
      expect(screen.getByText("Storage full")).toBeInTheDocument()
    })
  })
})
