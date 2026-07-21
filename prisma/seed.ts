import "dotenv/config"

import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "../src/lib/generated/prisma/client"
import { computeBmi } from "../src/lib/bmi"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

// Coprime list lengths (21 and 20) so first and last names advance
// independently: every row gets a distinct pair, unique across all 60.
const FIRST = ["Ada","Alan","Grace","Katherine","Linus","Margaret","Dennis","Barbara","Edsger","Radia","Ken","Hedy","Tim","Anita","Guido","Shafi","James","Sophie","Bjarne","Joan","Donald"]
const LAST = ["Lovelace","Turing","Hopper","Johnson","Torvalds","Hamilton","Ritchie","Liskov","Dijkstra","Perlman","Thompson","Lamarr","Berners-Lee","Borg","Rossum","Goldwasser","Gosling","Wilson","Stroustrup","Clarke"]

// Deterministic pseudo-spread (no Math.random — keeps seeds reproducible).
function makeRow(i: number) {
  const imperial = i % 2 === 0
  const weightValue = imperial ? 120 + ((i * 3) % 130) : 55 + ((i * 1.4) % 60) // lb : kg
  const heightValue = imperial ? 60 + ((i * 2) % 18) : 152 + ((i * 3) % 46) // in : cm
  const weightUnit = imperial ? ("lb" as const) : ("kg" as const)
  const heightUnit = imperial ? ("in" as const) : ("cm" as const)
  const system = imperial ? ("imperial" as const) : ("metric" as const)
  const bmi = computeBmi({ weightValue, heightValue, system })
  const year = 1955 + (i % 45)
  const month = String((i % 12) + 1).padStart(2, "0")
  const day = String((i % 27) + 1).padStart(2, "0")
  return {
    firstName: FIRST[i % FIRST.length],
    lastName: LAST[i % LAST.length],
    dob: new Date(`${year}-${month}-${day}`),
    sex: i % 2 === 0 ? ("male" as const) : ("female" as const),
    weightValue: weightValue.toFixed(3),
    weightUnit,
    heightValue: heightValue.toFixed(2),
    heightUnit,
    bmi: bmi.toFixed(1),
    contact: {
      create: {
        phone: `+1415555${String(1000 + i).slice(-4)}`,
        email: `${FIRST[i % FIRST.length].toLowerCase()}.${i}@example.com`,
      },
    },
  }
}

async function main() {
  await prisma.contact.deleteMany()
  await prisma.participant.deleteMany()
  for (let i = 0; i < 60; i++) {
    await prisma.participant.create({ data: makeRow(i) })
  }
  const count = await prisma.participant.count()
  console.log(`Seeded ${count} participants`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
