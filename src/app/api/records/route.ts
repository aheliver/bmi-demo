import { recordsQuerySchema } from "@/domain/record"
import { listRecords } from "@/services/list-records"
import { withRequestLog } from "@/lib/with-request-log"

export const GET = withRequestLog("records.list", async (req) => {
  const url = new URL(req.url)
  const parsed = recordsQuerySchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
  })

  if (!parsed.success) {
    return Response.json({ error: "Invalid query parameters" }, { status: 400 })
  }

  const result = await listRecords(parsed.data)
  return Response.json(result)
})
