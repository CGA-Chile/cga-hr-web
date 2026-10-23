# 0019 — HR holds the admin role

Date: 2026-10-23
Status: Accepted

## Context

The app has three roles: `admin`, `editor` and `supervisor`. Until now HR held `editor`, the same
role as the two people who record the daily assignment, and the maintainer was the only `admin`.

Administration — employees, positions, rates, closes — is admin-only, on the screen and in RLS
(`private.is_admin()` on every insert and update of `employees`, `positions`, the rate tables and
`periods`). So HR could not add a new hire or deactivate someone who left, and had to ask the
maintainer, who is at the plant one day a week. The person who holds HR also runs the warehouse
and is the one who learns first that someone joined or left.

Three ways to give HR that access were weighed:

- **Promote HR to `admin`.** No code, no migration: a change to the user's `app_metadata`.
- **Let `editor` write `employees`.** One migration and a screen change. But `editor` is also the
  role of the two people who record assignments, and they would receive it too.
- **A fourth role between `editor` and `admin`.** Exact, but every policy and helper that names
  `editor` would have to learn it, for one user.

## Decision

HR holds the `admin` role. The role table in `docs/DOMAIN.md` §4 says so. The code and the
policies do not change.

## Consequences

- HR adds, edits and deactivates employees without waiting for the maintainer.
- HR also receives everything else `admin` can do: positions, rates, closing a period, changing an
  assignment on a paid day and validating a carry-over excess. That is deliberate — HR is who
  reports the close — but it means the admin-only lock on paid days now protects pay against the
  assignment recorders, not against HR. The change history still records every write, whoever
  makes it.
- There are two admins. The rates screen is the riskiest part of the panel: a new version applies
  from its effective date onward and changes what open days pay.
- Revisit if HR changes hands, or if an admin-only action is taken by mistake. The next step would
  be the fourth role, scoped to `employees`.
