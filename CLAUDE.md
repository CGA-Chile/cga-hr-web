# CGA Bonus App

Internal app for CGA Chile, a cotton products manufacturing plant. It replaces the Google
Sheets grid used to record which worker was assigned to which position each day, and computes
the daily carding-line bonus that HR reports at month close.

Single repository. Next.js on Vercel, PostgreSQL on Supabase.

Chilean team. **Conversation and product documents in Spanish; everything inside the code in
English.** `docs/DOMAIN.md` is the versioned source of truth for domain rules and stays in
Spanish — this file, the code, and the database are in English.

@CONTRIBUTING.md

---

## Working rules (always)

1. **Language split, no mixing inside a file.**
   - **English:** variable, function, class, type, enum, file and folder names; comments and
     JSDoc; log and exception messages; table and column names; commit messages; this file;
     `CONTRIBUTING.md`; ADRs.
   - **Spanish:** conversation with the team, `docs/DOMAIN.md`, and every string the end user
     sees on screen.
   - A Spanish comment inside a `.ts` file is a bug to fix, even if the file already has others.
   - **Exception — domain proper nouns.** Position codes name real machines and real jobs on
     the floor: `RIETER`, `ACM`, `ENCAJADOR_ACM`, `ALIMENTADOR_RIETER`, `PACKING_ACM`,
     `FALU_N1`, `CARDA_VIEJA`. They stay in Spanish, uppercase, unaccented. Translating them
     would break the match with what people actually say in the plant, and the whole point is
     that the screen reads like the sheet it replaces. Everything *around* them —
     `Position`, `code`, `bonusEligible` — is English.

2. **No i18n framework.** One language on screen, Spanish. User-facing copy lives in
   `src/copy/` as typed constants, not scattered across components — the terminology has to
   stay consistent because the users are matching it against a sheet they know by heart.
   Neutral Spanish, short sentences, no technical jargon.

3. **Good programming practices.** Readable and maintainable over clever. Explicit names,
   short single-responsibility functions, no dead code, no comments explaining the obvious.

4. **TypeScript, strict.** Never `any`. Use `unknown` and narrow with type guards. Avoid `as`
   assertions unless justified. Prefer derived types (`ReturnType`, `Pick`, `Omit`, generics)
   over duplicated definitions. Database types are generated with
   `supabase gen types typescript` — never hand-write a table type that already exists there.

5. **DRY.** Before writing something new, look for it: components in `src/components/`, hooks
   in `src/hooks/`, helpers in `src/utils/`, Zod schemas in `src/schemas/`. If a block repeats
   twice, extract it.

6. **Git — what is allowed and what is not.** The full workflow is in `CONTRIBUTING.md`,
   imported above. In this repository you **may**, without asking each time: create a branch,
   commit to it, push that branch, and open a pull request.

   You may **never**, under any circumstance and regardless of instruction:
   - commit or push to `main`
   - `git push --force` / `--force-with-lease` on any branch
   - `git reset --hard`, `git rebase`, `git commit --amend` or any other rewriting of history
     that is already pushed
   - `git checkout .`, `git clean -fd`, or anything else that discards uncommitted work you
     did not write
   - merge a pull request, or apply a database migration to Supabase
   - commit anything on the "never commit" list in `CONTRIBUTING.md` §7

   If a task seems to require one of these, stop and say so. Do not find a way around it.

7. **Explain every change until it is understood.** Start with the technical explanation, in
   precise terms and not vague metaphors, then the reasoning behind the decision. The goal is
   to learn, not just to ship. This applies to the PR description as much as to conversation.

8. **Minimalist aesthetic.** Clear visual hierarchy, generous spacing, little colour, no
   ornament. Respect the existing theme tokens instead of introducing ad-hoc styles.

9. **This repository is public.** Never commit real employee data, real bonus amounts, `.env`
   files, or the Supabase `service_role` key. Amounts belong in the database, not in source —
   which is already rule "no hardcoded rates" below, and here is a second reason for it.
   `CONTRIBUTING.md` §7 has the full list.

---

## Domain glossary

The database and the code use these terms. The UI uses the Spanish column.

| English (code) | Español (UI) | Meaning |
|---|---|---|
| `Employee` | Trabajador | Someone on the payroll. |
| `Position` | Puesto | Where an employee works that day: a machine, bodega, aseo, or an absence marker. |
| `Assignment` | Asignación | One employee, one date, one position. The atomic record. |
| `carding line` | línea de cardas | Rieter + ACM. The only line that generates this bonus. |
| `inline packing` | packing en línea | Packing done on the ACM itself. Switches the bonus scheme. |
| `bonus scheme` | esquema de bono | `POSITION_RATE` or `EQUAL_SHARE`. Derived, never set by hand. |
| `POSITION_RATE` | Tarifa por puesto | Fixed amount per position. Default scheme. |
| `EQUAL_SHARE` | Reparto igualitario | Everyone on the line earns the same, capped. Triggered by inline packing. |
| `daily cap` | tope diario | The maximum the `EQUAL_SHARE` formula will distribute in one day. **It is an input to that formula only — it is not enforced over `POSITION_RATE`.** See below. |
| `Period` | Cierre / Período | The settlement window HR reports. Roughly the 25th to the 24th, not a calendar month. |
| `settlement` | liquidación | Stamping a bonus day as paid in a given period. |
| `carry-over` | arrastre | A bonus day from a closed period, entered late, paid in the next one. |

Do not invent alternative translations. If a term is missing here, ask before naming it.

---

## Database conventions

PostgreSQL on Supabase. Migrations live in `supabase/migrations/`, applied with the Supabase
CLI. Never modify the schema from the dashboard: if it is not in a migration, it does not exist.
Migration process and its constraints: `CONTRIBUTING.md` §6.

- Table names in English, plural, `snake_case`. Column names `snake_case`.
- **Every table carries the same base columns:** `id uuid`, `created_at`, `updated_at`,
  `deleted_at`. Soft delete everywhere — nothing is physically removed.
- `updated_at` is maintained by a trigger, not by application code.
- **Unique indexes must be partial: `WHERE deleted_at IS NULL`.** Without that, soft-deleting a
  row and recreating it collides with the constraint. This bites specifically on
  `assignments (date, employee_id)`.
- Row Level Security enabled on every table. No table ships without a policy. In a public
  repository with a public `anon` key, RLS *is* the access control model — a table without a
  policy is a table anyone on the internet can read.
- History tables are append-only and populated by triggers, never by application code, so that
  auditing does not depend on someone remembering to log.

---

## Bonus calculation

The calculation lives in `src/domain/bonus/` as **pure functions**: no database access, no
network, no dates read from the system clock. Input is the day's assignments plus the settings
in force; output is the amount per employee.

This is the one module that cannot be wrong — it decides what people get paid. Every rule in
`docs/DOMAIN.md` has a test, including the twelve mandatory cases. A change to these rules
without a test that fails without the change does not get merged.

Amounts are integers in Chilean pesos. No floats, no decimals, no currency library. Division
truncates downward so the `EQUAL_SHARE` distribution is never exceeded by rounding.

Bonus rates are **never hard-coded**, in source or in tests. They come from `bonus_settings`
and `bonus_position_rates`, versioned by effective date. Each day is calculated with the
settings in force on that date, so closed periods do not change when rates do. Tests build
their own fixture settings; they never import production values.

**The daily cap does not apply to `POSITION_RATE`.** It appears only inside the `EQUAL_SHARE`
formula. Under `POSITION_RATE` the day's total is the plain sum of the rates of the positions
that were actually filled, and if a data-entry error makes that sum exceed the cap, the
calculation returns the real sum. It is not clamped, and the write is not blocked. The daily
summary marks the day visually so the user sees it; correcting it is the user's job. Rule 5
in "UI patterns" explains why.

---

## Stack and structure

- **Next.js (App Router) + TypeScript**, deployed on Vercel.
- **Supabase** for PostgreSQL, Auth and RLS. Access via `supabase-js` with generated types —
  no second ORM layer on top.
- **react-hook-form + Zod** for forms and validation.
- **IndexedDB** for the pending-writes queue (see `docs/DOMAIN.md`, "Conexión intermitente").
- **No Redux.** Four users and one screen of state; server components plus local state are
  enough. Do not add a global state library without discussing it first.

```
src/
  app/          routes; pages only orchestrate
  sections/     composed views per feature
  components/   reusable, domain-agnostic
  domain/       business rules — pure, tested, no I/O
  schemas/      Zod
  types/        shared types and generated DB types
  copy/         user-facing Spanish strings
  utils/
  hooks/
```

---

## UI patterns

1. **Web first, adapts to mobile.** The main use is on a computer; the phone has to work well
   but does not drive the design.
2. **Read mode by default.** Screens open locked; the user presses "Editar" to change anything.
   This applies to every role, admin included. A misclick here means someone gets paid the
   wrong amount.
3. **Read mode is not a reduced version.** It browses previous months, opens the daily summary,
   the per-employee detail and the change history — identical to edit mode, minus writing.
4. **Side drawers, not floating modals**, for creating, editing or showing entity detail. Modal
   dialogs only for destructive confirmations, and a confirmation dialog never contains a form.
5. **Nothing blocks the user; anomalies are shown, not prevented.** No modal alerts, no
   disabled save buttons, no validation that refuses a write because the numbers look odd.
   Getting it right is the user's responsibility; the app's job is to make what happened
   visible and unmissable. The daily summary states which scheme is active and why, who earns
   what, and the day's total — and marks the total when it is above the daily cap, or when a
   line position has more than one occupant. A wrong total shows itself.
6. Copy is written for someone with limited digital literacy. "Sin conexión — 12 cambios
   guardados en este dispositivo", not "Sync error: queue length 12".

---

## Commands

```
npm run dev
npm run build
npm run lint
npm run test
npx tsc --noEmit

npx supabase start
npx supabase db reset
npx supabase migration new <name>
npx supabase gen types typescript --local > src/types/database.ts
```

`npx supabase db push` is deliberately absent: migrations are applied to production by a
human, not from an agent session. `CONTRIBUTING.md` §6.

---

## Before writing code

Read `docs/DOMAIN.md`. It holds the domain rules, the data model and the decisions already
made, and it is versioned — it is what a fresh clone gets.

`BRIEF-app-bonos-carda.md` is the internal product document. It has the real bonus amounts and
real names, so it is gitignored and exists only on the maintainer's machine. When it is
present, read it too: it is more detailed than `docs/DOMAIN.md` and it wins on any conflict.
When it is not, `docs/DOMAIN.md` is complete enough to work from.

When something is covered by neither, **ask instead of inventing** — this app computes wages,
and a plausible-looking guess is worse than a question.
