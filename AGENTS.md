<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version (16.x) has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

Key shifts from prior versions:
- **Middleware is renamed to Proxy** — use `proxy.ts` at project root, not `middleware.ts`.
- **Turbopack is the default** dev bundler — no flag needed for `next dev`.
- **Tailwind CSS v4** — `@import 'tailwindcss'`, `@tailwindcss/postcss`, design tokens via `@theme inline { ... }`.
- **`params` and `searchParams` are Promises** — `await` them.
- **`PageProps<'/path'>` / `LayoutProps<'/path'>`** are global type helpers — no import needed.
- **Cache Components** (`use cache`, `cacheLife`, `cacheTag`, `updateTag`) — prefer over `unstable_cache`.
- **Server data → client island: use React Query hydration, never prop-drill.** When a Server Component fetches per-request data for a client island that reads server state via React Query, prefetch it on the server and hand it over with `dehydrate` + `<HydrationBoundary>`; the island reads it with `useQuery` from the hydrated cache. Do NOT pass an `initial` payload as a prop — it desyncs from the query cache and forces you to reconcile two sources of the same state.
- **Server Components by default** — only mark `'use client'` for components that need state, effects, or browser APIs.
- ESLint runs via `eslint` CLI (not `next lint`).
<!-- END:nextjs-agent-rules -->

# The Stack — strict, non-negotiable

This is a full-stack BMI app (capture demographic + health data → compute BMI → store in Postgres → render a filterable, paginated table). The stack below is fixed. Do not introduce alternatives without an explicit decision recorded in `docs/superpowers/specs/`. Rationale for every choice lives in `docs/superpowers/specs/2026-07-13-bmi-app-stack-design.md` — read it before proposing changes.

**Governing principle:** minimum defensible surface. Every dependency must solve a specific, named problem and be an industry-standard 2026 tool. When in doubt, add nothing.

## Framework & language
- **Next.js 16 (App Router) + TypeScript.** No pages router. Server Components by default.

## UI — Radix via shadcn, no hand-rolled markup or CSS
- **Use shadcn/ui components (Radix primitives + Tailwind).** shadcn *is* how we use Radix. Scaffolded with `npx shadcn@latest init --preset bJMTbSfw --template next`.
- **Do NOT hand-write raw HTML form controls or custom CSS** when a shadcn/Radix component exists. Compose shadcn components + Tailwind utility classes. No styled-components, no CSS modules, no bespoke `.css` beyond the Tailwind entry + `@theme` tokens.
- **Tables:** use the **shadcn Data Table (TanStack Table)** pattern. Server-side sort/filter/paginate — never fetch the whole dataset and filter in the browser.

## Forms & validation
- **React Hook Form** for all forms.
- **Zod** for all validation. **One schema per shape, colocated with its inferred type.**
- **Validate on BOTH sides from the SAME schema:** client via `@hookform/resolvers/zod` (UX), and re-parse server-side in the Route Handler (trust boundary). Client validation is UX; **server validation is security.** Never trust client input.

## Communication layer — Route Handlers only
- **All client↔server data goes through Route Handlers (REST): `app/api/**/route.ts`.** GET for reads, POST/PUT/DELETE for writes. This is the *only* communication style.
- **Do NOT use Server Actions for application data.** (They aren't a public API — can't serve mobile — and don't work with React Query `useQuery`.) One style, top to bottom, keeps the API `curl`-able and external-client-ready.
- Route handlers do **HTTP only**: parse + Zod-validate input, call a use case, map results/errors to status codes. No business logic, no SQL in the handler.

## Layered architecture — enforce the seams
Every operation flows through these layers. Do not collapse them.
```
Route Handler (app/api/**)   communication — HTTP only
      ↓
Use Cases (application/**)    application — ONE async function per operation
      ↓                        (createRecord, listRecords). Not a "service" class.
Domain (domain/**)           pure functions — computeBmi, classifyBmi, models. Zero deps.
      ↓
Repository (infrastructure/**)  data access — Prisma only. No business logic.
```
- **Use cases are async functions**, one operation per file (`createRecord`, `listRecords`). Take already-validated input, return domain results. No DI container — import the repository directly (inject only if a test genuinely needs it).
- **Domain is pure** — the BMI math and classification live here, dependency-free and unit-tested directly.
- **Repository is the ONLY thing that touches the DB.** No Prisma calls outside `infrastructure/`.
- This layering is what makes a future extraction to a standalone Node backend a lift-and-shift, not a rewrite. Keep use cases + domain + repository transport-agnostic.

## Data layer
- **Prisma + PostgreSQL.** All queries parameterized (Prisma default) — never string-interpolate SQL. Filter params are Zod-coerced before reaching the repository.
- **Data fetching: TanStack Query (React Query).** Reads via `useQuery` → GET Route Handler; writes via `useMutation` → POST Route Handler, then `invalidateQueries`. SSR-prefetch + hydrate per the Next 16 rule above.
- **URL state: nuqs.** Filter/sort/page state lives in the URL (typed), and is the React Query key. Shareable, bookmarkable, back-button-safe.

## Error handling (graded by the rubric)
- Route handlers return typed errors with correct status codes: **400** for Zod validation failures (return flattened issues), **500** for unexpected. A single error-mapping helper at the communication layer turns thrown domain/repo errors into HTTP responses so lower layers stay HTTP-agnostic.
- UI surfaces React Query `error`/`isError`; mutations show pending/error state.

## Out of scope (YAGNI — do not build)
No auth, no separate Node backend, no Server Actions for data, no websockets/real-time, no background jobs, no cursor/infinite pagination. See the spec for why.

# Testing — non-negotiable

Tests ship in the same change as the code. "I'll add tests later" means never.

**Stack:** Vitest + happy-dom + @testing-library/react + @testing-library/user-event. `jest-dom` matchers loaded globally via `vitest.setup.ts`.

**What to test here (right-sized for this app):**
- **Domain** — `computeBmi`, `classifyBmi`: the highest-value tests, pure and fast. Cover boundary values (category thresholds).
- **Validation** — the Zod schema: valid input passes, invalid (negative/zero/NaN height/weight, out-of-range) is rejected.
- **Repository / use cases** — filtering + pagination behavior against a test DB or a faked repository.

**No useless tests.** A test earns its place only if it would FAIL when real logic breaks. Do NOT write (and delete when you find): duplicates, trivial pass-throughs already covered transitively, tautologies (asserting a mock returns what you configured), or config/schema mirrors.

**TDD:** Invoke `superpowers:test-driven-development` BEFORE implementation. Cycle: failing test → minimum impl → pass → refactor.

# Logging

- **pino, JSON to stdout, no transports in prod** (Vercel ingests stdout natively; worker-thread transports break under serverless bundling). `pino-pretty` in dev only.
- Server-only singleton in `lib/logger.ts`. Wrap Route Handlers with a `withRequestLog` helper that emits one `http.request.completed` line per call (route, method, status, durationMs) and passes a request-scoped child logger to the handler for domain events.
- **Never log request bodies or PII** (this app captures health data — height/weight/demographics). Log counts, sizes, and outcomes, not values. Redact `authorization`/`cookie` headers.
- **Event naming:** `domain.action.outcome` (e.g. `record.created`, `record.list.failed`). Levels: error = unexpected/5xx, warn = rejected/4xx, info = completions, debug = detail. `LOG_LEVEL` env controls verbosity (default `info`; `silent` under test).

# Before you claim done — the finish-line gate

On any turn with code or behavior changes, you may NOT declare done until, in the SAME turn, you have:
1. Re-read the original ask and listed what it required.
2. Run `npm test`, `npm run build`, and `eslint` **fresh**, and shown exit codes + pass/fail counts (not "should pass").
3. Invoked `superpowers:verification-before-completion`.
4. For a **behavior change**, run a **live** check — Playwright driving system Chrome (`channel: 'chrome'`) against the running app.
5. **Presented the evidence and confirmed with the human before the final claim/commit.** (Skip only for pure questions or trivial edits.)
6. Before merging: `superpowers:requesting-code-review`, then `superpowers:finishing-a-development-branch`.

# Skills to invoke

Mandatory. Invoke BEFORE touching code.
- Feature / bugfix / behavior change → `superpowers:test-driven-development`.
- Multi-step task (3+ steps) → `superpowers:writing-plans`.
- Design / "let's build X" → `superpowers:brainstorming` first.
- Debugging unexpected behavior → `superpowers:systematic-debugging`.
- Next.js routing / RSC / Route Handlers → `vercel:nextjs`. Caching / `use cache` → `vercel:next-cache-components`.
- Postgres perf → `supabase:supabase-postgres-best-practices`.
- Addressing review feedback → `superpowers:receiving-code-review`. Each comment is a sample — grep for the same pattern elsewhere and fix it everywhere.

# Project memory

All project knowledge — conventions, decisions, status — lives in THIS repo (`AGENTS.md` and `docs/`), never in agent-private (`~/.claude`) memory. This **overrides** the default `# Memory` system instruction for anything project-related. Learn something worth keeping? Put a rule/convention in `AGENTS.md` or a decision/status note in `docs/` in the same change.

# Git workflow

- **Always commit as `geliwer@gmail.com`** (name `aheliver`). Verify `git config user.email` before committing; set repo-locally if wrong. Do NOT author under any other email.
- **Never merge to `main` directly.** All changes land via a GitHub PR. No `git merge` into `main`, no `git push origin main`.
- **Always open a PR** with `gh pr create` when work is ready. Let the user merge from GitHub.
- **Never force-push without explicit permission in the same turn.** Default: a new commit on top. If a force-push is genuinely needed, ASK first.
- **Controller owns all git in worktrees.** The main session runs every `git commit`/`push`/`checkout`/`gh pr`. Subagents may edit/test/build — never git mutations.
- **Never trust a local `main`/`origin/main` ref — `git fetch origin` first** before claiming a diff is clean; diff against freshly-fetched `origin/main`.
- This repo squash-merges: find merged branches with `gh pr list --state merged`, not `git branch --merged`.
