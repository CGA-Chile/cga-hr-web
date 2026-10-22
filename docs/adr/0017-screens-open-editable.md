# 0017 — Screens open editable

Date: 2026-10-22
Status: Accepted

## Context

From the first version, the sheet and the day view opened locked. Every role, admin included, had
to press «Editar» before changing anything, on the argument that a misclick pays someone the wrong
amount. The mode lived in the URL (`?modo=editar`) and only decided which controls the screen
drew. No server action read it and no RLS policy knew of it: every role that could write with it
could write without it.

Since then the sheet became the main screen, and on it a click on the grid writes nothing. It opens
the cell panel, and a position is saved only when a button in the panel is chosen: two deliberate
actions, never one. What actually protects pay already lives elsewhere and does not depend on the
mode:

- A paid date can be changed only by the admin, enforced by RLS.
- Every write goes through the history trigger: who, when, from what to what.
- A change to a settled date, or a new one inside a closed period, is a review item.
- The close gate stops a period closing over a correctable anomaly.

In daily use the button cost a click on every visit and a sentence on every panel telling the user
to go back and press it.

## Decision

Screens open editable. The «Editar» / «Terminar edición» toggle, the read-mode notice and the
`modo` query parameter are removed. Everything the mode used to reveal is always drawn: the position
picker, the incomplete-day marks, the note form, «Asignar por rango», the column copy, the holiday
form for HR and the admin, and the reprimand form while the period is open. The day view keeps its
inline position select in the grid.

Permissions are untouched. What each role may write is still decided by RLS and by the role checks
that already gated a control (the holiday form, the reprimand, the period end).

An old link carrying `?modo=editar` still works: the parameter is ignored.

## Consequences

**Makes easy:** recording the day takes one click less, and the panel says what to do instead of
what to press first.

**Makes hard:** the day view's inline select writes on a single choice, so a stray selection there
changes a position. It is recorded in the cell's history and shown as modified, and it is undone
like any other edit, which was judged enough.

**Revisit if** wrong positions start appearing that nobody meant to enter. The first response would
be to move the day view to the sheet's pattern (click opens a panel, the panel saves), not to bring
the toggle back.
