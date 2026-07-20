import { useMutation, useQueryClient } from "@tanstack/react-query"

import { recordSchema, type Record, type CreateRecordInput } from "@/features/records/schema"

export async function createRecord(input: CreateRecordInput): Promise<Record> {
  const res = await fetch("/api/records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`Failed to create record: ${res.status}`)
  return recordSchema.parse(await res.json())
}

export function useCreateRecord() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createRecord,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["records"] }),
  })
}
