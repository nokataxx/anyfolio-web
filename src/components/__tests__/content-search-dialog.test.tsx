import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { makeFile, makeFolder } from "@/test/fixtures"
import type { SearchResult } from "@/hooks/use-content-search"

// Mock useContentSearch so we can drive the dialog's data without going through Supabase
const mockUseContentSearch = vi.fn()
vi.mock("@/hooks/use-content-search", () => ({
  useContentSearch: (...args: unknown[]) => mockUseContentSearch(...args),
}))

import { ContentSearchDialog } from "../content-search-dialog"

const file1 = makeFile({ id: "f1", name: "Note.md", type: "md" })
const file2 = makeFile({ id: "f2", name: "Report.pdf", type: "pdf" })

function makeResult(file: typeof file1, context: string): SearchResult {
  return {
    file,
    folderName: null,
    matchContext: context,
    matchIndex: 0,
    query: "hello",
  }
}

describe("ContentSearchDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows empty state hint when dialog opens with no query", () => {
    mockUseContentSearch.mockReturnValue({
      query: "",
      setQuery: vi.fn(),
      results: [],
      isSearching: false,
    })

    render(
      <ContentSearchDialog
        allFiles={[file1]}
        folders={[makeFolder()]}
        open={true}
        onOpenChange={vi.fn()}
        onSelectFile={vi.fn()}
      />,
    )

    expect(
      screen.getByText("Type to search file contents"),
    ).toBeInTheDocument()
  })

  it("shows 'Searching…' indicator while isSearching is true", () => {
    mockUseContentSearch.mockReturnValue({
      query: "hello",
      setQuery: vi.fn(),
      results: [],
      isSearching: true,
    })

    render(
      <ContentSearchDialog
        allFiles={[]}
        folders={[]}
        open={true}
        onOpenChange={vi.fn()}
        onSelectFile={vi.fn()}
      />,
    )

    expect(screen.getByText("Searching…")).toBeInTheDocument()
  })

  it("shows 'No matches found' when query is non-empty but results are empty", () => {
    mockUseContentSearch.mockReturnValue({
      query: "xyz",
      setQuery: vi.fn(),
      results: [],
      isSearching: false,
    })

    render(
      <ContentSearchDialog
        allFiles={[]}
        folders={[]}
        open={true}
        onOpenChange={vi.fn()}
        onSelectFile={vi.fn()}
      />,
    )

    expect(screen.getByText("No matches found")).toBeInTheDocument()
  })

  it("renders results and calls onSelectFile with query on click", async () => {
    mockUseContentSearch.mockReturnValue({
      query: "hello",
      setQuery: vi.fn(),
      results: [
        makeResult(file1, "hello world"),
        makeResult(file2, "say hello"),
      ],
      isSearching: false,
    })

    const onSelect = vi.fn()
    render(
      <ContentSearchDialog
        allFiles={[file1, file2]}
        folders={[]}
        open={true}
        onOpenChange={vi.fn()}
        onSelectFile={onSelect}
      />,
    )

    expect(screen.getByText("Note.md")).toBeInTheDocument()
    expect(screen.getByText("Report.pdf")).toBeInTheDocument()

    await userEvent.click(screen.getByText("Note.md"))
    expect(onSelect).toHaveBeenCalledWith(file1, "hello", undefined)
  })

  it("highlights matching substrings in the snippet", () => {
    mockUseContentSearch.mockReturnValue({
      query: "hello",
      setQuery: vi.fn(),
      results: [makeResult(file1, "say hello world")],
      isSearching: false,
    })

    render(
      <ContentSearchDialog
        allFiles={[file1]}
        folders={[]}
        open={true}
        onOpenChange={vi.fn()}
        onSelectFile={vi.fn()}
      />,
    )

    const mark = document.querySelector("mark")
    expect(mark?.textContent).toBe("hello")
  })

  it("Enter key triggers onSelectFile for the current selection", async () => {
    const setQuery = vi.fn()
    mockUseContentSearch.mockReturnValue({
      query: "hello",
      setQuery,
      results: [makeResult(file1, "hello")],
      isSearching: false,
    })

    const onSelect = vi.fn()
    render(
      <ContentSearchDialog
        allFiles={[file1]}
        folders={[]}
        open={true}
        onOpenChange={vi.fn()}
        onSelectFile={onSelect}
      />,
    )

    const input = screen.getByPlaceholderText("Search file contents…")
    input.focus()

    await userEvent.keyboard("{Enter}")

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith(file1, "hello", undefined)
    })
  })

  it("ArrowDown moves selection to the next result", async () => {
    const onSelect = vi.fn()
    mockUseContentSearch.mockReturnValue({
      query: "hello",
      setQuery: vi.fn(),
      results: [makeResult(file1, "a"), makeResult(file2, "b")],
      isSearching: false,
    })

    render(
      <ContentSearchDialog
        allFiles={[file1, file2]}
        folders={[]}
        open={true}
        onOpenChange={vi.fn()}
        onSelectFile={onSelect}
      />,
    )

    const input = screen.getByPlaceholderText("Search file contents…")
    input.focus()

    await userEvent.keyboard("{ArrowDown}{Enter}")

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith(file2, "hello", undefined)
    })
  })
})
