import { useCallback, useRef, useState } from "react"

export type UploadStatus =
  | { kind: "uploading"; message: string }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string }

type UploadFn = (file: File, folderId: string | null) => Promise<{ error: string | null }>

const isPptx = (name: string) => /\.pptx?$/i.test(name)
const isWordOrText = (name: string) => /\.(docx?|txt)$/i.test(name)

export function useUploadQueue(uploadFn: UploadFn) {
  const [status, setStatus] = useState<UploadStatus | null>(null)
  const uploadingRef = useRef(false)
  const timerRef = useRef<number | null>(null)

  const enqueueUpload = useCallback(
    async (files: FileList | File[], folderId: string | null) => {
      const list = Array.from(files)
      if (!list.length) return
      if (uploadingRef.current) return

      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }

      uploadingRef.current = true
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
        uploadingRef.current = false
      }
    },
    [uploadFn],
  )

  return { status, enqueueUpload }
}
