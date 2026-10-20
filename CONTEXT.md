# Carding-line bonus

The vocabulary the code uses to talk about who was assigned where, and what that pays.

`CLAUDE.md` holds the base entity vocabulary — Employee, Position, Assignment, Period. This
file does not repeat it. What follows are the terms that carry the rules: the ones where
picking the wrong word produces the wrong amount.

Every term is English in code and Spanish on screen. The Spanish label is the one the plant
already uses; it is not a translation choice left open to the author.

## The day's calculation

**Bonus scheme** _(esquema de bono)_:
Which of the three formulas a given date is paid under: `POSITION_RATE`, `EQUAL_SHARE` or
`DAY_RATE`. Derived from the date and its assignments, never stored and never set by hand.
_Avoid_: mode, type, variant

**Day rate** _(bono día no hábil)_:
The scheme for Saturdays, Sundays and holidays, and the amount it pays. Everyone who worked
that date earns the same fixed amount, whatever their position and whether or not it is on the
carding line. Position rates, scheme triggers and the daily cap play no part. The amount has a
default per kind of date and HR may change it for one date.
_Avoid_: weekend bonus, Saturday bonus, flat rate

**Holiday** _(feriado)_:
A date HR marks as such. It is paid under the day rate even when it falls on a weekday.
_Avoid_: day off, non-working day

**Worked** _(trabajó)_:
Assigned that date to a position that is not an absence, on a day that was not incomplete. Absences
are Falta con aviso, Falta sin aviso, Licencia and Vacaciones: together they cover every reason
someone does not show up. The notice is a record, not a rule: both faltas pay nothing.

**Retired position** _(puesto inactivo)_:
A position with `active = false`. Past cells keep showing it; the picker no longer offers it.
Falta was retired when it split by notice.
_Avoid_: deleted position, archived position

**Incomplete day** _(día incompleto)_:
An assignment marked late, left early, or both. The person stays on their position in the sheet,
but for the bonus they are not there: they earn nothing under any scheme, they do not count in
the equal share's `n`, and they do not count as an occupant when looking for duplicates — so
whoever covered for them is paid without a mark. Only someone who came has one: an absence
carries no marks.
_Avoid_: partial day, half day

**Late** _(atraso)_:
A mark of an incomplete day: arrived after the start. Recorded with notice or without; the notice
is for HR and does not change the pay. Marks from before the notice existed have none.
_Avoid_: tardiness, absence

**Left early** _(salida temprana)_:
A mark of an incomplete day: left before the end. No notice is recorded for it.
_Avoid_: early exit, absence

**Scheme trigger** _(disparador de esquema)_:
A position whose presence on a date forces `EQUAL_SHARE`. A property of the position, carried
as data, so the calculation never recognises a position by its code. Packing ACM and Mantas
Rieter are the two today.
_Avoid_: inline packing flag, special position

**Bonus-eligible position** _(puesto bonificable)_:
A position that earns the bonus when someone is assigned to it. Also data — the calculation
receives the flag and obeys it.

**Daily cap** _(tope diario)_:
The ceiling on what one date may **settle**. It is not a ceiling on what the calculation may
return: during the month an over-cap total is computed, displayed and left alone, because
hiding it would hide the assignment error that caused it. It does not apply on day-rate dates.
_Avoid_: limit, maximum, budget

**Supervisor** _(supervisor)_:
The role that assigns people to positions and marks incomplete days, and never sees an amount. It sees
the anomalies so it can fix them, with any figures left out.

**Rate-bearing position** _(puesto de tarifa)_:
One of the bonus-eligible positions that has an amount under `POSITION_RATE`. Distinguished
from the scheme trigger, which is bonus-eligible but deliberately has no rate.

## The period's bonuses

Two bonuses are paid per period rather than per day, each a period amount spread over the
working days. They are distinct from the carding-line bonus and the day rate, and every report
keeps the four apart.

**Working day** _(día hábil)_:
A Monday to Friday that is not paid under the day rate: not a holiday, and not a date HR gave its
own day rate. The working days of a period are the divisor of both
period bonuses, the same for every employee, so a day not attended is a share not earned.
_Avoid_: business day, weekday, attended day

**Attended** _(asistió)_:
Assigned on a working day to a position that is not an absence. Unlike _worked_, an incomplete day
still counts as attended: arriving late or leaving early costs the daily bonus, not the period's.
_Avoid_: worked, present

**Production bonus** _(bono de producción)_:
A period amount paid for each working day attended on a production position: the period amount
times those days, divided by the period's working days, truncated. Attending every working day
earns exactly the period amount. A day on any other position earns no share.
_Avoid_: productivity bonus, monthly bonus

**Production position** _(puesto de producción)_:
A position whose working days earn the production bonus. Carried as data; every work position is
one except Bodega, Mantención and Supervisor.

**Compliance bonus** _(bono de cumplimiento)_:
A period amount earned the same way as the production bonus, over compliance positions, less a
fixed deduction for each strike in the period. Never below zero, and zero once the strikes reach
the limit.
_Avoid_: attendance bonus, punctuality bonus

**Compliance position** _(puesto de cumplimiento)_:
A position whose working days earn the compliance bonus. Carried as data, separately from the
production position; every work position is one except Mantención and Supervisor.

**Strike** _(incumplimiento)_:
A late arrival, with or without notice, or a Falta sin aviso. Each one deducts from the compliance
bonus earned. Leaving early and Falta con aviso are not strikes.
_Avoid_: falta, penalty, demerit

**Reprimand** _(amonestación)_:
A letter of reprimand given to an employee during a period, for any reason. Recorded per employee
and per period, it voids both period bonuses for that period, including days carried over into a
later one.
_Avoid_: warning, sanction

## Things that are wrong, and things that were wrong

These two look alike on screen and are opposites in the model. Keeping them apart is the point.

**Anomaly** _(anomalía)_:
A *derived* property of a date's data that suggests a mistake — two people on one rate-bearing
position, or a total above the daily cap. Recomputed, never recorded. Correct the assignment
and it stops existing. It is never acknowledged, because acknowledging a mistake that is still
present is a way of hiding it.
_Avoid_: warning, alert, error, flag

**Review item** _(ítem de revisión)_:
A *recorded* event: someone changed a date that had already been settled, or entered a new one
inside a closed period. It already happened and cannot be undone, so it is acknowledged rather
than corrected.
_Avoid_: anomaly, alert, pending change

**Validated excess** _(exceso validado)_:
An admin's explicit, recorded approval to settle one date above the daily cap. Reachable only
when the excess cannot be corrected — the amounts that caused it are already frozen in a closed
period. The company's error is not charged to the worker.
_Avoid_: override, exception, waiver

## Settling

**Settlement** _(liquidación)_:
Stamping a date's bonus as paid in a given period, freezing the amount. Frozen means frozen: a
later rate change or correction does not rewrite it.

**Carry-over** _(arrastre)_:
A bonus date from a period already closed, entered late, and settled in the next one. Exists
because nobody is denied a payment over a recording mistake made by the company.

**Close gate** _(compuerta de cierre)_:
The check that stops a period from closing while any date it would settle still has a
correctable anomaly. The only place the app refuses to proceed — closing is a deliberate
administrative act, not the daily data entry that must never be blocked.
_Avoid_: validation, blocker
