import { useEffect, useState } from "react"
import Encoding from "encoding-japanese"
import { supabase } from "@/lib/supabase"
import type { FileRecord } from "@/lib/types"

type TextViewerProps = {
  file: FileRecord
}

export function TextViewer({ file }: TextViewerProps) {
  const [content, setContent] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase.storage
        .from("anyfolio-files")
        .download(file.storage_path)

      if (cancelled) return

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      const buffer = await data.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      const detected = Encoding.detect(bytes)
      const unicodeArray = Encoding.convert(bytes, {
        to: "UNICODE",
        from: detected || "AUTO",
      })
      const text = Encoding.codeToString(unicodeArray)
      if (!cancelled) {
        setContent(text)
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [file.storage_path])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p>Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-destructive">
        <p>Error: {error}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed">{content}</pre>
    </div>
  )
}
