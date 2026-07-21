import type { ColumnDef } from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react"

import type { UnitSystem } from "@/lib/unit-system"
import { formatWeight, formatHeight } from "@/lib/format"
import { Button } from "@/components/ui/button"
import type { Record, SortField, SortOrder } from "@/features/records/schema"

type SortState = {
  sort: SortField
  order: SortOrder
  onSort: (field: SortField) => void
}

function SortableHeader({
  label,
  field,
  sort,
  order,
  onSort,
}: SortState & { label: string; field: SortField }) {
  const active = sort === field
  const Icon = active ? (order === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8"
      onClick={() => onSort(field)}
    >
      {label}
      <Icon className={active ? "size-4" : "size-4 opacity-50"} aria-hidden />
    </Button>
  )
}

export function recordColumns(
  system: UnitSystem,
  sortState: SortState
): ColumnDef<Record>[] {
  return [
    {
      id: "fullName",
      header: () => (
        <SortableHeader label="Full name" field="fullName" {...sortState} />
      ),
      accessorFn: (r) => `${r.firstName} ${r.lastName}`,
    },
    { accessorKey: "dob", header: "DOB" },
    {
      id: "height",
      header: "Height",
      cell: ({ row }) =>
        formatHeight(row.original.heightCm, row.original.heightIn, system),
    },
    {
      id: "weight",
      header: "Weight",
      cell: ({ row }) =>
        formatWeight(row.original.weightKg, row.original.weightLb, system),
    },
    { accessorKey: "bmi", header: "BMI" },
    {
      id: "createdAt",
      header: () => (
        <SortableHeader label="Date created" field="createdAt" {...sortState} />
      ),
      cell: ({ row }) => row.original.createdAt.slice(0, 10),
    },
  ]
}
