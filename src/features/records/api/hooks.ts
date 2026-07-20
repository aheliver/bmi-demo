import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { recordsQueryKey, fetchRecords, createRecord } from "@/features/records/api/records"

export function useRecords(page: number, pageSize: number) {
  return useQuery({
    queryKey: recordsQueryKey(page, pageSize),
    queryFn: () => fetchRecords(page, pageSize),
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
