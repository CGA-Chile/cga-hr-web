# Carding-line bonus

The vocabulary the code uses to talk about who was assigned where, and what that pays.

`CLAUDE.md` holds the base entity vocabulary — Employee, Position, Assignment, Period. This
file does not repeat it. What follows are the terms that carry the rules: the ones where
picking the wrong word produces the wrong amount.

Every term is English in code and Spanish on screen. The Spanish label is the one the plant
already uses; it is not a translation choice left open to the author.

## The day's calculation

**Bonus scheme** _(esquema de bono)_:
Which of the two formulas a given date is paid under. Derived from that date's assignments,
never stored and never set by hand.
_Avoid_: mode, type, variant

**Scheme trigger** _(disparador de esquema)_:
A position whose presence on a date forces `EQUAL_SHARE`. A property of the position, carried
as data, so the calculation never recognises a position by its code.
_Avoid_: inline packing flag, special position

**Bonus-eligible position** _(puesto bonificable)_:
A position that earns the bonus when someone is assigned to it. Also data — the calculation
receives the flag and obeys it.

**Daily cap** _(tope diario)_:
The ceiling on what one date may **settle**. It is not a ceiling on what the calculation may
return: during the month an over-cap total is computed, displayed and left alone, because
hiding it would hide the assignment error that caused it.
_Avoid_: limit, maximum, budget

**Rate-bearing position** _(puesto de tarifa)_:
One of the bonus-eligible positions that has an amount under `POSITION_RATE`. Distinguished
from the scheme trigger, which is bonus-eligible but deliberately has no rate.

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
