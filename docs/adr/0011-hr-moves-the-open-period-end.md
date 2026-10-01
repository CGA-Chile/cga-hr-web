# 0011 — HR moves the open period's end; closing opens the next period

Date: 2026-10-01
Status: Accepted

## Context

BBS, the external accountant, fixes the date each bonus period ends. Usually it is the 24th, but
not always: if the accountant closes on the 28th, the period must end on the 28th. HR is the team
that receives that date and enters it in the app.

Until now only the admin could touch periods. Each period was created by hand, and its end could
change only while it was the latest one. The historical import created three open periods in a
row, so in practice none of the earlier ones could move.

## Decision

- Editors (HR) and the admin may change the end of an open period through
  `public.set_period_end`. It is a `security definer` function that updates `end_date` and nothing
  else. Direct `update` on `periods` stays admin-only, so an editor cannot rename, reopen or close
  a period by hand.
- The existing contiguity trigger is unchanged. A start never moves, and only the latest open
  period's end can move. The accountant's rule, "the next period starts the day after the previous
  close", is exactly what that trigger already enforces.
- `close_period` creates the next period in the same transaction, starting the day after, unless
  a later period already exists. The app proposes the next end (the usual 24th) and its name; HR
  corrects the end later if the accountant picks another date.
- One open period at a time is a property of the flow, not a database constraint:
  - The create form only appears when no period is open.
  - Closing creates exactly one successor.

  A hard constraint would have rejected the three open periods that production already has from
  the historical import. Overlaps and gaps, which are what could actually misplace money, stay
  impossible at the database level.
- Closing stays admin-only.

## Consequences

- HR can follow the accountant without asking the admin. Moving the end never changes an amount,
  because nothing in an open period is settled yet.
- The `close_period` signature changed. The code that calls it and the migration have to ship
  together: close no period between merging and applying the migration.
- If several periods are ever open at once again, only the last one's end can move. To revisit
  this, the earlier ones would have to be closed, or their ends would have to cascade into their
  successors' starts.
