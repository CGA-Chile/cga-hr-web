import { dayRateOn } from "@/domain/bonus/dayRate";
import { findSettingsInForce } from "@/domain/bonus/settingsInForce";
import type { BonusScheme, IsoDate } from "@/domain/bonus/types";
import type { PeriodBonusKind } from "@/domain/periodBonus/types";
import { loadCalendar, loadSettingsVersions } from "@/sections/bonus/dailyBonuses";
import { isKind } from "@/sections/bonus/periodBonuses";
import { fullName } from "@/sections/day/queries";
import type { Period } from "@/sections/periods/queries";
import { orThrow, type ServerSupabase } from "@/utils/supabase/query";

/** The four bonuses a close reports, each kept apart. */
export type BonusAmounts = { carding: number; dayRate: number; production: number; compliance: number };

export const REPORT_BONUSES = ["carding", "dayRate", "production", "compliance"] as const satisfies readonly (keyof BonusAmounts)[];

export type ReportLine = {
  date: IsoDate;
  positionName: string;
  scheme: BonusScheme;
  amount: number;
  carryOver: boolean;
};

/** One settlement row of a period bonus: the days of `originName`, paid by this close. */
export type PeriodBonusLine = {
  bonus: PeriodBonusKind;
  originName: string;
  carryOver: boolean;
  days: number;
  workingDays: number | null;
  strikes: number;
  reprimanded: boolean;
  amount: number;
};

export type ReportRow = {
  employeeId: string;
  name: string;
  nationalId: string | null;
  amounts: BonusAmounts;
  /** The part of each amount that is carry-over from earlier periods. */
  carryOver: BonusAmounts;
  total: number;
  lines: ReportLine[];
  periodBonusLines: PeriodBonusLine[];
};

export type CloseReport = {
  rows: ReportRow[];
  amounts: BonusAmounts;
  total: number;
};

type Person = { name: string; nationalId: string | null };
export type DailyEntry = ReportLine & { employeeId: string; person: Person };
export type PeriodBonusEntry = PeriodBonusLine & { employeeId: string; person: Person };

/**
 * What a closed period paid, per person and per bonus. Amounts are the frozen values, never
 * recalculated: what was paid is what is reported. An assignment deleted after it was paid is
 * still here, because the money still went out.
 *
 * The scheme shown for a date is the one its paid amounts were settled under: it considers only
 * assignments settled by this close or an earlier one, so a trigger recorded later does not
 * rewrite how an earlier payment is explained. A day-rate date is read from the settings and the
 * calendar as they stand.
 */
export async function loadCloseReport(supabase: ServerSupabase, period: Period): Promise<CloseReport> {
  const [daily, periodBonus] = await Promise.all([loadDailyEntries(supabase, period), loadPeriodBonusEntries(supabase, period)]);
  return aggregateReport(daily, periodBonus);
}

/** Groups the entries per person, splitting each amount by bonus and carry-over. */
export function aggregateReport(daily: readonly DailyEntry[], periodBonus: readonly PeriodBonusEntry[]): CloseReport {
  const byEmployee = new Map<string, ReportRow>();
  const rowFor = (employeeId: string, person: Person): ReportRow => {
    const existing = byEmployee.get(employeeId);
    if (existing) return existing;
    const created: ReportRow = {
      employeeId,
      ...person,
      amounts: zero(),
      carryOver: zero(),
      total: 0,
      lines: [],
      periodBonusLines: [],
    };
    byEmployee.set(employeeId, created);
    return created;
  };
  const add = (row: ReportRow, bonus: keyof BonusAmounts, amount: number, carryOver: boolean) => {
    row.amounts[bonus] += amount;
    if (carryOver) row.carryOver[bonus] += amount;
    row.total += amount;
  };

  for (const { employeeId, person, ...line } of daily) {
    const row = rowFor(employeeId, person);
    add(row, line.scheme === "DAY_RATE" ? "dayRate" : "carding", line.amount, line.carryOver);
    row.lines.push(line);
  }
  for (const { employeeId, person, ...line } of periodBonus) {
    const row = rowFor(employeeId, person);
    add(row, line.bonus === "PRODUCTION" ? "production" : "compliance", line.amount, line.carryOver);
    row.periodBonusLines.push(line);
  }

  const rows = [...byEmployee.values()]
    .map((row) => ({
      ...row,
      lines: row.lines.sort((a, b) => a.date.localeCompare(b.date)),
      periodBonusLines: row.periodBonusLines.sort(
        (a, b) => Number(a.carryOver) - Number(b.carryOver) || b.bonus.localeCompare(a.bonus),
      ),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  const amounts = zero();
  for (const row of rows) {
    for (const bonus of REPORT_BONUSES) amounts[bonus] += row.amounts[bonus];
  }

  return { rows, amounts, total: rows.reduce((sum, row) => sum + row.total, 0) };
}

function zero(): BonusAmounts {
  return { carding: 0, dayRate: 0, production: 0, compliance: 0 };
}

function personOf(employee: { first_name: string; last_name: string; national_id: string | null } | null): Person {
  return { name: employee ? fullName(employee) : "", nationalId: employee?.national_id ?? null };
}

async function loadDailyEntries(supabase: ServerSupabase, period: Period): Promise<DailyEntry[]> {
  const settled = orThrow(
    await supabase
      .from("assignments")
      .select("date, employee_id, position_id, settled_amount, employees(first_name, last_name, national_id)")
      .eq("settled_in_period_id", period.id),
  );
  const dates = [...new Set(settled.map((row) => row.date))].sort();

  const [positions, periods, settledOnDates, versions, calendar] = await Promise.all([
    supabase.from("positions").select("id, name, triggers_equal_share"),
    supabase.from("periods").select("id, closed_at").eq("status", "CLOSED"),
    dates.length
      ? supabase
          .from("assignments")
          .select("date, position_id, settled_in_period_id")
          .in("date", dates)
          .not("settled_in_period_id", "is", null)
      : Promise.resolve({ data: [], error: null }),
    loadSettingsVersions(supabase),
    loadCalendar(supabase, dates[0] ?? period.start_date, dates.at(-1) ?? period.end_date),
  ]);
  const positionsById = new Map(orThrow(positions).map((position) => [position.id, position]));
  const closedAt = new Map(orThrow(periods).map((closed) => [closed.id, closed.closed_at ?? ""]));
  const thisClose = period.closed_at ?? "";

  const equalShareDates = new Set(
    orThrow(settledOnDates)
      .filter(
        (row) =>
          positionsById.get(row.position_id)?.triggers_equal_share &&
          (closedAt.get(row.settled_in_period_id ?? "") ?? "") <= thisClose,
      )
      .map((row) => row.date),
  );

  const schemeOn = (date: IsoDate): BonusScheme => {
    const settings = findSettingsInForce(date, versions);
    if (settings && dayRateOn(date, settings, calendar.get(date))) return "DAY_RATE";
    return equalShareDates.has(date) ? "EQUAL_SHARE" : "POSITION_RATE";
  };

  return settled.map((row) => ({
    employeeId: row.employee_id,
    person: personOf(row.employees),
    date: row.date,
    positionName: positionsById.get(row.position_id)?.name ?? "",
    scheme: schemeOn(row.date),
    amount: row.settled_amount ?? 0,
    carryOver: row.date < period.start_date,
  }));
}

async function loadPeriodBonusEntries(supabase: ServerSupabase, period: Period): Promise<PeriodBonusEntry[]> {
  const rows = orThrow(
    await supabase
      .from("period_bonus_settlements")
      .select(
        "employee_id, bonus, days, strikes, reprimanded, amount, origin_period_id, origin:periods!origin_period_id(name, working_days), employees(first_name, last_name, national_id)",
      )
      .eq("period_id", period.id)
      .is("deleted_at", null),
  );
  return rows.flatMap((row) =>
    isKind(row.bonus)
      ? [
          {
            employeeId: row.employee_id,
            person: personOf(row.employees),
            bonus: row.bonus,
            originName: row.origin?.name ?? "",
            carryOver: row.origin_period_id !== period.id,
            days: row.days,
            workingDays: row.origin?.working_days ?? null,
            strikes: row.strikes,
            reprimanded: row.reprimanded,
            amount: row.amount,
          },
        ]
      : [],
  );
}
