import { describe, it, expect, vi } from "vitest"

vi.mock("./logger", () => {
  const child = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  return { logger: { child: () => child, info: vi.fn(), warn: vi.fn(), error: vi.fn() } }
})

import { withRequestLog } from "./with-request-log"

describe("withRequestLog", () => {
  it("invokes the handler and returns its response", async () => {
    const handler = withRequestLog("records.list", async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 }))
    const res = await handler(new Request("http://localhost/api/records?page=1"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it("returns 500 when the handler throws", async () => {
    const handler = withRequestLog("records.list", async () => {
      throw new Error("boom")
    })
    const res = await handler(new Request("http://localhost/api/records"))
    expect(res.status).toBe(500)
  })
})
