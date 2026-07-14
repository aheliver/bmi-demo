# BMI App — Application Architecture Design

**Date:** 2026-07-14
**Builds on:** [`2026-07-13-bmi-app-stack-design.md`](./2026-07-13-bmi-app-stack-design.md) (the locked stack) and the canonical-stack table in `AGENTS.md`.

**Purpose:** Turn the already-locked stack into a concrete, buildable skeleton — the exact folder tree, each layer's responsibility, naming conventions, and how a request flows through the seams. The stack decisions themselves are settled and are *not* revisited here.

This document is the answer to "define the architecture of the app." It was produced by researching current (2025–2026) industry patterns for this exact combination — Next.js 16 App Router + layered/Clean Architecture + Prisma repository + TanStack Query SSR — and reconciling them against the locked stack. Sources are listed at the end.

---

## Decisions recorded (the ones that shaped this layout)

| Decision | Choice | Rationale |
|---|---|---|
| Layer organization | **Layer-first** (`domain/ application/ infrastructure/`) | Matches the AGENTS.md canonical table and the stack spec; keeps Clean-Architecture seams explicit for a single-domain app. |
| Folder root | **Root-level**, not `src/` | The locked spec and AGENTS.md already write these paths at repo root (`application/create-record.ts`, `domain/bmi.ts`, `infrastructure/record-repository.ts`). `src/` is the slightly-more-popular industry convention but would mean rewriting every path in the source-of-truth docs for a purely cosmetic gain. Root-level = zero doc churn. |
| `app/` role | **Routing only** | Universal 2025–2026 consensus (Next.js docs, nikolovlazar clean-arch, bulletproof-react, Feature-Sliced Design): `app/` holds routes + thin route handlers + route-local UI; the layered core lives in sibling folders. |
| Boundary enforcement | **Convention-only** (no lint tooling) | Every reference *can* enforce the dependency direction with `eslint-plugin-boundaries` / `import/no-restricted-paths`, but for a single-feature app that's ceremony. The direction is documented and upheld by review. (Opt-in later if the app grows.) |
| Repository shape | **Functional module**, no interface, no DI | The 2025–2026 consensus wraps Prisma in plain async functions grouped into a module, not OOP repository classes — functions compose with Next's caching primitives and tree-shake better. The stack spec already rejected DI ("import the repository directly… inject only if a test genuinely needs it"). |

Anything not listed here (e.g. how BMI category is modeled, exact Zod fields) is a data-modeling detail deferred to implementation — out of scope for the architecture.

---

## Folder tree

```
bmi-demo-project/
├─ app/                              # ROUTING ONLY — Next.js owns this
│  ├─ layout.tsx                     # root layout; wraps children in <Providers>
│  ├─ page.tsx                       # Server Component: prefetch + dehydrate + <HydrationBoundary>
│  ├─ providers.tsx                  # 'use client' — QueryClientProvider + NuqsAdapter
│  ├─ get-query-client.ts            # makeQueryClient / getQueryClient (isServer branch)
│  ├─ globals.css                    # Tailwind v4 entry + @theme tokens
│  ├─ _components/                   # route-local UI islands ('_' = non-routable)
│  │  ├─ records-table.tsx           # 'use client' — useQuery + shadcn Data Table
│  │  ├─ record-form-dialog.tsx      # 'use client' — RHF + zodResolver + useMutation
│  │  └─ record-filters.tsx          # 'use client' — nuqs useQueryStates
│  └─ api/
│     └─ records/
│        ├─ route.ts                 # GET (list) + POST (create) — HTTP only
│        └─ _lib/                    # communication-layer helpers (non-routable)
│           ├─ http-error.ts         # thrown domain/repo error → HTTP status mapper
│           └─ with-request-log.ts   # wraps handlers; one http.request.completed line
│
├─ domain/                          # PURE — zero dependencies, unit-tested directly
│  ├─ bmi.ts                         # computeBmi, classifyBmi
│  └─ record.ts                      # Record domain type + BmiCategory
│
├─ application/                     # USE CASES — one async function per operation
│  ├─ create-record.ts               # createRecord(input): validated input → domain Record
│  └─ list-records.ts                # listRecords(query): filter/sort/page → { rows, total }
│
├─ infrastructure/                  # DATA ACCESS — the only code that touches the DB
│  ├─ prisma.ts                      # PrismaClient singleton (globalThis, hot-reload safe)
│  └─ record-repository.ts           # recordRepository: findMany+count ($transaction), create
│
├─ lib/                             # cross-cutting, framework-agnostic shared code
│  ├─ schemas/
│  │  └─ record.ts                   # the shared Zod schemas + inferred types (see below)
│  ├─ query-keys.ts                  # recordKeys factory, keyed on nuqs URL params
│  └─ logger.ts                      # pino singleton (per AGENTS.md logging rules)
│
├─ components/ui/                   # shadcn-generated primitives (code we own)
├─ prisma/
│  └─ schema.prisma
└─ (config: package.json, next.config.ts, tsconfig.json, vitest.config.ts, .env, …)
```

---

## The layers and their contracts

The whole point of the layout is a one-directional dependency flow. Each layer knows only about the layer below it; nothing reaches around a seam.

```
app/ (routing + UI)
   │  imports use cases + shared schema/query-keys
   ▼
application/ (use cases)        ← the transport-agnostic core; lift-and-shift target
   │  imports domain + repository
   ▼
domain/ (pure rules)  ◄──────── infrastructure/ (repository)
   imports nothing                imports prisma + domain (to map rows → Record)
```

### `app/` — communication + presentation (Next.js)
- **Route handlers** (`app/api/records/route.ts`) do **HTTP only**: parse the request, Zod-validate input (re-parsing the *same* schema from `lib/schemas`, because the server is the trust boundary), call one use case, map the result/error to a status code. No business logic, no SQL. Wrapped in `with-request-log` so every call emits one structured log line.
- **Error mapping** lives at this layer (`app/api/records/_lib/http-error.ts`): a single helper turns thrown domain/repository errors into `400`/`500` responses, so lower layers stay HTTP-agnostic.
- **UI islands** (`app/_components/*`) are `'use client'` components. They never call the repository or Prisma — they talk to the route handlers through TanStack Query hooks.
- **`page.tsx`** is a Server Component that prefetches the first query on the server, `dehydrate`s the cache, and hands it to the client island via `<HydrationBoundary>` — the AGENTS.md rule (hydrate, never prop-drill an `initial` payload).

**Contract:** what does it do? Translate HTTP ⇄ use-case calls and render. How do you use it? Hit `GET /api/records` / `POST /api/records`, or render the page. What does it depend on? `application/` + `lib/schemas` + `lib/query-keys`.

### `application/` — use cases (the reusable core)
- One **async function per operation**, one file each: `createRecord`, `listRecords`. Not a "service" class.
- Takes **already-shaped, validated input**, orchestrates domain functions + the repository, returns domain results. Transport-agnostic — no `Request`/`Response`, no HTTP status codes.
- This is the layer you would **lift into a standalone Node backend** if a mobile client ever justified extraction — a move, not a rewrite.

**Contract:** do? Run one business operation end-to-end. Use? `await createRecord(input)` / `await listRecords(query)`. Depend on? `domain/` + `infrastructure/`.

### `domain/` — pure rules
- `computeBmi`, `classifyBmi`, and the `Record` type. **Zero dependencies** — no Prisma, no React, no HTTP.
- The highest-value, fastest tests live here (boundary values on the classification thresholds).

**Contract:** do? Encode the BMI rules. Use? Call the pure functions. Depend on? **Nothing.**

### `infrastructure/` — data access
- `record-repository.ts` is a **functional module** (`recordRepository`) — the *only* code that touches the database. Server-side filter/sort/paginate: `where` + `skip`/`take` + `orderBy`, with row count fetched alongside rows in one `$transaction([findMany, count])` (identical `where` in both). It **maps Prisma rows to the domain `Record`** so Prisma types never leak upward.
- `prisma.ts` is the `globalThis` singleton that survives dev hot-reload without exhausting the connection pool.

**Contract:** do? Read/write records in Postgres and return domain types. Use? `recordRepository.findMany(...)` / `.create(...)`. Depend on? `prisma` + `domain/` (for the return type).

### `lib/` — cross-cutting
- **`schemas/record.ts`** — the shared Zod schema(s) and their inferred types. Deliberately *not* inside a layer, because both the client island (`@hookform/resolvers/zod`) and the server route handler import the same schema. One schema, two consumers, single source of truth for the shape.
- **`query-keys.ts`** — a `recordKeys` factory so the query key is built one way everywhere and keyed on the nuqs URL params (URL change → key change → automatic refetch).
- **`logger.ts`** — the pino singleton per the AGENTS.md logging rules.

---

## Request / data flow

### Read — the filtered, paginated table
```
URL (nuqs): ?minBmi=20&maxBmi=30&page=2&sort=bmi:desc     typed URL state
   │
records-table.tsx: useQuery({ queryKey: recordKeys.list(params),
                              queryFn: fetch('/api/records?…'),
                              placeholderData: keepPreviousData })   no flicker on page change
   │  (SSR: page.tsx prefetched page 1 → dehydrate → HydrationBoundary)
   ▼
GET /api/records (route.ts)          Zod-parse query params, call use case, map errors
   ▼
listRecords(query)                   use case
   ▼
recordRepository.findMany + count    WHERE + LIMIT/OFFSET + ORDER BY, one $transaction
   ▼
{ rows: Record[], total } → JSON → shadcn Data Table renders the current page
```
Filtering/sorting/pagination are **server-side** — only the current page's rows leave the DB. The URL is the single source of truth for filter state (shareable, bookmarkable, back-button-safe) and doubles as the React Query key.

### Write — create a record
```
record-form-dialog.tsx: RHF + zodResolver (same schema)     client validation = UX
   │  useMutation({ mutationFn: POST /api/records })
   ▼
POST /api/records (route.ts)         re-Zod-parse body (trust boundary), call use case
   ▼
createRecord(input)                  computeBmi (domain) → recordRepository.create
   ▼
recordRepository.create → domain Record → 201
   ▼
onSettled: await queryClient.invalidateQueries({ queryKey: recordKeys.all })   table refetches
```

---

## Testing seam (per AGENTS.md)

The layout makes the high-value tests trivial to reach:
- **`domain/`** — `computeBmi`/`classifyBmi` tested as pure functions (boundary values). Fastest, most valuable.
- **`lib/schemas`** — the Zod schema: valid passes, invalid (negative/zero/NaN, out-of-range) rejected.
- **`application/` + `infrastructure/`** — filtering + pagination behavior against a test DB or a faked `recordRepository` (the functional module is easy to stub without DI).

---

## What this design deliberately does NOT add

Consistent with AGENTS.md's "minimum defensible surface":
- **No `src/` wrapper** — root-level matches the docs.
- **No lint-enforced boundaries** — convention + review for a single feature.
- **No repository interface / DI container** — a functional module imported directly.
- **No `interface-adapters/` or `controllers/` layer** — the route handler *is* the interface adapter; a separate controller file is ceremony at this size.
- **No feature folders** (`features/records/*`) — there is one feature; layer-first is clearer here. If a second domain appears, revisit.

---

## Sources (industry research, 2025–2026)

- Next.js official — [Project structure & organization](https://nextjs.org/docs/app/getting-started/project-structure) (`app/` for routing; `_folder` private folders; "store project files outside `app`").
- [nikolovlazar/nextjs-clean-architecture](https://github.com/nikolovlazar/nextjs-clean-architecture) — the canonical Clean-Architecture-in-Next reference (layer split, `*.use-case.ts` / `*.repository.ts` conventions).
- [bulletproof-react — project structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md) — unidirectional-import rule.
- [Feature-Sliced Design for Next.js App Router](https://feature-sliced.design/blog/nextjs-app-router-guide) — "`app/` for routing only, `src/` for architecture."
- [TanStack Query — Advanced SSR](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr) — `getQueryClient`, prefetch + `dehydrate` + `HydrationBoundary`, `staleTime`.
- [TanStack Query — Paginated queries](https://tanstack.com/query/latest/docs/framework/react/guides/paginated-queries) — `placeholderData: keepPreviousData`.
- [TkDodo — Effective React Query Keys](https://tkdodo.eu/blog/effective-react-query-keys) — query-key factories keyed on URL state.
- [Prisma — Pagination](https://www.prisma.io/docs/orm/prisma-client/queries/pagination) & [Transactions](https://www.prisma.io/docs/orm/prisma-client/queries/transactions) — `$transaction([findMany, count])`.
- [Prisma — Next.js best practices](https://www.prisma.io/docs/orm/more/help-and-troubleshooting/help-articles/nextjs-prisma-client-dev-practices) — `globalThis` singleton.
