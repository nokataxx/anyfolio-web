import { useCallback, useRef, useState } from "react"
import type { FileRecord } from "@/lib/types"

export type TransferStatus =
  | { kind: "uploading"; message: string }
  | { kind: "downloading"; message: string }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string }

type UploadFn = (file: File, folderId: string | null) => Promise<{ error: string | null }>
type DownloadFn = (file: FileRecord) => Promise<{ blob: Blob | null; error: string | null }>

const isPptx = (name: string) => /\.pptx?$/i.test(name)
const isWordOrText = (name: string) => /\.(docx?|txt)$/i.test(name)

function saveBlobAs(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  a.rel = "noopener"
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function useTransferQueue(uploadFn: UploadFn, downloadFn: DownloadFn) {
  const [status, setStatus] = useState<TransferStatus | null>(null)
  const busyRef = useRef(false)
  const timerRef = useRef<number | null>(null)

  function clearStatusTimer() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const enqueueUpload = useCallback(
    async (files: FileList | File[], folderId: string | null) => {
      const list = Array.from(files)
      if (!list.length) return
      if (busyRef.current) return

      clearStatusTimer()
      busyRef.current = true
      try {
        for (const file of list) {
          const message = isPptx(file.name)
            ? `Converting ${file.name} to PDF...`
            : isWordOrText(file.name)
              ? `Converting ${file.name} to Markdown...`
              : `Uploading ${file.name}...`
          setStatus({ kind: "uploading", message })
          const result = await uploadFn(file, folderId)
          if (result.error) {
            setStatus({ kind: "error", message: result.error })
            timerRef.current = window.setTimeout(() => setStatus(null), 6000)
            return
          }
        }
        setStatus({
          kind: "success",
          message: list.length === 1 ? "Uploaded 1 file" : `Uploaded ${list.length} files`,
        })
        timerRef.current = window.setTimeout(() => setStatus(null), 3000)
      } finally {
        busyRef.current = false
      }
    },
    [uploadFn],
  )

  const downloadFile = useCallback(
    async (file: FileRecord) => {
      if (busyRef.current) return
      clearStatusTimer()
      busyRef.current = true
      try {
        setStatus({ kind: "downloading", message: `Downloading ${file.name}...` })
        const result = await downloadFn(file)
        if (result.error || !result.blob) {
          setStatus({ kind: "error", message: result.error ?? "Download failed" })
          timerRef.current = window.setTimeout(() => setStatus(null), 6000)
          return
        }
        saveBlobAs(result.blob, file.name)
        setStatus({ kind: "success", message: `Saved ${file.name}` })
        timerRef.current = window.setTimeout(() => setStatus(null), 3000)
      } finally {
        busyRef.current = false
      }
    },
    [downloadFn],
  )

  return { status, enqueueUpload, downloadFile }
}
