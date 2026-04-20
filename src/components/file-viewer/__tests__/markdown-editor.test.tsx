import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MarkdownEditor } from "../markdown-editor"

describe("MarkdownEditor", () => {
  it("renders the initial content", async () => {
    render(
      <MarkdownEditor
        initialContent="# Hello"
        onChange={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(screen.getByTestId("markdown-editor")).toBeInTheDocument()
    })
    expect(screen.getByTestId("markdown-editor").textContent).toContain("# Hello")
  })

  it("fires onChange when the user types", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(<MarkdownEditor initialContent="" onChange={onChange} />)

    await waitFor(() => {
      expect(screen.getByTestId("markdown-editor")).toBeInTheDocument()
    })

    const editor = screen.getByTestId("markdown-editor")
    const editable = editor.querySelector(".cm-content") as HTMLElement
    editable.focus()
    await user.keyboard("hello")

    expect(onChange).toHaveBeenCalled()
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0]
    expect(lastCall).toContain("hello")
  })

  it("invokes onSave when Ctrl+S is pressed", async () => {
    const onSave = vi.fn()

    render(
      <MarkdownEditor
        initialContent="draft"
        onChange={vi.fn()}
        onSave={onSave}
      />,
    )

    await waitFor(() => {
      expect(screen.getByTestId("markdown-editor")).toBeInTheDocument()
    })

    const editable = screen
      .getByTestId("markdown-editor")
      .querySelector(".cm-content") as HTMLElement
    editable.focus()
    fireEvent.keyDown(editable, { key: "s", ctrlKey: true })

    expect(onSave).toHaveBeenCalledTimes(1)
  })
})
