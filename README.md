# CGA Bonus App

Internal web app for a cotton products manufacturing plant in Chile. It replaces the Google
Sheets grid the production supervisor used to record which worker was assigned to which
position each day, and it computes the daily carding-line bonus that HR reports at month close.

Roughly twenty employees, four users, one screen that matters. The interesting part is not the
scale — it is that a wrong number here means a real person is paid the wrong amount.

> **Status:** setting up. The repository currently holds documentation, decisions and tooling.
> The Next.js application has not been scaffolded yet.

## Why it exists

The bonus used to be a fixed rate per position, and calculating it meant counting cells in a
spreadsheet. Then a second scheme was introduced — when packing happens inline on the ACM
machine, every position on the line switches to an equal split with a daily ceiling. Deriving
that by hand, from a grid, once a month, turned out to be exactly as reliable as it sounds.

So the calculation moved into a pure, tested module, and the spreadsheet became an app.

## Stack

- **Next.js** (App Router) + TypeScript, strict, deployed on **Vercel**
- **Supabase** — PostgreSQL, Auth, Row Level Security
- **react-hook-form** + **Zod**
- **IndexedDB** for the pending-writes queue: the plant has intermittent connectivity, so
  writes are queued locally with a client-generated idempotency key and replayed on reconnect

No global state library. Four users and one screen of state do not need one.

## Design decisions worth knowing

Some choices here look wrong until you know the context. They are documented in
[`docs/adr/`](docs/adr/), and the short version is:

**Nothing blocks the user.** No modal alerts, no disabled save buttons, no validation that
refuses a write because the numbers look unusual. If a data-entry error produces a day total
above the cap, the app shows the real total and marks it — it does not silently clamp it. The
users have been spotting wrong totals on a spreadsheet for years; hiding the symptom would take
away the only error detection that already works.
See [ADR 0004](docs/adr/0004-daily-cap-applies-only-to-equal-share.md).

**Every screen opens read-only.** You press "Editar" to change anything, admin included. A
misclick costs someone money.

**Soft delete everywhere, and every unique index is partial** (`WHERE deleted_at IS NULL`).
Without that, deleting and re-creating the same day's assignment collides with the constraint.

**Amounts are integers in Chilean pesos, and no rate is hardcoded.** Rates live in the database,
versioned by effective date, so a rate change does not retroactively alter a period that has
already been paid.

**One Supabase project, which is production** — with a deliberately strict migration process to
compensate. See [ADR 0003](docs/adr/0003-single-supabase-project.md).

## Repository

```
CLAUDE.md                  Working rules for this codebase (also read by Claude Code)
CONTRIBUTING.md            Git workflow, PRs, CI, migrations, definition of done
docs/DOMAIN.md             Business rules, data model, mandatory test cases
docs/adr/                  Architecture decision records
.github/workflows/ci.yml   Lint, typecheck, test, build on every PR
.claude/                   Agent configuration and the git guard hook
```

This repository is public and the application is real, so the internal product document —
which carries actual bonus amounts and employee names — is not versioned.
[`docs/DOMAIN.md`](docs/DOMAIN.md) is its public counterpart: every rule and every test case is
there, with **example amounts** that preserve the structure of each rule but not the real
figures. See [ADR 0001](docs/adr/0001-public-repository.md).

## Getting started

Requires Node 20+, Docker (for the local Supabase stack) and the Supabase CLI.

```bash
git clone https://github.com/CGA-Chile/cga-hr-web.git
cd cga-hr-web
npm install

cp .env.example .env.local     # fill in from `npx supabase start` output

npx supabase start             # local PostgreSQL, Auth and Studio
npx supabase db reset          # apply migrations and seed
npm run dev
```

Development always runs against the local Supabase instance, never against the remote project.

```bash
npm run lint
npm run test
npx tsc --noEmit
npm run build
```

## Contributing

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) first. Short version: branch off `main`, commit in
[Conventional Commits](https://www.conventionalcommits.org/), open a PR, let CI pass, squash
merge. Nobody commits to `main` — including the maintainer, and including the agent.

## Language

Code, comments, commits and technical documentation are in **English**. The product domain
document and every string the end user sees are in **Spanish**, because the users are Chilean
and the whole point is that the screen reads like the spreadsheet it replaces. Position codes
(`RIETER`, `PACKING_ACM`, `ALIMENTADOR_RIETER`) stay in Spanish everywhere: they name real
machines and real jobs on the plant floor.

## License

Not currently licensed for reuse. Published for reference.
