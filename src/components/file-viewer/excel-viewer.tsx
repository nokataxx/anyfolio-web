import { useEffect, useMemo, useState } from "react"
import { read, utils, type WorkBook, type WorkSheet } from "xlsx"
import { supabase } from "@/lib/supabase"
import type { FileRecord } from "@/lib/types"

type ExcelViewerProps = {
  file: FileRecord
}

type MergeMap = Map<string, { hidden: true } | { colSpan: number; rowSpan: number }>

function buildMergeMap(sheet: WorkSheet): MergeMap {
  const map: MergeMap = new Map()
  for (const m of sheet["!merges"] ?? []) {
    for (let r = m.s.r; r <= m.e.r; r++) {
      for (let c = m.s.c; c <= m.e.c; c++) {
        if (r === m.s.r && c === m.s.c) {
          map.set(`${r}:${c}`, {
            colSpan: m.e.c - m.s.c + 1,
            rowSpan: m.e.r - m.s.r + 1,
          })
        } else {
          map.set(`${r}:${c}`, { hidden: true })
        }
      }
    }
  }
  return map
}

function normalizeRows(rows: unknown[][]): string[][] {
  const maxCols = rows.reduce((max, row) => Math.max(max, row.length), 0)
  return rows.map((row) => {
    const padded = Array.from({ length: maxCols }, (_, i) =>
      row[i] != null ? String(row[i]) : ""
    )
    return padded
  })
}

export function ExcelViewer({ file }: ExcelViewerProps) {
  const [workbook, setWorkbook] = useState<WorkBook | null>(null)
  const [sheetName, setSheetName] = useState("")
  const [rows, setRows] = useState<string[][]>([])
  const [error, setError] = useState<string | null>(null)

  const mergeMap = useMemo(() => {
    if (!workbook || !sheetName) return new Map() as MergeMap
    return buildMergeMap(workbook.Sheets[sheetName])
  }, [workbook, sheetName])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setError(null)
      setWorkbook(null)
      setRows([])

      const { data, error } = await supabase.storage
        .from("anyfolio-files")
        .download(file.storage_path)

      if (cancelled) return

      if (error) {
        setError(error.message)
        return
      }

      const buffer = await data.arrayBuffer()
      if (cancelled) return

      const wb = read(buffer)
      setWorkbook(wb)

      const firstSheet = wb.SheetNames[0]
      setSheetName(firstSheet)
      setRows(
        normalizeRows(
          utils.sheet_to_json<unknown[]>(wb.Sheets[firstSheet], { header: 1 })
        )
      )
    }

    load()
    return () => {
      cancelled = true
    }
  }, [file.storage_path])

  const handleSheetChange = (name: string) => {
    if (!workbook) return
    setSheetName(name)
    setRows(
      normalizeRows(
        utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1 })
      )
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-destructive">
        {error}
      </div>
    )
  }

  if (!workbook) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        Loading...
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {workbook.SheetNames.length > 1 && (
        <div className="sticky top-0 z-10 flex gap-0 border-b bg-background/80 px-2 backdrop-blur">
          {workbook.SheetNames.map((name) => (
            <button
              key={name}
              className={`border-b-2 px-3 py-2 text-sm transition-colors ${
                name === sheetName
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => handleSheetChange(name)}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      <div className="overflow-auto p-4">
        <table className="w-full border-collapse text-sm">
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className={ri === 0 ? "bg-muted font-medium" : "border-b border-border"}>
                {row.map((cell, ci) => {
                  const merge = mergeMap.get(`${ri}:${ci}`)
                  if (merge && "hidden" in merge) return null
                  return (
                    <td
                      key={ci}
                      className="border border-border px-3 py-1.5"
                      {...(merge && {
                        colSpan: merge.colSpan,
                        rowSpan: merge.rowSpan,
                      })}
                    >
                      {cell}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
