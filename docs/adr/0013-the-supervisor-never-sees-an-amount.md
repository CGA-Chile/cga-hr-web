# 0013 — The supervisor assigns people and never sees an amount

Date: 2026-10-08
Status: Accepted

## Context

The production supervisor helps assign people to positions every day and is the person who knows
who arrived late. They should not see what anyone earns: not the rates, not the daily totals, not
the period totals. Until now every member read everything, and the two roles were `admin` and
`editor`.

The repository is public and the `anon` key ships in the browser. Hiding amounts only on screen
would leave them one API call away for a signed-in supervisor.

## Decision

- A third role, `supervisor`. It writes assignments and late marks exactly like an editor, through
  the same policies and the same queued operation.
- `private.sees_amounts()` is true for `admin` and `editor`. The read policies on
  `bonus_settings`, `bonus_position_rates` and `cap_overrides` require it, and so do moving a
  period's end, marking holidays and acknowledging review items.
- The app never runs the calculation for a supervisor. The sheet, the day view and the notices
  list show duplicated positions, found by `findDuplicatedPositions`, which needs no settings.
  Closes, reports and review are not in their navigation and redirect them to the sheet; the
  report downloads answer 404.

## Consequences

- What the supervisor sees is exactly what they can act on: who is where, who was late, which
  position has two people.
- Not hidden: `assignments.settled_amount`, the frozen amount of a date already paid, and
  `calendar_dates.day_rate`, an amount HR set for one date. Hiding one column under RLS means
  splitting the table or revoking column grants for every role, for values that describe the past
  rather than the rates. Revisit if the supervisor ever gets a client other than this app, or if
  either column starts carrying something they should not know.
- An over-cap total without a duplicate is invisible to the supervisor. Under `POSITION_RATE` the
  rates are set so a full line sums to the cap, so such a total comes from a duplicate, which they
  do see.
