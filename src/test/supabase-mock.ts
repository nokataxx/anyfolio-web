import { vi } from "vitest"

export type SupabaseResponse<T = unknown> = {
  data: T | null
  error: { message: string } | null
}

/**
 * Builder returned by supabase.from(...).
 * Each filter/modifier (select, eq, is, order, update, delete, insert, single)
 * returns the same thenable so calls can be chained then awaited.
 *
 * The `respond` callback lets tests stub the final resolved value.
 */
export type QueryBuilder = {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  is: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  then: (onFulfilled: (value: SupabaseResponse) => unknown) => Promise<unknown>
  /** Inspect last call arguments for assertions */
  _calls: {
    select?: unknown[]
    insert?: unknown[]
    update?: unknown[]
    delete?: unknown[]
    eq?: unknown[][]
    is?: unknown[][]
    order?: unknown[]
  }
}

export function createQueryBuilder(response: SupabaseResponse = { data: [], error: null }): QueryBuilder {
  const calls: QueryBuilder["_calls"] = { eq: [], is: [] }

  const builder = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    order: vi.fn(),
    single: vi.fn(),
    then: (onFulfilled: (value: SupabaseResponse) => unknown) =>
      Promise.resolve(response).then(onFulfilled),
    _calls: calls,
  } as QueryBuilder

  // Every chainable method returns the same builder
  builder.select.mockImplementation((...args: unknown[]) => {
    calls.select = args
    return builder
  })
  builder.insert.mockImplementation((...args: unknown[]) => {
    calls.insert = args
    return builder
  })
  builder.update.mockImplementation((...args: unknown[]) => {
    calls.update = args
    return builder
  })
  builder.delete.mockImplementation((...args: unknown[]) => {
    calls.delete = args
    return builder
  })
  builder.eq.mockImplementation((...args: unknown[]) => {
    calls.eq!.push(args)
    return builder
  })
  builder.is.mockImplementation((...args: unknown[]) => {
    calls.is!.push(args)
    return builder
  })
  builder.order.mockImplementation((...args: unknown[]) => {
    calls.order = args
    return builder
  })
  builder.single.mockImplementation(() => builder)

  return builder
}

export type StorageResponse = {
  data: Blob | null
  error: { message: string } | null
}

export function createStorageMock() {
  const upload = vi.fn<(path: string, file: Blob) => Promise<SupabaseResponse>>()
  const remove = vi.fn<(paths: string[]) => Promise<SupabaseResponse>>()
  const download = vi.fn<(path: string) => Promise<StorageResponse>>()
  upload.mockResolvedValue({ data: null, error: null })
  remove.mockResolvedValue({ data: null, error: null })
  download.mockResolvedValue({ data: null, error: null })

  const from = vi.fn(() => ({ upload, remove, download }))
  return { from, upload, remove, download }
}

export type MockUser = { id: string; email?: string }

export function createSupabaseMock() {
  // Per-table query builders, one per invocation of .from(<table>)
  const tableBuilders: QueryBuilder[] = []
  let nextResponse: SupabaseResponse = { data: [], error: null }

  const from = vi.fn(() => {
    const builder = createQueryBuilder(nextResponse)
    tableBuilders.push(builder)
    return builder
  })

  const storage = createStorageMock()

  const getUser = vi.fn<() => Promise<{ data: { user: MockUser | null } }>>()
  getUser.mockResolvedValue({ data: { user: { id: "test-user-id" } } })

  const rpc = vi.fn<(name: string, args?: unknown) => Promise<SupabaseResponse>>()
  rpc.mockResolvedValue({ data: [], error: null })

  const supabase = {
    from,
    storage,
    auth: { getUser },
    rpc,
  }

  return {
    supabase,
    /** Set the response returned by the *next* .from().select()... chain */
    setNextResponse(response: SupabaseResponse) {
      nextResponse = response
    },
    /** Get all query builders created during the test, in call order */
    getTableBuilders: () => tableBuilders,
    resetTableBuilders: () => {
      tableBuilders.length = 0
    },
  }
}
