import { describe, it, expect, vi } from "vitest"

vi.mock("@/services/list-records", () => ({
  listRecords: vi.fn().mockResolvedValue({ data: [], total: 0 }),
}))

import { GET } from "./route"
import { listRecords } from "@/services/list-records"

describe("GET /api/records", () => {
  it("validates + forwards query and returns the result", async () => {
    const res = await GET(new Request("http://localhost/api/records?page=2&pageSize=20"))
    expect(res.status).toBe(200)
    expect(listRecords).toHaveBeenCalledWith({ page: 2, pageSize: 20 })
    expect(await res.json()).toEqual({ data: [], total: 0 })
  })

  it("400s on an invalid page", async () => {
    const res = await GET(new Request("http://localhost/api/records?page=0"))
    expect(res.status).toBe(400)
  })

  it("defaults page/pageSize when absent", async () => {
    await GET(new Request("http://localhost/api/records"))
    expect(listRecords).toHaveBeenCalledWith({ page: 1, pageSize: 20 })
  })
})
