# BMI Home Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the home page — a paginated (20/page) table of participant BMI records with a header unit-system toggle (Metric ↔ Imperial), a placeholder footer, and a bottom-right Add FAB — backed by the two-table Postgres schema, an SSR-hydrated React Query read, and a Zod contract shared by client and server.

**Architecture:** Layer-first per `AGENTS.md` (`app → services → domain ← infrastructure`). The **shared Zod record contract lives in `src/domain/`** and is the spine: the repository maps Prisma rows to it, the use case returns it, the GET route handler re-validates the query with it, and the client parses/renders it — one schema, both sides. The row DTO carries **both unit systems** (`weightKg`+`weightLb`, `heightCm`+`heightIn`) — all computed by Postgres as generated STORED columns — so the header toggle re-renders Metric/Imperial by **selecting and formatting** the right column, with **no refetch and no read-time conversion**. BMI is a pure domain function, written to the DB only by the seed (this feature is GET-only).

**Tech Stack:** Next.js 16 (App Router, RSC), TypeScript, Prisma 7 + PostgreSQL, Zod 4, TanStack Query 5 (SSR hydration) + TanStack Table 8 (shadcn Data Table), nuqs 2, shadcn/ui, pino, Vitest + happy-dom + Testing Library, Playwright.

## Global Constraints

- **Stack is fixed by `AGENTS.md`** — never introduce a tool outside its canonical table. New libs need a recorded decision; this plan adds **none** (everything used is already in `package.json`).
- **Next.js 16 rules:** Server Components by default; `'use client'` only for state/effects/browser APIs. `params`/`searchParams` are Promises — `await` them. Server → client island data via `dehydrate` + `<HydrationBoundary>` + `useQuery`, **never an `initial` prop**. (The unit-system cookie passed as the toggle's initial UI state is a *preference*, not query data — that is **not** the anti-pattern.)
- **Validation:** one Zod schema per shape, colocated with its inferred type, in `src/domain/`. Validate client-side (UX) and **re-parse server-side** (trust boundary) from the SAME schema.
- **Layers:** `domain/` imports nothing but Zod (validators live in domain; "zero deps" means zero I/O/side-effect deps). Domain must stay **client-safe** — no node built-ins, no server-only imports. No Prisma calls outside `src/infrastructure/`. No business logic or SQL in route handlers.
- **Numeric:** Postgres `numeric` (Prisma `Decimal`) in the DB; convert `Decimal → number` **once, in the repository mapper**. `number` at the transport/domain boundary.
- **Logging:** pino JSON to stdout; never log request bodies or PII (this app captures health data). Event names `domain.action.outcome`.
- **Git:** commit as `geliwer@gmail.com` (name `aheliver`); never push to `main`; land via `gh pr create`.
- **Testing ships with the code** (same commit). No useless tests — a test earns its place only if it fails when real logic breaks. TDD: failing test → minimal impl → pass.
- **DB columns:** `snake_case` in Postgres via `@map`/`@@map`; camelCase in Prisma Client / TS.
- **Out of scope (do not build):** filtering, sorting, the Add popup / `POST` shape, auth, `address`, Update/Delete endpoints. The schema/query surface leaves room for them.

---

## File Structure

**Prisma / data**
- `prisma/schema.prisma` — Modify: add `Sex`/`WeightUnit`/`HeightUnit` enums + `Participant` + `Contact` models.
- `prisma/migrations/**` — Create: base migration (tables) + hand-edited generated-column DDL.
- `prisma/seed.ts` — Create: ~60 mock participants+contacts; computes BMI via the domain function.
- `prisma.config.ts` — Modify: register the seed command.

**Domain (pure, client-safe, Zod only)**
- `src/domain/record.ts` — Create: `recordDtoSchema`, `recordsQuerySchema`, `recordsResponseSchema` + inferred types + unit-system constants.
- `src/domain/bmi.ts` — Create: `computeBmi`.
- `src/domain/units.ts` — Create: `formatWeight`/`formatHeight` — select the DB-provided value for the system + format (no conversion).

**Infrastructure** (data access = plain functions, not a repository class/interface — the Next+Prisma standard)
- `src/infrastructure/prisma.ts` — Create: `PrismaClient` singleton.
- `src/infrastructure/participant-repo.ts` — Create: `listParticipants()` — Prisma query + maps rows → `RecordDto`.

**Services**
- `src/services/list-records.ts` — Create: `listRecords` use case.

**lib / cross-cutting**
- `src/lib/logger.ts` — Create: pino singleton.
- `src/lib/with-request-log.ts` — Create: route-handler logging wrapper.
- `src/lib/query-client.ts` — Create: `makeQueryClient`/`getQueryClient`.
- `src/lib/records-query.ts` — Create: shared query key + `fetchRecords` (client transport, parses response).
- `src/lib/unit-system.ts` — Create: **client-safe** — cookie name + `parseUnitSystem`. No `next/headers`.
- `src/lib/unit-system.server.ts` — Create: **server-only** — `getUnitSystem()` (reads the cookie via `next/headers`).

**App / API**
- `src/app/api/records/route.ts` — Create: `GET` handler.
- `src/app/page.tsx` — Modify: static shell (footer + FAB + frame) + one `<Suspense>` dynamic island.
- `src/app/layout.tsx` — Modify: wrap children in `NuqsAdapter` + `QueryProvider`.
- `src/components/records-section.tsx` — Create: the dynamic island — reads the cookie + `searchParams`, prefetches, hydrates, renders header + table under the unit provider.
- `next.config.ts` — Modify: enable `cacheComponents`.

**Providers / hooks / UI (client)**
- `src/providers/query-provider.tsx` — Create.
- `src/providers/unit-system-provider.tsx` — Create: UI-preference context (initialised from the cookie).
- `src/hooks/use-records.ts` — Create: `useRecords` query hook.
- `src/hooks/use-unit-system.ts` — Create: context consumer hook.
- `src/components/records-table.tsx` — Create: client island (TanStack/shadcn Data Table + pager).
- `src/components/record-columns.tsx` — Create: column definitions.
- `src/components/unit-toggle.tsx` — Create: Metric/Imperial toggle.
- `src/components/site-header.tsx` — Create: header hosting the toggle.
- `src/components/site-footer.tsx` — Create.
- `src/components/add-fab.tsx` — Create: bottom-right `+` button (opens nothing).
- shadcn primitives added via CLI: `table`, `toggle-group`, `skeleton`, `sonner`.

---

## Task 1: Prisma schema — enums, `Participant`, `Contact`, base migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_init_participant_contact/migration.sql` (generated)

**Interfaces:**
- Produces: Prisma models `Participant` (as-entered + `bmi` + timestamps; the two generated columns are added in Task 2) and `Contact`; DB tables `participant`, `contact`. Column names are `snake_case`.

**Environment note:** Prisma 7 requires **Node.js 24+**. Confirm `node --version` is ≥ 24 before running any `prisma` command (a Node 20 shell crashes `prisma generate` with an ESM/CJS error). Use `nvm use 24` or equivalent.

- [ ] **Step 1: Ensure the dev database is running**

Run: `npm run db:up`
Expected: `bmi_postgres` container healthy. Confirm `.env` exists (copy from `.env.example` if not): it must define `DATABASE_URL`.

- [ ] **Step 2: Write the models into `prisma/schema.prisma`**

Append below the existing `datasource` block:

```prisma
enum Sex {
  male
  female
}

enum WeightUnit {
  kg
  lb
}

enum HeightUnit {
  cm
  in
}

model Participant {
  id          Int        @id @default(autoincrement())
  firstName   String     @map("first_name")
  lastName    String     @map("last_name")
  dob         DateTime   @db.Date
  sex         Sex
  weightValue Decimal    @map("weight_value") @db.Decimal(7, 3)
  weightUnit  WeightUnit @map("weight_unit")
  heightValue Decimal    @map("height_value") @db.Decimal(6, 2)
  heightUnit  HeightUnit @map("height_unit")

  // NOTE: the generated STORED columns (weight_kg, weight_lb, height_cm, height_in)
  // are deliberately NOT declared here yet. Task 2 creates them via raw SQL, then
  // `prisma db pull` introspects them back with Prisma's own correct annotation.

  bmi Decimal @db.Decimal(4, 1)

  createdAt DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt DateTime? @map("deleted_at") @db.Timestamptz(6)

  contact Contact?

  @@index([bmi])
  @@index([createdAt])
  @@index([deletedAt])
  @@map("participant")
}

model Contact {
  id            Int      @id @default(autoincrement())
  participantId Int      @unique @map("participant_id")
  phone         String
  email         String
  createdAt     DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt     DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt     DateTime? @map("deleted_at") @db.Timestamptz(6)

  participant Participant @relation(fields: [participantId], references: [id], onDelete: Cascade)

  @@index([participantId])
  @@map("contact")
}
```

- [ ] **Step 3: Create and apply the base migration**

Run: `npx prisma migrate dev --name init_participant_contact`
Expected: a new folder under `prisma/migrations/` with `migration.sql`, applied to the DB, then `prisma generate` runs. Both `participant` and `contact` tables now exist (without the generated columns).

- [ ] **Step 4: Verify the tables exist**

Run: `docker exec bmi_postgres psql -U bmi -d bmi -c "\dt"`
Expected: `participant` and `contact` listed.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add participant + contact schema and base migration"
```

---

## Task 2: Add `weight_kg`/`weight_lb`/`height_cm`/`height_in` as generated STORED columns (raw migration + introspect)

**Files:**
- Create: `prisma/migrations/<timestamp>_add_generated_unit_columns/migration.sql`
- Modify: `prisma/schema.prisma` (via `prisma db pull` — introspects the correct read-only annotation)

**Interfaces:**
- Produces: `participant.weight_kg`, `participant.weight_lb`, `participant.height_cm`, `participant.height_in` as `GENERATED ALWAYS AS (...) STORED`, plus the matching `Participant` fields that Prisma **omits from create/update inputs**. The exact schema annotation is whatever `db pull` writes — never a guess.

**Why all four (the design decision):** the display toggle can render **any** row in **either** system, and **read-time conversion is forbidden** (the requirement). So both representations of each measurement are **precomputed** in the DB — the client just picks the column matching the toggle and formats it. (This holds regardless of how rows were entered: even an all-metric dataset still needs `weight_lb`/`height_in` to render imperial without converting.) All four are generated from the single as-entered source, so there is zero drift and one source of truth, and no client-side unit conversion exists (see Task 3 — formatting only).

**Why introspect, not hardcode:** Prisma has no first-class STORED-generated support and the correct field annotation (`@default(dbgenerated(...))` vs a comment vs `@ignore`) differs by version. Rather than guess, we create the columns in raw SQL and let `prisma db pull` introspect the annotation Prisma considers drift-free. The verification steps are a **hard gate** — do not proceed to Task 7/8 until both checks pass.

- [ ] **Step 1: Create an empty migration to hold the raw DDL**

Run: `npx prisma migrate dev --create-only --name add_generated_unit_columns`
Expected: a new migration folder with an (essentially empty) `migration.sql` — the schema and DB are otherwise in sync.

- [ ] **Step 2: Write the generated-column DDL into that migration**

Replace the migration's `migration.sql` contents with (0.45359237 kg/lb, 2.54 cm/in — exact constants; each system is a `CASE` on the entered unit, so no generated column references another):

```sql
ALTER TABLE "participant"
  ADD COLUMN "weight_kg" numeric(9,4) GENERATED ALWAYS AS (
    CASE "weight_unit" WHEN 'kg' THEN "weight_value" ELSE "weight_value" * 0.45359237 END
  ) STORED,
  ADD COLUMN "weight_lb" numeric(9,4) GENERATED ALWAYS AS (
    CASE "weight_unit" WHEN 'lb' THEN "weight_value" ELSE "weight_value" / 0.45359237 END
  ) STORED,
  ADD COLUMN "height_cm" numeric(6,2) GENERATED ALWAYS AS (
    CASE "height_unit" WHEN 'cm' THEN "height_value" ELSE "height_value" * 2.54 END
  ) STORED,
  ADD COLUMN "height_in" numeric(6,2) GENERATED ALWAYS AS (
    CASE "height_unit" WHEN 'in' THEN "height_value" ELSE "height_value" / 2.54 END
  ) STORED;
```

- [ ] **Step 3: Apply the migration**

Run: `npx prisma migrate dev`
Expected: applies the pending migration and reports success. If it asks to reset, do **not** reset — re-read the SQL for a syntax slip.

- [ ] **Step 4: Verify the columns are generated in the live DB, and the math is right**

```bash
docker exec bmi_postgres psql -U bmi -d bmi -c "\d participant" | grep -E "weight_kg|weight_lb|height_cm|height_in"
```
Expected: all four show `generated always as (...) stored`. Then check the math with a throwaway row:
```bash
docker exec bmi_postgres psql -U bmi -d bmi -c \
"INSERT INTO participant (first_name,last_name,dob,sex,weight_value,weight_unit,height_value,height_unit,bmi,updated_at) \
 VALUES ('t','t','2000-01-01','male',150,'lb',70,'in',21.5,now()) RETURNING weight_kg, weight_lb, height_cm, height_in;"
docker exec bmi_postgres psql -U bmi -d bmi -c "DELETE FROM participant WHERE first_name='t';"
```
Expected: `weight_kg ≈ 68.0389`, `weight_lb = 150.0000`, `height_cm = 177.80`, `height_in = 70.00`.

- [ ] **Step 5: Introspect the columns back into the schema**

Run: `npx prisma db pull`
Expected: `schema.prisma` now contains `weightKg`/`weightLb`/`heightCm`/`heightIn` fields on `Participant` with whatever annotation Prisma emits for generated columns. `db pull` may reorder fields or rewrite the relation/`@map` formatting — **diff it** (`git diff prisma/schema.prisma`) and restore any relation names, `@@map`, or index lines it dropped, keeping ONLY the four new generated-column fields as the intended change. Re-add the `@map(...)` for each if pull didn't.

- [ ] **Step 6: Regenerate the client and GATE on read-only inputs (do not proceed if this fails)**

Run: `npx prisma generate`
Then confirm Prisma treats the columns as read-only:
```bash
grep -RnE "weightKg|weightLb|heightCm|heightIn" src/lib/generated/prisma/models.ts | head
```
**Hard gate — both must hold:**
1. `npx prisma migrate dev` reports **no drift** ("Already in sync" / no new migration needed).
2. The generated `ParticipantCreateInput`/`ParticipantUncheckedCreateInput` in `src/lib/generated/prisma/` **do not require** the four generated fields (they must be absent or optional). Confirm by opening `models.ts` / the create-input type.

If either fails (e.g. a field is writable/required), the annotation is wrong: mark the field with `@ignore` for writes while keeping it readable, or adjust per the introspected form, then re-run this step. Only continue once inserts won't send these columns (Postgres rejects writes to a generated column).

- [ ] **Step 7: Commit**

```bash
git add prisma/migrations prisma/schema.prisma
git commit -m "feat(db): weight_kg/height_cm generated STORED columns (introspected)"
```

---

## Task 3: Domain — unit formatting (`src/domain/units.ts`)

**Files:**
- Create: `src/domain/units.ts`
- Test: `src/domain/units.test.ts`

**Interfaces:**
- Consumes: `UnitSystem` type from Task 4 (`src/domain/record.ts`). **Write Task 4's constants first if implementing out of order** — the `UnitSystem` type is defined there.
- Produces: `formatWeight(weightKg: number, weightLb: number, system: UnitSystem): string`; `formatHeight(heightCm: number, heightIn: number, system: UnitSystem): string`.
- **No conversion here.** Both unit representations already come from the DB (Task 2 generated columns). These helpers only **select** the value matching the system and **format** it (round + label). There are no kg↔lb / cm↔in math functions anywhere in the app.

- [ ] **Step 1: Write the failing test**

```ts
// src/domain/units.test.ts
import { describe, it, expect } from "vitest"
import { formatWeight, formatHeight } from "./units"

describe("formatWeight", () => {
  it("selects + formats the kg value in metric", () => {
    expect(formatWeight(68.0389, 150, "metric")).toBe("68.0 kg")
  })
  it("selects + formats the lb value in imperial", () => {
    expect(formatWeight(68.0389, 150, "imperial")).toBe("150.0 lb")
  })
})

describe("formatHeight", () => {
  it("selects + formats the cm value in metric", () => {
    expect(formatHeight(177.8, 70, "metric")).toBe("178 cm")
  })
  it("selects + formats the in value in imperial", () => {
    expect(formatHeight(177.8, 70, "imperial")).toBe("70 in")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/units.test.ts`
Expected: FAIL — module `./units` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/domain/units.ts
import type { UnitSystem } from "./record"

const round1 = (n: number): number => Math.round(n * 10) / 10

// Both values come pre-computed from the DB; pick the one for `system` and format it.
export function formatWeight(weightKg: number, weightLb: number, system: UnitSystem): string {
  return system === "metric"
    ? `${round1(weightKg).toFixed(1)} kg`
    : `${round1(weightLb).toFixed(1)} lb`
}

export function formatHeight(heightCm: number, heightIn: number, system: UnitSystem): string {
  return system === "metric"
    ? `${Math.round(heightCm)} cm`
    : `${Math.round(heightIn)} in`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/units.test.ts`
Expected: PASS (4 tests). If it errors on the `UnitSystem` import, implement Task 4 Step 3 first, then re-run.

- [ ] **Step 5: Commit**

```bash
git add src/domain/units.ts src/domain/units.test.ts
git commit -m "feat(domain): unit formatting helpers (select + format, no conversion)"
```

---

## Task 4: Domain — shared Zod record contract (`src/domain/record.ts`)

**Files:**
- Create: `src/domain/record.ts`
- Test: `src/domain/record.test.ts`

**Interfaces:**
- Produces: constant `SEXES`; the shared unit vocabulary `UNIT_SYSTEMS` + `unitSystemSchema` + `UnitSystem`; `recordDtoSchema` + `RecordDto`; `recordsQuerySchema` + `RecordsQuery`; `recordsResponseSchema` + `RecordsResponse`. This is the contract every other layer consumes.

- [ ] **Step 1: Write the failing test**

```ts
// src/domain/record.test.ts
// Only the query schema is tested — it carries real logic (coercion + defaults + bounds)
// and is the request trust boundary. recordDtoSchema is a plain output shape (no logic
// beyond Zod primitives), so testing it would just be testing Zod — omitted per AGENTS.md.
import { describe, it, expect } from "vitest"
import { recordsQuerySchema } from "./record"

describe("recordsQuerySchema", () => {
  it("applies defaults when absent", () => {
    expect(recordsQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 })
  })
  it("coerces string query params to numbers", () => {
    expect(recordsQuerySchema.parse({ page: "3", pageSize: "20" })).toEqual({ page: 3, pageSize: 20 })
  })
  it("rejects page < 1 and pageSize > 100", () => {
    expect(recordsQuerySchema.safeParse({ page: 0 }).success).toBe(false)
    expect(recordsQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/record.test.ts`
Expected: FAIL — module `./record` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/domain/record.ts
import { z } from "zod"

export const SEXES = ["male", "female"] as const

// The one shared unit vocabulary — reused by the DB enum, the domain (BMI), the display
// toggle, and the cookie. No unit string literals live anywhere else in the app.
export const UNIT_SYSTEMS = ["metric", "imperial"] as const
export const unitSystemSchema = z.enum(UNIT_SYSTEMS)
export type UnitSystem = z.infer<typeof unitSystemSchema>
// Metric ⇒ weight in kg, height in cm. Imperial ⇒ weight in lb, height in in.

/** One row of GET /api/records. Participant fields only — no contact PII.
 *  Carries both unit systems (from DB generated columns) so the client renders either
 *  system by selecting a column — no refetch, no read-time conversion. */
export const recordDtoSchema = z.object({
  id: z.number().int().positive(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dob: z.string(), // ISO calendar date, yyyy-mm-dd
  // Both unit systems come straight from the DB generated columns — no read-time conversion.
  weightKg: z.number().positive(),
  weightLb: z.number().positive(),
  heightCm: z.number().positive(),
  heightIn: z.number().positive(),
  bmi: z.number().positive(),
  createdAt: z.string(), // ISO datetime
})
export type RecordDto = z.infer<typeof recordDtoSchema>

/** Query params for the list endpoint. Coerces the raw string searchParams. */
export const recordsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})
export type RecordsQuery = z.infer<typeof recordsQuerySchema>

export const recordsResponseSchema = z.object({
  data: z.array(recordDtoSchema),
  total: z.number().int().nonnegative(),
})
export type RecordsResponse = z.infer<typeof recordsResponseSchema>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/record.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/record.ts src/domain/record.test.ts
git commit -m "feat(domain): shared Zod record contract (DTO, query, response)"
```

---

## Task 5: Domain — `computeBmi` (`src/domain/bmi.ts`)

**Files:**
- Create: `src/domain/bmi.ts`
- Test: `src/domain/bmi.test.ts`

**Interfaces:**
- Consumes: `UnitSystem` (Task 4).
- Produces: `BmiInput` (`{ weightValue: number; heightValue: number; system: UnitSystem }`) and `computeBmi(input: BmiInput): number` — result rounded to 1 decimal. Consumed by the seed (Task 8).
- **Strictness by construction:** a single `system` (not independent weight/height units) means a metric weight can never be paired with an imperial height — mixing is unrepresentable, so there is no runtime "mixed units" error to throw or test. Uses the shared `UnitSystem` — no magic strings.

- [ ] **Step 1: Write the failing test**

```ts
// src/domain/bmi.test.ts
import { describe, it, expect } from "vitest"
import { computeBmi } from "./bmi"

describe("computeBmi", () => {
  it("metric: kg + cm (CDC formula)", () => {
    // 68 kg, 178 cm -> 68 / 1.78^2 = 21.46...
    expect(computeBmi({ weightValue: 68, heightValue: 178, system: "metric" })).toBe(21.5)
  })
  it("imperial: lb + in (CDC × 703)", () => {
    // 150 lb, 70 in -> 150/70^2*703 = 21.52...
    expect(computeBmi({ weightValue: 150, heightValue: 70, system: "imperial" })).toBe(21.5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/bmi.test.ts`
Expected: FAIL — module `./bmi` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/domain/bmi.ts
import type { UnitSystem } from "./record"

export interface BmiInput {
  weightValue: number
  heightValue: number
  system: UnitSystem
}

/** BMI from the as-entered values, using the CDC formula for the entry's unit system.
 *  A single `system` makes a metric/imperial mix unrepresentable. */
export function computeBmi({ weightValue, heightValue, system }: BmiInput): number {
  const bmi =
    system === "metric"
      ? weightValue / (heightValue / 100) ** 2 // kg / m²
      : (weightValue / heightValue ** 2) * 703 // lb / in² × 703
  return Math.round(bmi * 10) / 10
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/bmi.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/bmi.ts src/domain/bmi.test.ts
git commit -m "feat(domain): computeBmi with CDC per-system formulas"
```

---

## Task 6: Infrastructure — Prisma client singleton (`src/infrastructure/prisma.ts`)

**Files:**
- Create: `src/infrastructure/prisma.ts`

**Interfaces:**
- Produces: `prisma` — a `PrismaClient` singleton (reused across dev HMR so connections don't leak). Consumed by the repository function (Task 7).

No standalone test — a bare client instantiation has no logic of its own; it's exercised by Task 7's integration test. Verify with typecheck.

- [ ] **Step 1: Write the Prisma singleton**

```ts
// src/infrastructure/prisma.ts
import { PrismaClient } from "@/lib/generated/prisma/client"

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/prisma.ts
git commit -m "feat(infra): prisma client singleton"
```

---

## Task 7: Infrastructure — participant repository function (`src/infrastructure/participant-repo.ts`)

**Files:**
- Create: `src/infrastructure/participant-repo.ts`
- Test: `src/infrastructure/participant-repo.test.ts` (integration — self-skips without `DATABASE_URL`)

**Interfaces:**
- Consumes: `prisma` (Task 6); `RecordsQuery`, `RecordsResponse`, `RecordDto` (Task 4).
- Produces: `listParticipants(query: RecordsQuery): Promise<RecordsResponse>` — a **plain async function** (no repository class or interface; data access is a module of functions, the Next+Prisma standard). `toDto` maps `Decimal → number`, `Date → ISO string`, and returns only DTO fields (no contact join, no PII). Query filters `deletedAt: null`, orders `createdAt` desc, offset-paginates.
- **Why the mapper exists:** Prisma returns `Decimal` for `numeric` and `Date` for dates, and `Decimal.toJSON()` serializes as a *string* — so returning rows directly would break the `number` DTO contract. The mapper is the required cost of storing exact `numeric`.

- [ ] **Step 1: Write the failing integration test**

```ts
// src/infrastructure/participant-repo.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "./prisma"
import { listParticipants } from "./participant-repo"

const hasDb = Boolean(process.env.DATABASE_URL)

describe.skipIf(!hasDb)("listParticipants (integration)", () => {
  let createdId: number

  beforeAll(async () => {
    const p = await prisma.participant.create({
      data: {
        firstName: "Repo", lastName: "Test", dob: new Date("1990-01-01"),
        sex: "male", weightValue: "150", weightUnit: "lb",
        heightValue: "70", heightUnit: "in", bmi: "21.5",
      },
      select: { id: true },
    })
    createdId = p.id
  })

  afterAll(async () => {
    await prisma.participant.delete({ where: { id: createdId } })
    await prisma.$disconnect()
  })

  it("maps generated columns to numbers in the DTO and leaks no PII", async () => {
    const { data, total } = await listParticipants({ page: 1, pageSize: 100 })
    expect(total).toBeGreaterThan(0)
    const row = data.find((r) => r.id === createdId)!
    expect(typeof row.weightKg).toBe("number")
    expect(row.weightKg).toBeCloseTo(68.0389, 3) // 150 lb -> kg, generated by Postgres
    expect(row.weightLb).toBeCloseTo(150, 3)     // entered as lb, stored verbatim
    expect(row.heightCm).toBeCloseTo(177.8, 2)   // 70 in -> cm
    expect(row.heightIn).toBeCloseTo(70, 2)      // entered as in, stored verbatim
    expect(row.dob).toBe("1990-01-01")
    expect(row).not.toHaveProperty("phone")
    expect(row).not.toHaveProperty("email")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run db:up && npx vitest run src/infrastructure/participant-repo.test.ts`
Expected: FAIL — module `./participant-repo` not found. (If `DATABASE_URL` is unset the suite skips — export it or ensure `.env` is loaded; Vitest reads `.env` via `dotenv` only if configured, so run with `DATABASE_URL=postgresql://bmi:bmi@localhost:5432/bmi?schema=public npx vitest run ...` if it skips.)

- [ ] **Step 3: Write the repository function**

```ts
// src/infrastructure/participant-repo.ts
import { prisma } from "./prisma"
import type { RecordsQuery, RecordsResponse, RecordDto } from "@/domain/record"

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

type Decimalish = { toNumber(): number }

type Row = {
  id: number
  firstName: string
  lastName: string
  dob: Date
  weightKg: Decimalish
  weightLb: Decimalish
  heightCm: Decimalish
  heightIn: Decimalish
  bmi: Decimalish
  createdAt: Date
}

function toDto(row: Row): RecordDto {
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
  return { data: rows.map(toDto), total }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/infrastructure/participant-repo.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/participant-repo.ts src/infrastructure/participant-repo.test.ts
git commit -m "feat(infra): listParticipants repository function with DTO mapper"
```

---

## Task 8: Seed script — ~60 participants + contacts

**Files:**
- Create: `prisma/seed.ts`
- Modify: `prisma.config.ts`

**Interfaces:**
- Consumes: `computeBmi` (Task 5), `prisma` (Task 7). BMI enters the DB **only** here (GET-only feature) — computed via the domain function, never hand-typed. `weightKg`/`heightCm` are omitted from create input (Postgres generates them).

- [ ] **Step 1: Register the seed command in `prisma.config.ts`**

Add a `migrations.seed` command to the existing `defineConfig`:

```ts
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
```

If `tsx` is not resolvable, use `"node --experimental-strip-types prisma/seed.ts"` (Node 24 default). Confirm which works in Step 3.

- [ ] **Step 2: Write the seed script**

```ts
// prisma/seed.ts
import { PrismaClient } from "../src/lib/generated/prisma/client"
import { computeBmi } from "../src/domain/bmi"

const prisma = new PrismaClient()

const FIRST = ["Ada","Alan","Grace","Katherine","Linus","Margaret","Dennis","Barbara","Edsger","Radia","Ken","Hedy","Tim","Anita","Guido","Shafi","James","Sophie","Bjarne","Joan"]
const LAST = ["Lovelace","Turing","Hopper","Johnson","Torvalds","Hamilton","Ritchie","Liskov","Dijkstra","Perlman","Thompson","Lamarr","Berners-Lee","Borg","Rossum","Goldwasser","Gosling","Wilson","Stroustrup","Clarke"]

// Deterministic pseudo-spread (no Math.random — keeps seeds reproducible).
function makeRow(i: number) {
  const imperial = i % 2 === 0
  const weightValue = imperial ? 120 + (i * 3) % 130 : 55 + (i * 1.4) % 60   // lb : kg
  const heightValue = imperial ? 60 + (i * 2) % 18 : 152 + (i * 3) % 46      // in : cm
  const weightUnit = imperial ? "lb" as const : "kg" as const
  const heightUnit = imperial ? "in" as const : "cm" as const
  const system = imperial ? "imperial" as const : "metric" as const
  const bmi = computeBmi({ weightValue, heightValue, system })
  const year = 1955 + (i % 45)
  const month = String((i % 12) + 1).padStart(2, "0")
  const day = String((i % 27) + 1).padStart(2, "0")
  return {
    firstName: FIRST[i % FIRST.length],
    lastName: LAST[(i * 7) % LAST.length],
    dob: new Date(`${year}-${month}-${day}`),
    sex: i % 2 === 0 ? "male" as const : "female" as const,
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
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 3: Run the seed**

Run: `npx prisma db seed`
Expected: `Seeded 60 participants`. If the runner errors on TS, switch the `seed` command per Step 1's note and re-run.

- [ ] **Step 4: Verify the data (3 pages at 20/page, spread of BMI)**

Run:
```bash
docker exec bmi_postgres psql -U bmi -d bmi -c \
"SELECT count(*), min(bmi), max(bmi) FROM participant WHERE deleted_at IS NULL;"
```
Expected: count 60, a min/max BMI spread (not all identical).

- [ ] **Step 5: Commit**

```bash
git add prisma/seed.ts prisma.config.ts
git commit -m "feat(db): seed 60 mock participants with domain-computed BMI"
```

---

## Task 9: Service — `listRecords` use case

**Files:**
- Create: `src/services/list-records.ts`

**Interfaces:**
- Consumes: `RecordsQuery`/`RecordsResponse` (Task 4), the participant repository (Task 7).
- Produces: `listRecords(query: RecordsQuery): Promise<RecordsResponse>`. Thin pass-through — keeps the route handler HTTP-only and the seam uniform (per AGENTS.md, a near pass-through use case is fine).
- **No test:** the use case has no logic of its own (it forwards the query and returns the result). A mock-the-repo-and-assert-forwarding test would be a tautology, so none is written (per AGENTS.md "no useless tests"). It is exercised transitively by the route-handler and repository tests. Add a test here only if this function grows real logic.

- [ ] **Step 1: Write the implementation**

```ts
// src/services/list-records.ts
import type { RecordsQuery, RecordsResponse } from "@/domain/record"
import { listParticipants } from "@/infrastructure/participant-repo"

export async function listRecords(query: RecordsQuery): Promise<RecordsResponse> {
  return listParticipants(query)
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/services/list-records.ts
git commit -m "feat(services): listRecords use case"
```

---

## Task 10: lib — pino logger + `withRequestLog` wrapper

**Files:**
- Create: `src/lib/logger.ts`
- Create: `src/lib/with-request-log.ts`
- Test: `src/lib/with-request-log.test.ts`

**Interfaces:**
- Produces: `logger` (pino singleton); `withRequestLog(event: string, handler: (req: Request, log: Logger) => Promise<Response>): (req: Request) => Promise<Response>` — emits one `http.request.completed` line (event, method, status, durationMs) per call and passes a child logger to the handler. Never logs bodies/PII.

- [ ] **Step 1: Write the logger**

```ts
// src/lib/logger.ts
import "server-only"
import pino from "pino"

const isDev = process.env.NODE_ENV !== "production"

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "test" ? "silent" : "info"),
  ...(isDev ? { transport: { target: "pino-pretty" } } : {}),
})

export type Logger = pino.Logger
```

- [ ] **Step 2: Write the failing test**

```ts
// src/lib/with-request-log.test.ts
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
    const handler = withRequestLog("records.list", async () => { throw new Error("boom") })
    const res = await handler(new Request("http://localhost/api/records"))
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/with-request-log.test.ts`
Expected: FAIL — module `./with-request-log` not found.

- [ ] **Step 4: Write minimal implementation**

```ts
// src/lib/with-request-log.ts
import { logger, type Logger } from "./logger"

type Handler = (req: Request, log: Logger) => Promise<Response>

export function withRequestLog(event: string, handler: Handler) {
  return async (req: Request): Promise<Response> => {
    const start = performance.now()
    const method = req.method
    const log = logger.child({ event })
    try {
      const res = await handler(req, log)
      log.info(
        { method, status: res.status, durationMs: Math.round(performance.now() - start) },
        "http.request.completed",
      )
      return res
    } catch (err) {
      log.error(
        { method, status: 500, durationMs: Math.round(performance.now() - start), err },
        "http.request.failed",
      )
      return new Response(JSON.stringify({ error: "Internal Server Error" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      })
    }
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/with-request-log.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/logger.ts src/lib/with-request-log.ts src/lib/with-request-log.test.ts
git commit -m "feat(lib): pino logger + withRequestLog route wrapper"
```

---

## Task 11: API — `GET /api/records` route handler

**Files:**
- Create: `src/app/api/records/route.ts`
- Test: `src/app/api/records/route.test.ts`

**Interfaces:**
- Consumes: `recordsQuerySchema` (Task 4), `listRecords` (Task 9), `withRequestLog` (Task 10).
- Produces: `GET` — parses `page`/`pageSize` from the URL, `recordsQuerySchema.safeParse` (400 on failure), calls `listRecords`, returns `{ data, total }` as JSON. HTTP-only.

- [ ] **Step 1: Write the failing test**

```ts
// src/app/api/records/route.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/records/route.test.ts`
Expected: FAIL — module `./route` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/app/api/records/route.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/records/route.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/records/route.ts src/app/api/records/route.test.ts
git commit -m "feat(api): GET /api/records with Zod-validated pagination"
```

---

## Task 12: Query infrastructure — client factory, provider, nuqs adapter, shared query

**Files:**
- Create: `src/lib/query-client.ts`
- Create: `src/lib/records-query.ts`
- Create: `src/providers/query-provider.tsx`
- Create: `src/hooks/use-records.ts`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `recordsResponseSchema`/`RecordsResponse` (Task 4).
- Produces: `getQueryClient()`/`makeQueryClient()`; `recordsQueryKey(page, pageSize)`; `fetchRecords(page, pageSize): Promise<RecordsResponse>` (parses via the schema); `QueryProvider`; `useRecords(page, pageSize)`. Layout now wraps children in `NuqsAdapter` → `QueryProvider`.

This task is client/provider wiring — no standalone unit test (exercised by the component test in Task 14 and the live check in Task 17). Verify via `typecheck` + `build`.

- [ ] **Step 1: Query client factory**

```ts
// src/lib/query-client.ts
import { QueryClient, isServer } from "@tanstack/react-query"

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { staleTime: 60_000 } },
  })
}

let browserQueryClient: QueryClient | undefined

export function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient()
  browserQueryClient ??= makeQueryClient()
  return browserQueryClient
}
```

- [ ] **Step 2: Shared query key + client transport**

```ts
// src/lib/records-query.ts
import { recordsResponseSchema, type RecordsResponse } from "@/domain/record"

export const recordsQueryKey = (page: number, pageSize: number) =>
  ["records", { page, pageSize }] as const

/** Client-side fetch of the list endpoint. Server prefetch calls the use case directly
 *  (see the home page) — both resolve to the same RecordsResponse shape. */
export async function fetchRecords(page: number, pageSize: number): Promise<RecordsResponse> {
  const res = await fetch(`/api/records?page=${page}&pageSize=${pageSize}`)
  if (!res.ok) throw new Error(`Failed to load records: ${res.status}`)
  return recordsResponseSchema.parse(await res.json())
}
```

- [ ] **Step 3: Query provider**

```tsx
// src/providers/query-provider.tsx
"use client"

import { QueryClientProvider } from "@tanstack/react-query"
import { getQueryClient } from "@/lib/query-client"

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
```

- [ ] **Step 4: `useRecords` hook (keeps previous page during pagination)**

```ts
// src/hooks/use-records.ts
"use client"

import { useQuery } from "@tanstack/react-query"
import { recordsQueryKey, fetchRecords } from "@/lib/records-query"

export function useRecords(page: number, pageSize: number) {
  return useQuery({
    queryKey: recordsQueryKey(page, pageSize),
    queryFn: () => fetchRecords(page, pageSize),
    placeholderData: (previous) => previous,
  })
}
```

- [ ] **Step 5: Wrap the layout**

Modify `src/app/layout.tsx` — wrap `{children}` inside `ThemeProvider` with the nuqs adapter and query provider:

```tsx
import { NuqsAdapter } from "nuqs/adapters/next/app"
import { QueryProvider } from "@/providers/query-provider"
// ...existing imports...

        <ThemeProvider>
          <NuqsAdapter>
            <QueryProvider>{children}</QueryProvider>
          </NuqsAdapter>
        </ThemeProvider>
```

- [ ] **Step 6: Typecheck + build**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/query-client.ts src/lib/records-query.ts src/providers/query-provider.tsx src/hooks/use-records.ts src/app/layout.tsx
git commit -m "feat(web): react-query client, provider, nuqs adapter, records query"
```

---

## Task 13: Unit-system preference — cookie helpers + provider + hook

**Files:**
- Create: `src/lib/unit-system.ts` (client-safe)
- Create: `src/lib/unit-system.server.ts` (server-only)
- Create: `src/providers/unit-system-provider.tsx`
- Create: `src/hooks/use-unit-system.ts`
- Test: `src/lib/unit-system.test.ts`

**Interfaces:**
- Consumes: `UNIT_SYSTEMS`/`UnitSystem` (Task 4).
- Produces: `UNIT_SYSTEM_COOKIE` (`"unit-system"`) + `parseUnitSystem(value: string | undefined): UnitSystem` (defaults `metric`) — both in the **client-safe** `unit-system.ts`; `getUnitSystem(): Promise<UnitSystem>` (server, reads the cookie) in the **server-only** `unit-system.server.ts`; `UnitSystemProvider` (client context, UI-preference — initialised from the server cookie value, writes the cookie on change); `useUnitSystem(): { system, setSystem }`.
- **Module split is load-bearing:** the client `UnitSystemProvider` imports `UNIT_SYSTEM_COOKIE` — so that symbol MUST live in a file free of `next/headers`. `getUnitSystem` (which imports `next/headers`) lives in a separate `server-only` file that no client component imports. Merging them pulls `next/headers` into the client bundle and **fails the build**.
- **Note (not the hydration anti-pattern):** passing the cookie value as `initialSystem` is a UI *preference*, not React Query data — correct per `AGENTS.md`. This small context holds a display toggle, not app/server data, so it does not violate the "no Context as a data store" rule.

- [ ] **Step 1: Write the failing test (pure parser)**

```ts
// src/lib/unit-system.test.ts
import { describe, it, expect } from "vitest"
import { parseUnitSystem } from "./unit-system"

describe("parseUnitSystem", () => {
  it("returns the value when valid", () => {
    expect(parseUnitSystem("imperial")).toBe("imperial")
    expect(parseUnitSystem("metric")).toBe("metric")
  })
  it("defaults to metric for missing/invalid", () => {
    expect(parseUnitSystem(undefined)).toBe("metric")
    expect(parseUnitSystem("furlongs")).toBe("metric")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/unit-system.test.ts`
Expected: FAIL — module `./unit-system` not found.

- [ ] **Step 3: Write the client-safe cookie helpers (no `next/headers`)**

```ts
// src/lib/unit-system.ts
import { UNIT_SYSTEMS, type UnitSystem } from "@/domain/record"

export const UNIT_SYSTEM_COOKIE = "unit-system"

export function parseUnitSystem(value: string | undefined): UnitSystem {
  return UNIT_SYSTEMS.includes(value as UnitSystem) ? (value as UnitSystem) : "metric"
}
```

```ts
// src/lib/unit-system.server.ts
import "server-only"
import { cookies } from "next/headers"
import type { UnitSystem } from "@/domain/record"
import { UNIT_SYSTEM_COOKIE, parseUnitSystem } from "./unit-system"

/** Server-only: read the preference for a no-flash first paint. */
export async function getUnitSystem(): Promise<UnitSystem> {
  const store = await cookies()
  return parseUnitSystem(store.get(UNIT_SYSTEM_COOKIE)?.value)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/unit-system.test.ts`
Expected: PASS (2 tests). The pure `unit-system.ts` has no server-only imports, so the test loads it cleanly and the client provider can import `UNIT_SYSTEM_COOKIE` from it without dragging `next/headers` into the bundle.

- [ ] **Step 5: Write the provider + hook**

```tsx
// src/providers/unit-system-provider.tsx
"use client"

import { createContext, useCallback, useState } from "react"
import type { UnitSystem } from "@/domain/record"
import { UNIT_SYSTEM_COOKIE } from "@/lib/unit-system"

type UnitSystemContextValue = { system: UnitSystem; setSystem: (next: UnitSystem) => void }

export const UnitSystemContext = createContext<UnitSystemContextValue | null>(null)

export function UnitSystemProvider({
  initialSystem,
  children,
}: {
  initialSystem: UnitSystem
  children: React.ReactNode
}) {
  const [system, setSystemState] = useState<UnitSystem>(initialSystem)

  const setSystem = useCallback((next: UnitSystem) => {
    setSystemState(next)
    document.cookie = `${UNIT_SYSTEM_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
  }, [])

  return (
    <UnitSystemContext.Provider value={{ system, setSystem }}>
      {children}
    </UnitSystemContext.Provider>
  )
}
```

```ts
// src/hooks/use-unit-system.ts
"use client"

import { useContext } from "react"
import { UnitSystemContext } from "@/providers/unit-system-provider"

export function useUnitSystem() {
  const ctx = useContext(UnitSystemContext)
  if (!ctx) throw new Error("useUnitSystem must be used within UnitSystemProvider")
  return ctx
}
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/unit-system.ts src/lib/unit-system.server.ts src/lib/unit-system.test.ts src/providers/unit-system-provider.tsx src/hooks/use-unit-system.ts
git commit -m "feat(web): cookie-backed unit-system preference (provider + hook)"
```

---

## Task 14: UI — shadcn primitives, columns, records table island

**Files:**
- Create (via CLI): `src/components/ui/table.tsx`, `src/components/ui/toggle-group.tsx`, `src/components/ui/skeleton.tsx`, `src/components/ui/sonner.tsx`
- Create: `src/components/record-columns.tsx`
- Create: `src/components/records-table.tsx`
- Test: `src/components/records-table.test.tsx`

**Interfaces:**
- Consumes: `useRecords` (Task 12), `useUnitSystem` (Task 13), `formatWeight`/`formatHeight` (Task 3), `RecordDto` (Task 4), shadcn `table` primitives, nuqs `useQueryState`.
- Produces: `recordColumns` (TanStack `ColumnDef<RecordDto>[]` — Full name, DOB, Height, Weight, BMI, Date created; Height/Weight formatted by the active system); `RecordsTable` — client island reading `page` from the URL via nuqs, rendering the shadcn Data Table + a prev/next pager.

- [ ] **Step 1: Add the shadcn primitives**

Run: `npx shadcn@latest add table toggle-group skeleton sonner`
Expected: the four components appear under `src/components/ui/`. Commit them with this task.

- [ ] **Step 2: Write the column definitions**

```tsx
// src/components/record-columns.tsx
"use client"

import type { ColumnDef } from "@tanstack/react-table"
import type { RecordDto } from "@/domain/record"
import type { UnitSystem } from "@/domain/record"
import { formatWeight, formatHeight } from "@/domain/units"

export function recordColumns(system: UnitSystem): ColumnDef<RecordDto>[] {
  return [
    {
      id: "fullName",
      header: "Full name",
      accessorFn: (r) => `${r.firstName} ${r.lastName}`,
    },
    { accessorKey: "dob", header: "DOB" },
    {
      id: "height",
      header: "Height",
      cell: ({ row }) => formatHeight(row.original.heightCm, row.original.heightIn, system),
    },
    {
      id: "weight",
      header: "Weight",
      cell: ({ row }) => formatWeight(row.original.weightKg, row.original.weightLb, system),
    },
    { accessorKey: "bmi", header: "BMI" },
    {
      id: "createdAt",
      header: "Date created",
      cell: ({ row }) => row.original.createdAt.slice(0, 10),
    },
  ]
}
```

- [ ] **Step 3: Write the failing test**

```tsx
// src/components/records-table.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { RecordsTable } from "./records-table"

vi.mock("nuqs", () => ({
  useQueryState: () => [1, vi.fn()],
  parseAsInteger: { withDefault: () => ({}) },
}))

const record = {
  id: 1, firstName: "Ada", lastName: "Lovelace", dob: "1815-12-10",
  weightKg: 68.0389, weightLb: 150, heightCm: 177.8, heightIn: 70,
  bmi: 21.5, createdAt: "2026-07-16T00:00:00.000Z",
}

vi.mock("@/hooks/use-records", () => ({
  useRecords: () => ({ data: { data: [record], total: 1 }, isPending: false, isError: false }),
}))

const mockSystem = vi.fn()
vi.mock("@/hooks/use-unit-system", () => ({ useUnitSystem: () => mockSystem() }))

describe("RecordsTable", () => {
  beforeEach(() => mockSystem.mockReturnValue({ system: "metric", setSystem: vi.fn() }))

  it("renders a row with metric-formatted height/weight", () => {
    render(<RecordsTable pageSize={20} />)
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument()
    expect(screen.getByText("178 cm")).toBeInTheDocument()
    expect(screen.getByText("68.0 kg")).toBeInTheDocument()
  })

  it("re-renders imperial units when the system is imperial (no refetch path)", () => {
    mockSystem.mockReturnValue({ system: "imperial", setSystem: vi.fn() })
    render(<RecordsTable pageSize={20} />)
    expect(screen.getByText("70 in")).toBeInTheDocument()
    expect(screen.getByText("150.0 lb")).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run src/components/records-table.test.tsx`
Expected: FAIL — module `./records-table` not found.

- [ ] **Step 5: Write the records table island**

```tsx
// src/components/records-table.tsx
"use client"

import { useMemo } from "react"
import { parseAsInteger, useQueryState } from "nuqs"
import {
  flexRender, getCoreRowModel, useReactTable,
} from "@tanstack/react-table"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useRecords } from "@/hooks/use-records"
import { useUnitSystem } from "@/hooks/use-unit-system"
import { recordColumns } from "@/components/record-columns"

export function RecordsTable({ pageSize }: { pageSize: number }) {
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1))
  const { system } = useUnitSystem()
  const { data, isPending, isError } = useRecords(page, pageSize)

  const columns = useMemo(() => recordColumns(system), [system])
  const rows = data?.data ?? []
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  if (isError) {
    return <p className="text-destructive p-4 text-sm">Failed to load records.</p>
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isPending ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((_c, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No records.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell ?? cell.column.columnDef.header, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Page {page} of {pageCount} · {total} records
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/components/records-table.test.tsx`
Expected: PASS (2 tests) — the second proves the unit switch is pure client formatting (same data, different render).

- [ ] **Step 7: Commit**

```bash
git add src/components/ui src/components/record-columns.tsx src/components/records-table.tsx src/components/records-table.test.tsx
git commit -m "feat(web): records data table island with unit-aware formatting"
```

---

## Task 15: UI — unit toggle, header, footer, Add FAB

**Files:**
- Create: `src/components/unit-toggle.tsx`
- Create: `src/components/site-header.tsx`
- Create: `src/components/site-footer.tsx`
- Create: `src/components/add-fab.tsx`

**Interfaces:**
- Consumes: `useUnitSystem` (Task 13), shadcn `toggle-group` + `button`, `lucide-react` icons.
- Produces: `UnitToggle` (Metric/Imperial `ToggleGroup`, calls `setSystem`); `SiteHeader` (app title + `UnitToggle`); `SiteFooter` (name/copyright); `AddFab` (fixed bottom-right `+` button — `aria-label="Add record"`, no onClick behavior yet).
- **No unit test:** these are presentational/wiring components with no logic of their own — `UnitToggle` just forwards `ToggleGroup`'s value to `setSystem`. A unit test would mostly assert shadcn's own behavior; the real click→units interaction is covered by the Playwright check in Task 17.

- [ ] **Step 1: Write the components**

```tsx
// src/components/unit-toggle.tsx
"use client"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useUnitSystem } from "@/hooks/use-unit-system"
import type { UnitSystem } from "@/domain/record"

export function UnitToggle() {
  const { system, setSystem } = useUnitSystem()
  return (
    <ToggleGroup
      type="single"
      value={system}
      onValueChange={(value) => { if (value) setSystem(value as UnitSystem) }}
      variant="outline"
      size="sm"
    >
      <ToggleGroupItem value="metric" aria-label="Metric (kg, cm)">Metric</ToggleGroupItem>
      <ToggleGroupItem value="imperial" aria-label="Imperial (lb, in)">Imperial</ToggleGroupItem>
    </ToggleGroup>
  )
}
```

```tsx
// src/components/site-header.tsx
import { UnitToggle } from "@/components/unit-toggle"

export function SiteHeader() {
  return (
    <header className="flex items-center justify-between border-b px-6 py-4">
      <h1 className="text-lg font-semibold">BMI Records</h1>
      <UnitToggle />
    </header>
  )
}
```

```tsx
// src/components/site-footer.tsx
// No new Date()/Date.now() here — this renders in the prerendered static shell
// (Cache Components), and reading the current time there is a dynamic access that errors.
export function SiteFooter() {
  return (
    <footer className="text-muted-foreground border-t px-6 py-4 text-center text-sm">
      BMI App
    </footer>
  )
}
```

```tsx
// src/components/add-fab.tsx
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

export function AddFab() {
  return (
    <Button
      size="icon"
      aria-label="Add record"
      className="fixed right-6 bottom-6 h-14 w-14 rounded-full shadow-lg"
    >
      <Plus className="h-6 w-6" />
    </Button>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/unit-toggle.tsx src/components/site-header.tsx src/components/site-footer.tsx src/components/add-fab.tsx
git commit -m "feat(web): unit toggle, header, footer, add FAB"
```

---

## Task 16: Home page — static shell + dynamic records island (Cache Components)

**Files:**
- Modify: `next.config.ts` (enable `cacheComponents`)
- Create: `src/components/records-section.tsx` (the dynamic island)
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `getQueryClient`/`recordsQueryKey` (Task 12), `listRecords` (Task 9), `getUnitSystem` (Task 13), `UnitSystemProvider` (Task 13), `SiteHeader`/`SiteFooter`/`AddFab` (Task 15), `RecordsTable` (Task 14).
- Produces: a route where the **static shell** (frame + footer + FAB) is prerendered via Cache Components, and one **dynamic Suspense island** (`RecordsSection`) reads the unit cookie + `searchParams`, prefetches via `listRecords` (no HTTP hop), `dehydrate`s, and renders the header + table under the unit provider. The client island reads the hydrated cache with the same query key.

**PPR split (deliberate, spec refinement):** the spec wanted the header in the static shell *and* the unit toggle in the header. Those conflict — the toggle reflects a per-user cookie, so anything containing it must be dynamic. Resolution: the **header travels with the dynamic island** (it hosts the toggle), while the **footer, FAB, and page frame form the prerendered static shell**. Reading `searchParams`/`cookies()` happens only inside the island under `<Suspense>`, so the shell stays static. (Alternative, if a larger static shell is preferred later: move the toggle into a table toolbar and keep `SiteHeader` static — not done now to honor "toggle in the header".)

- [ ] **Step 1: Enable Cache Components**

Modify `next.config.ts`:

```ts
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  cacheComponents: true,
}

export default nextConfig
```

- [ ] **Step 2: Write the dynamic island**

```tsx
// src/components/records-section.tsx
import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import { getQueryClient } from "@/lib/query-client"
import { recordsQueryKey } from "@/lib/records-query"
import { listRecords } from "@/services/list-records"
import { getUnitSystem } from "@/lib/unit-system.server"
import { UnitSystemProvider } from "@/providers/unit-system-provider"
import { SiteHeader } from "@/components/site-header"
import { RecordsTable } from "@/components/records-table"

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export async function RecordsSection({
  searchParams,
  pageSize,
}: {
  searchParams: SearchParams
  pageSize: number
}) {
  // Awaiting these dynamic inputs HERE (inside <Suspense>) keeps the page shell static.
  const sp = await searchParams
  const rawPage = Array.isArray(sp.page) ? sp.page[0] : sp.page
  const page = Math.max(1, Number(rawPage) || 1)

  const system = await getUnitSystem()

  const queryClient = getQueryClient()
  await queryClient.prefetchQuery({
    queryKey: recordsQueryKey(page, pageSize),
    queryFn: () => listRecords({ page, pageSize }),
  })

  return (
    <UnitSystemProvider initialSystem={system}>
      <SiteHeader />
      <main className="flex-1 px-6 py-6">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <RecordsTable pageSize={pageSize} />
        </HydrationBoundary>
      </main>
    </UnitSystemProvider>
  )
}
```

- [ ] **Step 3: Rewrite `src/app/page.tsx` (static shell + island)**

```tsx
// src/app/page.tsx
import { Suspense } from "react"
import { SiteFooter } from "@/components/site-footer"
import { AddFab } from "@/components/add-fab"
import { RecordsSection } from "@/components/records-section"
import { Skeleton } from "@/components/ui/skeleton"

const PAGE_SIZE = 20

// Note: `searchParams` is NOT awaited here — awaiting it at the page level would make
// the whole route dynamic. It is passed (as a Promise) into the island, which awaits it
// under <Suspense>. So footer + FAB + frame prerender as the static shell.
export default function Page({ searchParams }: PageProps<"/">) {
  return (
    <div className="flex min-h-svh flex-col">
      <Suspense fallback={<RecordsSectionFallback />}>
        <RecordsSection searchParams={searchParams} pageSize={PAGE_SIZE} />
      </Suspense>
      <SiteFooter />
      <AddFab />
    </div>
  )
}

function RecordsSectionFallback() {
  return (
    <>
      <div className="flex items-center justify-between border-b px-6 py-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-40" />
      </div>
      <main className="flex-1 space-y-3 px-6 py-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </main>
    </>
  )
}
```

- [ ] **Step 4: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: both PASS. The build output should show `/` with a prerendered shell and dynamic (streamed) content — confirm it does NOT report `/` as fully dynamic (ƒ) with no shell, and that no server-only module (`next/headers`, `server-only`, the repository) leaked into a client bundle. If the build complains that a dynamic API (`cookies`/`searchParams`) is read outside a Suspense boundary, the island wiring is wrong — fix before continuing.

- [ ] **Step 5: Manual smoke check**

Run (in one terminal): `npm run db:up` (if not running) then `npm run dev`.
Open `http://localhost:3000`. Expected: header with a Metric/Imperial toggle, a 20-row table, a pager showing "Page 1 of 3 · 60 records", a bottom-right `+` FAB, a footer. Toggling Imperial changes height/weight units **without a network request** (watch the Network tab — no `/api/records` call fires on toggle). Clicking Next loads page 2 and updates the URL to `?page=2`. Reloading with a `unit-system=imperial` cookie set shows imperial units on first paint (no flash).

- [ ] **Step 6: Commit**

```bash
git add next.config.ts src/components/records-section.tsx src/app/page.tsx
git commit -m "feat(web): home page — static shell + dynamic records island (PPR)"
```

---

## Task 17: Full verification + live check + PR

**Files:** none (verification only) — plus an optional `e2e/home.spec.ts`.

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all suites PASS. The repository integration suite runs if `DATABASE_URL` is set and the DB is up, otherwise self-skips — for the finish gate, run it with the DB up so generated columns are actually exercised.

- [ ] **Step 2: Lint + typecheck + build**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: all PASS, clean.

- [ ] **Step 3: Write a Playwright live check**

```ts
// e2e/home.spec.ts
import { test, expect } from "@playwright/test"

test("home lists records and toggles units without refetch", async ({ page }) => {
  const requests: string[] = []
  page.on("request", (r) => { if (r.url().includes("/api/records")) requests.push(r.url()) })

  await page.goto("/")
  await expect(page.getByRole("heading", { name: "BMI Records" })).toBeVisible()
  await expect(page.getByText(/records/)).toBeVisible()

  const before = requests.length
  await page.getByRole("button", { name: /imperial/i }).click()
  await expect(page.getByText(/lb/).first()).toBeVisible()
  expect(requests.length).toBe(before) // unit toggle triggers NO /api/records call

  await page.getByRole("button", { name: "Next" }).click()
  await expect(page).toHaveURL(/page=2/)
})
```

- [ ] **Step 4: Run the live check**

Run: `npm run db:up && npm run dev` (one terminal), then `npm run e2e` (another). Ensure `playwright.config.ts` `baseURL` is `http://localhost:3000` (or start the app via its `webServer` config).
Expected: PASS.

- [ ] **Step 5: Invoke `superpowers:verification-before-completion`, then present evidence to the human.**

- [ ] **Step 6: Push the branch and open the PR**

```bash
git push -u origin design/bmi-schema-home
gh pr create --title "BMI home page: paginated records table + schema" --body "<summary + test evidence>"
```

Expected: a PR URL. Hand it to the human. Do **not** merge.

---

## Self-Review

**Spec coverage** (checked against `docs/superpowers/specs/2026-07-16-bmi-home-and-schema-design.md`):
- Guiding decision (mechanical→DB, business→domain): Tasks 1–2 (generated columns), 5 (computeBmi). ✓
- CDC formulas: Task 5. ✓
- Two-table `participant 1—1 contact` schema, exact column types, generated STORED columns, indexes: Tasks 1–2. ✓
- Numeric types (Decimal in DB, number at boundary, converted once in the mapper): Task 7. ✓
- Unit handling: **both** unit systems stored as DB generated columns (no read-time conversion — the stated requirement) + paired Metric/Imperial toggle + cookie-backed SSR + client-only re-render that only *picks + formats* (no refetch, no math): Tasks 2 (4 generated columns), 3 (format-only), 13, 14 (test proves the toggle re-renders from the same row), 16. ✓
- Home page/data flow: route `/`, prefetch + `dehydrate`/`HydrationBoundary` (no `initial` prop), table columns exactly Full name/DOB/Height/Weight/BMI/Date created, offset pagination 20/page via nuqs in the URL, single FAB (opens nothing), minimal footer: Tasks 14, 16. ✓
- Caching (page cacheable, only the table dynamic): Cache Components — static shell (frame + footer + FAB) prerendered; the header + table stream as one dynamic `<Suspense>` island reading the cookie + `searchParams`: Task 16. The header rides with the island because it hosts the per-user unit toggle (documented refinement of the spec's "header in the static shell"). ✓
- API `GET /api/records?page=&pageSize=` → `{ data, total }`, participant rows only (no PII), Zod-validated, HTTP-only handler: Tasks 4, 11 (test asserts no phone/email in DTO: Task 7). ✓
- Seed ~60 rows via Prisma, domain-computed BMI: Task 8. ✓
- libphonenumber-js: **intentionally deferred** — the spec adds it for *normalizing phone input*, which belongs to the Add feature (`POST`), explicitly out of scope here. Seed phones are already E.164 literals. Not a gap.
- Out of scope (filter/sort, add popup, auth, address, update/delete): none built. ✓
- Zod shared client+server (user's explicit ask): the contract lives in `src/domain/record.ts` (Task 4), re-parsed server-side in the handler (Task 11) and parsed client-side in `fetchRecords` (Task 12). ✓

**Placeholder scan:** no TBD/TODO; every code step has complete code. The one deliberately-not-hardcoded value — the Prisma generated-column field annotation — is resolved empirically via `prisma db pull` behind a hard verification gate (Task 2 Steps 5–6), not guessed.

**Type consistency:** `RecordDto`, `RecordsQuery`, `RecordsResponse`, `listParticipants(query)`, `listRecords(query)`, `recordsQueryKey(page, pageSize)`, `fetchRecords(page, pageSize)`, `useRecords(page, pageSize)`, `formatWeight(weightKg, weightLb, system)`, `formatHeight(heightCm, heightIn, system)`, `computeBmi(BmiInput)`, `getUnitSystem()`, `UnitSystemProvider({ initialSystem })`, `useUnitSystem()` — names/signatures are consistent across every task that references them.
