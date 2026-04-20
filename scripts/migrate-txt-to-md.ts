/**
 * Migration: anyfolio_files type='txt' -> type='md'
 *
 * Converts all existing `.txt` files to `.md` in both the database and
 * Supabase Storage. File content is not re-extracted; `content_text` and
 * `content_pages` are preserved.
 *
 * Requires env vars (loaded via `node --env-file=.env.local`):
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   npm run migrate:txt-to-md -- --dry-run
 *   npm run migrate:txt-to-md
 */

import { createClient } from "@supabase/supabase-js"

const BUCKET = "anyfolio-files"

const dryRun = process.argv.includes("--dry-run")

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  console.error("Missing SUPABASE_URL (or VITE_SUPABASE_URL) environment variable")
  process.exit(1)
}
if (!serviceRoleKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

type TxtFileRow = {
  id: string
  user_id: string
  name: string
  type: string
  storage_path: string
}

function renameToMd(path: string): string {
  return path.replace(/\.txt$/i, ".md")
}

async function migrateOne(row: TxtFileRow): Promise<{ ok: boolean; reason?: string }> {
  const oldPath = row.storage_path
  const newPath = renameToMd(oldPath)
  const newName = renameToMd(row.name)

  if (oldPath === newPath) {
    return { ok: false, reason: `storage_path has no .txt extension: ${oldPath}` }
  }

  if (dryRun) {
    console.log(`  [dry-run] ${oldPath} -> ${newPath} (name: ${row.name} -> ${newName})`)
    return { ok: true }
  }

  // 1. Download from old path
  const { data: blob, error: dlError } = await supabase.storage
    .from(BUCKET)
    .download(oldPath)
  if (dlError || !blob) {
    return { ok: false, reason: `download failed: ${dlError?.message ?? "no data"}` }
  }

  // 2. Upload to new path
  const { error: upError } = await supabase.storage
    .from(BUCKET)
    .upload(newPath, blob, { contentType: "text/markdown", upsert: false })
  if (upError) {
    return { ok: false, reason: `upload failed: ${upError.message}` }
  }

  // 3. Update DB row
  const { error: dbError } = await supabase
    .from("anyfolio_files")
    .update({ type: "md", storage_path: newPath, name: newName })
    .eq("id", row.id)
  if (dbError) {
    // Rollback: remove the newly uploaded file so DB stays consistent with storage
    await supabase.storage.from(BUCKET).remove([newPath])
    return { ok: false, reason: `db update failed: ${dbError.message}` }
  }

  // 4. Delete old storage path
  const { error: rmError } = await supabase.storage.from(BUCKET).remove([oldPath])
  if (rmError) {
    console.warn(`  [warn] ${row.id}: new path committed but old path remains: ${rmError.message}`)
  }

  return { ok: true }
}

async function main() {
  console.log(`Migration: type='txt' -> type='md'${dryRun ? " (DRY RUN)" : ""}`)

  const { data: rows, error } = await supabase
    .from("anyfolio_files")
    .select("id, user_id, name, type, storage_path")
    .eq("type", "txt")

  if (error) {
    console.error("Query failed:", error.message)
    process.exit(1)
  }

  const targets = (rows ?? []) as TxtFileRow[]
  console.log(`Target count: ${targets.length}`)

  let success = 0
  const failures: Array<{ id: string; reason: string }> = []

  for (const row of targets) {
    const result = await migrateOne(row)
    if (result.ok) {
      success += 1
      if (!dryRun) console.log(`  [ok] ${row.id} (${row.name})`)
    } else {
      failures.push({ id: row.id, reason: result.reason ?? "unknown" })
      console.error(`  [fail] ${row.id} (${row.name}): ${result.reason}`)
    }
  }

  console.log("\n=== Summary ===")
  console.log(`Total:    ${targets.length}`)
  console.log(`Success:  ${success}`)
  console.log(`Failures: ${failures.length}`)
  if (failures.length > 0) {
    console.log("\nFailed IDs:")
    for (const f of failures) console.log(`  - ${f.id}: ${f.reason}`)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error("Unhandled error:", e)
  process.exit(1)
})
