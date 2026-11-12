# 0023 — Workera writes the incomplete-day marks

Date: 2026-11-12
Status: Accepted

## Context

Stage 1 of the Workera integration (`docs/adr/0022`, #80) reads the fingerprint clock each night and
only *shows* attendance mismatches on the sheet. It touches no pay.

Stage 2 begins with the late and left-early marks (#81). From a date the admin sets
(`attendance_settings.applies_from`), these marks stop being buttons on the cell panel and are
derived from the day's clockings compared with the person's Workera schedule, plus a tolerance in
minutes. They change pay: an incomplete day earns no carding bonus and a late day is a compliance
strike (`docs/DOMAIN.md` §5, §5b).

Three questions had no obvious answer:

1. Are the derived marks **stored** on the assignment, or **derived on read** like the mismatches?
2. The marks are written by the system, not a person. How does the history show that?
3. **When** is a mark written — only by a background pass, or also the moment a position is assigned?

## Decision

**The marks are stored on `assignments.late` / `left_early`, written by the system.** The bonus
calculation, the settlement freeze and the review list all read the stored booleans; a day's pay and
its audit trail must not depend on re-deriving from clockings at read time. This also means a closed
period keeps exactly the marks it settled, frozen like every other settled value.

**Authorship is an explicit column, `assignment_history.source` (`MANUAL` | `WORKERA`)**, set through
a transaction-local flag (`app.history_source`) that the history trigger reads. We rejected using
`changed_by IS NULL` as the signal: an admin-triggered reread or tolerance change runs as the admin,
with a non-null `changed_by`, yet the mark is still system-derived. Only a column dedicated to the
question answers it in every path.

**The derivation rule lives twice**, in `src/domain/attendance/marks.ts` (`deriveMarks`, pure and
tested) and in `private.derive_attendance_marks` in SQL, because the write path runs inside the
database. They change together, exactly as `dayRateOn` and `private.is_day_rate_date` do.

**A mark is written at two moments:**

- **At assignment time.** `apply_assignment_operation` derives the marks for a work day the stage
  covers, in the same write that assigns the position, so the sheet is correct immediately — even
  for a date entered late whose clockings were already read. This write is attributed `MANUAL`: a
  person made it, and `changed_by` is that person.
- **By `recompute_attendance_marks`.** After a Workera read (over the range it covered) and after the
  admin changes the tolerance or the stage date (over the open periods), the system re-derives and
  writes only the marks that changed. These rows are attributed `WORKERA`.

A user write leaves the mark already equal to what Workera would derive, so the next recompute is a
no-op on that day and writes no `WORKERA` row. The `WORKERA` rows are therefore exactly the changes
the system made on its own — a correction read from Workera, or a tolerance change — which is what an
audit of "why did this mark move?" needs to see. The notice of a late (`late_notified`) stays a
manual choice in both paths: Workera says whether someone was late, not whether they warned.

## Consequences

Easy: pay and the review list stay correct without re-deriving at read time; the panel shows the
read value read-only; changing the tolerance re-prices the open periods in one call; the stage is a
date, not a deploy.

Hard: the rule now lives in two languages and the tests must keep them in step. Setting
`applies_from` to a date inside an open period would overwrite manual marks already entered for those
days, so the admin form guides toward the start of a future period, and recompute never touches a
settled day.

Revisit if a second system writer appears (automatic absences, #83, is the next one and reuses
`source`), or if the two derivations drift in a way the tests do not catch — at which point moving
the write-time derivation to call the SQL function directly would collapse them into one.
