<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version (16.x) has breaking changes — APIs, conventions, and file structure may differ from your training data. Consult the `vercel:nextjs` skill (and the official v16 upgrade guide) before writing code. Heed deprecation notices.

Key shifts from prior versions:
- **Middleware is renamed to Proxy** — use `proxy.ts` at project root, not `middleware.ts`.
- **Turbopack is the default** dev bundler — no flag needed for `next dev`.
- **Tailwind CSS v4** — `@import 'tailwindcss'`, `@tailwindcss/postcss`, design tokens via `@theme inline { ... }`.
- **`params` and `searchParams` are Promises** — `await` them.
- **`PageProps<'/path'>` / `LayoutProps<'/path'>`** are global type helpers — no import needed.
- **Cache Components** (`use cache`, `cacheLife`, `cacheTag`, `updateTag`) — prefer over `unstable_cache`.
- **Server Components by default** — only mark `'use client'` for components that need state, effects, or browser APIs.
- **ESLint runs via the `eslint` CLI** (`next lint` was removed in v16).
<!-- END:nextjs-agent-rules -->

# Logging

- **pino, JSON to stdout, no transports in prod** (Vercel / Cloud Run ingest stdout natively; worker-thread transports break under serverless bundling). `pino-pretty` in dev only. pino is Node-only — load it behind a `NEXT_RUNTIME === 'nodejs'` guard so it stays out of edge bundles.
- **Never log bodies, file contents, or user filenames** — log byte sizes, counts, and formats instead. Redact `authorization` / `cookie` / `set-cookie` headers in the logger config.
- **Event naming:** `domain.action.outcome`. Levels: error = unexpected/5xx, warn = denied/rejected/timeout (4xx), info = completions and lifecycle, debug = polling + upstream detail. `LOG_LEVEL` controls verbosity (default `info`; `silent` under test).

# Testing — non-negotiable

Tests ship in the same change as the code. "I'll add tests later" means never; reviewers reject PRs without them.

**No useless tests.** A test earns its place only if it would FAIL when the implementation's real logic breaks. Do NOT write (and delete when you find):
- **Duplicates** — an assertion already made by another test.
- **Trivial pass-throughs** — a one-liner already covered transitively by a higher-level test.
- **Tautologies** — asserting only that a mock was called with what you just handed it, or that a fake returns what you configured it to return.
- **Config / metadata / schema mirrors** — asserting a declarative object (page `metadata`, `sitemap.ts` / `robots.ts` output, JSON-LD) equals the literals it's built from. A real regression surfaces in the build or a live check, not a unit assertion. (Real transformation logic like HTML-escaping is the exception — test that.)

When you touch a test file, remove the useless tests you find there, not just the ones you'd add.

**TDD:** Invoke `superpowers:test-driven-development` BEFORE implementation. Cycle: failing test → minimum impl → pass → refactor. For refactors with no new behavior, write a characterization test first.

# Before you claim done — the finish-line gate

On any turn with code or behavior changes, you may NOT declare done — no `result:`, no "complete" — until, in the SAME turn, you have:

1. Re-read the original ask and listed what it required.
2. Run `npm test`, `npm run build`, and `eslint` **fresh**, and shown the exit codes + pass/fail counts (not "should pass").
3. Invoked `superpowers:verification-before-completion`.
4. For a **behavior change**, run a **live** check against the running app (unit-green ≠ works in the browser).
5. Verified the diff against freshly-fetched `origin/main` (`git fetch origin` first — a stale local ref shows phantom changes).
6. Presented the evidence and confirmed with the human before the final claim/commit.
7. Before merging: `superpowers:requesting-code-review`, then `superpowers:finishing-a-development-branch`.

"Unit tests pass" and "the change is done" are different claims.

# Skills to invoke

Mandatory, not suggestions. Invoke BEFORE touching code.

- Feature / bugfix / behavior change → `superpowers:test-driven-development`.
- Multi-step task (3+ steps) → `superpowers:writing-plans`.
- Creative / design / any UI work → `superpowers:brainstorming`, then `frontend-design:frontend-design`.
- Debugging unexpected behavior → `superpowers:systematic-debugging`.
- Addressing review feedback → `superpowers:receiving-code-review`. **Each comment is a sample** — grep for the same pattern elsewhere and fix it everywhere.
- Next.js routing / RSC / Server Actions → `vercel:nextjs`. Caching / `use cache` / PPR → `vercel:next-cache-components`.

# Project memory

All project knowledge — conventions, decisions, status, learnings — lives in THIS repo (`AGENTS.md` and `docs/`), never in agent-private (`~/.claude`) memory. This **overrides** the default `# Memory` instruction for anything project-related. Learn something worth keeping? Put it in `AGENTS.md` (a rule/convention) or `docs/` (a decision/status note) in the same change. Agent-private memory is only for cross-project facts about the user's own working style.

# Git workflow

- **Never merge to `main` directly.** All changes land via a GitHub pull request — no `git merge` into `main`, no `git push origin main`. Push the feature branch and open a PR with `gh pr create`; let the user merge it. This applies even for trivial changes and docs.
- **Never force-push without explicit user permission in the same turn.** No `--force`, `--force-with-lease`, `commit --amend` + push, or `rebase -i` + push. Default: a new commit on top, push, done. If genuinely needed (removing a secret), ASK first.
- **Never trust a local `main` / `origin/main` ref — `git fetch origin` first.** A `git diff main` against a stale ref shows phantom changes. Verify against freshly-fetched `origin/main` or the PR diff on GitHub.
- **Find merged branches with `gh pr list --state merged`, not `git branch --merged`** (squash-merges never make the source branch an ancestor of `main`).
