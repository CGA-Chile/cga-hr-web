# 0006 — The daily cap is an invariant of settled amounts, not of computed ones

Date: 2026-08-20
Status: Accepted

Extends [0004](0004-daily-cap-applies-only-to-equal-share.md), which is not superseded: its
decision about what happens *during* the month still holds.

## Context

ADR 0004 read the two source documents as contradicting each other and resolved the conflict in
favour of the screen specification: the cap is a parameter of the `EQUAL_SHARE` formula and
nothing more. That reading is right about the month and wrong about the year. It leaves the cap
with no enforcement at any point, and the business does mean it — the four rate-bearing
positions sum to exactly the cap by construction, which is not a coincidence but a budget.

The two statements the documents make are both true; they describe different moments.

- "The company never pays more than the cap in a day" is about money that leaves the company.
- "A total above the cap must be visible so the user fixes it" is about a number on a screen
  during data entry.

An over-cap total under `POSITION_RATE` has exactly one cause: a rate-bearing position with more
than one occupant. That is a data-entry error with a correct answer — one of the two people
belongs somewhere else — but the app has no way to know which, and 0004 correctly refused to
guess. What 0004 did not consider is that the app does not have to guess *and* does not have to
give up. It can wait for the one moment when a person is already looking at the whole period and
ask them.

## Decision

The daily cap is an invariant of what is **settled**, enforced by a person at close.

**During the period — unchanged from 0004.** The calculation returns the real sum. Over-cap
totals are computed, displayed and left alone. Nothing is clamped, nothing is redistributed, no
write is refused. Anomalies are marked passively, and a standing list of dates carrying an
anomaly is reachable from the day view so a mistake does not survive unseen until month end.

**At close — the close gate.** A period cannot be closed while any date it would settle still
carries a correctable anomaly. The admin resolves each one by moving the surplus person to
another position or leaving them unassigned; the app never picks. The gate covers every date the
close would settle, carry-over dates from earlier periods included, because those are the dates
being paid now and this is the last moment they can be corrected.

Closing is already restricted to `admin`. The gate therefore falls on the one role that can also
fix what it reports.

This is the only place in the app that refuses to proceed. Closing a period is a deliberate
administrative act performed a dozen times a year, not the daily data entry that
`CLAUDE.md` rule 5 protects.

## Consequences

**Makes easy:** the cap becomes true again without the calculation acquiring a special case —
`src/domain/bonus/` still returns the plain sum and still has no opinion about whether that sum
is acceptable. The enforcement lives in the close, where a human already is.

**Makes hard:** a close can now be blocked by a mistake made three weeks earlier by someone else,
and the person who has to fix it is not the person who made it. The standing anomaly list exists
to make that rare rather than routine.

**The alternative that stays rejected:** blocking duplicate occupancy at write time. 0004's two
reasons hold and a third was added. Two people cannot be swapped between positions without
passing through a state where one position has both. Writes are queued in IndexedDB and applied
on reconnect, so a server-side refusal fails hours later with the supervisor already gone — a
change that silently did not apply is worse than a number that is visibly wrong, because the
number can be seen and the absence cannot.

**Would make us revisit:** a period that cannot be closed on time because an anomaly cannot be
resolved — a person who genuinely worked a position that someone else also genuinely worked. The
gate assumes every anomaly has a correct answer. If that turns out to be false, the gate needs an
escape hatch of the kind [0008](0008-carry-over-excess-requires-admin-validation.md) defines for
the case where correction is impossible.
