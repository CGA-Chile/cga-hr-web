import { describe, expect, it } from "vitest";
import type { CalendarDate, IsoDate } from "@/domain/bonus/types";
import { addDays, weekdayOf } from "@/utils/chileDate";
import { calculatePeriodBonuses } from "./calculatePeriodBonuses";
import type { PeriodBonusAmounts, PeriodBonusAssignment, PeriodBonusInput, PeriodBonusPosition } from "./types";

// The example values of docs/DOMAIN.md §5b. Fictional, never production's.
const AMOUNTS: PeriodBonusAmounts = {
  productionAmount: 21_000,
  complianceAmount: 12_600,
  strikeDeduction: 1_500,
  strikeLimit: 3,
};

const RIETER: PeriodBonusPosition = { id: "rieter", absence: false, production: true, compliance: true, strike: false };
const BODEGA: PeriodBonusPosition = { id: "bodega", absence: false, production: false, compliance: true, strike: false };
const MANTENCION: PeriodBonusPosition = { id: "mantencion", absence: false, production: false, compliance: false, strike: false };
const FALTA_CON_AVISO: PeriodBonusPosition = { id: "fca", absence: true, production: false, compliance: false, strike: false };
const FALTA_SIN_AVISO: PeriodBonusPosition = { id: "fsa", absence: true, production: false, compliance: false, strike: true };
const POSITIONS = [RIETER, BODEGA, MANTENCION, FALTA_CON_AVISO, FALTA_SIN_AVISO];

const JUAN = "juan";
const MONDAY = "2026-10-05";

/** The first `count` Mondays to Fridays from `start`. */
function weekdays(start: IsoDate, count: number): IsoDate[] {
  const dates: IsoDate[] = [];
  for (let date = start; dates.length < count; date = addDays(date, 1)) {
    if (weekdayOf(date) !== 0 && weekdayOf(date) !== 6) dates.push(date);
  }
  return dates;
}

function on(dates: readonly IsoDate[], position: PeriodBonusPosition, late = false): PeriodBonusAssignment[] {
  return dates.map((date) => ({ employeeId: JUAN, date, positionId: position.id, late }));
}

/** A period whose working days are exactly `dates`, with nothing else in it. */
function periodOf(dates: readonly IsoDate[], overrides: Partial<PeriodBonusInput> = {}): PeriodBonusInput {
  return {
    startDate: dates[0],
    endDate: dates[dates.length - 1],
    amounts: AMOUNTS,
    assignments: [],
    positions: POSITIONS,
    calendar: new Map(),
    reprimanded: new Set(),
    ...overrides,
  };
}

function juanIn(input: PeriodBonusInput) {
  const result = calculatePeriodBonuses(input);
  const juan = result.perEmployee.find((entry) => entry.employeeId === JUAN);
  if (!juan) throw new Error("Juan was not in the result");
  return { ...juan, workingDays: result.workingDays };
}

describe("the period bonuses", () => {
  it("P1: attending every working day earns both amounts in full", () => {
    const days = weekdays(MONDAY, 21);
    expect(juanIn(periodOf(days, { assignments: on(days, RIETER) }))).toMatchObject({
      workingDays: 21,
      production: 21_000,
      compliance: 12_600,
    });
  });

  it("P2: a day not attended is a share not earned", () => {
    const days = weekdays(MONDAY, 21);
    expect(juanIn(periodOf(days, { assignments: on(days.slice(1), RIETER) }))).toMatchObject({
      production: 20_000,
      compliance: 12_000,
    });
  });

  it("P3: a divisor that does not split the amount evenly still pays it in full for every day", () => {
    const days = weekdays(MONDAY, 22);
    expect(juanIn(periodOf(days, { assignments: on(days, RIETER) }))).toMatchObject({ production: 21_000 });
  });

  it("P4: a share that does not come out even is truncated", () => {
    const days = weekdays(MONDAY, 22);
    expect(juanIn(periodOf(days, { assignments: on(days.slice(1), RIETER) }))).toMatchObject({ production: 20_045 });
  });

  it("P5: only days on a production position earn production; compliance counts Bodega too", () => {
    const days = weekdays(MONDAY, 20);
    const assignments = [...on(days.slice(0, 19), BODEGA), ...on(days.slice(19), RIETER)];
    expect(juanIn(periodOf(days, { assignments }))).toMatchObject({
      productionDays: 1,
      complianceDays: 20,
      production: 1_050,
      compliance: 12_600,
    });
  });

  it("P6: a position that earns neither pays nothing", () => {
    const days = weekdays(MONDAY, 20);
    expect(juanIn(periodOf(days, { assignments: on(days, MANTENCION) }))).toMatchObject({
      production: 0,
      compliance: 0,
    });
  });

  it("P7: a Saturday adds no day and is not in the divisor", () => {
    const days = weekdays(MONDAY, 10);
    const saturday = "2026-10-10";
    const result = juanIn(periodOf(days, { assignments: on([...days, saturday], RIETER) }));
    expect(result).toMatchObject({ workingDays: 10, productionDays: 10, production: 21_000 });
  });

  it("P8: a weekday holiday is not in the divisor", () => {
    const days = weekdays(MONDAY, 10);
    const calendar = new Map<IsoDate, CalendarDate>([[days[3], { holiday: true, dayRate: null }]]);
    const worked = days.filter((date) => date !== days[3]);
    expect(juanIn(periodOf(days, { calendar, assignments: on(worked, RIETER) }))).toMatchObject({
      workingDays: 9,
      production: 21_000,
    });
  });

  it("P9: a weekday HR gave a day rate is not in the divisor, nor a day attended", () => {
    const days = weekdays(MONDAY, 10);
    const calendar = new Map<IsoDate, CalendarDate>([[days[3], { holiday: false, dayRate: 9_000 }]]);
    expect(juanIn(periodOf(days, { calendar, assignments: on(days, RIETER) }))).toMatchObject({
      workingDays: 9,
      productionDays: 9,
      production: 21_000,
    });
  });

  it("P10: a late arrival costs a deduction from compliance, not the day", () => {
    const days = weekdays(MONDAY, 21);
    const assignments = [...on(days.slice(1), RIETER), ...on(days.slice(0, 1), RIETER, true)];
    expect(juanIn(periodOf(days, { assignments }))).toMatchObject({
      strikes: 1,
      production: 21_000,
      compliance: 12_600 - 1_500,
    });
  });

  it("P11: a Falta sin aviso is a strike, and its day earns nothing", () => {
    const days = weekdays(MONDAY, 21);
    const assignments = [...on(days.slice(0, 1), RIETER, true), ...on(days.slice(1, 2), FALTA_SIN_AVISO), ...on(days.slice(2), RIETER)];
    expect(juanIn(periodOf(days, { assignments }))).toMatchObject({
      strikes: 2,
      complianceDays: 20,
      compliance: 12_000 - 2 * 1_500,
    });
  });

  it("P12: reaching the strike limit voids compliance and leaves production alone", () => {
    const days = weekdays(MONDAY, 21);
    const assignments = [...on(days.slice(0, 3), RIETER, true), ...on(days.slice(3), RIETER)];
    expect(juanIn(periodOf(days, { assignments }))).toMatchObject({ strikes: 3, compliance: 0, production: 21_000 });
  });

  it("P13: a deduction larger than what was earned leaves compliance at zero, never below", () => {
    const days = weekdays(MONDAY, 21);
    const assignments = [...on(days.slice(0, 1), RIETER, true), ...on(days.slice(1, 3), FALTA_SIN_AVISO)];
    expect(juanIn(periodOf(days, { assignments: assignments.slice(0, 2) }))).toMatchObject({ compliance: 0 });
  });

  it("P14: leaving early still counts the day, with no deduction", () => {
    const days = weekdays(MONDAY, 21);
    // Leaving early is not part of the input at all: the period bonuses never look at it.
    expect(juanIn(periodOf(days, { assignments: on(days, RIETER) }))).toMatchObject({ strikes: 0, compliance: 12_600 });
  });

  it("P15: a Falta con aviso loses its day, with no deduction", () => {
    const days = weekdays(MONDAY, 21);
    const assignments = [...on(days.slice(0, 1), FALTA_CON_AVISO), ...on(days.slice(1), RIETER)];
    expect(juanIn(periodOf(days, { assignments }))).toMatchObject({ strikes: 0, compliance: 12_000 });
  });

  it("P16: a late arrival on a Saturday is a strike too", () => {
    const days = weekdays(MONDAY, 10);
    const assignments = [...on(days, RIETER), ...on(["2026-10-10"], RIETER, true)];
    expect(juanIn(periodOf(days, { assignments }))).toMatchObject({ strikes: 1, compliance: 12_600 - 1_500 });
  });

  it("P17: a reprimand voids both bonuses", () => {
    const days = weekdays(MONDAY, 21);
    expect(juanIn(periodOf(days, { assignments: on(days, RIETER), reprimanded: new Set([JUAN]) }))).toMatchObject({
      reprimanded: true,
      production: 0,
      compliance: 0,
    });
  });

  it("P18: a period with no working days pays nothing and does not divide by zero", () => {
    const weekend = ["2026-10-10", "2026-10-11"];
    expect(juanIn(periodOf(weekend, { assignments: on(weekend, RIETER) }))).toMatchObject({
      workingDays: 0,
      production: 0,
      compliance: 0,
    });
  });

  it("ignores assignments outside the period", () => {
    const days = weekdays(MONDAY, 5);
    const outside = [addDays(days[0], -3), addDays(days[4], 3)];
    expect(juanIn(periodOf(days, { assignments: [...on(days, RIETER), ...on(outside, RIETER, true)] }))).toMatchObject({
      productionDays: 5,
      strikes: 0,
    });
  });

  it("lists a reprimanded employee with no assignments, so the reprimand is frozen with the rest", () => {
    const days = weekdays(MONDAY, 5);
    expect(juanIn(periodOf(days, { reprimanded: new Set([JUAN]) }))).toMatchObject({ reprimanded: true, production: 0 });
  });
});
