# BMI App — Stack & Architecture Design

**Date:** 2026-07-13
**Context:** Curebase coding interview. Build a full-stack app that captures demographic + health data (height/weight → computed BMI), stores it in PostgreSQL, and renders it in a filterable, paginated, navigable table. 90-minute hard limit at interview time; the scaffold is pre-built. Rubric rewards **layered architecture (communication / domain / data-access), clean abstractions, validation, error handling**, and the ability to **explain every choice**.

This document records the stack decisions and *why* each was made, so every choice can be defended under questioning.

---

## Guiding principle

**Minimum defensible surface, industry-standard tools.** Every library must earn its place by solving a specific, named problem, and must be a widely-adopted 2026 standard (the ask was explicitly "most widely used / industry standard"). Bias against sophistication for its own sake — each added tool is one more thing to justify.

---

## The stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16** (App Router) | House framework (task says so); most widely deployed full-stack React framework. |
| Language | **TypeScript** | Required by the task. |
| UI | **shadcn/ui + Tailwind v4** | shadcn = Radix primitives + Tailwind + code you own. Tailwind is the create-next-app default; shadcn is the standard component approach. Satisfies "Radix always" — shadcn *is* how you use Radix in practice. Scaffold: `npx shadcn@latest init --preset bJMTbSfw --template next`. |
| Forms | **React Hook Form** | shadcn's default form is built on RHF — the standard default. |
| Validation | **Zod** | Unanimous industry standard. **One schema, used on both sides.** |
| Communication | **Route Handlers (REST)** | One communication style for reads *and* writes. `curl`-able, framework-agnostic, and the documented 2026 choice when you have (or plan) external clients like mobile. |
| Application | **Use cases** (async function per operation) | Clean-Architecture "interactor". One operation per file (`createRecord`, `listRecords`). Not a catch-all "service" (which connotes a capability like Auth/Playback); not a class (over-ceremony for this app). |
| Domain | **Pure functions** | `computeBmi`, `classifyBmi`, the `Record` model. No dependencies — trivially unit-testable. |
| Data access | **Repository + Prisma** | Explicit repository module = the data-access layer the rubric grades. Prisma is the most-adopted TypeScript ORM (~7.8M weekly downloads). Parameterized by default → injection-safe. |
| Database | **PostgreSQL** | Task-preferred; most popular full-stack DB combo. |
| Data fetching | **TanStack Query (React Query)**, SSR-hydrated | Client cache for the table: cached-per-filter reads, smooth pagination (`keepPreviousData`), background refetch. Reads via `useQuery` → GET route; writes via `useMutation` → POST route. |
| URL state | **nuqs** | Typed filter/sort/page state in the URL: shareable, bookmarkable, back-button-safe, SSR-friendly. Removes hand-rolled searchParams parsing. |
| Table | **shadcn Data Table (TanStack Table)** | Headless table logic + shadcn components; the reference pattern for server-side sort/filter/paginate. |
| Tests | **Vitest** | Right-sized: cover domain (BMI calc, classification), validation (Zod), and the repository. |

---

## Architecture — layers

```
Route Handler        communication — HTTP only: parse, validate (Zod), status codes, shape response
   (interface)       app/api/records/route.ts
        ↓
Use Cases            application — one async function per operation; orchestrates domain + repo
   (application)     application/create-record.ts, application/list-records.ts
        ↓
Domain               pure rules — computeBmi, classifyBmi, Record type; zero dependencies
   (domain)          domain/bmi.ts
        ↓
Repository           data access — Prisma only, no business logic
   (infrastructure)  infrastructure/record-repository.ts
```

**Why these seams:**
- Route handler stays thin → business logic is reusable from a CLI/cron/other transport and is unit-testable without a server.
- Use cases are transport-agnostic → the layer you **lift into a standalone Node backend** if mobile ever justifies extraction (a move, not a rewrite).
- Domain is pure → fastest, most valuable tests live here.
- Repository is the only thing that touches the DB → single place to reason about queries and injection-safety.

---

## Data flow — the filtered table

```
URL searchParams (nuqs)      ?minBmi=20&maxBmi=30&page=2&sort=bmi:desc   (typed)
        │
useQuery({ queryKey: ['records', params],            React Query, keyed on params
           queryFn: fetch('/api/records?…'),          cache per filter combo
           placeholderData: keepPreviousData })        no flicker on page change
        │
GET /api/records  (Route Handler)                    validates params with Zod
        │
listRecords(filter, page, sort)                      use case
        │
recordRepository.findMany(...)  → WHERE + LIMIT/OFFSET   data access (server-side filtering)
        │
shadcn Data Table (TanStack Table)                   renders the current page
```

Filtering/sorting/pagination are **server-side** (only the current page's rows leave the DB). Create flow mirrors this: form (RHF + Zod) → `useMutation` → `POST /api/records` → `createRecord` use case → repository → `invalidateQueries`.

---

## Validation & safe input (the rubric's explicit question)

- **One Zod schema**, colocated with its inferred type. Reused in two places:
  - **Client** — via `@hookform/resolvers/zod` in React Hook Form (fast UX feedback).
  - **Server** — re-parsed in the Route Handler. The server is the trust boundary; **client validation is UX, server validation is security.**
- **Safe DB input** — Prisma parameterizes all queries; no string-interpolated SQL. Query params (filters) are Zod-parsed/coerced before reaching the repository.

---

## Error handling

- Route handlers return typed error responses with correct status codes (400 for validation failures with Zod's flattened issues; 500 for unexpected).
- A single error-mapping helper at the communication layer converts thrown domain/repository errors → HTTP responses, so use cases and the repository stay HTTP-agnostic.
- React Query surfaces `error`/`isError` to the UI; mutations show pending/error state.

---

## Explicitly out of scope (YAGNI)

- **No auth** (task says so). Route Handlers leave the door open to add it centrally in `proxy.ts` later.
- **No separate Node backend now.** Next serves both web and API. Layering makes extraction to a standalone service a lift-and-shift *if* mobile ever justifies it.
- **No Server Actions for app data.** One communication style (Route Handlers) — chosen for consistency + external-client (mobile) readiness. (Server Actions can't serve mobile; `useQuery` can't use them.)
- No infinite scroll / cursor pagination (offset pagination is sufficient for this dataset size).
- No real-time/websockets, no background jobs.

---

## Alternatives considered (and why not)

- **Drizzle** instead of Prisma — excellent, rising, more SQL-transparent, but Prisma is more widely adopted and the stated goal was industry-standard/most-used. Both give a clean repository layer and are injection-safe.
- **RSC + Server Actions, no React Query** (the other coherent 2026 package) — least code, most Next-idiomatic *for a web-only app*. Rejected because it isn't mobile-ready (Server Actions aren't a public API) and drops the client-side caching we want for the table. Adding React Query on top of it collapses back into either this package (React Query inert) or the REST package (needs a GET route).
- **Server Actions for writes + React Query hybrid** — works (`useMutation` + Server Action), but asymmetric with GET reads *and* still not mobile-ready on writes. Loses on consistency and extensibility; wins on nothing decisive.
- **Class-per-use-case** — more textbook Clean Architecture, but ceremony an interviewer may read as over-engineering for a BMI form.
- **Manual `useSearchParams`** instead of nuqs — viable fallback, but ~30 lines of boilerplate and manual coercion per filter; nuqs is a small, well-scoped dependency that removes it.
