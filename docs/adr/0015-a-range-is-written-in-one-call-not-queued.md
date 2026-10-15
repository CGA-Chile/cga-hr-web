# 0015 — A range is written in one call, not queued

Date: 2026-10-15
Status: Accepted

## Context

HR needed to assign one position to a person over a range of dates: a fifteen-day medical leave
that lands on a Wednesday of a week already filled with ACM, a holiday, a fixed post for a week.
Doing it cell by cell was fifteen clicks, and easy to get half done.

Every edit in the app goes through the pending-writes queue (`docs/DOMAIN.md` §10): one operation
per cell, saved on the device, replayed oldest first, each with its own `op_id`. Expanding a range
into one queued operation per date would have reused all of that, but a network failure in the
middle of the replay leaves the range half written: the first days on leave, the rest still on
ACM. The queue stops at the first failure by design, so the half state can last until the next
retry, and the sheet shows it as if it were true.

A range is also a write that only makes sense after reading. The user has to see which dates it
replaces before pressing the button, so the panel reads those dates from the database first, which
needs a connection anyway.

## Decision

A range is written by one database function, `apply_assignment_range`, in one call: every date or
none. It runs as the caller under the same RLS as a single cell and writes through the same history
trigger. It skips a paid date the caller may not change instead of failing the whole range, and
answers what each changed date held before. It never empties a paid date, not even for the admin:
the settlement lives on the row, and an undo that recreates the row could not bring it back.

It does not go through the queue. Without a connection the panel says so and saves nothing.

Undo is the exception: it is a set of ordinary cell edits built from that answer, queued with
`enqueueMany` so they are replayed together. Each one restores a single cell, so a partial replay
is a set of correct cells, not a broken range, and the queue's guarantees apply.

The rules for each date (a date with the position stays as it is; a replaced date loses its
incomplete-day marks; a note is changed only when a new one is given) live twice: in the SQL
function, which decides, and in `rangePlan.ts`, which previews. Both have tests on the same cases.

## Consequences

- A range is atomic and cannot be left half applied by a bad connection.
- Assigning a range needs signal. At the plant this is an office task done by HR, on a computer,
  so it is acceptable; a supervisor on the floor without signal still edits cell by cell.
- The preview and the function can drift apart. If the rules change, both change, and the tests on
  both sides say so.
- If ranges turn out to be needed offline, the queue would need an operation that carries a range
  and is applied by this same function. Revisit then, not before.
