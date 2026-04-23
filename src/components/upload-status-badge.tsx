import { CheckCircle2, Loader2, XCircle } from "lucide-react"
import type { UploadStatus } from "@/hooks/use-upload-queue"

export function UploadStatusBadge({ status }: { status: UploadStatus | null }) {
  if (!status) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 right-6 z-70 flex max-w-sm items-center gap-2 rounded-lg border bg-background px-4 py-3 shadow-lg ${
        status.kind === "error" ? "border-destructive" : ""
      }`}
    >
      {status.kind === "uploading" && (
        <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
      )}
      {status.kind === "success" && (
        <CheckCircle2 className="size-4 shrink-0 text-primary" />
      )}
      {status.kind === "error" && (
        <XCircle className="size-4 shrink-0 text-destructive" />
      )}
      <p className="text-sm">{status.message}</p>
    </div>
  )
}
