import { describe, it, expect, vi } from "vitest"

vi.mock("@/infrastructure/participant-repo", () => ({
  listParticipants: vi.fn().mockResolvedValue({ data: [], total: 0 }),
}))

import { GET } from "./route"
import { listParticipants } from "@/infrastructure/participant-repo"

describe("GET /api/records", () => {
  it("validates + forwards query and returns the result", async () => {
    const res = await GET(new Request("http://localhost/api/records?page=2&pageSize=20"))
    expect(res.status).toBe(200)
    expect(listParticipants).toHaveBeenCalledWith({
      page: 2,
      pageSize: 20,
      sort: "createdAt",
      order: "desc",
    })
    expect(await res.json()).toEqual({ data: [], total: 0 })
  })

  it("400s on an invalid page", async () => {
    const res = await GET(new Request("http://localhost/api/records?page=0"))
    expect(res.status).toBe(400)
  })

  it("defaults page/pageSize/sort/order when absent", async () => {
    await GET(new Request("http://localhost/api/records"))
    expect(listParticipants).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      sort: "createdAt",
      order: "desc",
    })
  })

  it("forwards a non-default sort/order to the repo", async () => {
    await GET(new Request("http://localhost/api/records?sort=name&order=asc"))
    expect(listParticipants).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      sort: "name",
      order: "asc",
    })
  })

  it("400s on an unknown sort field", async () => {
    const res = await GET(new Request("http://localhost/api/records?sort=bogus"))
    expect(res.status).toBe(400)
  })
})
