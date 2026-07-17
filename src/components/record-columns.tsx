"use client"

import type { ColumnDef } from "@tanstack/react-table"

import type { RecordDto, UnitSystem } from "@/domain/record"
import { formatWeight, formatHeight } from "@/domain/units"

export function recordColumns(system: UnitSystem): ColumnDef<RecordDto>[] {
  return [
    {
      id: "fullName",
      header: "Full name",
      accessorFn: (r) => `${r.firstName} ${r.lastName}`,
    },
    { accessorKey: "dob", header: "DOB" },
    {
      id: "height",
      header: "Height",
      cell: ({ row }) => formatHeight(row.original.heightCm, row.original.heightIn, system),
    },
    {
      id: "weight",
      header: "Weight",
      cell: ({ row }) => formatWeight(row.original.weightKg, row.original.weightLb, system),
    },
    { accessorKey: "bmi", header: "BMI" },
    {
      id: "createdAt",
      header: "Date created",
      cell: ({ row }) => row.original.createdAt.slice(0, 10),
    },
  ]
}
