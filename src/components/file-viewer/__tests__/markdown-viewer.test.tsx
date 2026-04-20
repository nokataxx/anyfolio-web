import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, waitFor, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useRef, useState } from "react"
import { createSupabaseMock } from "@/test/supabase-mock"
import { makeFile } from "@/test/fixtures"
import type {
  MarkdownViewerHandle,
  MarkdownViewerStatus,
} from "../markdown-viewer"

const mockState = createSupabaseMock()

vi.mock("@/lib/supabase", () => ({
  get supabase() {
    return mockState.supabase
  },
}))

vi.mock("@/components/file-viewer/markdown-editor", () => ({
  MarkdownEditor: ({
    initialContent,
    onChange,
  }: {
    initialContent: string
    onChange: (v: string) => void
    onSave?: () => void
  }) => (
    <textarea
      data-testid="markdown-editor-mock"
      defaultValue={initialContent}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}))

import { MarkdownViewer } from "../markdown-viewer"
import type { FileRecord } from "@/lib/types"

const fileA = makeFile({ id: "a", name: "Note.md", type: "md" })
const fileB = makeFile({ id: "b", name: "Other.md", type: "md" })

function makeSave() {
  return vi.fn(async () => ({ error: null as null, updatedAt: "2026-01-02T00:00:00Z" }))
}

type HarnessProps = {
  file: FileRecord
  allFiles: FileRecord[]
  onSaveContent?: React.ComponentProps<typeof MarkdownViewer>["onSaveContent"]
  onStatus?: (s: MarkdownViewerStatus) => void
}

/**
 * Wrapper that mirrors how dashboard consumes MarkdownViewer: buttons live
 * outside the viewer and talk to it via ref + onStatusChange.
 */
function Harness({ file, allFiles, onSaveContent, onStatus }: HarnessProps) {
  const ref = useRef<MarkdownViewerHandle>(null)
  const [status, setStatus] = useState<MarkdownViewerStatus>({
    mode: "view",
    isDirty: false,
    saving: false,
    ready: false,
  })

  return (
    <div>
      {status.mode === "view" ? (
        <button
          type="button"
          onClick={() => ref.current?.enterEdit()}
          disabled={!status.ready || !onSaveContent}
        >
          Edit
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={() => ref.current?.tryExitEdit()}
            disabled={status.saving}
          >
            View
          </button>
          <button
            type="button"
            onClick={() => ref.current?.save()}
            disabled={!status.isDirty || status.saving}
          >
            Save
          </button>
        </>
      )}
      <MarkdownViewer
        ref={ref}
        file={file}
        allFiles={allFiles}
        onNavigateToFile={vi.fn()}
        onSaveContent={onSaveContent}
        onStatusChange={(s) => {
          setStatus(s)
          onStatus?.(s)
        }}
      />
    </div>
  )
}

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

  it("reports status updates via onStatusChange", async () => {
    const blob = new Blob(["# Title"], { type: "text/markdown" })
    mockState.supabase.storage.download.mockResolvedValue({ data: blob, error: null })
    const onStatus = vi.fn<(s: MarkdownViewerStatus) => void>()

    render(
      <Harness
        file={fileA}
        allFiles={[fileA]}
        onSaveContent={makeSave()}
        onStatus={onStatus}
      />,
    )

    await waitFor(() => {
      const lastCall = onStatus.mock.calls.at(-1)?.[0]
      expect(lastCall?.ready).toBe(true)
      expect(lastCall?.mode).toBe("view")
    })
  })

  it("enters edit mode via ref and shows the editor", async () => {
    const blob = new Blob(["# Title"], { type: "text/markdown" })
    mockState.supabase.storage.download.mockResolvedValue({ data: blob, error: null })

    const user = userEvent.setup()
    render(<Harness file={fileA} allFiles={[fileA]} onSaveContent={makeSave()} />)

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /edit/i })).toBeEnabled(),
    )
    await user.click(screen.getByRole("button", { name: /edit/i }))

    expect(screen.getByTestId("markdown-editor-mock")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled()
  })

  it("disables Edit when onSaveContent is not provided", async () => {
    const blob = new Blob(["# Title"], { type: "text/markdown" })
    mockState.supabase.storage.download.mockResolvedValue({ data: blob, error: null })

    render(<Harness file={fileA} allFiles={[fileA]} />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument()
    })
    expect(screen.getByRole("button", { name: /edit/i })).toBeDisabled()
  })

  it("marks dirty when the user edits, enabling Save", async () => {
    const blob = new Blob(["# Title"], { type: "text/markdown" })
    mockState.supabase.storage.download.mockResolvedValue({ data: blob, error: null })

    const user = userEvent.setup()
    render(<Harness file={fileA} allFiles={[fileA]} onSaveContent={makeSave()} />)

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /edit/i })).toBeEnabled(),
    )
    await user.click(screen.getByRole("button", { name: /edit/i }))

    const editor = screen.getByTestId("markdown-editor-mock") as HTMLTextAreaElement
    await user.clear(editor)
    await user.type(editor, "# Changed")

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /save/i })).toBeEnabled(),
    )
  })

  it("calls onSaveContent with the snapshotted updated_at", async () => {
    const blob = new Blob(["# Title"], { type: "text/markdown" })
    mockState.supabase.storage.download.mockResolvedValue({ data: blob, error: null })

    const onSaveContent = makeSave()
    const user = userEvent.setup()
    render(
      <Harness file={fileA} allFiles={[fileA]} onSaveContent={onSaveContent} />,
    )

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /edit/i })).toBeEnabled(),
    )
    await user.click(screen.getByRole("button", { name: /edit/i }))

    const editor = screen.getByTestId("markdown-editor-mock") as HTMLTextAreaElement
    await user.clear(editor)
    await user.type(editor, "# New")

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /save/i })).toBeEnabled(),
    )
    await user.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      expect(onSaveContent).toHaveBeenCalledWith(
        fileA,
        "# New",
        expect.objectContaining({
          expectedUpdatedAt: fileA.updated_at,
          overwrite: false,
        }),
      )
    })
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /save/i })).toBeDisabled(),
    )
  })

  it("shows conflict dialog and retries with overwrite", async () => {
    const blob = new Blob(["# Title"], { type: "text/markdown" })
    mockState.supabase.storage.download.mockResolvedValue({ data: blob, error: null })

    const onSaveContent = vi
      .fn()
      .mockResolvedValueOnce({
        error: "CONFLICT",
        conflict: true,
        latestUpdatedAt: "2026-03-01T00:00:00Z",
      })
      .mockResolvedValueOnce({ error: null, updatedAt: "2026-03-02T00:00:00Z" })

    const user = userEvent.setup()
    render(
      <Harness file={fileA} allFiles={[fileA]} onSaveContent={onSaveContent} />,
    )

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /edit/i })).toBeEnabled(),
    )
    await user.click(screen.getByRole("button", { name: /edit/i }))

    const editor = screen.getByTestId("markdown-editor-mock") as HTMLTextAreaElement
    await user.clear(editor)
    await user.type(editor, "# New")
    await user.click(screen.getByRole("button", { name: /save/i }))

    const overwriteBtn = await screen.findByRole("button", { name: /上書き保存/ })
    await user.click(overwriteBtn)

    await waitFor(() => expect(onSaveContent).toHaveBeenCalledTimes(2))
    expect(onSaveContent.mock.calls[1][2]).toEqual(
      expect.objectContaining({ overwrite: true }),
    )
  })

  it("switches mobile tab aria-selected state when tab buttons are clicked", async () => {
    const blob = new Blob(["# Title"], { type: "text/markdown" })
    mockState.supabase.storage.download.mockResolvedValue({ data: blob, error: null })

    const user = userEvent.setup()
    render(<Harness file={fileA} allFiles={[fileA]} onSaveContent={makeSave()} />)

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /edit/i })).toBeEnabled(),
    )
    await user.click(screen.getByRole("button", { name: /edit/i }))

    const editorTab = screen.getByRole("tab", { name: /editor/i })
    const previewTab = screen.getByRole("tab", { name: /preview/i })
    expect(editorTab).toHaveAttribute("aria-selected", "true")
    expect(previewTab).toHaveAttribute("aria-selected", "false")

    await user.click(previewTab)
    expect(previewTab).toHaveAttribute("aria-selected", "true")
    expect(editorTab).toHaveAttribute("aria-selected", "false")

    await user.click(editorTab)
    expect(editorTab).toHaveAttribute("aria-selected", "true")
  })

  it("resets to view mode when the file changes", async () => {
    const blob = new Blob(["# A"], { type: "text/markdown" })
    mockState.supabase.storage.download.mockResolvedValue({ data: blob, error: null })

    const user = userEvent.setup()
    const onSaveContent = makeSave()
    const { rerender } = render(
      <Harness file={fileA} allFiles={[fileA, fileB]} onSaveContent={onSaveContent} />,
    )

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /edit/i })).toBeEnabled(),
    )
    await user.click(screen.getByRole("button", { name: /edit/i }))
    expect(screen.getByTestId("markdown-editor-mock")).toBeInTheDocument()

    rerender(
      <Harness file={fileB} allFiles={[fileA, fileB]} onSaveContent={onSaveContent} />,
    )

    await waitFor(() => {
      expect(screen.queryByTestId("markdown-editor-mock")).not.toBeInTheDocument()
    })
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument()
  })
})

// Suppress unused `act` import lint: userEvent wraps in act under the hood; we
// re-export to keep the import available for future flushing needs.
void act
