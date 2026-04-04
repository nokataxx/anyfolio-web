import { useCallback, useEffect, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeSlug from "rehype-slug"
import remarkWikilink from "@/lib/remark-wikilink"
import { supabase } from "@/lib/supabase"
import type { FileRecord } from "@/lib/types"

type MarkdownViewerProps = {
  file: FileRecord
  allFiles: FileRecord[]
  onNavigateToFile: (file: FileRecord) => void
}

function resolveWikiLink(target: string, allFiles: FileRecord[]): FileRecord | undefined {
  const normalized = target.toLowerCase().trim()
  return allFiles.find((f) => {
    const nameNoExt = f.name.replace(/\.[^.]+$/, "").toLowerCase()
    const nameFull = f.name.toLowerCase()
    return nameNoExt === normalized || nameFull === normalized
  })
}

export function MarkdownViewer({ file, allFiles, onNavigateToFile }: MarkdownViewerProps) {
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

  const renderLink = useCallback(
    (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
      const { href, children } = props
      if (href?.startsWith("wikilink://")) {
        const target = decodeURIComponent(href.replace("wikilink://", ""))
        const resolved = resolveWikiLink(target, allFiles)
        if (resolved) {
          return (
            <button
              type="button"
              className="text-primary underline decoration-dotted cursor-pointer hover:decoration-solid"
              onClick={() => onNavigateToFile(resolved)}
            >
              {children}
            </button>
          )
        }
        return (
          <span className="text-muted-foreground cursor-not-allowed" title="File not found">
            {children}
          </span>
        )
      }
      return (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      )
    },
    [allFiles, onNavigateToFile]
  )

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
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkWikilink]}
        rehypePlugins={[rehypeSlug]}
        components={{ a: renderLink }}
      >
        {content}
      </ReactMarkdown>
    </article>
  )
}
