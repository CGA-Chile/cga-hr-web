# 0009 — The agent applies migrations, with a backup and in the open

Date: 2026-08-20
Status: Accepted

Supersedes [0003](0003-single-supabase-project.md). The single-project setup is unchanged; only
rule 2 changes.

## Context

ADR 0003 rule 2 read: "Migrations are never applied by CI, and never by an agent." Asked where
that rule came from, the answer is here — no tool, harness or skill imposes it. It was a local
decision, and the ADR itself predicted it would be questioned: "Rule 2 is the one that matters
most and the one most likely to be eroded."

Re-reading it, the rule fused two things.

The **risk** 0003 identified is real and unchanged: one Supabase project, it is production, it
holds real payroll records, and there is no environment where a mistake is cheap. Nothing about
that has improved.

The **safeguard** it chose does not address that risk. A bad migration destroys the same rows
whoever runs it. The actor restriction looked like protection while the actual protection was
rules 3 through 6 — additive-first, `DROP` alone, forward-only, types regenerated — plus the
backup. Those are properties of the migration and the procedure. "Not the agent" is a property
of the typist.

The cost was real. This project is built jointly with an agent, and handing every schema change
back mid-flight breaks the loop exactly where the agent holds the most context about what the
migration is for and what the code around it expects.

## Decision

The agent may apply migrations to the Supabase project.

1. **A backup is taken first. Always.** Unchanged from 0003, and the safeguard the actor
   restriction was standing in for. It protects against a bad migration regardless of who ran it.
2. **The agent says what it is about to apply, and why, before applying it.** Applying a migration
   to production is destructive, hard to reverse and outward-facing — exactly the class
   `CLAUDE.md` rule 6 already requires be announced rather than performed quietly.
3. **CI still never applies migrations.** This half of 0003 rule 2 stands. The line that matters
   is attended versus unattended, not human versus agent: CI has no judgment and nobody is reading
   its output. An agent applying a migration in an unattended background job is the same failure
   and is equally out of scope here.

Rules 1 and 3 through 6 of 0003 carry over unchanged, restated so this file is readable alone:

- Day-to-day development runs against a local Supabase instance (`npx supabase start`).
- Additive-first: add, backfill, ship the code that reads it; remove what it replaced later.
- `DROP` statements travel alone, in a pull request that does nothing else, with a backup confirmed.
- Migrations are forward-only. A wrong migration is corrected by a new one.
- Types are regenerated in the same pull request, from a freshly reset local database.

## Consequences

**Makes easy:** a schema change and the code that depends on it move through one flow instead of
stalling at a handoff. The generated types stay in step with the database because the same actor
does both in the same pass.

**Makes hard:** the remaining protection is a backup and an additive-first habit, and both now
depend on the agent following them rather than on a human being structurally forced to. 0003 was
right that this is the rule most likely to erode; removing it makes the erosion cheaper, and the
announcement in rule 2 above is what keeps it visible.

**The alternative that was rejected:** keeping the restriction and routing schema changes through
`/wizard`, which generates a script for a human to run. It preserves the handoff cost without
buying protection the backup does not already provide, and the skill's own guidance says not to
use it for steps the agent could perform itself.

**Would make us revisit:** everything 0003 named — a backfill too large to verify by eye, or a
second developer needing a shared database — plus one new trigger that did not exist before: the
first migration applied that should not have been. One is enough.
