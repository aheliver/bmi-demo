# BMI App — Home Page & Data Schema Design

**Date:** 2026-07-16
**Status:** Approved (brainstorming)
**Scope:** defines the concrete database schema and the home-page behaviour/data flow. `AGENTS.md` stays the lean stack/architecture guide; the per-feature detail lives here.

## Context

Curebase coding interview app: capture demographic + health data (height/weight →
computed BMI), store it in PostgreSQL, render it in a paginated table on the home page.
The brief (`/.temp/Curebase Coding Interview June 2026.pdf`) is a **90-minute, "simple but
complete, functional not pretty"** build, and the evaluation rewards **clean layers of
responsibility, clean abstractions, validation/error handling, and the ability to explain
every choice and the alternatives considered.** The stack is fixed by `AGENTS.md`.

This design covers two things: (1) the database schema, and (2) the home page behaviour
and data flow. **Filtering and sorting are explicitly out of current scope** (the query
surface is shaped so they slot in later without rework).

## Guiding decision: where derived values live

> **Mechanical, lossless transforms → the database. Business logic → the domain layer.**

- **Unit conversion** (kg↔lb, cm↔in) is a fixed physical constant with no business rules,
  so Postgres owns the canonical columns as **generated STORED columns** — always
  consistent with the source, indexable, never written by the app.
- **BMI** is business logic (plus category classification), so it lives in a **pure,
  unit-tested `computeBmi` in the domain layer** and its result is stored.

Because BMI is computed from the **as-entered** values via the CDC per-unit formula
(below), it never reads the canonical columns — the two derivations are independent, so
there is no ordering/double-computation problem between them.

## BMI formulas (CDC, from the brief)

- **US / Imperial:** `BMI = weight(lb) / height(in)² × 703`
- **Metric:** `BMI = weight(kg) / height(m)²`

`computeBmi` selects the formula matching the entered unit system and returns BMI rounded
to one decimal. Category thresholds (`classifyBmi`) are domain logic and unit-tested at the
boundaries.

## Data model

Two tables with a `participant 1 —— 1 contact` relationship. Contact details (PII, and the
data most likely to change) are extracted so they mutate independently and are isolated
from the health metrics.

### `participant`

| Column          | Type              | Notes |
|-----------------|-------------------|-------|
| `id`            | serial PK         | Integer id — clean JSON, ample for this app. |
| `first_name`    | text NOT NULL     | |
| `last_name`     | text NOT NULL     | |
| `dob`           | date NOT NULL     | Date of birth (date only). |
| `sex`           | enum(`male`,`female`) NOT NULL | |
| `weight_value`  | numeric(7,3) NOT NULL | Exactly as the user entered it. |
| `weight_unit`   | enum(`kg`,`lb`) NOT NULL | |
| `height_value`  | numeric(6,2) NOT NULL | Exactly as the user entered it. |
| `height_unit`   | enum(`cm`,`in`) NOT NULL | |
| `weight_kg`     | numeric(9,4) **GENERATED ALWAYS AS … STORED** | DB-derived canonical weight. |
| `height_cm`     | numeric(6,2) **GENERATED ALWAYS AS … STORED** | DB-derived canonical height. |
| `bmi`           | numeric(4,1) NOT NULL | Domain `computeBmi()`, written at insert. |
| `created_at`    | timestamptz NOT NULL DEFAULT now() | |
| `updated_at`    | timestamptz NOT NULL | |
| `deleted_at`    | timestamptz NULL   | Soft-delete marker — **designed, not wired** (no delete endpoint yet). |

Generation expressions:

```sql
weight_kg GENERATED ALWAYS AS (
  CASE weight_unit WHEN 'kg' THEN weight_value ELSE weight_value * 0.45359237 END
) STORED
height_cm GENERATED ALWAYS AS (
  CASE height_unit WHEN 'cm' THEN height_value ELSE height_value * 2.54 END
) STORED
```

Prisma 7 does not manage generated columns in its schema DSL, so these two columns are
added via a hand-authored migration and their Prisma fields are read-only (excluded from
create/update inputs).

### `contact`

| Column           | Type              | Notes |
|------------------|-------------------|-------|
| `id`             | serial PK         | |
| `participant_id` | int FK → `participant.id`, UNIQUE, NOT NULL | 1:1. |
| `phone`          | text NOT NULL     | Stored in **E.164** always (e.g. `+14155552671`). |
| `email`          | text NOT NULL     | |
| `created_at`     | timestamptz NOT NULL DEFAULT now() | |
| `updated_at`     | timestamptz NOT NULL | |
| `deleted_at`     | timestamptz NULL  | Soft-delete marker (designed, not wired). |

Room to add `address` later without touching `participant`.

### Indexes

- `participant(bmi)` — supports the future Min/Max-BMI filter shown in the brief.
- `participant(created_at)` — paginate newest-first without a full sort at scale.
- `participant(deleted_at)` — filter to live rows once soft-delete is wired.
- `contact(participant_id)` — the join / FK.

## Numeric types

- **Storage:** Postgres `numeric` (Prisma `Decimal`) for all measurements — exact, no
  binary-float error. Never `float`/`double` for stored measurements.
- **Transport / domain:** convert `Decimal → number` at the API boundary. Values here are
  ≤7 significant digits; a JS `number` renders them exactly at display precision, and the
  exact value is preserved in Postgres. decimal.js is not carried into the domain — `number`
  is sufficient and keeps the domain dependency-free.

## Unit handling & display

- Each measurement is stored **as entered** (`value` + `unit`) plus the DB-generated
  canonical column.
- The home page header has a **paired Metric ↔ Imperial system toggle** (Metric = kg + cm,
  Imperial = lb + in) — one control, not two independent unit switches.
- Toggle state lives in a **cookie**: the server reads it during SSR so the first paint is
  in the right system (no flash), it persists across reloads, and flipping it is a pure
  client-side re-render (formatting only) — **never a refetch**, and not part of the query
  key.

## Home page & data flow

- **Route `/`.** Static shell (header + footer + FAB chrome) is cacheable via Next 16 Cache
  Components. The **table is the only dynamic island.**
- **SSR + hydration:** the server prefetches page 1 of the records query with React Query,
  `dehydrate`s it, and hands off via `<HydrationBoundary>`; the client island reads it with
  `useQuery`. (Per `AGENTS.md`: hydration, never an `initial` prop.)
- **Table columns:** Full name, DOB (as a date), Height, Weight, BMI, Date created. Height
  and Weight render in the system the header toggle selects. Sex, phone, and email are
  stored but not shown in the table.
- **Pagination:** offset-based, **20 rows/page** default. `page` (and `pageSize`) live in
  the URL via **nuqs** and form the React Query key — shareable, back-button-safe. No
  cursor/infinite pagination.
- **FAB:** a single bottom-right `+` Add button. It opens nothing yet — the add popup is a
  separate task.
- **Footer:** minimal placeholder (app name / copyright).

## API

- `GET /api/records?page=&pageSize=` → `{ data, total }`. `data` is **participant rows
  only** (the table shows no contact fields) — `contact` PII is deliberately **not** joined
  into the list response. `total` drives the pager. Route handler is HTTP-only (parse +
  Zod-validate, call a use case, map errors to status codes).
- `POST /api/records` (create) is defined by `AGENTS.md`; its request shape is deferred to
  the add-feature task. This home-page task needs only `GET`.

## Seed data

~60 mock participants (each with a contact) via a Prisma seed script, so pagination is
visibly exercised (3 pages at 20/page) with a spread of BMI values.

## Libraries to add

- **`libphonenumber-js`** — normalize user-entered phone input to E.164 before storage
  (the industry-standard normalizer). Zod additionally validates the E.164 shape
  (`^\+[1-9]\d{1,14}$`) on both client and server.

## Out of scope (this design)

- Filtering and sorting (query surface shaped for them; not built now).
- The add popup / `POST` request shape (separate task).
- Auth (per the brief and `AGENTS.md`).
- `address` on `contact`, and Update/Delete endpoints (schema leaves room; not wired).

## Alternatives considered (for the interview explain-your-choices bar)

- **Store both kg and lbs as plain columns** — rejected: two sources of truth for one fact,
  drift risk, doubled write logic. The DB-generated canonical column gives the same
  physical presence without drift.
- **Store canonical only, convert on read for everything** — viable, but loses the exact
  original the user typed. We keep the as-entered value alongside canonical.
- **BMI as a generated column** — rejected: Postgres forbids a generated column referencing
  other generated columns, so it would re-inline the unit conversions (duplicated
  constants), and it would move business logic out of the tested domain layer.
- **Single flat table** (matches the brief's screenshot) — viable and simpler, but mixes
  PII/contact with health metrics; the 1:1 split isolates PII and lets contact data change
  independently, which reads well for a medical-data company.
- **Unit toggle in URL (nuqs) or localStorage** — rejected in favour of a cookie so SSR
  renders the correct system on first paint with no flash.
