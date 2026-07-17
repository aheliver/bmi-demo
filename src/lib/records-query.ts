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
