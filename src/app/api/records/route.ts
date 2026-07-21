import type { Prisma } from "@/lib/generated/prisma/client"

import { recordsQuerySchema, createRecordSchema } from "@/features/records/schema"
import { listParticipants, createParticipant } from "@/infrastructure/participant-repo"
import { computeBmi } from "@/lib/bmi"
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

const toParticipantInput = createRecordSchema.transform(
  ({ system, phone, email, dob, weightValue, heightValue, ...rest }): Prisma.ParticipantCreateInput => ({
    ...rest,
    dob: new Date(dob),
    weightValue,
    heightValue,
    weightUnit: system === "metric" ? "kg" : "lb",
    heightUnit: system === "metric" ? "cm" : "in",
    bmi: computeBmi({ weightValue, heightValue, system }),
    contact:
      phone || email ? { create: { phone: phone || null, email: email || null } } : undefined,
  }),
)

export const POST = withRequestLog("records.create", async (req, log) => {
  const body = await req.json().catch(() => null)
  const parsed = toParticipantInput.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Invalid record" }, { status: 400 })
  }

  const record = await createParticipant(parsed.data)
  log.info({ recordId: record.id }, "record.created")
  return Response.json(record, { status: 201 })
})
