import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ViewerErrorBoundary } from "../viewer-error-boundary"

function Boom({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("Something exploded")
  return <div>Healthy child</div>
}

describe("ViewerErrorBoundary", () => {
  // Silence React's uncaught error console noise when testing thrown errors
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    errorSpy.mockRestore()
  })

  it("renders children when no error is thrown", () => {
    render(
      <ViewerErrorBoundary>
        <Boom shouldThrow={false} />
      </ViewerErrorBoundary>,
    )
    expect(screen.getByText("Healthy child")).toBeInTheDocument()
  })

  it("renders fallback UI with the error message when a child throws", () => {
    render(
      <ViewerErrorBoundary>
        <Boom shouldThrow={true} />
      </ViewerErrorBoundary>,
    )

    expect(screen.getByText("Failed to display this file")).toBeInTheDocument()
    expect(screen.getByText("Something exploded")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Try again/ }),
    ).toBeInTheDocument()
  })

  it("clears the error and re-renders children when 'Try again' is clicked", async () => {
    const { rerender } = render(
      <ViewerErrorBoundary>
        <Boom shouldThrow={true} />
      </ViewerErrorBoundary>,
    )

    expect(screen.getByText("Failed to display this file")).toBeInTheDocument()

    // Fix the child and click retry
    rerender(
      <ViewerErrorBoundary>
        <Boom shouldThrow={false} />
      </ViewerErrorBoundary>,
    )
    await userEvent.click(screen.getByRole("button", { name: /Try again/ }))

    expect(screen.getByText("Healthy child")).toBeInTheDocument()
  })

  it("resets the error state when resetKey changes", () => {
    const { rerender } = render(
      <ViewerErrorBoundary resetKey="file-a">
        <Boom shouldThrow={true} />
      </ViewerErrorBoundary>,
    )

    expect(screen.getByText("Failed to display this file")).toBeInTheDocument()

    // Simulate switching to a different file
    rerender(
      <ViewerErrorBoundary resetKey="file-b">
        <Boom shouldThrow={false} />
      </ViewerErrorBoundary>,
    )

    expect(screen.getByText("Healthy child")).toBeInTheDocument()
    expect(screen.queryByText("Failed to display this file")).toBeNull()
  })

  it("logs the error to console.error", () => {
    render(
      <ViewerErrorBoundary>
        <Boom shouldThrow={true} />
      </ViewerErrorBoundary>,
    )

    // The first console.error calls are from React's internal error reporting
    // and our componentDidCatch. Just check at least one carries our message.
    const loggedAny = errorSpy.mock.calls.some((call: unknown[]) =>
      call.some(
        (arg: unknown) =>
          (typeof arg === "string" && arg.includes("Viewer crashed")) ||
          (arg instanceof Error && arg.message === "Something exploded"),
      ),
    )
    expect(loggedAny).toBe(true)
  })
})
