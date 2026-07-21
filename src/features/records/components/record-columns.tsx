import type { ColumnDef, Row } from "@tanstack/react-table"

import { formatWeight, formatHeight } from "@/lib/format"
import { useUnitSystem } from "@/providers/unit-system-provider"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import type { Record } from "@/features/records/schema"

function HeightCell({ row }: { row: Row<Record> }) {
  const { system } = useUnitSystem()
  return formatHeight(row.original.heightCm, row.original.heightIn, system)
}

function WeightCell({ row }: { row: Row<Record> }) {
  const { system } = useUnitSystem()
  return formatWeight(row.original.weightKg, row.original.weightLb, system)
}

export const recordColumns: ColumnDef<Record>[] = [
  {
    id: "fullName",
    accessorFn: (r) => `${r.firstName} ${r.lastName}`,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Full name" />
    ),
  },
  { accessorKey: "dob", header: "DOB", enableSorting: false },
  { id: "height", header: "Height", enableSorting: false, cell: HeightCell },
  { id: "weight", header: "Weight", enableSorting: false, cell: WeightCell },
  { accessorKey: "bmi", header: "BMI", enableSorting: false },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date created" />
    ),
    sortDescFirst: true,
    cell: ({ row }) => row.original.createdAt.slice(0, 10),
  },
]
