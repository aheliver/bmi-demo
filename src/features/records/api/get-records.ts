import {
  recordsResponseSchema,
  type RecordsResponse,
  type RecordsQuery,
} from "@/features/records/schema"

export const recordsQueryKey = (query: RecordsQuery) =>
  ["records", query] as const

export async function fetchRecords(
  query: RecordsQuery
): Promise<RecordsResponse> {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
    sort: query.sort,
    order: query.order,
  })
  const res = await fetch(`/api/records?${params}`)
  if (!res.ok) throw new Error(`Failed to load records: ${res.status}`)
  return recordsResponseSchema.parse(await res.json())
}
