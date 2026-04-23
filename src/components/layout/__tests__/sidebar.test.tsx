import { describe, it, expect, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Sidebar } from "../sidebar"
import { makeFile, makeFolder } from "@/test/fixtures"

type Handlers = Parameters<typeof Sidebar>[0]

function setup(partial: Partial<Handlers> = {}) {
  const handlers = {
    folders: [],
    files: [],
    allFiles: [],
    selectedFolderId: null,
    selectedFileId: null,
    onSelectFolder: vi.fn(),
    onSelectFile: vi.fn(),
    onNavigateToFile: vi.fn(),
    onCreateFolder: vi.fn().mockResolvedValue({ error: null }),
    onCreateFile: vi.fn().mockResolvedValue({ error: null }),
    onDeleteFolder: vi.fn().mockResolvedValue({ error: null }),
    onRenameFolder: vi.fn().mockResolvedValue({ error: null }),
    onDeleteFile: vi.fn().mockResolvedValue({ error: null }),
    onRenameFile: vi.fn().mockResolvedValue({ error: null }),
    onDownloadFile: vi.fn(),
    onMoveFile: vi.fn().mockResolvedValue({ error: null }),
    onMoveFolder: vi.fn().mockResolvedValue({ error: null }),
    ...partial,
  } satisfies Handlers
  return { handlers, result: render(<Sidebar {...handlers} />) }
}

describe("Sidebar", () => {
  it("renders the 'Folders' header", () => {
    setup()
    expect(screen.getByText("Folders")).toBeInTheDocument()
  })

  it("renders all root-level folders", () => {
    const folderA = makeFolder({ id: "fa", name: "Alpha" })
    const folderB = makeFolder({ id: "fb", name: "Beta" })
    setup({ folders: [folderA, folderB] })

    expect(screen.getByText("Alpha")).toBeInTheDocument()
    expect(screen.getByText("Beta")).toBeInTheDocument()
  })

  it("renders root-level files (name without extension + dimmed extension)", () => {
    const file = makeFile({ id: "f1", name: "readme.md", type: "md", folder_id: null })
    setup({ files: [file], allFiles: [file] })

    // Name without extension is rendered; extension rendered in a muted span
    expect(screen.getByText("readme")).toBeInTheDocument()
    expect(screen.getByText(".md")).toBeInTheDocument()
  })

  it("calls onSelectFolder when a folder is clicked", async () => {
    const folder = makeFolder({ id: "fa", name: "Alpha" })
    const { handlers } = setup({ folders: [folder] })

    await userEvent.click(screen.getByText("Alpha"))
    expect(handlers.onSelectFolder).toHaveBeenCalledWith("fa")
  })

  it("calls onSelectFile when a root-level file is clicked", async () => {
    const file = makeFile({ id: "f1", name: "note.md", type: "md", folder_id: null })
    const { handlers } = setup({ files: [file], allFiles: [file] })

    await userEvent.click(screen.getByText("note"))
    expect(handlers.onSelectFile).toHaveBeenCalledWith(file)
  })

  it("filters files via the search box across allFiles", async () => {
    const a = makeFile({ id: "1", name: "apple.md", type: "md" })
    const b = makeFile({ id: "2", name: "banana.md", type: "md" })
    setup({ files: [], allFiles: [a, b] })

    // Open search
    const searchBtn = screen.getAllByRole("button").find(
      (b) => b.querySelector("svg.lucide-search"),
    )
    await userEvent.click(searchBtn!)

    const input = screen.getByPlaceholderText("Search files...")
    await userEvent.type(input, "app")

    // Search result area should contain "apple" but not "banana"
    expect(screen.getByText("apple")).toBeInTheDocument()
    expect(screen.queryByText("banana")).toBeNull()
  })

  it("opens the new-folder dialog and creates a folder", async () => {
    const { handlers } = setup()

    // The dialog trigger is the FolderPlus icon button
    const folderPlusBtn = screen.getAllByRole("button").find(
      (b) => b.querySelector("svg.lucide-folder-plus"),
    )
    await userEvent.click(folderPlusBtn!)

    const dialog = await screen.findByRole("dialog")
    const input = within(dialog).getByPlaceholderText("Folder name")
    await userEvent.type(input, "Projects")
    await userEvent.click(within(dialog).getByRole("button", { name: "Create" }))

    expect(handlers.onCreateFolder).toHaveBeenCalledWith("Projects", null)
  })

  it("collapses to compact mode when the collapse button is clicked", async () => {
    setup({ folders: [makeFolder({ name: "Alpha" })] })

    // The collapse toggle uses PanelLeftClose icon (when expanded)
    const collapseBtn = screen.getAllByRole("button").find(
      (b) => b.querySelector("svg.lucide-panel-left-close"),
    )
    await userEvent.click(collapseBtn!)

    // After collapse, 'Folders' header is hidden
    expect(screen.queryByText("Folders")).toBeNull()
    // And Alpha folder name is hidden (only icon remains)
    expect(screen.queryByText("Alpha")).toBeNull()
  })
})
