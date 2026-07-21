import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { recordsQueryKey, fetchRecords, createRecord } from "@/features/records/api/records"
import type { RecordsQuery } from "@/features/records/schema"

export function useRecords(query: RecordsQuery) {
  return useQuery({
    queryKey: recordsQueryKey(query),
    queryFn: () => fetchRecords(query),
    placeholderData: keepPreviousData,
  })
}

export function useCreateRecord() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createRecord,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["records"] }),
  })
}
