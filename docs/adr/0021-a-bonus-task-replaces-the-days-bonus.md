# 0021 — A bonus task replaces the day's bonus

Date: 2026-10-29
Status: Accepted

## Context

The plant pays a fixed amount to everyone who unloaded the goods truck on a given day. It does not
happen every day, and the people who do it come from their own positions: an operator feeding the
Rieter stops for a while, unloads, and goes back. HR wants the app to record it and pay it, and wants
the next case like it to need no deploy.

`docs/DOMAIN.md` §3 listed the truck bonus as out of scope. Every bonus until now came from the
position or from the date, and an assignment holds one position per person and date. That unique
index is structural: it is what guarantees nobody earns two daily bonuses.

## Decision

- A **bonus task** _(tarea con bono)_ is a mark on the cell, **on top of the position**. It is not a
  position. The person keeps their position on the sheet, so the period bonuses, which count days
  by position, do not change.
- It is the person's **only bonus that day**. For the carding line and the day rate they are treated
  exactly like an incomplete day: they earn nothing there, they do not count in the equal share's
  `n`, and they are not an occupant when looking for duplicates. The task pays its own amount even
  when it is lower than the rate it displaces. HR chose that knowingly: the cell says the task, and
  the amount is the task's.
- Late and early marks do not take a task away: the work was done. An absence cannot hold one; the
  database clears it, as it clears the marks.
- At most **one task per cell**. With "only bonus that day" there is nothing to decide between two.
- The amount is a fixed amount per person, not a share, kept in the settings version
  (`bonus_task_rates`, beside `bonus_position_rates`) and versioned by effective date like any rate.
  A new task takes its amount in every version, which changes nothing already paid since no date has
  it yet; a later change of amount is a new version.
- The task's amount is outside the line's total and outside the daily cap.
- The close settles tasks in their own table, `bonus_task_settlements`, **once per person and date**.
  A task marked on a day whose line amount is already frozen is carried over at the task's amount
  **less what that day already paid**, never below zero. A change of task on a date of a closed
  period is a review item.
- The catalogue is data the admin edits. Editors and the supervisor mark tasks; the supervisor sees
  the task, never its amount (`docs/adr/0013`).

## Consequences

- Nobody is paid two daily bonuses: the line pays the task holder zero, and the settlement table is
  unique per person and date. The carry-over rule extends the same guarantee to a task marked after
  the line amount froze.
- A task that pays less than the rate it displaces costs the person money. That is an operating
  question for HR, not a defect, and the screen makes the amount visible.
- A day's pay now comes from two tables. The report and the close preview read both; a reader of
  `assignments.settled_amount` alone sees zero for a task holder.
- The task settlement does not lock the row to the admin: like a period-bonus day, a Bodega day with a
  paid task stays writable and later changes show up as review items.
- If a case appears where one person does two tasks in a day, or a task should add to the line rather
  than replace it, this decision has to be revisited, not bent.
