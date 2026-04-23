import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type Ref,
} from "react"
import { read, utils, write, type WorkBook, type WorkSheet } from "xlsx"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import type { FileRecord } from "@/lib/types"

type SaveResult =
  | { error: null; updatedAt: string }
  | { error: string; conflict?: boolean; latestUpdatedAt?: string }

export type ExcelViewerStatus = {
  mode: "view" | "edit"
  isDirty: boolean
  saving: boolean
  ready: boolean
}

export type ExcelViewerHandle = {
  enterEdit: () => void
  tryExitEdit: () => void
  save: () => void
}

type ExcelViewerProps = {
  file: FileRecord
  onSaveContent?: (
    file: FileRecord,
    content: Blob,
    options: { expectedUpdatedAt: string; overwrite?: boolean },
  ) => Promise<SaveResult>
  onStatusChange?: (status: ExcelViewerStatus) => void
  ref?: Ref<ExcelViewerHandle>
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
  return rows.map((row) =>
    Array.from({ length: maxCols }, (_, i) => (row[i] != null ? String(row[i]) : "")),
  )
}

function sheetToRows(sheet: WorkSheet): string[][] {
  return normalizeRows(utils.sheet_to_json<unknown[]>(sheet, { header: 1 }))
}

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

export function ExcelViewer({ file, onSaveContent, onStatusChange, ref }: ExcelViewerProps) {
  const [workbook, setWorkbook] = useState<WorkBook | null>(null)
  const [sheetName, setSheetName] = useState("")
  const [rows, setRows] = useState<string[][]>([])
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<"view" | "edit">("view")
  const [activeCell, setActiveCell] = useState<{ r: number; c: number } | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [snapshotUpdatedAt, setSnapshotUpdatedAt] = useState(file.updated_at)

  const mergeMap = useMemo(() => {
    if (!workbook || !sheetName) return new Map() as MergeMap
    return buildMergeMap(workbook.Sheets[sheetName])
  }, [workbook, sheetName])

  // Reset state when switching files
  const [prevFileId, setPrevFileId] = useState(file.id)
  if (prevFileId !== file.id) {
    setPrevFileId(file.id)
    setMode("view")
    setActiveCell(null)
    setIsDirty(false)
    setSaving(false)
    setSnapshotUpdatedAt(file.updated_at)
  }

  const ready = !!workbook && error === null

  const onStatusChangeRef = useRef(onStatusChange)
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange
  })
  useEffect(() => {
    onStatusChangeRef.current?.({ mode, isDirty, saving, ready })
  }, [mode, isDirty, saving, ready])

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
      setRows(sheetToRows(wb.Sheets[firstSheet]))
    }

    load()
    return () => {
      cancelled = true
    }
  }, [file.storage_path])

  const handleSheetChange = (name: string) => {
    if (!workbook) return
    if (activeCell) setActiveCell(null)
    setSheetName(name)
    setRows(sheetToRows(workbook.Sheets[name]))
  }

  const commitEdit = useCallback(
    (r: number, c: number, newValue: string) => {
      if (!workbook) return
      const currentDisplay = rows[r]?.[c] ?? ""
      if (currentDisplay === newValue) return

      // Shallow-copy down to the edited sheet so React sees a new reference;
      // other sheets and workbook metadata are shared.
      const nextSheet: WorkSheet = { ...workbook.Sheets[sheetName] }
      const cellRef = utils.encode_cell({ r, c })
      if (newValue === "") {
        delete nextSheet[cellRef]
      } else {
        // Replace the cell entirely; dropping any prior formula so the literal value wins
        nextSheet[cellRef] = { t: "s", v: newValue, w: newValue }
      }
      const nextWorkbook: WorkBook = {
        ...workbook,
        Sheets: { ...workbook.Sheets, [sheetName]: nextSheet },
      }

      setWorkbook(nextWorkbook)
      setRows((prev) => prev.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? newValue : cell)) : row)))
      setIsDirty(true)
    },
    [workbook, sheetName, rows],
  )

  const handleEnterEdit = useCallback(() => {
    if (!onSaveContent || !ready) return
    setMode("edit")
    setActiveCell(null)
    setSnapshotUpdatedAt(file.updated_at)
  }, [onSaveContent, ready, file.updated_at])

  const reloadFromStorage = useCallback(async () => {
    const { data, error } = await supabase.storage
      .from("anyfolio-files")
      .download(file.storage_path)
    if (error || !data) {
      setError(error?.message ?? "Reload failed")
      return
    }
    const buffer = await data.arrayBuffer()
    const wb = read(buffer)
    setWorkbook(wb)
    const target = wb.SheetNames.includes(sheetName) ? sheetName : wb.SheetNames[0]
    setSheetName(target)
    setRows(sheetToRows(wb.Sheets[target]))
  }, [file.storage_path, sheetName])

  const handleTryExitEdit = useCallback(() => {
    if (isDirty) {
      const ok = window.confirm("未保存の変更があります。破棄しますか?")
      if (!ok) return
      setIsDirty(false)
      void reloadFromStorage()
    }
    setMode("view")
    setActiveCell(null)
  }, [isDirty, reloadFromStorage])

  const handleSave = useCallback(async () => {
    if (!isDirty || saving || !workbook || !onSaveContent) return
    setSaving(true)
    const buffer = write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer
    const blob = new Blob([buffer], { type: XLSX_CONTENT_TYPE })

    let result = await onSaveContent(file, blob, {
      expectedUpdatedAt: snapshotUpdatedAt,
      overwrite: false,
    })

    if (result.error !== null && result.conflict) {
      const ok = window.confirm(
        "このファイルは他の場所で更新されています。上書きしますか?",
      )
      if (!ok) {
        setSaving(false)
        return
      }
      result = await onSaveContent(file, blob, {
        expectedUpdatedAt: snapshotUpdatedAt,
        overwrite: true,
      })
    }

    setSaving(false)

    if (result.error === null) {
      setSnapshotUpdatedAt(result.updatedAt)
      setIsDirty(false)
      setMode("view")
      setActiveCell(null)
      toast.success("Saved")
    } else {
      toast.error(`Save failed: ${result.error}`)
    }
  }, [isDirty, saving, workbook, onSaveContent, file, snapshotUpdatedAt])

  useImperativeHandle(
    ref,
    () => ({
      enterEdit: handleEnterEdit,
      tryExitEdit: handleTryExitEdit,
      save: () => void handleSave(),
    }),
    [handleEnterEdit, handleTryExitEdit, handleSave],
  )

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
                  const isActive = mode === "edit" && activeCell?.r === ri && activeCell?.c === ci
                  const editable = mode === "edit"
                  return (
                    <td
                      key={ci}
                      className={`border border-border px-3 py-1.5 ${
                        editable && !isActive ? "cursor-text hover:bg-accent/40" : ""
                      }`}
                      {...(merge && {
                        colSpan: merge.colSpan,
                        rowSpan: merge.rowSpan,
                      })}
                      onClick={() => {
                        if (editable && !isActive) setActiveCell({ r: ri, c: ci })
                      }}
                    >
                      {isActive ? (
                        <input
                          autoFocus
                          defaultValue={cell}
                          className="w-full rounded border border-primary bg-background px-1 py-0.5 outline-none"
                          onBlur={(e) => {
                            commitEdit(ri, ci, e.target.value)
                            setActiveCell(null)
                          }}
                          onKeyDown={(e) => {
                            if (e.nativeEvent.isComposing) return
                            if (e.key === "Enter") {
                              e.preventDefault()
                              commitEdit(ri, ci, e.currentTarget.value)
                              setActiveCell(null)
                            } else if (e.key === "Escape") {
                              e.preventDefault()
                              setActiveCell(null)
                            }
                          }}
                        />
                      ) : (
                        cell
                      )}
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
