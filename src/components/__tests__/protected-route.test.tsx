import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

// Mock react-router's Navigate to a recognizable element
vi.mock("react-router", () => ({
  Navigate: ({ to, replace }: { to: string; replace?: boolean }) => (
    <div data-testid="navigate" data-to={to} data-replace={String(!!replace)} />
  ),
}))

const mockUseAuth = vi.fn()
vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}))

import { ProtectedRoute } from "../protected-route"

describe("ProtectedRoute", () => {
  it("renders loading state while auth is loading", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true })
    render(
      <ProtectedRoute>
        <div>Secret content</div>
      </ProtectedRoute>,
    )
    expect(screen.getByText("Loading...")).toBeInTheDocument()
    expect(screen.queryByText("Secret content")).toBeNull()
  })

  it("redirects to /login when user is not authenticated", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    render(
      <ProtectedRoute>
        <div>Secret content</div>
      </ProtectedRoute>,
    )
    const nav = screen.getByTestId("navigate")
    expect(nav.getAttribute("data-to")).toBe("/login")
    expect(nav.getAttribute("data-replace")).toBe("true")
  })

  it("renders children when user is authenticated", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1", email: "a@b.com" },
      loading: false,
    })
    render(
      <ProtectedRoute>
        <div>Secret content</div>
      </ProtectedRoute>,
    )
    expect(screen.getByText("Secret content")).toBeInTheDocument()
    expect(screen.queryByTestId("navigate")).toBeNull()
  })
})
