import {
  recordsResponseSchema,
  type RecordsResponse,
  type SortField,
  type SortOrder,
} from "@/features/records/schema"

export const recordsQueryKey = (
  page: number,
  pageSize: number,
  sort: SortField,
  order: SortOrder
) => ["records", { page, pageSize, sort, order }] as const

export async function fetchRecords(
  page: number,
  pageSize: number,
  sort: SortField,
  order: SortOrder
): Promise<RecordsResponse> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sort,
    order,
  })
  const res = await fetch(`/api/records?${params}`)
  if (!res.ok) throw new Error(`Failed to load records: ${res.status}`)
  return recordsResponseSchema.parse(await res.json())
}
