import { recordsResponseSchema, type RecordsResponse } from "@/features/records/schema"

export const recordsQueryKey = (page: number, pageSize: number) =>
  ["records", { page, pageSize }] as const

export async function fetchRecords(page: number, pageSize: number): Promise<RecordsResponse> {
  const res = await fetch(`/api/records?page=${page}&pageSize=${pageSize}`)
  if (!res.ok) throw new Error(`Failed to load records: ${res.status}`)
  return recordsResponseSchema.parse(await res.json())
}
