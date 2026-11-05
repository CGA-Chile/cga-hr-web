# 0022 — Workera is the source of truth for attendance

Date: 2026-11-05
Status: Accepted

## Context

The plant's fingerprint clock runs on Workera, which is also the company's legal attendance record.
Until now the app recorded attendance only through what people typed: a position meant the person
came, and a supervisor marked late and left early by hand. Those marks cost money. An incomplete day
loses the day's bonus, and a late arrival also deducts from the compliance bonus. Supervisors miss
late arrivals that the clock does not.

`docs/DOMAIN.md` §3 listed schedule control and integration with any external system as out of scope.

Workera's API exposes clockings, schedules, special permissions and employees. It does not expose
computed lateness, tolerance or webhooks, and it serves clockings 20 to a page, slowly. The same key
that reads can also write: `PUT /employee` erases any field left out of the body.

A first read of real data showed that clockings and schedules often disagree, and that the
disagreement would have cost pay on a large share of days had it been applied directly.

## Decision

- **Workera wins on attendance, and the app only reads it.** The client issues GET requests and has no
  code path that writes. Corrections to a clocking are made in Workera, by the people who have access.
- **Absences stay in the app.** Workera's special permissions are ignored: their classification is not
  reliable, and the sheet is often more current for leave and vacation.
- **Read once a night, not live.** Who did not come is only known once the day is over. Each night
  rereads the last 7 days, so corrections in Workera arrive, and an admin can reread any date range.
  Only the fields needed are stored: person, date and time, type and status. Inactive clockings do not
  count.
- **An attendance mismatch is an anomaly:** derived, never acknowledged, and gone when the sheet or
  Workera is corrected. It is the same mark on the cell for every reason, and the note states which.
- **Late and left early become derived from clockings** against Workera's schedule, within one
  tolerance in minutes that an admin sets, defaulting to 0. Changing it recalculates every unsettled day
  of the open periods. Nobody can mark late someone whose clocking is on time. An admin may pardon a
  mark, one at a time or in bulk by date, with a mandatory reason, and sync does not put it back.
- **An incomplete clocking never produces a late or early mark.** It is a mismatch, because a forgotten
  fingerprint should not cost the bonus on its own.
- **Someone with no clocking and an empty cell gets an automatic absence** as Falta sin aviso, pending
  confirmation by a person. It deducts from the moment it is written. It is written only for someone
  active in both systems, with a schedule that date, on a date that is not a holiday, after a successful
  read. Sync only fills empty cells, so it never overwrites vacation or leave.
- **Mismatches, unconfirmed automatic absences and dates without a successful read all stop the close.**
  An admin can validate a mismatch that cannot be corrected, with a mandatory reason, the same way as a
  validated excess. Settled days are never changed by sync; they only show the mismatch.
- **Two stages, each with a start date an admin configures.** Stage 1 shows mismatches and touches
  neither pay nor the close. Stage 2 writes marks and automatic absences and arms the close gate, from
  the start of a future period.
- **People are matched by RUT,** with a mapping an admin confirms. The app never creates or deactivates
  an employee on its own. Workera's `code` is not used because it can change and does not always match
  the RUT.
- **Credentials stay in environment variables.** Serving another company would most likely mean its own
  deployment and its own Supabase project, not credentials typed into a screen. Nothing specific to one
  company's Workera account is hard-coded, so that path stays open.

## Consequences

- Attendance errors in Workera become pay errors, which is why Stage 1 exists: it exposes bad schedules
  and missing clockings before they can cost anyone money.
- The close can now be stopped by data only two people can fix, one of whom is on site once a week. The
  validation is the way out, and a period's close needs planning ahead for it.
- An automatic absence adds a recurring chore, because someone has to confirm it. Bulk confirmation
  exists for that reason. It also keeps the incentive to clean up Workera: someone who left but is still
  active there shows up with absences at every close.
- A person's day is decided by data from outside the app, so what was read has to be stored. It is also
  the evidence for a mark when someone disputes it.
- Assignments now have a writer that is not a person, so history has to say so.
- Revisit if the reads prove too slow for the nightly window, if Workera starts exposing corrections
  reliably, or if a second company is actually signed.
