import { describe, it, expect, vi } from "vitest"

vi.mock("@/infrastructure/participant-repo", () => ({
  listParticipants: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  createParticipant: vi.fn().mockResolvedValue({
    id: 7, firstName: "Ada", lastName: "Lovelace", dob: "1990-01-01",
    weightKg: 72, weightLb: 158.7, heightCm: 178, heightIn: 70.1, bmi: 22.7,
    createdAt: "2026-07-20T00:00:00.000Z",
  }),
}))

import { GET, POST } from "./route"
import { listParticipants, createParticipant } from "@/infrastructure/participant-repo"

const body = {
  firstName: "Ada", lastName: "Lovelace", dob: "1990-01-01", sex: "female",
  system: "metric", weightValue: 72, heightValue: 178, phone: "", email: "",
}
const post = (b: unknown) =>
  POST(new Request("http://localhost/api/records", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(b),
  }))

describe("GET /api/records", () => {
  it("validates + forwards query and returns the result", async () => {
    const res = await GET(new Request("http://localhost/api/records?page=2&pageSize=20"))
    expect(res.status).toBe(200)
    expect(listParticipants).toHaveBeenCalledWith({ page: 2, pageSize: 20 })
    expect(await res.json()).toEqual({ data: [], total: 0 })
  })

  it("400s on an invalid page", async () => {
    const res = await GET(new Request("http://localhost/api/records?page=0"))
    expect(res.status).toBe(400)
  })

  it("defaults page/pageSize when absent", async () => {
    await GET(new Request("http://localhost/api/records"))
    expect(listParticipants).toHaveBeenCalledWith({ page: 1, pageSize: 20 })
  })
})

describe("POST /api/records", () => {
  it("computes BMI server-side, derives units, and returns 201", async () => {
    const res = await post(body)
    expect(res.status).toBe(201)
    expect(createParticipant).toHaveBeenCalledWith(
      expect.objectContaining({ weightUnit: "kg", heightUnit: "cm", bmi: 22.7, contact: undefined }),
    )
  })

  it("passes a contact when phone and email are provided", async () => {
    await post({ ...body, phone: "555-0100", email: "a@b.com" })
    expect(createParticipant).toHaveBeenCalledWith(
      expect.objectContaining({ contact: { phone: "555-0100", email: "a@b.com" } }),
    )
  })

  it("creates a contact from one field, storing null for the other", async () => {
    await post({ ...body, phone: "555-0100", email: "" })
    expect(createParticipant).toHaveBeenCalledWith(
      expect.objectContaining({ contact: { phone: "555-0100", email: null } }),
    )
  })

  it("ignores a client-supplied bmi and uses the server-computed value", async () => {
    await post({ ...body, bmi: 999 })
    expect(createParticipant).toHaveBeenCalledWith(
      expect.objectContaining({ bmi: 22.7 }),
    )
  })

  it("derives imperial units when system is imperial", async () => {
    await post({ ...body, system: "imperial" })
    expect(createParticipant).toHaveBeenCalledWith(
      expect.objectContaining({ weightUnit: "lb", heightUnit: "in" }),
    )
  })

  it("400s on an invalid body", async () => {
    const res = await post({ ...body, firstName: "" })
    expect(res.status).toBe(400)
  })
})
