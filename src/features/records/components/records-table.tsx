"use client"

import { useCallback } from "react"
import { useQueryStates } from "nuqs"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type OnChangeFn,
  type SortingState,
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  recordsQueryKey,
  fetchRecords,
} from "@/features/records/api/get-records"
import { recordColumns } from "@/features/records/components/record-columns"
import { sortField } from "@/features/records/schema"
import { recordsSearchParsers } from "@/features/records/search-params"

export function RecordsTable({ pageSize }: { pageSize: number }) {
  const [{ page, sort, order }, setQuery] = useQueryStates(recordsSearchParsers)
  const setPage = useCallback(
    (next: number) => setQuery({ page: next }),
    [setQuery]
  )

  const sorting: SortingState = [{ id: sort, desc: order === "desc" }]
  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    const [next] = typeof updater === "function" ? updater(sorting) : updater
    if (!next) return
    setQuery({
      sort: sortField.parse(next.id),
      order: next.desc ? "desc" : "asc",
      page: 1,
    })
  }

  const query = { page, pageSize, sort, order }
  const { data, isPending, isError } = useQuery({
    queryKey: recordsQueryKey(query),
    queryFn: () => fetchRecords(query),
    placeholderData: keepPreviousData,
  })

  const rows = data?.data ?? []
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  const table = useReactTable({
    data: rows,
    columns: recordColumns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    enableSortingRemoval: false,
    state: { sorting },
    onSortingChange,
  })

  if (isError) {
    return (
      <p className="p-4 text-sm text-destructive">Failed to load records.</p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>
                    {h.isPlaceholder
                      ? null
                      : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isPending ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {recordColumns.map((_c, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={recordColumns.length}
                  className="h-24 text-center"
                >
                  No records.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {page} of {pageCount} · {total} records
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
