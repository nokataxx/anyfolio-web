import { useEffect, useState } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import type { FileRecord } from "@/lib/types"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString()

type PdfViewerProps = {
  file: FileRecord
}

export function PdfViewer({ file }: PdfViewerProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1.2)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setError(null)
      setPageNumber(1)

      const { data, error } = await supabase.storage
        .from("anyfolio-files")
        .download(file.storage_path)

      if (cancelled) return

      if (error) {
        setError(error.message)
        return
      }

      const url = URL.createObjectURL(data)
      setPdfUrl(url)
    }

    load()
    return () => {
      cancelled = true
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.storage_path])

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-destructive">
        {error}
      </div>
    )
  }

  if (!pdfUrl) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        Loading...
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background/80 px-4 py-2 backdrop-blur">
        <Button
          variant="outline"
          size="icon-sm"
          disabled={pageNumber <= 1}
          onClick={() => setPageNumber((p) => p - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm tabular-nums">
          {pageNumber} / {numPages}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={pageNumber >= numPages}
          onClick={() => setPageNumber((p) => p + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
        <div className="ml-4 flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
          >
            <ZoomOut className="size-4" />
          </Button>
          <span className="w-12 text-center text-sm tabular-nums">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setScale((s) => Math.min(3, s + 0.2))}
          >
            <ZoomIn className="size-4" />
          </Button>
        </div>
      </div>
      <div className="p-4">
        <Document
          file={pdfUrl}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          loading={
            <div className="text-muted-foreground">Loading PDF...</div>
          }
        >
          <Page pageNumber={pageNumber} scale={scale} />
        </Document>
      </div>
    </div>
  )
}
