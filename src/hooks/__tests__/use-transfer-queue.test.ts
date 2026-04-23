import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"

const { toastError, toastInfo } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastInfo: vi.fn(),
}))
vi.mock("sonner", () => ({
  toast: {
    error: toastError,
    info: toastInfo,
  },
}))

import { useTransferQueue, MAX_UPLOAD_SIZE_BYTES } from "../use-transfer-queue"

function makeFile(name: string, sizeBytes: number): File {
  // Use a Blob of the target size so File.size reflects it accurately
  const blob = new Blob([new Uint8Array(sizeBytes)])
  return new File([blob], name, { type: "text/plain" })
}

describe("useTransferQueue - upload size limit", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("rejects files larger than MAX_UPLOAD_SIZE_BYTES with a toast and does not call uploadFn", async () => {
    const uploadFn = vi.fn().mockResolvedValue({ error: null })
    const downloadFn = vi.fn()
    const { result } = renderHook(() => useTransferQueue(uploadFn, downloadFn))

    const oversized = makeFile("huge.pdf", MAX_UPLOAD_SIZE_BYTES + 1)
    await act(async () => {
      await result.current.enqueueUpload([oversized], null)
    })

    expect(toastError).toHaveBeenCalledTimes(1)
    expect(toastError.mock.calls[0][0]).toContain("huge.pdf")
    expect(uploadFn).not.toHaveBeenCalled()
    expect(result.current.status).toBeNull()
  })

  it("uploads valid files while reporting oversized ones separately", async () => {
    const uploadFn = vi.fn().mockResolvedValue({ error: null })
    const downloadFn = vi.fn()
    const { result } = renderHook(() => useTransferQueue(uploadFn, downloadFn))

    const tiny = makeFile("note.md", 100)
    const oversized = makeFile("huge.pdf", MAX_UPLOAD_SIZE_BYTES + 1)

    await act(async () => {
      await result.current.enqueueUpload([oversized, tiny], null)
    })

    expect(toastError).toHaveBeenCalledTimes(1)
    expect(uploadFn).toHaveBeenCalledTimes(1)
    expect(uploadFn.mock.calls[0][0]).toBe(tiny)
    await waitFor(() => {
      expect(result.current.status?.kind).toBe("success")
    })
    expect(result.current.status?.message).toContain("1 file")
  })

  it("accepts files exactly at the limit", async () => {
    const uploadFn = vi.fn().mockResolvedValue({ error: null })
    const downloadFn = vi.fn()
    const { result } = renderHook(() => useTransferQueue(uploadFn, downloadFn))

    const boundary = makeFile("boundary.pdf", MAX_UPLOAD_SIZE_BYTES)
    await act(async () => {
      await result.current.enqueueUpload([boundary], null)
    })

    expect(toastError).not.toHaveBeenCalled()
    expect(uploadFn).toHaveBeenCalledTimes(1)
  })
})
