import "@testing-library/jest-dom/vitest"

// jsdom does not implement Element.scrollIntoView
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {}
}

// jsdom does not implement ResizeObserver (used by Radix ScrollArea etc.)
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
