import { describe, it, expect } from "vitest"
import { recordsQuerySchema } from "./schema"

describe("recordsQuerySchema", () => {
  it("applies defaults when absent", () => {
    expect(recordsQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 20,
      sort: "createdAt",
      order: "desc",
    })
  })
  it("coerces string query params to numbers", () => {
    expect(
      recordsQuerySchema.parse({ page: "3", pageSize: "20" })
    ).toMatchObject({
      page: 3,
      pageSize: 20,
    })
  })
  it("rejects page < 1 and pageSize > 100", () => {
    expect(recordsQuerySchema.safeParse({ page: 0 }).success).toBe(false)
    expect(recordsQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false)
  })
  it("accepts valid sort/order and rejects unknown values", () => {
    expect(
      recordsQuerySchema.parse({ sort: "name", order: "asc" })
    ).toMatchObject({
      sort: "name",
      order: "asc",
    })
    expect(recordsQuerySchema.safeParse({ sort: "bogus" }).success).toBe(false)
    expect(recordsQuerySchema.safeParse({ order: "sideways" }).success).toBe(
      false
    )
  })
})
