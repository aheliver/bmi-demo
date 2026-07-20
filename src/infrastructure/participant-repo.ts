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

export type CreateParticipantInput = {
  firstName: string
  lastName: string
  dob: string
  sex: "male" | "female"
  weightValue: number
  weightUnit: "kg" | "lb"
  heightValue: number
  heightUnit: "cm" | "in"
  bmi: number
  contact?: { phone: string; email: string }
}

export async function createParticipant(input: CreateParticipantInput): Promise<Record> {
  const row = await prisma.participant.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      dob: new Date(input.dob),
      sex: input.sex,
      weightValue: input.weightValue,
      weightUnit: input.weightUnit,
      heightValue: input.heightValue,
      heightUnit: input.heightUnit,
      bmi: input.bmi,
      ...(input.contact ? { contact: { create: input.contact } } : {}),
    },
    select: listSelect,
  })
  return toRecord(row)
}
