"use client"

import { useCallback, useMemo } from "react"
import { parseAsInteger, parseAsStringLiteral, useQueryStates } from "nuqs"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
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
import { useUnitSystem } from "@/providers/unit-system-provider"
import {
  recordsQueryKey,
  fetchRecords,
} from "@/features/records/api/get-records"
import { recordColumns } from "@/features/records/components/record-columns"
import {
  sortFields,
  sortOrders,
  DEFAULT_SORT,
  DEFAULT_ORDER,
  type SortField,
} from "@/features/records/schema"

export function RecordsTable({ pageSize }: { pageSize: number }) {
  const [{ page, sort, order }, setQuery] = useQueryStates({
    page: parseAsInteger.withDefault(1),
    sort: parseAsStringLiteral(sortFields).withDefault(DEFAULT_SORT),
    order: parseAsStringLiteral(sortOrders).withDefault(DEFAULT_ORDER),
  })
  const setPage = useCallback(
    (next: number) => setQuery({ page: next }),
    [setQuery]
  )

  // Clicking the active column flips direction; a new column starts at its natural
  // direction (A→Z for names, newest-first for dates). Sorting resets to page 1.
  const onSort = useCallback(
    (field: SortField) => {
      setQuery({
        sort: field,
        order:
          field === sort
            ? order === "asc"
              ? "desc"
              : "asc"
            : field === "name"
              ? "asc"
              : "desc",
        page: 1,
      })
    },
    [setQuery, sort, order]
  )

  const { system } = useUnitSystem()
  const { data, isPending, isError } = useQuery({
    queryKey: recordsQueryKey(page, pageSize, sort, order),
    queryFn: () => fetchRecords(page, pageSize, sort, order),
    placeholderData: keepPreviousData,
  })

  const columns = useMemo(
    () => recordColumns(system, { sort, order, onSort }),
    [system, sort, order, onSort]
  )
  const rows = data?.data ?? []
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
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
                  {columns.map((_c, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
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
