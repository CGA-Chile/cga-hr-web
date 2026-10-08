import { calculateDailyBonus } from "@/domain/bonus/calculateDailyBonus";
import { dayRateOn } from "@/domain/bonus/dayRate";
import { findSettingsInForce } from "@/domain/bonus/settingsInForce";
import type {
  BonusAssignment,
  BonusPosition,
  BonusSettingsVersion,
  CalendarDate,
  DailyBonusResult,
  DayRate,
  IsoDate,
} from "@/domain/bonus/types";
import { orThrow, type ServerSupabase } from "@/utils/supabase/query";

/** One date's calculation, or the fact that no settings version covers it. */
export type DailyBonus =
  | { date: IsoDate; settings: BonusSettingsVersion; dayRate: DayRate | null; result: DailyBonusResult }
  | { date: IsoDate; settings: null; dayRate: null; result: null };

/** What HR recorded per date, keyed by date. */
export type Calendar = ReadonlyMap<IsoDate, CalendarDate>;

/** A live assignment as the calculation and the settlement need it. */
export type LiveAssignment = BonusAssignment & {
  id: string;
  date: IsoDate;
  settledAmount: number | null;
};

export async function loadBonusPositions(supabase: ServerSupabase): Promise<BonusPosition[]> {
  const rows = orThrow(
    await supabase.from("positions").select("id, bonus_eligible, triggers_equal_share, type").is("deleted_at", null),
  );
  return rows.map((row) => ({
    id: row.id,
    bonusEligible: row.bonus_eligible,
    triggersEqualShare: row.triggers_equal_share,
    absence: row.type === "ABSENCE",
  }));
}

export async function loadSettingsVersions(supabase: ServerSupabase): Promise<BonusSettingsVersion[]> {
  const rows = orThrow(
    await supabase
      .from("bonus_settings")
      .select(
        "effective_from, effective_to, daily_cap, max_amount_per_person, saturday_day_rate, sunday_day_rate, holiday_day_rate, bonus_position_rates(position_id, amount, deleted_at)",
      )
      .is("deleted_at", null),
  );
  return rows.map((row) => ({
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    dailyCap: row.daily_cap,
    maxAmountPerPerson: row.max_amount_per_person,
    dayRates:
      row.saturday_day_rate !== null && row.sunday_day_rate !== null && row.holiday_day_rate !== null
        ? { saturday: row.saturday_day_rate, sunday: row.sunday_day_rate, holiday: row.holiday_day_rate }
        : null,
    positionRates: new Map(
      row.bonus_position_rates
        .filter((rate) => rate.deleted_at === null)
        .map((rate) => [rate.position_id, rate.amount]),
    ),
  }));
}

export async function loadLiveAssignments(supabase: ServerSupabase, from: IsoDate, to: IsoDate): Promise<LiveAssignment[]> {
  const rows = orThrow(
    await supabase
      .from("assignments")
      .select("id, date, employee_id, position_id, settled_amount")
      .gte("date", from)
      .lte("date", to)
      .is("deleted_at", null),
  );
  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    employeeId: row.employee_id,
    positionId: row.position_id,
    settledAmount: row.settled_amount,
  }));
}

export async function loadCalendar(supabase: ServerSupabase, from: IsoDate, to: IsoDate): Promise<Calendar> {
  const rows = orThrow(
    await supabase
      .from("calendar_dates")
      .select("date, holiday, day_rate")
      .gte("date", from)
      .lte("date", to)
      .is("deleted_at", null),
  );
  return new Map(rows.map((row) => [row.date, { holiday: row.holiday, dayRate: row.day_rate }]));
}

/**
 * Calculates each date that has assignments, with the settings version in force on that date,
 * so a rate change mid-period never alters a date before it.
 */
export function calculateDates(
  assignments: readonly LiveAssignment[],
  positions: readonly BonusPosition[],
  versions: readonly BonusSettingsVersion[],
  calendar: Calendar,
): DailyBonus[] {
  const byDate = Map.groupBy(assignments, (assignment) => assignment.date);
  return [...byDate]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dateAssignments]): DailyBonus => {
      const settings = findSettingsInForce(date, versions);
      if (!settings) return { date, settings: null, dayRate: null, result: null };
      const dayRate = dayRateOn(date, settings, calendar.get(date));
      return {
        date,
        settings,
        dayRate,
        result: calculateDailyBonus({ assignments: dateAssignments, positions, settings, dayRate: dayRate?.amount ?? null }),
      };
    });
}

export async function loadDailyBonuses(supabase: ServerSupabase, from: IsoDate, to: IsoDate): Promise<DailyBonus[]> {
  const [assignments, positions, versions, calendar] = await Promise.all([
    loadLiveAssignments(supabase, from, to),
    loadBonusPositions(supabase),
    loadSettingsVersions(supabase),
    loadCalendar(supabase, from, to),
  ]);
  return calculateDates(assignments, positions, versions, calendar);
}
