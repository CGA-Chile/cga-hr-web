# 0012 — Weekends and holidays pay a day rate; a late arrival is not on the line

Date: 2026-10-08
Status: Accepted

## Context

Until now every date was paid under one of two schemes, `POSITION_RATE` or `EQUAL_SHARE`, and
only to people on the carding line. Saturdays were paid like any weekday.

That is not how the plant pays. On Saturdays, Sundays and holidays everyone who works earns the
same fixed amount, whatever their position: the person in bodega earns the same as the Rieter
operator. The amount usually is the same every weekend, but the plant may pay one Saturday more
than another. Holidays are not derivable from the calendar alone and HR marks them.

Separately, the plant does not pay the line bonus to someone who arrived late. The original brief
handled that by not assigning the person at all, which left the sheet wrong: the position looked
empty, and the person looked absent when they had worked.

## Decision

- A third scheme, `DAY_RATE` _(monto del día)_, applies to every Saturday, Sunday and holiday. It
  takes precedence over the other two: position rates, scheme triggers and the daily cap play no
  part on those dates.
- Everyone who **worked** the date earns the day rate: assigned to a position that is not an
  absence, and not marked late. Being on the carding line does not matter.
- The amount has a default per kind of date (Saturday, Sunday, holiday), versioned with the rest
  of the bonus settings, and HR may set a different amount for one date. Holidays are marked by
  HR, one date at a time.
- **Late** _(atraso)_ is a mark on an assignment, not a missing assignment. The late person stays
  on their position in the sheet, earns nothing under any scheme, does not count in the equal
  share's `n`, and does not count as an occupant when looking for duplicates. Whoever covered
  the position is paid without a mark.
- Changing a holiday mark or a day's amount after the date was settled follows the existing rule
  for settled dates: the settled amount stays frozen and the change becomes a review item.

## Consequences

- Who earns a bonus is no longer the same as who is on a bonus-eligible position. On a day-rate
  date it is everyone who worked; the calculation needs every assignment of the date, not only
  the line's.
- A day-rate total can be many times the daily cap, legitimately. The above-cap anomaly does not
  apply on those dates, and the close gate does not treat them as excesses.
- The sheet keeps reading like the plant's own grid: a late person is still in their cell, marked.
- A date that should have been a holiday and was not marked before the close is paid wrong, and
  the app does not pay the difference automatically. Revisit if that review item turns out to be
  common.
