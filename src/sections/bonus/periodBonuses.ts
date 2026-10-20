import type { IsoDate } from "@/domain/bonus/types";
import { isPeriodBonusKind } from "@/domain/periodBonus/kind";
import type {
  ClosedPeriod,
  CountableAssignment,
  PeriodBonusAmounts,
  PeriodBonusCloseInput,
  PeriodBonusKind,
  PeriodBonusPosition,
  PeriodBonusSettlement,
} from "@/domain/periodBonus/types";
import type { Period } from "@/sections/periods/queries";
import type { Database } from "@/types/database";
import { orThrow, type ServerSupabase } from "@/utils/supabase/query";
import { loadCalendar } from "./dailyBonuses";

export async function loadPeriodBonusPositions(supabase: ServerSupabase): Promise<PeriodBonusPosition[]> {
  const rows = orThrow(
    await supabase
      .from("positions")
      .select("id, type, production_bonus, compliance_bonus, compliance_strike")
      .is("deleted_at", null),
  );
  return rows.map((row) => ({
    id: row.id,
    absence: row.type === "ABSENCE",
    production: row.production_bonus,
    compliance: row.compliance_bonus,
    strike: row.compliance_strike,
  }));
}

/** The period-bonus amounts of the version in force on `date`: a period's end (docs/adr/0016). */
export async function loadPeriodBonusAmounts(supabase: ServerSupabase, date: IsoDate): Promise<PeriodBonusAmounts | null> {
  const rows = orThrow(
    await supabase
      .from("bonus_settings")
      .select("production_amount, compliance_amount, strike_deduction, strike_limit")
      .lte("effective_from", date)
      .or(`effective_to.is.null,effective_to.gte.${date}`)
      .is("deleted_at", null),
  );
  if (rows.length > 1) throw new Error(`Expected one bonus settings version in force on ${date}, found ${rows.length}`);
  return rows[0] ? toAmounts(rows[0]) : null;
}

type AmountColumns = Pick<
  Database["public"]["Tables"]["bonus_settings"]["Row"],
  "production_amount" | "compliance_amount" | "strike_deduction" | "strike_limit"
>;

/** The four amounts travel together, all or none, on settings and on a closed period alike. */
function toAmounts(row: AmountColumns): PeriodBonusAmounts | null {
  if (
    row.production_amount === null ||
    row.compliance_amount === null ||
    row.strike_deduction === null ||
    row.strike_limit === null
  ) {
    return null;
  }
  return {
    productionAmount: row.production_amount,
    complianceAmount: row.compliance_amount,
    strikeDeduction: row.strike_deduction,
    strikeLimit: row.strike_limit,
  };
}

/** The reprimands of a period, keyed by employee, with their notes. */
export async function loadReprimands(supabase: ServerSupabase, periodId: string): Promise<Map<string, string | null>> {
  const rows = orThrow(
    await supabase.from("reprimands").select("employee_id, note").eq("period_id", periodId).is("deleted_at", null),
  );
  return new Map(rows.map((row) => [row.employee_id, row.note]));
}

/** Who has a reprimand in the period. */
export async function loadReprimanded(supabase: ServerSupabase, periodId: string): Promise<Set<string>> {
  return new Set((await loadReprimands(supabase, periodId)).keys());
}

/**
 * Everything planPeriodBonusClose needs to close `period`: its own assignments, the days closed
 * periods still owe, those periods' frozen terms and what they already paid.
 */
export async function loadPeriodBonusCloseInput(supabase: ServerSupabase, period: Period): Promise<PeriodBonusCloseInput> {
  const [own, owed, positions, amounts, reprimanded] = await Promise.all([
    supabase
      .from("assignments")
      .select("id, date, employee_id, position_id, late, production_settled_in_period_id, compliance_settled_in_period_id")
      .gte("date", period.start_date)
      .lte("date", period.end_date)
      .is("deleted_at", null),
    supabase
      .from("period_bonus_owed_days")
      .select("assignment_id, date, employee_id, position_id, late, origin_period_id, bonus")
      .lte("date", period.end_date),
    loadPeriodBonusPositions(supabase),
    loadPeriodBonusAmounts(supabase, period.end_date),
    loadReprimanded(supabase, period.id),
  ]);

  // The view's columns are nullable to the type generator; every row it returns has them all.
  const owedDays = orThrow(owed).flatMap(toOwedDay);
  const origins = [...new Set(owedDays.map((row) => row.originPeriodId))];
  const earliest = owedDays.reduce((min, row) => (row.assignment.date < min ? row.assignment.date : min), period.start_date);

  const [closedPeriods, settled, calendar] = await Promise.all([
    origins.length ? loadClosedPeriods(supabase, origins) : [],
    origins.length ? loadSettlements(supabase, origins) : [],
    loadCalendar(supabase, earliest, period.end_date),
  ]);

  const ownAssignments: CountableAssignment[] = orThrow(own).map((row) => ({
    id: row.id,
    employeeId: row.employee_id,
    date: row.date,
    positionId: row.position_id,
    late: row.late,
    counted: {
      PRODUCTION: row.production_settled_in_period_id !== null,
      COMPLIANCE: row.compliance_settled_in_period_id !== null,
    },
  }));

  // A day owed for one bonus only was already counted for the other.
  const owedById = Map.groupBy(owedDays, (row) => row.assignment.id);
  const carriedAssignments: CountableAssignment[] = [...owedById.values()].map((rows) => {
    const owedKinds = new Set(rows.map((row) => row.bonus));
    return {
      ...rows[0].assignment,
      counted: { PRODUCTION: !owedKinds.has("PRODUCTION"), COMPLIANCE: !owedKinds.has("COMPLIANCE") },
    };
  });

  return {
    period: { id: period.id, startDate: period.start_date, endDate: period.end_date },
    amounts,
    closedPeriods,
    assignments: [...ownAssignments, ...carriedAssignments],
    positions,
    calendar,
    reprimanded,
    settled,
  };
}

type OwedRow = Pick<
  Database["public"]["Views"]["period_bonus_owed_days"]["Row"],
  "assignment_id" | "date" | "employee_id" | "position_id" | "late" | "origin_period_id" | "bonus"
>;

type OwedDay = {
  assignment: Omit<CountableAssignment, "counted">;
  originPeriodId: string;
  bonus: PeriodBonusKind;
};

function toOwedDay(row: OwedRow): OwedDay[] {
  const { assignment_id: id, date, employee_id: employeeId, position_id: positionId, origin_period_id: originPeriodId } = row;
  if (!id || !date || !employeeId || !positionId || !originPeriodId || !isPeriodBonusKind(row.bonus)) return [];
  return [{ assignment: { id, date, employeeId, positionId, late: row.late ?? false }, originPeriodId, bonus: row.bonus }];
}

async function loadClosedPeriods(supabase: ServerSupabase, ids: readonly string[]): Promise<ClosedPeriod[]> {
  const rows = orThrow(
    await supabase
      .from("periods")
      .select("id, start_date, end_date, working_days, production_amount, compliance_amount, strike_deduction, strike_limit")
      .in("id", ids),
  );
  return rows.map((row) => {
    const amounts = toAmounts(row);
    return {
      id: row.id,
      startDate: row.start_date,
      endDate: row.end_date,
      terms: amounts && row.working_days !== null ? { ...amounts, workingDays: row.working_days } : null,
    };
  });
}

async function loadSettlements(supabase: ServerSupabase, originIds: readonly string[]): Promise<PeriodBonusSettlement[]> {
  const rows = orThrow(
    await supabase
      .from("period_bonus_settlements")
      .select("origin_period_id, employee_id, bonus, days, strikes, reprimanded, amount")
      .in("origin_period_id", originIds)
      .is("deleted_at", null),
  );
  return rows.flatMap((row) =>
    isPeriodBonusKind(row.bonus)
      ? [
          {
            originPeriodId: row.origin_period_id,
            employeeId: row.employee_id,
            bonus: row.bonus,
            days: row.days,
            strikes: row.strikes,
            reprimanded: row.reprimanded,
            amount: row.amount,
          },
        ]
      : [],
  );
}
