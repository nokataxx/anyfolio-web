import { supabase } from "@/lib/supabase"
import { extractText, getPdfPageTexts } from "@/lib/text-extraction"
import type { FileRecord } from "@/lib/types"

const SEARCHABLE_TYPES = new Set(["md", "txt", "pdf", "xlsx"])
const MAX_CONCURRENT = 3

let backfillRunning = false
let backfillDone = false

/**
 * Backfill content_text for files that don't have it yet.
 * Runs once per session; subsequent calls are no-ops.
 */
export async function backfillContentText(allFiles: FileRecord[]): Promise<void> {
  if (backfillRunning || backfillDone) return
  backfillRunning = true

  try {
    // Find searchable files without content_text
    const { data, error } = await supabase
      .from("anyfolio_files")
      .select("id")
      .is("content_text", null)

    if (error || !data || data.length === 0) {
      backfillDone = true
      return
    }

    const idsToFill = new Set(data.map((r) => r.id))
    const filesToFill = allFiles.filter(
      (f) => idsToFill.has(f.id) && SEARCHABLE_TYPES.has(f.type),
    )

    if (filesToFill.length === 0) {
      backfillDone = true
      return
    }

    const queue = [...filesToFill]
    const workers = Array.from({ length: MAX_CONCURRENT }, async () => {
      while (queue.length > 0) {
        const file = queue.shift()!
        try {
          const text = await extractText(file)
          const pages = file.type === "pdf" ? getPdfPageTexts(file.storage_path) : undefined

          await supabase
            .from("anyfolio_files")
            .update({
              content_text: text || null,
              content_pages: pages ?? null,
            })
            .eq("id", file.id)
        } catch {
          // Skip files that fail extraction
        }
      }
    })

    await Promise.all(workers)
    backfillDone = true
  } finally {
    backfillRunning = false
  }
}
