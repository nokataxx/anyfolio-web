import { useEffect, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeSlug from "rehype-slug"
import { supabase } from "@/lib/supabase"
import type { FileRecord } from "@/lib/types"

type MarkdownViewerProps = {
  file: FileRecord
}

export function MarkdownViewer({ file }: MarkdownViewerProps) {
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

      const text = await data.text()
      if (!cancelled) {
        setContent(text)
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [file.storage_path])

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
    <article className="prose prose-neutral dark:prose-invert max-w-none p-6">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]}>{content}</ReactMarkdown>
    </article>
  )
}
