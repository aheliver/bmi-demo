# Add Record Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user create a participant record (and optional contact) from a dialog opened by the home-page FAB, with live BMI preview, validation, a success/error toast, and a discard guard.

**Architecture:** RHF + Zod dialog form → `useMutation` → `POST /api/records` → handler re-parses the same Zod schema, computes BMI server-side, calls a Prisma repository that inserts the Participant and (conditionally) a nested Contact → success invalidates the `["records"]` query. Units follow the global system; BMI is derived (never sent by the client). All new UI composes already-scaffolded Base UI (shadcn base-nova) primitives.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Prisma/Postgres, TanStack Query, React Hook Form, Zod, `@base-ui/react` primitives, sonner, Vitest + Testing Library.

## Global Constraints

- Design spec: `docs/superpowers/specs/2026-07-17-add-record-design.md` — the source of truth for behavior.
- One Zod schema (`createRecordSchema`) validates client and server. The client never sends BMI; the server computes it with `computeBmi`.
- Units follow the global unit system (metric → kg + cm, imperial → lb + in). The submit payload carries `system`; the server derives `weightUnit`/`heightUnit`.
- Contact is optional; if either phone or email is filled, both are required and email must be valid; otherwise no Contact row.
- No explanatory comments. Import shared vocabulary (`unitSystemSchema`), never redeclare it. Prisma calls only in `src/infrastructure/`.
- Logging: never log field values (PII/health data) — only counts/ids/outcomes. Event names `domain.action.outcome`.
- Commit as `aheliver <geliwer@gmail.com>`.
- The base-nova registry has **no** `form` component — compose RHF directly with `input`/`label`/`select` primitives.

---

### Task 1: `createRecordSchema` (request contract, shared client + server)

**Files:**
- Modify: `src/features/records/schema.ts`
- Test: `src/features/records/schema.test.ts`

**Interfaces:**
- Consumes: `unitSystemSchema` from `@/lib/unit-system`.
- Produces: `createRecordSchema` (Zod) and `type CreateRecordInput = z.infer<typeof createRecordSchema>` with fields `{ firstName: string; lastName: string; dob: string; sex: "male" | "female"; system: "metric" | "imperial"; weightValue: number; heightValue: number; phone: string; email: string }`.

- [ ] **Step 1: Write the failing tests**

Append to `src/features/records/schema.test.ts`:

```ts
import { createRecordSchema } from "./schema"

const valid = {
  firstName: "Ada",
  lastName: "Lovelace",
  dob: "1990-01-01",
  sex: "female",
  system: "metric",
  weightValue: 72,
  heightValue: 178,
  phone: "",
  email: "",
}

describe("createRecordSchema", () => {
  it("accepts a valid record with no contact", () => {
    const parsed = createRecordSchema.parse(valid)
    expect(parsed.weightValue).toBe(72)
    expect(parsed.phone).toBe("")
  })

  it("coerces numeric strings (form inputs) to numbers", () => {
    const parsed = createRecordSchema.parse({ ...valid, weightValue: "72", heightValue: "178" })
    expect(parsed.weightValue).toBe(72)
    expect(parsed.heightValue).toBe(178)
  })

  it("rejects a missing name and a non-positive weight", () => {
    expect(createRecordSchema.safeParse({ ...valid, firstName: "" }).success).toBe(false)
    expect(createRecordSchema.safeParse({ ...valid, weightValue: 0 }).success).toBe(false)
  })

  it("rejects a future DOB and one before 1900", () => {
    expect(createRecordSchema.safeParse({ ...valid, dob: "3000-01-01" }).success).toBe(false)
    expect(createRecordSchema.safeParse({ ...valid, dob: "1899-12-31" }).success).toBe(false)
  })

  it("requires phone and email together", () => {
    expect(createRecordSchema.safeParse({ ...valid, phone: "555", email: "" }).success).toBe(false)
    expect(createRecordSchema.safeParse({ ...valid, phone: "", email: "a@b.com" }).success).toBe(false)
    expect(createRecordSchema.safeParse({ ...valid, phone: "555", email: "a@b.com" }).success).toBe(true)
  })

  it("rejects an invalid email when contact is provided", () => {
    expect(createRecordSchema.safeParse({ ...valid, phone: "555", email: "nope" }).success).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/features/records/schema.test.ts`
Expected: FAIL — `createRecordSchema` is not exported.

- [ ] **Step 3: Add the schema**

Append to `src/features/records/schema.ts` (keep existing `z` import; add the unit-system import at the top):

```ts
import { unitSystemSchema } from "@/lib/unit-system"

export const createRecordSchema = z
  .object({
    firstName: z.string().trim().min(1, "Required").max(100),
    lastName: z.string().trim().min(1, "Required").max(100),
    dob: z
      .string()
      .min(1, "Required")
      .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date")
      .refine((v) => new Date(v) <= new Date(), "Date of birth cannot be in the future")
      .refine((v) => new Date(v) >= new Date("1900-01-01"), "Date of birth is too far in the past"),
    sex: z.enum(["male", "female"]),
    system: unitSystemSchema,
    weightValue: z.coerce.number().positive("Enter a positive number"),
    heightValue: z.coerce.number().positive("Enter a positive number"),
    phone: z.string().trim().max(30).optional().default(""),
    email: z.string().trim().optional().default(""),
  })
  .superRefine((val, ctx) => {
    const hasPhone = val.phone.length > 0
    const hasEmail = val.email.length > 0
    if (hasPhone !== hasEmail) {
      ctx.addIssue({
        code: "custom",
        path: [hasPhone ? "email" : "phone"],
        message: "Phone and email must be provided together",
      })
    }
    if (hasEmail && !z.string().email().safeParse(val.email).success) {
      ctx.addIssue({ code: "custom", path: ["email"], message: "Invalid email" })
    }
  })
export type CreateRecordInput = z.infer<typeof createRecordSchema>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/features/records/schema.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/features/records/schema.ts src/features/records/schema.test.ts
git commit -m "feat: add createRecordSchema request contract"
```

---

### Task 2: `createParticipant` repository function

**Files:**
- Modify: `src/infrastructure/participant-repo.ts`
- Test: `src/infrastructure/participant-repo.test.ts`

**Interfaces:**
- Consumes: existing `prisma`, `listSelect`, `toRecord` (already in this file), `Record` type.
- Produces:
  - `type CreateParticipantInput = { firstName: string; lastName: string; dob: string; sex: "male" | "female"; weightValue: number; weightUnit: "kg" | "lb"; heightValue: number; heightUnit: "cm" | "in"; bmi: number; contact?: { phone: string; email: string } }`
  - `createParticipant(input: CreateParticipantInput): Promise<Record>`

- [ ] **Step 1: Write the failing test**

Append to `src/infrastructure/participant-repo.test.ts`:

```ts
import { createParticipant } from "./participant-repo"

describe.skipIf(!hasDb)("createParticipant (integration)", () => {
  const ids: number[] = []

  afterAll(async () => {
    for (const id of ids) await prisma.participant.delete({ where: { id } })
    await prisma.$disconnect()
  })

  it("inserts a participant without a contact and returns the mapped record", async () => {
    const rec = await createParticipant({
      firstName: "Grace", lastName: "Hopper", dob: "1980-05-05", sex: "female",
      weightValue: 60, weightUnit: "kg", heightValue: 165, heightUnit: "cm", bmi: 22.0,
    })
    ids.push(rec.id)
    expect(rec.weightKg).toBeCloseTo(60, 3)
    expect(rec.heightCm).toBeCloseTo(165, 2)
    expect(rec.bmi).toBe(22)
    const contact = await prisma.contact.findUnique({ where: { participantId: rec.id } })
    expect(contact).toBeNull()
  })

  it("inserts a nested contact when provided", async () => {
    const rec = await createParticipant({
      firstName: "Alan", lastName: "Turing", dob: "1975-06-23", sex: "male",
      weightValue: 154, weightUnit: "lb", heightValue: 70, heightUnit: "in", bmi: 22.1,
      contact: { phone: "555-0100", email: "alan@example.com" },
    })
    ids.push(rec.id)
    const contact = await prisma.contact.findUnique({ where: { participantId: rec.id } })
    expect(contact?.email).toBe("alan@example.com")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/infrastructure/participant-repo.test.ts`
Expected: FAIL — `createParticipant` is not exported. (If `DATABASE_URL` is unset the integration blocks are skipped; run `npm run db:up` first to exercise them.)

- [ ] **Step 3: Add the function**

Append to `src/infrastructure/participant-repo.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run db:up && npm test -- src/infrastructure/participant-repo.test.ts`
Expected: PASS (both integration cases). Without a DB the suite is skipped — that is acceptable for the unit run but exercise it at least once locally.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/participant-repo.ts src/infrastructure/participant-repo.test.ts
git commit -m "feat: add createParticipant repository function"
```

---

### Task 3: `POST /api/records` route handler

**Files:**
- Modify: `src/app/api/records/route.ts`
- Test: `src/app/api/records/route.test.ts`

**Interfaces:**
- Consumes: `createRecordSchema` (Task 1), `createParticipant` (Task 2), `computeBmi` from `@/lib/bmi`, `withRequestLog`.
- Produces: `export const POST` — 201 with the created `Record` on success; 400 on invalid body.

- [ ] **Step 1: Write the failing tests**

Edit `src/app/api/records/route.test.ts` — extend the existing `vi.mock` factory to also mock `createParticipant`, then add a POST describe:

```ts
vi.mock("@/infrastructure/participant-repo", () => ({
  listParticipants: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  createParticipant: vi.fn().mockResolvedValue({
    id: 7, firstName: "Ada", lastName: "Lovelace", dob: "1990-01-01",
    weightKg: 72, weightLb: 158.7, heightCm: 178, heightIn: 70.1, bmi: 22.7,
    createdAt: "2026-07-20T00:00:00.000Z",
  }),
}))

import { GET, POST } from "./route"
import { listParticipants, createParticipant } from "@/infrastructure/participant-repo"

const body = {
  firstName: "Ada", lastName: "Lovelace", dob: "1990-01-01", sex: "female",
  system: "metric", weightValue: 72, heightValue: 178, phone: "", email: "",
}
const post = (b: unknown) =>
  POST(new Request("http://localhost/api/records", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(b),
  }))

describe("POST /api/records", () => {
  it("computes BMI server-side, derives units, and returns 201", async () => {
    const res = await post(body)
    expect(res.status).toBe(201)
    expect(createParticipant).toHaveBeenCalledWith(
      expect.objectContaining({ weightUnit: "kg", heightUnit: "cm", bmi: 22.7, contact: undefined }),
    )
  })

  it("passes a contact when phone and email are provided", async () => {
    await post({ ...body, phone: "555-0100", email: "a@b.com" })
    expect(createParticipant).toHaveBeenCalledWith(
      expect.objectContaining({ contact: { phone: "555-0100", email: "a@b.com" } }),
    )
  })

  it("400s on an invalid body", async () => {
    const res = await post({ ...body, firstName: "" })
    expect(res.status).toBe(400)
  })
})
```

Note: `computeBmi({ weightValue: 72, heightValue: 178, system: "metric" })` = `72 / 1.78**2` ≈ `22.7`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/app/api/records/route.test.ts`
Expected: FAIL — `POST` is not exported.

- [ ] **Step 3: Add the handler**

Edit `src/app/api/records/route.ts` — add imports and the `POST` export (keep the existing `GET`):

```ts
import { recordsQuerySchema, createRecordSchema } from "@/features/records/schema"
import { listParticipants, createParticipant } from "@/infrastructure/participant-repo"
import { computeBmi } from "@/lib/bmi"
import { withRequestLog } from "@/lib/with-request-log"

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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/app/api/records/route.test.ts`
Expected: PASS (POST cases + existing GET cases).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/records/route.ts src/app/api/records/route.test.ts
git commit -m "feat: add POST /api/records handler"
```

---

### Task 4: UI primitives + Toaster mount

**Files:**
- Create (via CLI): `src/components/ui/{dialog,alert-dialog,input,label,select,sonner}.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces: the scaffolded primitives (exports named `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose`; `AlertDialog`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogAction`, `AlertDialogCancel`; `Input`; `Label`; `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`; `Toaster`) and a mounted `<Toaster />`.

- [ ] **Step 1: Scaffold the primitives (idempotent)**

Run:
```bash
npx shadcn@latest add dialog alert-dialog input label select sonner --yes
```
Expected: creates the six files under `src/components/ui/` (skips any already present). `Dialog`/`AlertDialog` are controlled via `open`/`onOpenChange`; `Select` via `value`/`onValueChange`.

- [ ] **Step 2: Mount the Toaster**

Edit `src/app/layout.tsx` — import and render `<Toaster />` inside `ThemeProvider` (it reads `next-themes`):

```tsx
import { Toaster } from "@/components/ui/sonner"
```

```tsx
        <ThemeProvider>
          <NuqsAdapter>
            <QueryProvider>{children}</QueryProvider>
          </NuqsAdapter>
          <Toaster />
        </ThemeProvider>
```

- [ ] **Step 3: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: PASS (the primitives typecheck; `<Toaster />` renders).

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/dialog.tsx src/components/ui/alert-dialog.tsx src/components/ui/input.tsx src/components/ui/label.tsx src/components/ui/select.tsx src/components/ui/sonner.tsx src/app/layout.tsx
git commit -m "feat: add dialog/select/input primitives and mount Toaster"
```

---

### Task 5: `useCreateRecord` mutation (feature api)

**Files:**
- Create: `src/features/records/api/create-record.ts`

**Interfaces:**
- Consumes: `recordSchema`, `type Record`, `type CreateRecordInput` from `@/features/records/schema`.
- Produces:
  - `createRecord(input: CreateRecordInput): Promise<Record>`
  - `useCreateRecord()` → TanStack `useMutation` result; on success invalidates `["records"]`.

- [ ] **Step 1: Write the file**

Create `src/features/records/api/create-record.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { recordSchema, type Record, type CreateRecordInput } from "@/features/records/schema"

export async function createRecord(input: CreateRecordInput): Promise<Record> {
  const res = await fetch("/api/records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`Failed to create record: ${res.status}`)
  return recordSchema.parse(await res.json())
}

export function useCreateRecord() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createRecord,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["records"] }),
  })
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/records/api/create-record.ts
git commit -m "feat: add useCreateRecord mutation"
```

---

### Task 6: `AddRecordDialog` component (form + BMI preview + discard guard)

**Files:**
- Modify: `src/components/add-fab.tsx` (forward button props)
- Create: `src/features/records/components/add-record-dialog.tsx`
- Test: `src/features/records/components/add-record-dialog.test.tsx`

**Interfaces:**
- Consumes: `AddFab`, the Task 4 primitives, `computeBmi`, `useUnitSystem`, `createRecordSchema` (Task 1), `useCreateRecord` (Task 5).
- Produces: `export function AddRecordDialog()` — client component rendering the FAB, the form dialog, and the discard-confirmation.

- [ ] **Step 1: Make `AddFab` forward props**

Replace `src/components/add-fab.tsx` with:

```tsx
import * as React from "react"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"

export function AddFab(props: React.ComponentProps<typeof Button>) {
  return (
    <Button
      size="icon"
      aria-label="Add record"
      className="fixed right-6 bottom-6 h-14 w-14 rounded-full shadow-lg"
      {...props}
    >
      <Plus className="h-6 w-6" />
    </Button>
  )
}
```

- [ ] **Step 2: Write the failing test**

Create `src/features/records/components/add-record-dialog.test.tsx`:

```tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { UnitSystemProvider } from "@/providers/unit-system-provider"
import { AddRecordDialog } from "./add-record-dialog"

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <UnitSystemProvider initialSystem="metric">
        <AddRecordDialog />
      </UnitSystemProvider>
    </QueryClientProvider>,
  )
}

describe("AddRecordDialog", () => {
  it("opens the dialog from the FAB", async () => {
    const user = userEvent.setup()
    renderDialog()
    await user.click(screen.getByRole("button", { name: "Add record" }))
    expect(await screen.findByText("Add record", { selector: "[data-slot=dialog-title]" })).toBeInTheDocument()
  })

  it("shows a live BMI preview from weight and height", async () => {
    const user = userEvent.setup()
    renderDialog()
    await user.click(screen.getByRole("button", { name: "Add record" }))
    await user.type(await screen.findByLabelText(/weight/i), "72")
    await user.type(screen.getByLabelText(/height/i), "178")
    expect(await screen.findByTestId("bmi-preview")).toHaveTextContent("22.7")
  })

  it("guards discard when the form is dirty", async () => {
    const user = userEvent.setup()
    renderDialog()
    await user.click(screen.getByRole("button", { name: "Add record" }))
    await user.type(await screen.findByLabelText(/first name/i), "Ada")
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(await screen.findByText("Discard changes?")).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/features/records/components/add-record-dialog.test.tsx`
Expected: FAIL — module `./add-record-dialog` does not exist.

- [ ] **Step 4: Write the component**

Create `src/features/records/components/add-record-dialog.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import { useForm, Controller, type DefaultValues } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import type { z } from "zod"

import { AddFab } from "@/components/add-fab"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { computeBmi } from "@/lib/bmi"
import { useUnitSystem } from "@/providers/unit-system-provider"
import { createRecordSchema } from "@/features/records/schema"
import { useCreateRecord } from "@/features/records/api/create-record"

type FormInput = z.input<typeof createRecordSchema>
type FormOutput = z.output<typeof createRecordSchema>

export function AddRecordDialog() {
  const { system } = useUnitSystem()
  const [open, setOpen] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const { mutate, isPending } = useCreateRecord()

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(createRecordSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      dob: "",
      sex: undefined,
      system,
      weightValue: "",
      heightValue: "",
      phone: "",
      email: "",
    } as DefaultValues<FormInput>,
  })

  useEffect(() => {
    setValue("system", system)
  }, [system, setValue])

  const weightLabel = system === "metric" ? "kg" : "lb"
  const heightLabel = system === "metric" ? "cm" : "in"

  const w = Number(watch("weightValue"))
  const h = Number(watch("heightValue"))
  const bmiPreview = w > 0 && h > 0 ? computeBmi({ weightValue: w, heightValue: h, system }) : null

  const handleOpenChange = (next: boolean) => {
    if (!next && isDirty) {
      setConfirmDiscard(true)
      return
    }
    setOpen(next)
  }

  const discard = () => {
    reset()
    setConfirmDiscard(false)
    setOpen(false)
  }

  const onSubmit = (data: FormOutput) => {
    mutate(data, {
      onSuccess: () => {
        toast.success("Record added")
        reset()
        setOpen(false)
      },
      onError: () => {
        toast.error("Something went wrong, please try again later")
      },
    })
  }

  return (
    <>
      <AddFab onClick={() => setOpen(true)} />

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add record</DialogTitle>
            <DialogDescription>Enter the participant&apos;s details.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3" noValidate>
            <div className="grid gap-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" {...register("firstName")} />
              {errors.firstName && (
                <p className="text-destructive text-sm">{errors.firstName.message}</p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" {...register("lastName")} />
              {errors.lastName && (
                <p className="text-destructive text-sm">{errors.lastName.message}</p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="dob">Date of birth</Label>
              <Input id="dob" type="date" {...register("dob")} />
              {errors.dob && <p className="text-destructive text-sm">{errors.dob.message}</p>}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="sex">Sex</Label>
              <Controller
                control={control}
                name="sex"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger id="sex" className="w-full">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.sex && <p className="text-destructive text-sm">{errors.sex.message}</p>}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="weightValue">Weight ({weightLabel})</Label>
              <Input id="weightValue" type="number" step="any" {...register("weightValue")} />
              {errors.weightValue && (
                <p className="text-destructive text-sm">{errors.weightValue.message}</p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="heightValue">Height ({heightLabel})</Label>
              <Input id="heightValue" type="number" step="any" {...register("heightValue")} />
              {errors.heightValue && (
                <p className="text-destructive text-sm">{errors.heightValue.message}</p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label>BMI</Label>
              <output data-testid="bmi-preview" className="text-sm font-medium">
                {bmiPreview ?? "—"}
              </output>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input id="phone" {...register("phone")} />
              {errors.phone && <p className="text-destructive text-sm">{errors.phone.message}</p>}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="email">Email (optional)</Label>
              <Input id="email" {...register("email")} />
              {errors.email && <p className="text-destructive text-sm">{errors.email.message}</p>}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>Your entered data will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={discard}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/features/records/components/add-record-dialog.test.tsx`
Expected: PASS. If a Base UI portal makes an assertion race, prefer `findBy*` queries (already used) and query `screen` (portals mount under `document.body`).

- [ ] **Step 6: Commit**

```bash
git add src/components/add-fab.tsx src/features/records/components/add-record-dialog.tsx src/features/records/components/add-record-dialog.test.tsx
git commit -m "feat: add AddRecordDialog with BMI preview and discard guard"
```

---

### Task 7: Wire the dialog into the page + live check

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `AddRecordDialog` (Task 6).

- [ ] **Step 1: Swap the FAB for the dialog**

Edit `src/app/page.tsx`:
- Remove `import { AddFab } from "@/components/add-fab"`.
- Add `import { AddRecordDialog } from "@/features/records/components/add-record-dialog"`.
- Replace `<AddFab />` with `<AddRecordDialog />`.

- [ ] **Step 2: Full verification**

Run:
```bash
npm test
npm run build
npm run lint
```
Expected: all PASS. (`npm test` runs the schema, repo (skipped without DB), route, and dialog suites.)

- [ ] **Step 3: Live check (behavior change — required by the finish-line gate)**

Start the DB and dev server (`npm run db:up`, `npm run dev`), then drive the app with Playwright/bundled Chromium:
- Click the FAB → dialog opens.
- Fill first/last name, DOB, sex, weight, height → BMI preview shows a value.
- Save → success toast, dialog closes, the new row appears at the top of the table.
- Reopen, type a field, press Esc/click the overlay/click Cancel → "Discard changes?" appears; Keep editing keeps values; Discard closes.
- (Error path) With the API forced to fail, Save keeps the dialog open with values intact and shows the error toast.

Capture the outcome (pass/fail) before claiming done.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: open the add-record dialog from the home page FAB"
```

---

## Self-Review

**Spec coverage:**
- FAB opens a popup → Task 6/7. ✔
- Fields from both tables (participant + contact) → Task 1 schema + Task 6 form. ✔
- Validation on the fields, client + server, one schema → Task 1 + Task 3. ✔
- Confirmation toast on save → Task 6 `onSuccess`. ✔
- Error keeps values + dialog open + error toast → Task 6 `onError` (no reset on error). ✔
- Discard confirmation on dirty close → Task 6 `handleOpenChange` + AlertDialog. ✔
- Units follow global system; BMI derived server-side, previewed live → Task 1 (`system`), Task 3 (compute), Task 6 (preview). ✔
- Contact optional, both-or-neither → Task 1 superRefine, Task 3 conditional contact. ✔

**Placeholder scan:** none — every step has concrete code/commands.

**Type consistency:** `CreateRecordInput` (Task 1) = mutation input (Task 5); `CreateParticipantInput` fields (Task 2) match the handler's call (Task 3); `computeBmi({ weightValue, heightValue, system })` used identically in Task 3 and Task 6; `Record` returned by `createParticipant` (Task 2), `createRecord` (Task 5), and parsed by `recordSchema`.
