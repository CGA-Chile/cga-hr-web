# 0007 — Positions carry their own scheme trigger

Date: 2026-08-20
Status: Accepted

## Context

`docs/DOMAIN.md` states the rule plainly: the list of bonus-eligible positions "is data, not
code", it lives in `positions.bonus_eligible`, and the calculation module "never compares against
a literal list of codes". Adding a bonus-eligible position must be a row, not a deploy.

The rule was unimplementable as written. Deriving the day's scheme requires knowing that
`PACKING_ACM` *specifically* forces `EQUAL_SHARE`, and no column carried that. `bonus_eligible`
does not: four other positions have it and none of them change the scheme. A pure module handed
the day's assignments and the positions' flags had no way to reach the answer, so it would have
had to compare against the string `PACKING_ACM` — the exact thing the rule forbids, in the one
module `CLAUDE.md` says cannot be wrong.

The gap was invisible because there is currently exactly one such position, which makes a
hardcoded code and a data-driven flag behave identically. They stop behaving identically the
first time the plant adds a second one, and at that point the difference is a deploy.

## Decision

`positions` carries a second flag:

```
triggers_equal_share boolean not null default false
check (not triggers_equal_share or bonus_eligible)
```

The calculation module receives it alongside `bonus_eligible` and derives the scheme from it. It
never sees a position code.

The check constraint forbids the one combination that has no meaning: a position that changes how
the whole line is paid while paying nothing itself. Making that state impossible to write is
cheaper than making the calculation defend against it, and it keeps `n` well defined.

## Consequences

**Makes easy:** the stated rule becomes true instead of aspirational. A new machine, a second
inline-packing arrangement, or a change of mind about which position flips the scheme is a row in
`positions`. The calculation module's inputs are now fully described by the flags it receives,
which is what makes it testable without a database.

**Makes hard:** two boolean columns on `positions` can drift into contradiction if someone edits
them from the dashboard instead of through a migration. The check constraint catches the only
combination that matters; the rest is covered by the standing rule that the schema is changed by
migration only.

**Would make us revisit:** a third scheme. Two booleans describe two schemes adequately; three
would want a single `scheme_trigger` column naming which scheme the position forces, and at that
point this ADR is superseded rather than amended.
