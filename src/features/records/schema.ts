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

export const sortField = z.enum(["fullName", "createdAt"])
export const sortOrder = z.enum(["asc", "desc"])
export type SortField = z.infer<typeof sortField>
export type SortOrder = z.infer<typeof sortOrder>

export const recordsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: sortField.default("createdAt"),
  order: sortOrder.default("desc"),
})
export type RecordsQuery = z.infer<typeof recordsQuerySchema>

export const recordsResponseSchema = z.object({
  data: z.array(recordSchema),
  total: z.number().int().nonnegative(),
})
export type RecordsResponse = z.infer<typeof recordsResponseSchema>
