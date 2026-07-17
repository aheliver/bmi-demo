import { describe, it, expect } from "vitest"
import { recordsQuerySchema } from "./schema"

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
