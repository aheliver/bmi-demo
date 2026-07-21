# Add Record — design

Status: accepted (2026-07-17)

Lets a user create a new participant record (and optional contact) from the home page. The floating "add" button opens a dialog with a form; on save the record is persisted, the table refreshes, and a toast confirms. Errors keep the dialog open with the entered values intact.

## Decisions

### Units follow the global system
The form does not offer per-field unit selectors. Weight and height are entered in whichever system the header toggle is currently set to (metric → kg + cm, imperial → lb + in). Because both values share one system, the existing `computeBmi` in `src/lib/bmi.ts` is usable as-is with no normalisation step. The submitted payload carries the current `system`; the server derives `weightUnit`/`heightUnit` from it before persisting.

### Contact is optional
Phone and email may both be left blank, in which case no `Contact` row is created. If **either** is filled, **both** are required (the `Contact` table's `phone` and `email` are non-null), and email must be a valid address.

### BMI is derived, never entered, never trusted from the client
BMI is shown in the dialog as a **read-only** field that recomputes live from the entered weight and height (using `computeBmi` on the client) for immediate feedback. It shows a placeholder until both values are valid.

The client-previewed BMI is **display-only and is not part of the request payload**. The `POST` handler recomputes BMI server-side with the same `computeBmi` and stores that value. Rationale: the route handler is a public REST endpoint that any client can call directly, so derived/authoritative fields must be owned by the server — a client-supplied BMI could be inconsistent with the height/weight it accompanies. Using the same pure function on both sides guarantees the previewed value and the stored value agree. `computeBmi` is a single arithmetic expression with no I/O, so the server-side recompute has no meaningful cost.

### BMI compute + insert live inline in the route handler
The `POST` handler validates, calls `computeBmi`, then calls the repository. No `services/` layer: the logic is two calls with no branching, so a service would be a pass-through. If the flow later grows additional steps, extracting a service is a small, contained change.

### One schema, validated on both sides
A single `createRecordSchema` (colocated with its inferred type in `src/features/records/schema.ts`) is the request contract. The client validates with it via `@hookform/resolvers/zod` (UX); the `POST` handler re-parses the raw body with the same schema (the trust boundary). This is distinct from the existing `recordSchema`, which remains the **response** shape.

## Form fields

| Field | Required | Rules |
|---|---|---|
| First name | yes | non-empty, trimmed, max 100 |
| Last name | yes | non-empty, trimmed, max 100 |
| Date of birth | yes | valid date, not in the future, on/after 1900-01-01 |
| Sex | yes | `male` or `female` (Select) |
| Weight | yes | positive; unit label follows the current system (kg / lb) |
| Height | yes | positive; unit label follows the current system (cm / in) |
| BMI | — | read-only, auto-computed from weight + height; not submitted |
| Phone | no | if either phone or email is filled, both required |
| Email | no | if either phone or email is filled, both required; valid email |

## Data flow

1. FAB click opens the dialog.
2. User fills the form; BMI preview recomputes live from weight/height/system.
3. Submit runs client-side Zod validation; on pass, `useMutation` sends `POST /api/records`.
4. The handler re-parses the body with `createRecordSchema`, derives units from `system`, computes BMI, and calls the repository, which inserts the `Participant` and — only if contact was provided — a nested `Contact`.
5. On success (201): invalidate the `["records"]` query (table refetches, new record appears on page 1 by `createdAt desc`), reset and close the dialog, show a success toast.
6. On error: show an error toast ("Something went wrong, please try again later"), keep the dialog open, and preserve the entered values (the form is not reset).

## Error handling

- **Validation (client):** per-field messages via the shadcn form; submit is blocked.
- **Validation (server):** invalid body → `400`; the client surfaces the error toast.
- **Insert failure (server):** unexpected error → `500`; the client surfaces the error toast and keeps the dialog open with values intact.
- **Discard guard:** every close path (overlay click, Esc, the X, Cancel) routes through the dialog's single `onOpenChange(false)`. If the form is dirty, a confirmation ("Discard changes?" — Discard / Keep editing) is shown; if not dirty, the dialog closes immediately.

## Logging

The `POST` handler is wrapped with the existing `withRequestLog` (event tag `records.create`). Emit `record.created` (with only the new record id) on success. Failures are captured by `withRequestLog` itself, which logs `http.request.failed` with the `records.create` event tag and the error, and returns 500 — so no separate `record.create.failed` emission is added in the handler. Per the logging rules, log counts/outcomes only — never field values (health data / PII).

## Components and files

Reused as-is: `computeBmi` (`src/lib/bmi.ts`), `unit-system-provider`, `AddFab`, the `["records"]` query key, `recordSchema` (response), `withRequestLog`, `listParticipants`.

New / changed:

- `src/features/records/schema.ts` — add `createRecordSchema` + inferred type.
- `src/features/records/api/create-record.ts` — POST fetcher + `useMutation` that invalidates `["records"]`.
- `src/app/api/records/route.ts` — add `POST` (validate → compute BMI → repository).
- `src/infrastructure/participant-repo.ts` — add `createParticipant` (Prisma nested `contact: { create }`, conditional on contact present).
- `src/features/records/components/add-record-dialog.tsx` — new client component: owns dialog open state, renders `AddFab` as the trigger, hosts the RHF form, the live BMI preview, and the discard-confirmation.
- `src/app/page.tsx` — render `add-record-dialog` (client) in place of the bare `<AddFab />`, because opening a dialog needs client state.
- `src/app/layout.tsx` — mount the sonner `<Toaster />` (a dependency already, but nothing renders it yet).

shadcn components to scaffold via the configured registry (this repo uses `@base-ui/react`, style `base-nova` — scaffold, do not hand-write primitives): `dialog`, `form`, `input`, `label`, `select`, `alert-dialog`, `sonner`.

## Tests

- `createRecordSchema` validation: required fields, DOB not-future / lower bound, weight/height positivity, contact both-or-neither, invalid email.
- `createParticipant` repository: inserts with contact and without contact.
- BMI is already covered by `src/lib/bmi.test.ts`; no new BMI test needed.
