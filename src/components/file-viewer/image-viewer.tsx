import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { FileRecord } from "@/lib/types"

type ImageViewerProps = {
  file: FileRecord
}

export function ImageViewer({ file }: ImageViewerProps) {
  const [url, setUrl] = useState<string | null>(null)
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

      const objectUrl = URL.createObjectURL(data)
      if (!cancelled) {
        setUrl(objectUrl)
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [file.storage_path])

  // Revoke previous object URL when a new one is created or on unmount
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [url])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        Loading...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-destructive">
        {error}
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center p-6">
      <img
        src={url ?? undefined}
        alt={file.name}
        className="max-h-[calc(100vh-8rem)] max-w-full object-contain"
      />
    </div>
  )
}
