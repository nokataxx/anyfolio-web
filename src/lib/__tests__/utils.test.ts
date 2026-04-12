import { describe, it, expect } from "vitest"
import { cn } from "../utils"

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar")
  })

  it("handles conditional classes", () => {
    const isHidden = false
    expect(cn("base", isHidden && "hidden", "visible")).toBe("base visible")
  })

  it("deduplicates tailwind conflicts", () => {
    expect(cn("px-2", "px-4")).toBe("px-4")
  })

  it("handles undefined and null inputs", () => {
    expect(cn("base", undefined, null)).toBe("base")
  })

  it("handles empty arguments", () => {
    expect(cn()).toBe("")
  })

  it("merges arrays of class names", () => {
    expect(cn(["foo", "bar"], "baz")).toBe("foo bar baz")
  })
})
