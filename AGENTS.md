<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version (16.x) has breaking changes — APIs, conventions, and file structure may all differ from your training data. Consult the `vercel:nextjs` skill (and the official v16 upgrade guide) before writing code. Heed deprecation notices.

Key shifts from prior versions:
- **Middleware is renamed to Proxy** — use `proxy.ts` at project root, not `middleware.ts`.
- **Turbopack is the default** dev bundler — no flag needed for `next dev`.
- **Tailwind CSS v4** — `@import 'tailwindcss'`, `@tailwindcss/postcss`, design tokens via `@theme inline { ... }`.
- **`params` and `searchParams` are Promises** — `await` them.
- **`PageProps<'/path'>` / `LayoutProps<'/path'>`** are global type helpers — no import needed.
- **Cache Components** (`use cache`, `cacheLife`, `cacheTag`, `updateTag`) — prefer over `unstable_cache`.
- **Server data → client island: use React Query hydration, never prop-drill.** When a Server Component fetches per-request data for a client island that reads server state via React Query, prefetch it on the server and hand it over with `dehydrate` + `<HydrationBoundary>`; the island reads it with `useQuery` from the hydrated cache. Do NOT pass an `initial` payload as a prop — it desyncs from the query cache and forces you to reconcile two sources of the same state.
- **Server Components by default** — only mark `'use client'` for components that need state, effects, or browser APIs.
- **ESLint runs via the `eslint` CLI** (`next lint` was removed in v16).
<!-- END:nextjs-agent-rules -->

# The Stack — strict, non-negotiable

This is a full-stack BMI app (capture demographic + health data → compute BMI → store in Postgres → render a filterable, paginated table). The stack below is fixed. Do not introduce alternatives without an explicit decision recorded in `docs/superpowers/specs/`. Rationale for every choice lives in `docs/superpowers/specs/2026-07-13-bmi-app-stack-design.md` — read it before proposing changes.

**Governing principle:** minimum defensible surface. Every dependency must solve a specific, named problem and be an industry-standard 2026 tool. When in doubt, add nothing.

## Canonical stack — the single source of truth

**Before writing or changing any code, confirm it conforms to this table. If a task would require a tool NOT listed here, STOP and get an explicit decision — do not improvise a substitute.**

| Concern | MUST use | MUST NOT use |
|---|---|---|
| Framework | Next.js 16, App Router | pages router; any other framework |
| Language | TypeScript | plain JS |
| UI components | shadcn/ui (Radix primitives) | hand-written HTML controls; MUI/Chakra/AntD |
| Styling | Tailwind v4 utilities + `@theme` tokens | custom `.css`, CSS modules, styled-components, inline style hacks |
| Forms | React Hook Form | uncontrolled ad-hoc forms; Formik |
| Validation | Zod (one schema, client + server) | yup/joi; validating on one side only |
| Client↔server | Route Handlers (`src/app/api/**`), REST | Server Actions for app data; tRPC; GraphQL |
| App logic | use-case async functions (`src/services/**`) | logic in route handlers or components |
| Domain | pure functions (`src/domain/**`) | side effects / IO in domain code |
| Data access | Repository + Prisma (`src/infrastructure/**`) | Prisma calls outside the repository; raw string SQL |
| Database | PostgreSQL | SQLite/MySQL/Mongo |
| Data fetching | TanStack Query (React Query), SSR-hydrated | `fetch` in components w/o React Query; SWR |
| HTTP transport (inside `queryFn`/`mutationFn`) | native `fetch` | axios/ky/superagent |
| URL/filter state | nuqs | ad-hoc `useState` for filters not synced to URL |
| Local UI state (dialogs, form steps) | React `useState`/`useReducer` | Redux/Zustand/Jotai/global store; Context as a data store |
| Table | shadcn Data Table / TanStack Table, server-side filter/sort/paginate | client-side filtering of the full dataset |
| Notifications / toasts | shadcn toast (sonner) | react-hot-toast/react-toastify/custom |
| Unit/component tests | Vitest + Testing Library | Jest; `node:test` |
| E2E / live check | Playwright (bundled Chromium, version-pinned) | Cypress; Selenium |
| Package manager | npm | pnpm/yarn/bun |

If a rule below and this table ever disagree, the table wins — fix the prose.

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
- **All client↔server data goes through Route Handlers (REST): `src/app/api/**/route.ts`.** This is the *only* communication style. Each feature adds the endpoints and HTTP methods (`GET`/`POST`/`PUT`/`PATCH`/`DELETE`) it actually needs — no more, no fewer. The concrete endpoint list for a feature belongs in that feature's doc under `docs/`, not here.
- **Do NOT use Server Actions for application data.** (They aren't a public API — can't serve mobile — and don't work with React Query `useQuery`.) One style, top to bottom, keeps the API `curl`-able and external-client-ready.
- Route handlers do **HTTP only**: parse + Zod-validate input, call a use case, map results/errors to status codes. No business logic, no SQL in the handler.

## Project structure — layer-first under `src/`, enforce the seams
Application code lives under `src/`; config/tooling stays at the repo root. `app/` is Next.js **routing only**. Folders and what each holds (guidance — no fixed file list):
```
src/
  app/              # Next.js routing only — pages and route handlers
  domain/           # pure, framework-free core — entities, business rules,
                    #   validators, and repository interfaces (the contracts)
  services/         # use cases — orchestrate domain and repositories
  infrastructure/   # the outside world — external SDK clients and repository implementations
  components/       # shared UI, including shadcn primitives
  providers/        # app-level React context providers, wired into the layout
  hooks/            # shared React hooks
  lib/              # generic helpers with no external I/O
prisma/             # schema and migrations — stays at repo root
```
Dependency direction — never collapse a seam or reach around one:
- **Flow:** `app → services → domain ← infrastructure`. `domain/` imports nothing.
- **Use cases live in `services/`**, one async function per operation — not a "service" class. Take already-validated input, return domain results. Import the repository directly; no DI container (inject only if a test genuinely needs it). A use case may be thin (a near pass-through) — that's fine; it keeps route handlers HTTP-only and the seam uniform.
- **Domain is pure** — business rules + types, zero deps, unit-tested directly. Repository **interfaces** (the contracts) live here.
- **Infrastructure is the only code that touches the DB or external systems** — the Prisma client and the repository **implementation**. No Prisma calls outside `src/infrastructure/`.

## Data layer
- **Prisma + PostgreSQL.** All queries parameterized (Prisma default) — never string-interpolate SQL. Filter params are Zod-coerced before reaching the repository.
- **Data fetching: TanStack Query (React Query).** Reads via `useQuery` → GET Route Handler; writes via `useMutation` → the appropriate write Route Handler (`POST`/`PUT`/`PATCH`/`DELETE`), then `invalidateQueries`. SSR-prefetch + hydrate per the Next 16 rule above.
- **URL state: nuqs.** Filter/sort/page state lives in the URL (typed), and is the React Query key. Shareable, bookmarkable, back-button-safe.

# Testing — non-negotiable

Tests ship in the same change as the code. "I'll add tests later" means never.

**Stack:** Vitest + happy-dom + @testing-library/react + @testing-library/user-event. `jest-dom` matchers loaded globally via `vitest.setup.ts`.

**What to test — right-size to the layer, not to any one feature:**
- **Domain** — pure business-rule functions: the highest-value tests, pure and fast. Cover boundary values.
- **Validation** — the Zod schema for each shape: valid input passes, invalid (out-of-range, wrong type, missing) is rejected.
- **Repository / use cases** — filtering, pagination, and other data behavior against a test DB or a faked repository.

**No useless tests.** A test earns its place only if it would FAIL when real logic breaks. Do NOT write (and delete when you find): duplicates, trivial pass-throughs already covered transitively, tautologies (asserting a mock returns what you configured), or config/schema mirrors.

**TDD:** Invoke `superpowers:test-driven-development` BEFORE implementation. Cycle: failing test → minimum impl → pass → refactor.

# Logging

- **pino, JSON to stdout, no transports in prod** (Vercel ingests stdout natively; worker-thread transports break under serverless bundling). `pino-pretty` in dev only.
- Server-only singleton in `src/lib/logger.ts`. Wrap Route Handlers with a `withRequestLog` helper that emits one `http.request.completed` line per call (route, method, status, durationMs) and passes a request-scoped child logger to the handler for domain events.
- **Never log request bodies or PII** (this app captures health data — height/weight/demographics). Log counts, sizes, and outcomes, not values. Redact `authorization`/`cookie` headers.
- **Event naming:** `domain.action.outcome` (e.g. `record.created`, `record.list.failed`). Levels: error = unexpected/5xx, warn = rejected/4xx, info = completions, debug = detail. `LOG_LEVEL` env controls verbosity (default `info`; `silent` under test).

# Before you claim done — the finish-line gate

On **any** turn that produces a durable change — code, behavior, **or a committed doc/spec** — you may NOT declare done until, in the SAME turn, you have:
1. Re-read the original ask and listed what it required.
2. Run `npm test`, `npm run build`, and `eslint` **fresh**, and shown exit codes + pass/fail counts (not "should pass"). (Skip only when the change touches no code — e.g. a docs-only spec.)
3. Invoked `superpowers:verification-before-completion`.
4. For a **behavior change**, run a **live** check — Playwright driving bundled Chromium against the running app.
5. **Presented the evidence and confirmed with the human before the final claim/commit.** (Skip only for pure questions or trivial edits.)
6. Before merging: `superpowers:requesting-code-review`, then `superpowers:finishing-a-development-branch`.
7. **OPENED A PR.** If the change is committed, it MUST live on a branch that is **pushed** and has an **open `gh pr create` PR** against `main`. A local commit is NOT done — "done" for anything committed means a PR URL exists and has been handed to the human. Never end a turn with a committed-but-unpushed branch or a pushed branch without a PR. (This overrides any skill that says to stop at a commit.)
8. **CLEANED UP THE WORKTREE.** If the work was done in a worktree (`.claude/worktrees/…`), once the branch is pushed and the PR is open, REMOVE the worktree (`ExitWorktree` → `remove`; discarded local commits are safe because they live on the pushed remote branch). Never leave a dangling worktree behind — a pushed PR branch makes the local worktree disposable. Do not report "done" with a stale worktree still on disk.

# Skills to invoke

Mandatory. Invoke BEFORE touching code.
- Feature / bugfix / behavior change → `superpowers:test-driven-development`.
- Multi-step task (3+ steps) → `superpowers:writing-plans`.
- Design / "let's build X" → `superpowers:brainstorming` first.
- Debugging unexpected behavior → `superpowers:systematic-debugging`.
- Next.js routing / RSC / Route Handlers → `vercel:nextjs`. Caching / `use cache` → `vercel:next-cache-components`.
- Addressing review feedback → `superpowers:receiving-code-review`. Each comment is a sample — grep for the same pattern elsewhere and fix it everywhere.

# Writing docs & specs — no speculation, no slop

Rules learned from a real mistake made in this repo. Follow them:
- **Match the altitude of the ask.** "Define the structure" means directories and their purpose — NOT invented filenames, function signatures, or code snippets. Produce exactly what was asked and nothing more.
- **Never write things that don't exist.** Do not put files, functions, APIs, or example code into a doc unless they exist or have been explicitly decided. A future reader treats them as real and builds on the hallucination. If a detail is deferred, write "deferred to implementation" — do not invent it.
- **Document only what's decided.** A spec records settled decisions + rationale, not a guess at how it'll be built.
- **Prefer folding into AGENTS.md over a new spec.** Before creating a standalone doc, ask: is this small enough to live here? A tiny thing (a few dirs + a rule) in its own file becomes a second source of truth that drifts and invites hallucination. One source of truth wins; add a separate spec only when the content is genuinely large or self-contained.

# Project memory

All project knowledge — conventions, decisions, status — lives in THIS repo (`AGENTS.md` and `docs/`), never in agent-private (`~/.claude`) memory. This **overrides** the default `# Memory` system instruction for anything project-related. Learn something worth keeping? Put a rule/convention in `AGENTS.md` or a decision/status note in `docs/` in the same change.

# Git workflow

- **Always commit as `geliwer@gmail.com`** (name `aheliver`). Verify `git config user.email` before committing; set repo-locally if wrong. Do NOT author under any other email.
- **Never merge to `main` directly.** All changes land via a GitHub PR. No `git merge` into `main`, no `git push origin main`.
- **Always open a PR** with `gh pr create` when work is ready. Let the user merge from GitHub. **A commit without a pushed branch and an open PR is unfinished work** — the turn is not done until the PR URL exists (see the finish-line gate). This applies to docs/specs too, not just code.
- **Never force-push without explicit permission in the same turn.** Default: a new commit on top. If a force-push is genuinely needed, ASK first.
- **Controller owns all git in worktrees.** The main session runs every `git commit`/`push`/`checkout`/`gh pr`. Subagents may edit/test/build — never git mutations.
- **Remove the worktree when finishing.** After the branch is pushed and the PR is open, `ExitWorktree` → `remove` — the work is safe on the remote. Never leave a stale worktree in `.claude/worktrees/` after the work is done (see finish-line gate step 8).
- **Never trust a local `main`/`origin/main` ref — `git fetch origin` first** before claiming a diff is clean; diff against freshly-fetched `origin/main`.
- This repo squash-merges: find merged branches with `gh pr list --state merged`, not `git branch --merged`.
