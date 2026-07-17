// TODO(next iteration): relocate this out of `lib/` (it does network I/O, which `lib/` is
// not meant to hold) into a per-feature api module: `src/features/records/api/get-records.ts`.
// Colocate three parts there (bulletproof-react api-layer pattern): the fetcher, a TanStack
// v5 `queryOptions(...)` wrapper (one source of truth for queryKey + queryFn, reused by
// useQuery AND the SSR prefetch), and the `useRecords` hook. Then delete this file and
// `src/hooks/use-records.ts`. Not `infrastructure/` — that folder is server-only (Prisma).
// Refs: https://github.com/alan2207/bulletproof-react/blob/master/docs/api-layer.md
//       https://tanstack.com/query/latest/docs/framework/react/guides/query-options
import { recordsResponseSchema, type RecordsResponse } from "@/domain/record"

export const recordsQueryKey = (page: number, pageSize: number) =>
  ["records", { page, pageSize }] as const

/** Client-side fetch of the list endpoint. Server prefetch calls the use case directly
 *  (see the records island) — both resolve to the same RecordsResponse shape. */
export async function fetchRecords(page: number, pageSize: number): Promise<RecordsResponse> {
  const res = await fetch(`/api/records?page=${page}&pageSize=${pageSize}`)
  if (!res.ok) throw new Error(`Failed to load records: ${res.status}`)
  return recordsResponseSchema.parse(await res.json())
}
