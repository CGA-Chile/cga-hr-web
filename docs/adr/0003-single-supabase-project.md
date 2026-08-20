# 0003 — A single Supabase project, which is production

Date: 2026-08-14
Status: Accepted

## Context

The standard setup is at least two database environments: one for development and preview, one
for production. This project has one Supabase project, and it is production.

The reasons are practical rather than principled. There are four users and roughly twenty
employees; the operational load does not justify running two projects, and a second project is a
second thing to keep in sync, seed, and pay for. The Supabase CLI also provides a full local
database in Docker, which covers most of what a shared dev environment would.

The risk is not theoretical. With one project, a migration merged on Friday afternoon applies to
real payroll records. There is no environment where a mistake is cheap.

## Decision

One Supabase project, treated as production at all times.

The setup is only defensible if the process around it is stricter than usual, so:

1. **Day-to-day development runs against a local Supabase instance** (`npx supabase start`),
   never against the remote project.
2. **Migrations are never applied by CI, and never by an agent.** A human applies them by hand,
   after the pull request is merged, with a backup taken first. CI verifies that the code
   compiles against the committed generated types; it does not touch the database.
3. **Additive-first.** Add a column, backfill, ship the code that reads it. Removing what it
   replaced happens in a later, separate pull request.
4. **`DROP` statements travel alone**, in a pull request that does nothing else, with a
   confirmation that a backup exists.
5. **Migrations are forward-only.** There is no `down` migration. A wrong migration is corrected
   by a new migration, because by the time the error is visible, production data already has the
   shape the bad migration gave it, and running its inverse would destroy that data.
6. **Types are regenerated in the same pull request as the migration**, from a freshly reset
   local database. Types generated against a drifted local schema make `tsc` confidently wrong,
   which is worse than no typing at all.

Rule 2 is the one that matters most and the one most likely to be eroded. Applying migrations is
tedious and automating it is easy, which is exactly why it is written down.

## Consequences

**Makes easy:** one connection string, one dashboard, one set of secrets, no environment drift,
no cost. Local development is fast and fully offline.

**Makes hard:** there is no place to rehearse a risky migration against realistic data. The
mitigation is the additive-first rule and the backup, both of which depend on a human following
them.

**Accepted risk:** the window between merging a migration and applying it is a window where
`main` is deployed but the database does not match it. Keeping that window short — apply
immediately after merge — is part of the process, not an optimisation.

**Would make us revisit:** the first migration that requires backfilling a table large enough
that it cannot be verified by eye, or a second developer who needs a shared database to work
against. Either one justifies a separate development project, and this ADR gets superseded.
