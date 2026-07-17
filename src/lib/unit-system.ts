import { z } from "zod"

export const unitSystemSchema = z.enum(["metric", "imperial"])
export type UnitSystem = z.infer<typeof unitSystemSchema>
