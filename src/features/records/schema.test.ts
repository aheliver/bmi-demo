import { describe, it, expect } from "vitest"
import { recordsQuerySchema, createRecordSchema } from "./schema"

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

const valid = {
  firstName: "Ada",
  lastName: "Lovelace",
  dob: "1990-01-01",
  sex: "female",
  system: "metric",
  weightValue: 72,
  heightValue: 178,
  phone: "",
  email: "",
}

describe("createRecordSchema", () => {
  it("accepts a valid record with no contact", () => {
    const parsed = createRecordSchema.parse(valid)
    expect(parsed.weightValue).toBe(72)
    expect(parsed.phone).toBe("")
  })

  it("coerces numeric strings (form inputs) to numbers", () => {
    const parsed = createRecordSchema.parse({ ...valid, weightValue: "72", heightValue: "178" })
    expect(parsed.weightValue).toBe(72)
    expect(parsed.heightValue).toBe(178)
  })

  it("rejects a missing name and a non-positive weight", () => {
    expect(createRecordSchema.safeParse({ ...valid, firstName: "" }).success).toBe(false)
    expect(createRecordSchema.safeParse({ ...valid, weightValue: 0 }).success).toBe(false)
  })

  it("rejects a future DOB and one before 1900", () => {
    expect(createRecordSchema.safeParse({ ...valid, dob: "3000-01-01" }).success).toBe(false)
    expect(createRecordSchema.safeParse({ ...valid, dob: "1899-12-31" }).success).toBe(false)
  })

  it("allows phone and email independently (or neither)", () => {
    expect(createRecordSchema.safeParse({ ...valid, phone: "555", email: "" }).success).toBe(true)
    expect(createRecordSchema.safeParse({ ...valid, phone: "", email: "a@b.com" }).success).toBe(true)
    expect(createRecordSchema.safeParse({ ...valid, phone: "", email: "" }).success).toBe(true)
    expect(createRecordSchema.safeParse({ ...valid, phone: "555", email: "a@b.com" }).success).toBe(true)
  })

  it("rejects an invalid email whenever email is provided", () => {
    expect(createRecordSchema.safeParse({ ...valid, phone: "", email: "nope" }).success).toBe(false)
    expect(createRecordSchema.safeParse({ ...valid, phone: "555", email: "nope" }).success).toBe(false)
  })
})
