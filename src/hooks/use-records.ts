"use client"

import { useQuery } from "@tanstack/react-query"

import { recordsQueryKey, fetchRecords } from "@/lib/records-query"

export function useRecords(page: number, pageSize: number) {
  return useQuery({
    queryKey: recordsQueryKey(page, pageSize),
    queryFn: () => fetchRecords(page, pageSize),
    placeholderData: (previous) => previous,
  })
}
