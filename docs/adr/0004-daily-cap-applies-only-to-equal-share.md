# 0004 — The daily cap applies only to EQUAL_SHARE

Date: 2026-08-14
Status: Accepted — extended by [0006](0006-daily-cap-is-an-invariant-of-settled-amounts.md)

## Context

The two source documents contradicted each other. The glossary described the daily cap as an
absolute business rule — "the company never pays more than this per day for the bonus" — while
the screen specification used an over-cap total as its example of an error the user is supposed
to spot and fix, which is only possible if such a total can occur.

The calculation rules resolve it in favour of the second reading: `dailyCap` appears only inside
the `EQUAL_SHARE` formula, and nowhere in `POSITION_RATE`.

The contradiction has a narrow but real trigger. Under `POSITION_RATE` the four line rates sum
to exactly the cap, so a correctly filled day can never exceed it. It can only be exceeded when
a line position has more than one occupant — and nothing prevents that, because the unique index
is on `(date, employee_id)`, which stops one person holding two positions but not two people
holding one.

## Decision

The daily cap is a **parameter of the `EQUAL_SHARE` formula**, not a global ceiling.

Under `POSITION_RATE`, the day's total is the plain sum of the rates of the positions actually
filled. It is not clamped, not redistributed, and the write is not blocked. When the total
exceeds the cap, or when a rate-bearing line position has more than one occupant, the daily
summary marks it — passively and visibly, without a modal, without disabling anything.

The glossary in `CLAUDE.md` was corrected to match. Two test cases were added: one asserting
that `POSITION_RATE` returns an over-cap total unclamped, one asserting that duplicate occupancy
is harmless under `EQUAL_SHARE`.

## Consequences

**Makes easy:** the calculation stays a pure sum with no special cases, which is the property
that makes it testable. Errors surface as visibly wrong numbers, which is what the users are
already good at noticing — they have been reading these totals off a spreadsheet for years.

**Makes hard:** the app can display a total the company will not pay. This is accepted: the
report is a proposal that HR reviews, not an instruction to a bank, and a total silently
trimmed to the cap would hide the double assignment that caused it. Trimming would also require
deciding *whose* amount to reduce, which the app has no basis to decide.

**The alternative that was rejected:** blocking duplicate occupancy of line positions at write
time. It would make over-cap totals structurally impossible, but it contradicts the project's
governing UI principle — nothing blocks the user, anomalies are shown rather than prevented —
and it would reject a state the supervisor may have entered deliberately, mid-correction, on the
way to a valid one.

**Would make us revisit:** the report being consumed by an automated payment process rather than
by a person, at which point an unpayable total stops being informative and starts being a defect.
