import { z } from "zod"
import { unitSystemSchema } from "@/lib/unit-system"

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

export const createRecordSchema = z
  .object({
    firstName: z.string().trim().min(1, "Required").max(100),
    lastName: z.string().trim().min(1, "Required").max(100),
    dob: z
      .string()
      .min(1, "Required")
      .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date")
      .refine((v) => new Date(v) <= new Date(), "Date of birth cannot be in the future")
      .refine((v) => new Date(v) >= new Date("1900-01-01"), "Date of birth is too far in the past"),
    sex: z.enum(["male", "female"]),
    system: unitSystemSchema,
    weightValue: z.coerce.number().positive("Enter a positive number"),
    heightValue: z.coerce.number().positive("Enter a positive number"),
    phone: z.string().trim().max(30).optional().default(""),
    email: z.string().trim().max(254).optional().default(""),
  })
  .superRefine((val, ctx) => {
    if (val.email && !z.string().email().safeParse(val.email).success) {
      ctx.addIssue({ code: "custom", path: ["email"], message: "Invalid email" })
    }
  })
export type CreateRecordInput = z.infer<typeof createRecordSchema>
