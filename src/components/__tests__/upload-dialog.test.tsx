import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { UploadDialog } from "../upload-dialog"

describe("UploadDialog", () => {
  it("renders an Upload trigger button", () => {
    render(<UploadDialog folderId={null} onFiles={vi.fn()} />)
    expect(screen.getByRole("button", { name: /Upload/ })).toBeInTheDocument()
  })

  it("opens dialog content when trigger is clicked", async () => {
    render(<UploadDialog folderId={null} onFiles={vi.fn()} />)

    await userEvent.click(screen.getByRole("button", { name: /Upload/ }))

    expect(screen.getByText("Upload Files")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Choose Files" })).toBeInTheDocument()
  })

  it("calls onFiles with dropped files and the current folderId, then closes", async () => {
    const onFiles = vi.fn()

    render(<UploadDialog folderId="folder-xyz" onFiles={onFiles} />)

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
      expect(onFiles).toHaveBeenCalledTimes(1)
    })
    const [filesArg, folderArg] = onFiles.mock.calls[0]
    expect(Array.from(filesArg as FileList)).toEqual([file])
    expect(folderArg).toBe("folder-xyz")

    await waitFor(() => {
      expect(screen.queryByText("Upload Files")).not.toBeInTheDocument()
    })
  })
})
