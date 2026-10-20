# 0016 — The production and compliance bonuses are settled per period

Date: 2026-10-20
Status: Accepted

## Context

The plant pays two bonuses besides the carding-line bonus and the day rate, and HR has to report
them at the close, apart from each other and apart from the daily ones:

- **Production** _(bono de producción)_: a period amount spread evenly over the working days, paid
  for each working day the employee attended on a production position. Bodega, Mantención and
  Supervisor do not earn it.
- **Compliance** _(bono de cumplimiento)_: the same spread, over compliance positions (all but
  Mantención and Supervisor), less a fixed deduction for each strike — a late arrival or a Falta
  sin aviso — and nothing at all once the strikes reach a limit.
- A **reprimand** _(amonestación)_ given to an employee in a period voids both, for that period.

`docs/DOMAIN.md` §3 listed both bonuses as out of scope. Everything the app paid until now was a
daily amount: each date is calculated alone, with the settings in force on it, and settling stamps
each assignment with its frozen amount.

Neither new bonus is a daily amount. The share of a day depends on how many working days the
period has, which is known only once its end is final, and HR may move the end until the close.
Compliance is not even a sum of days: the deduction applies to the period total, with a floor at
zero and a cut-off at the limit.

## Decision

- Both bonuses are computed **per employee and per period**, by a pure module beside the daily one,
  and only the close freezes them.
- The divisor is the period's **working days**: Monday to Friday, not a holiday, and not a date HR
  gave a day rate. One rule decides both "is it a day-rate weekday" and "does it count", so they
  cannot drift apart.
- Production is `floor(amount × days attended / working days)`, so attending every working day
  earns exactly the announced amount. Compliance is the same less the deductions, floored at zero.
  An incomplete day counts as attended: being late costs the daily bonus and a strike, not the day.
- A period uses the settings version **in force on its end date**. A change the admin makes takes
  effect on the whole open period, retroactively, which is what HR asked for. A version starting
  after the end leaves the current period alone.
- At the close, the period freezes its terms (working days and the four amounts), and each employee
  gets a settlement row per bonus with the days counted, the strikes, whether a reprimand applied,
  and the amount. Every assignment counted is stamped, one column per bonus.
- **Carry-over** works as for the daily bonus: an attended day of a closed period entered late is
  paid in the next close, at its own period's frozen terms. The amount is the period's total
  recomputed with the extra days, less what was already paid, never below zero. Strikes and the
  reprimand stay as they were frozen: nothing recorded after a close deducts retroactively. Those
  changes show up as review items instead.
- Which positions count is data: two flags for the bonuses and one for the absence that is a strike,
  like `bonus_eligible` and `triggers_equal_share` before them (`docs/adr/0007`).

## Consequences

- During the period the amounts are estimates "with the current end date". The sheet keeps showing
  only daily amounts, and the person's panel labels the period bonuses as estimates.
- A change to an assignment counted only for a period bonus — a Bodega day in a closed period —
  stays writable by editors. Only the carding settlement locks a row to the admin; the change
  shows up in the review list. Locking it too would have touched every write path for a case that
  a review item already covers. Revisit if those review items become common.
- A period closed before the first version with period-bonus amounts has no frozen terms, and its
  days are never paid production or compliance, not even as carry-over.
- The close report gains a column per bonus, and the download shows only those amounts and the
  total. The carry-over is folded into each bonus, and the breakdown stays in the web view.
