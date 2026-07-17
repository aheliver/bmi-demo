// Only the query schema is tested — it carries real logic (coercion + defaults + bounds)
// and is the request trust boundary. recordDtoSchema is a plain output shape (no logic
// beyond Zod primitives), so testing it would just be testing Zod — omitted per AGENTS.md.
import { describe, it, expect } from "vitest"
import { recordsQuerySchema } from "./record"

describe("recordsQuerySchema", () => {
  it("applies defaults when absent", () => {
    expect(recordsQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 })
  })
  it("coerces string query params to numbers", () => {
    expect(recordsQuerySchema.parse({ page: "3", pageSize: "20" })).toEqual({ page: 3, pageSize: 20 })
  })
  it("rejects page < 1 and pageSize > 100", () => {
    expect(recordsQuerySchema.safeParse({ page: 0 }).success).toBe(false)
    expect(recordsQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false)
  })
})
