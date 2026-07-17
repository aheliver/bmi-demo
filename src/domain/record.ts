import { z } from "zod"

export const SEXES = ["male", "female"] as const

// The one shared unit vocabulary — reused by the DB enum, the domain (BMI), the display
// toggle, and the cookie. No unit string literals live anywhere else in the app.
export const UNIT_SYSTEMS = ["metric", "imperial"] as const
export const unitSystemSchema = z.enum(UNIT_SYSTEMS)
export type UnitSystem = z.infer<typeof unitSystemSchema>
// Metric ⇒ weight in kg, height in cm. Imperial ⇒ weight in lb, height in in.

/** One row of GET /api/records. Participant fields only — no contact PII.
 *  Carries both unit systems (from DB generated columns) so the client renders either
 *  system by selecting a column — no refetch, no read-time conversion. */
export const recordDtoSchema = z.object({
  id: z.number().int().positive(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dob: z.string(), // ISO calendar date, yyyy-mm-dd
  weightKg: z.number().positive(),
  weightLb: z.number().positive(),
  heightCm: z.number().positive(),
  heightIn: z.number().positive(),
  bmi: z.number().positive(),
  createdAt: z.string(), // ISO datetime
})
export type RecordDto = z.infer<typeof recordDtoSchema>

/** Query params for the list endpoint. Coerces the raw string searchParams. */
export const recordsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})
export type RecordsQuery = z.infer<typeof recordsQuerySchema>

export const recordsResponseSchema = z.object({
  data: z.array(recordDtoSchema),
  total: z.number().int().nonnegative(),
})
export type RecordsResponse = z.infer<typeof recordsResponseSchema>
