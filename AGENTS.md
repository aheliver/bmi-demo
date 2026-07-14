<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version (16.x) has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

Key shifts from prior versions:
- **Middleware is renamed to Proxy** — use `proxy.ts` at project root, not `middleware.ts`.
- **Turbopack is the default** dev bundler — no flag needed for `next dev`.
- **Tailwind CSS v4** — `@import 'tailwindcss'`, `@tailwindcss/postcss`, design tokens via `@theme inline { ... }`.
- **`params` and `searchParams` are Promises** — `await` them.
- **`PageProps<'/path'>` / `LayoutProps<'/path'>`** are global type helpers — no import needed.
- **Cache Components** (`use cache`, `cacheLife`, `cacheTag`, `updateTag`) — prefer over `unstable_cache`. Tool landing pages are RSC + cached; tool interactive flow is a client island.
- **Server data → client island: use React Query hydration, never prop-drill.** When a Server Component fetches per-request data for a client island that reads server state via React Query, prefetch it on the server and hand it over with `dehydrate` + `<HydrationBoundary>` (the pattern in `app/layout.tsx`); the island reads it with `useQuery` from the hydrated cache. Do NOT pass an `initial` payload as a prop — it desyncs from the query cache and forces you to reconcile two sources of the same state.
- **Server Components by default** — only mark `'use client'` for components that need state, effects, or browser APIs.
- ESLint runs via `eslint` CLI (not `next lint`).
<!-- END:nextjs-agent-rules -->

# Logging

- **pino, JSON to stdout, no transports in prod** (Vercel / Cloud Run ingest stdout natively; worker-thread transports break under serverless bundling). `pino-pretty` in Next.js dev only.
- **Next.js:** server-only singleton in `lib/logger.ts`; wrap API route handlers with `withRequestLog` from `lib/http/request-log.ts` — it emits one `http.request.completed` line per call (requestId from `x-vercel-id`, route, method, status, durationMs) and passes a request-scoped child logger to the handler for domain events. **Conversion service:** `src/logger.ts` + `hono-pino` middleware; enrich the per-request line with `c.get('logger').assign({...})`.
- **Server-render surface:** `instrumentation.ts` (root) logs any uncaught request-scoped error via `onRequestError` (`server.request.error`) and installs a process-level net in `register()` (`server.unhandled_rejection` / `server.uncaught_exception` for detached async — e.g. a rejected promise in `after()` work). Server Actions are wrapped with `withActionLog` from `lib/action-log.ts` (logs `server.action.failed` on throw + key domain events; preserves the action's signature). `proxy.ts` logs auth cookie-rotation failures. pino is Node-only, so `instrumentation.ts` hooks and `proxy.ts` load the logger via a dynamic `import()` gated on `NEXT_RUNTIME === 'nodejs'` — keeps it out of edge bundles.
- **Never log bodies, file contents, or user filenames** — log byte sizes, counts, and formats instead. `authorization` / `cookie` / `set-cookie` headers are redacted in the logger config.
- **Event naming:** `domain.action.outcome` (e.g. `download.denied.no-plan`, `conversion.job.failed`). Levels: error = unexpected/5xx, warn = denied/rejected/timeout (4xx), info = completions and lifecycle, debug = polling + upstream success detail (`/api/jobs/[id]` 2xx logs at debug — don't promote it).
- `LOG_LEVEL` env controls verbosity in both apps (default `info`; `silent` under test).


# Testing — non-negotiable

Tests ship in the same change as the code. "I'll add tests later" means never; reviewers reject PRs without them.

**Stack:** Vitest + happy-dom + @testing-library/react + @testing-library/user-event. `jest-dom` matchers loaded globally via `vitest.setup.ts`. Do not reintroduce `tsx --test` / `node:test`, and do not switch to jsdom (jsdom 27's CJS layer breaks under Node 20).


**No useless tests.** A test earns its place only if it would FAIL when the implementation's real logic breaks. More tests ≠ more coverage — redundant tests are maintenance cost with zero signal. Do NOT write (and delete when you find):
- **Duplicates** — an assertion already made by another test (e.g. the same boundary value checked twice).
- **Trivial pass-throughs** — a one-liner already covered transitively by a higher-level test (if `toolBadge()` already exercises `resolveTool()`, don't also unit-test `resolveTool()` in isolation).
- **Tautologies** — asserting only that a mock was called with exactly what you just handed it, or that a fake returns the value you configured it to return.
- **Config / metadata / schema mirrors** — asserting that a declarative SEO object equals the literals it's built from: page `metadata` (title/description/canonical/OG/Twitter/`robots`/`metadataBase`), `app/sitemap.ts` / `app/robots.ts` output, JSON-LD / schema builders. These restate the source; a real regression surfaces in the build or a live check, not a unit assertion. Do NOT unit-test them (real transformation logic like HTML-escaping is the exception — test that).

When you touch a test file, remove the useless tests you find there, not just the ones you'd add.

**TDD:** Invoke `superpowers:test-driven-development` BEFORE implementation. Cycle: failing test → minimum impl → pass → refactor. For refactors with no new behavior, write a characterization test first.

**Definition of done.** Before claiming complete:
1. Audit against the coverage table above — NOT your task list. Task lists get scoped to whatever you mentally committed to; the policy is the actual bar. List every file touched AND every untested file in the surrounding layer; for each, ask whether the policy requires a test.
2. Invoke `superpowers:verification-before-completion`. `npm test` exiting green tells you nothing about what you didn't test.
3. Treat plan completion and policy compliance as separate questions.

Found a gap? Write the missing tests in the same change, or stop and surface the gap explicitly — don't ship a partial result with "noted for later".

# Before you claim done — the finish-line gate

On any turn that includes code or behavior changes, you may NOT declare done — no `result:`, no "complete", no final claim — until, in the SAME turn, you have:

1. Re-read the original ask and listed what it required.
2. Run `npm test`, `npm run build`, and `eslint` **fresh**, and shown the exit codes + pass/fail counts (not "should pass").
   - Before claiming the diff itself is clean/complete, `git fetch origin` and verify against the freshly-fetched `origin/main` (or the GitHub PR diff) — a stale local `main` ref shows phantom changes and has produced false "done" claims. See Git workflow.
3. Invoked `superpowers:verification-before-completion`.
4. For a **behavior change**, run a **live** check — Playwright driving system Chrome (`channel: 'chrome'`) against the running app — because unit-green ≠ works in the browser.
5. **Presented the evidence and confirmed with the human before the final claim/commit.** This confirm step applies to turns with recent substantive changes; skip it only for pure questions or trivial edits.
6. Before merging: `superpowers:requesting-code-review`, then `superpowers:finishing-a-development-branch`.

"Unit tests pass" and "the change is done" are different claims — see Testing → Definition of done.

# Skills to invoke

Mandatory, not suggestions. Invoke BEFORE touching code.

**Workflow (process — invoke first):**
- Feature / bugfix / behavior change → `superpowers:test-driven-development`.
- Multi-step task (3+ steps) → `superpowers:writing-plans`.
- Creative / design work → `superpowers:brainstorming`, then dispatch the `design` subagent.
- Debugging unexpected behavior → `superpowers:systematic-debugging`.
- Before claiming complete → run the **finish-line gate** above (it includes `superpowers:verification-before-completion` + fresh evidence + a live check).
- Before merging → `superpowers:requesting-code-review`, then `superpowers:finishing-a-development-branch` (the finish-line gate's last step).
- Addressing review feedback → `superpowers:receiving-code-review`. **Each comment is a sample, not a single-site request** — grep the codebase for the same pattern in other files and apply the fix everywhere, then mention the broader scope in your reply.

**Domain:**
- Any UI/visual work → dispatch the `design` subagent (it invokes `pdfapp-design` + `frontend-design:frontend-design` for you).
- Next.js routing / RSC / Server Actions → `vercel:nextjs`. Caching / `use cache` / PPR → `vercel:next-cache-components`.
- Supabase → `supabase:supabase`. Postgres perf / RLS → `supabase:supabase-postgres-best-practices`.
- Stripe → `stripe:stripe-best-practices`.

# Logging

- **pino, JSON to stdout, no transports in prod** (Vercel / Cloud Run ingest stdout natively; worker-thread transports break under serverless bundling). `pino-pretty` in Next.js dev only.
- **Next.js:** server-only singleton in `lib/logger.ts`; wrap API route handlers with `withRequestLog` from `lib/http/request-log.ts` — it emits one `http.request.completed` line per call (requestId from `x-vercel-id`, route, method, status, durationMs) and passes a request-scoped child logger to the handler for domain events. **Conversion service:** `src/logger.ts` + `hono-pino` middleware; enrich the per-request line with `c.get('logger').assign({...})`.
- **Server-render surface:** `instrumentation.ts` (root) logs any uncaught request-scoped error via `onRequestError` (`server.request.error`) and installs a process-level net in `register()` (`server.unhandled_rejection` / `server.uncaught_exception` for detached async — e.g. a rejected promise in `after()` work). Server Actions are wrapped with `withActionLog` from `lib/action-log.ts` (logs `server.action.failed` on throw + key domain events; preserves the action's signature). `proxy.ts` logs auth cookie-rotation failures. pino is Node-only, so `instrumentation.ts` hooks and `proxy.ts` load the logger via a dynamic `import()` gated on `NEXT_RUNTIME === 'nodejs'` — keeps it out of edge bundles.
- **Never log bodies, file contents, or user filenames** — log byte sizes, counts, and formats instead. `authorization` / `cookie` / `set-cookie` headers are redacted in the logger config.
- **Event naming:** `domain.action.outcome` (e.g. `download.denied.no-plan`, `conversion.job.failed`). Levels: error = unexpected/5xx, warn = denied/rejected/timeout (4xx), info = completions and lifecycle, debug = polling + upstream success detail (`/api/jobs/[id]` 2xx logs at debug — don't promote it).
- `LOG_LEVEL` env controls verbosity in both apps (default `info`; `silent` under test).


# Project memory

All project knowledge — conventions, decisions, status, learnings — lives in THIS repo (`AGENTS.md` and `docs/`), never in agent-private (`~/.claude`) memory. This **overrides** the default `# Memory` system instruction for anything project-related: do not write project facts to `MEMORY.md` or the private memory dir. Learn something worth keeping about this project? Put it in `AGENTS.md` (a rule/convention) or `docs/` (a decision/status note) in the same change. Project status is git history + PRs, not a hand-maintained file. Agent-private memory is only for cross-project facts about the user's own working style.

# Git workflow

- **Always commit as `geliwer@gmail.com`.** Every commit in this repo must be authored with `user.email=geliwer@gmail.com` (name `aheliver`) — the identity linked to the `aheliver` GitHub account. Before committing, verify `git config user.email` returns `geliwer@gmail.com`; if not, set it repo-locally (`git config --local user.email geliwer@gmail.com`). Do NOT author commits under any other email (e.g. `a.heliver@lerpal.com`).
- **Never merge to `main` directly.** All changes land via a GitHub pull request. Do not run `git merge` into `main`, `git push origin main`, or any equivalent that fast-forwards `main` from a local branch.
- **Always open a PR.** When work is ready to integrate, push the feature branch and open a PR with `gh pr create`. Let the user (or required reviewers) merge it from GitHub.
- This applies even for trivial changes, docs, and "hotfixes". No exceptions without explicit user instruction in the same turn.
- **Never force-push without explicit user permission in the same turn.** No `git push --force`, no `--force-with-lease`, no `git commit --amend` followed by push, no `git rebase -i` then push. Default: a new commit on top, push, done — the PR diff stays linear and reviewable. If a force-push is genuinely needed (removing a secret, killing a broken merge), ASK first and wait for "yes". Convenience is not a reason. The history looking messier is not your call.
- **Controller owns all git in worktrees.** When work happens in a git worktree, the main session runs every `git commit` / `git push` / `git checkout` / `gh pr` itself. Subagents may edit files, run tests, builds, and installs — never git mutations. A bare `git` command in a subagent can land on the wrong branch (often `main`), because its CWD isn't guaranteed to be the worktree.
- **Never trust a local `main` / `origin/main` ref — `git fetch origin` first.** These refs go stale, and a `git diff main` against a stale ref shows phantom changes (once: hundreds of `.claude/` deletions that weren't real) and drives false "done" claims. Before you claim a branch's diff is clean or complete, `git fetch origin` and diff against the freshly-updated `origin/main` (`git diff origin/main --stat`), or read the PR diff on GitHub. This is part of the finish-line gate: the diff you verify must be the one reviewers will see, not a local snapshot.
- **Find merged branches with `gh pr list --state merged`, not `git branch --merged`.** This repo squash-merges, so the source branch never becomes an ancestor of `main` — `git branch --merged` misses every squash-merged branch. Use `gh pr list --state merged --json headRefName` to identify branches that are truly merged before deleting them.
