# 0008 — A carry-over excess over the daily cap requires the admin's recorded validation

Date: 2026-08-20
Status: Accepted

## Context

Two rules of this business are both firm and, in one narrow case, incompatible.

- The daily cap is real, and [0006](0006-daily-cap-is-an-invariant-of-settled-amounts.md) makes it
  an invariant of settled amounts, enforced by the close gate.
- Nobody is denied a payment because the company forgot to record their day. That is why
  carry-over exists at all (`docs/DOMAIN.md` §7).

The case where they collide:

> A date closed under `EQUAL_SHARE` with six people, each settled at the per-person maximum,
> consuming the whole daily cap. The amounts are frozen. Weeks later a seventh assignment for
> that same date is entered — someone who worked and was missed. The next close picks it up as
> carry-over. Calculated at the date's real `n` of seven, the newcomer earns a seventh share, and
> the date's true total is now above the cap.

The close gate cannot help. It resolves anomalies by correcting assignments, and there is nothing
here to correct: the seventh person's record is accurate, the other six are accurate, and their
amounts left the company weeks ago. Every party behaved correctly and the invariant still breaks.

The same shape has a worse variant: if the late assignment is the scheme trigger, a date settled
under `POSITION_RATE` becomes an `EQUAL_SHARE` date after the fact, and the frozen amounts belong
to a formula that no longer applies.

## Decision

The late assignment is calculated at the date's real `n` and paid. Frozen amounts are never
rewritten, never clawed back, and never recalculated.

The resulting excess cannot be settled silently. It requires the admin's explicit approval,
recorded in an append-only `cap_overrides` row carrying the period, the date, the approved
amount, the daily cap in force on that date, who approved it and when, and an optional note.

The cap in force is frozen into the row alongside the amount, for the same reason
`settled_amount` is frozen: a row read two years later must be legible without reconstructing
which rate version was active.

The governing reason is not arithmetic. The worker did the work. The recording mistake was the
company's, and an error the app could not prevent is the only thing that justifies exceeding the
cap.

## Consequences

**Makes easy:** carry-over keeps its promise. A person missed in one period is paid in the next
at the amount their day actually earned, with no clause about budget having run out.

**Makes hard:** the company can pay above its own daily ceiling, and the amount is not bounded by
anything except how many people were missed. The approval step is what keeps that visible: an
excess costs an admin a deliberate action and leaves a row explaining itself.

**The alternative that was rejected:** treating the cap as a per-date budget that settled amounts
consume, paying the late arrival whatever remains — which in the scenario above is zero. It keeps
the invariant perfectly and produces an unexplainable zero on the payslip of someone who worked a
full day and was forgotten by the company. That is precisely the outcome carry-over exists to
prevent, so preserving the invariant this way would defeat the rule it was meant to serve.

**Would make us revisit:** validated excesses becoming frequent rather than exceptional. A steady
trickle would mean assignments are routinely recorded late, and the fix for that is upstream — in
how and when the day is entered — not in a wider approval workflow.
