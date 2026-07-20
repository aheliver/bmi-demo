import { recordsQuerySchema, createRecordSchema } from "@/features/records/schema"
import { listParticipants, createParticipant } from "@/infrastructure/participant-repo"
import { computeBmi } from "@/lib/bmi"
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

  const result = await listParticipants(parsed.data)
  return Response.json(result)
})

export const POST = withRequestLog("records.create", async (req, log) => {
  const body = await req.json().catch(() => null)
  const parsed = createRecordSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Invalid record" }, { status: 400 })
  }

  const { firstName, lastName, dob, sex, system, weightValue, heightValue, phone, email } = parsed.data
  const record = await createParticipant({
    firstName,
    lastName,
    dob,
    sex,
    weightValue,
    weightUnit: system === "metric" ? "kg" : "lb",
    heightValue,
    heightUnit: system === "metric" ? "cm" : "in",
    bmi: computeBmi({ weightValue, heightValue, system }),
    contact: phone && email ? { phone, email } : undefined,
  })

  log.info({ recordId: record.id }, "record.created")
  return Response.json(record, { status: 201 })
})
