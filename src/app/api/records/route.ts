import { recordsQuerySchema } from "@/features/records/schema"
import { listParticipants } from "@/infrastructure/participant-repo"
import { withRequestLog } from "@/lib/with-request-log"

export const GET = withRequestLog("records.list", async (req) => {
  const url = new URL(req.url)
  const parsed = recordsQuerySchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
    sort: url.searchParams.get("sort") ?? undefined,
    order: url.searchParams.get("order") ?? undefined,
  })

  if (!parsed.success) {
    return Response.json({ error: "Invalid query parameters" }, { status: 400 })
  }

  const result = await listParticipants(parsed.data)
  return Response.json(result)
})
