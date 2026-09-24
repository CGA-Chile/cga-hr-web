# 0010 — The internal brief governs real amounts and names only

Date: 2026-09-24
Status: Accepted

## Context

`CLAUDE.md` told every reader that `BRIEF-app-bonos-carda.md`, the gitignored internal product
document, "wins on any conflict" with `docs/DOMAIN.md`.

The brief was written on 2026-08-14. The decisions of 2026-08-20 — the scheme trigger as data
(0007), the daily cap as an invariant of settled amounts with a close gate (0006), the validated
excess (0008), the `profiles` table, the 6-digit PIN, mandatory cases 13 and 14 — were recorded in
`docs/DOMAIN.md` and the ADRs and never carried back into the brief. The brief still derives the
scheme by recognising the code `PACKING_ACM` and has no close gate.

Read literally, the precedence rule reversed three accepted ADRs for anyone who had the brief on
disk, and did nothing for anyone who did not. Two readers of the same repository would build two
different calculations.

## Decision

The brief wins on the one thing only it holds: **real bonus amounts and real names**. On rules,
the data model and the test cases, `docs/DOMAIN.md` and the ADRs win.

This matches what ADR 0001 already said the public document had to be: genuinely complete, not a
stub pointing at a file strangers cannot read.

## Consequences

**Makes easy:** a fresh clone and the maintainer's machine build the same app. The rules have one
source, and it is versioned.

**Makes hard:** the brief is now allowed to be stale on rules, and it is. Anyone reading it for
context has to know that its rule sections are historical.

**Would make us revisit:** a rule decided in the brief first, by the business, and not yet in
`docs/DOMAIN.md`. The fix then is to carry it into `docs/DOMAIN.md`, not to restore the precedence.
