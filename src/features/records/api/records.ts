import {
  recordSchema,
  recordsResponseSchema,
  type Record,
  type RecordsResponse,
  type CreateRecordInput,
} from "@/features/records/schema"

export const recordsQueryKey = (page: number, pageSize: number) =>
  ["records", { page, pageSize }] as const

export async function fetchRecords(page: number, pageSize: number): Promise<RecordsResponse> {
  const res = await fetch(`/api/records?page=${page}&pageSize=${pageSize}`)
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
