import { prisma } from "./prisma"
import type { Prisma } from "@/lib/generated/prisma/client"
import type { RecordsQuery, RecordsResponse, Record } from "@/features/records/schema"

const listSelect = {
  id: true,
  firstName: true,
  lastName: true,
  dob: true,
  weightKg: true,
  weightLb: true,
  heightCm: true,
  heightIn: true,
  bmi: true,
  createdAt: true,
} as const

type Row = Prisma.ParticipantGetPayload<{ select: typeof listSelect }>

function toRecord(row: Row): Record {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    dob: row.dob.toISOString().slice(0, 10),
    weightKg: row.weightKg.toNumber(),
    weightLb: row.weightLb.toNumber(),
    heightCm: row.heightCm.toNumber(),
    heightIn: row.heightIn.toNumber(),
    bmi: row.bmi.toNumber(),
    createdAt: row.createdAt.toISOString(),
  }
}

export async function listParticipants({ page, pageSize }: RecordsQuery): Promise<RecordsResponse> {
  const where = { deletedAt: null }
  const [rows, total] = await Promise.all([
    prisma.participant.findMany({
      where,
      select: listSelect,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.participant.count({ where }),
  ])
  return { data: rows.map(toRecord), total }
}

export async function createParticipant(data: Prisma.ParticipantCreateInput): Promise<Record> {
  const row = await prisma.participant.create({ data, select: listSelect })
  return toRecord(row)
}
