import {
  recordSchema,
  recordsResponseSchema,
  type Record,
  type RecordsResponse,
  type RecordsQuery,
  type CreateRecordInput,
} from "@/features/records/schema"

export const recordsQueryKey = (query: RecordsQuery) =>
  ["records", query] as const

export async function fetchRecords(query: RecordsQuery): Promise<RecordsResponse> {
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

export async function createRecord(input: CreateRecordInput): Promise<Record> {
  const res = await fetch("/api/records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`Failed to create record: ${res.status}`)
  return recordSchema.parse(await res.json())
}
