import { z } from "zod"

export const recordSchema = z.object({
  id: z.number().int().positive(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dob: z.string(),
  weightKg: z.number().positive(),
  weightLb: z.number().positive(),
  heightCm: z.number().positive(),
  heightIn: z.number().positive(),
  bmi: z.number().positive(),
  createdAt: z.string(),
})
export type Record = z.infer<typeof recordSchema>

export const sortFields = ["name", "createdAt"] as const
export const sortOrders = ["asc", "desc"] as const
export type SortField = (typeof sortFields)[number]
export type SortOrder = (typeof sortOrders)[number]

export const DEFAULT_SORT: SortField = "createdAt"
export const DEFAULT_ORDER: SortOrder = "desc"

export const recordsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(sortFields).default(DEFAULT_SORT),
  order: z.enum(sortOrders).default(DEFAULT_ORDER),
})
export type RecordsQuery = z.infer<typeof recordsQuerySchema>

export const recordsResponseSchema = z.object({
  data: z.array(recordSchema),
  total: z.number().int().nonnegative(),
})
export type RecordsResponse = z.infer<typeof recordsResponseSchema>
