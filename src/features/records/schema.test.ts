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
  it("accepts the whitelisted sort columns and rejects anything else", () => {
    expect(
      recordsQuerySchema.parse({ sort: "fullName", order: "asc" })
    ).toMatchObject({
      sort: "fullName",
      order: "asc",
    })
    expect(
      recordsQuerySchema.parse({ sort: "createdAt", order: "desc" })
    ).toMatchObject({
      sort: "createdAt",
      order: "desc",
    })
    expect(recordsQuerySchema.safeParse({ sort: "name" }).success).toBe(false)
    expect(recordsQuerySchema.safeParse({ sort: "firstName" }).success).toBe(
      false
    )
    expect(recordsQuerySchema.safeParse({ order: "sideways" }).success).toBe(
      false
    )
  })
})
