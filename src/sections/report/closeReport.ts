import type { BonusScheme, IsoDate } from "@/domain/bonus/types";
import { fullName } from "@/sections/day/queries";
import type { Period } from "@/sections/periods/queries";
import { orThrow, type ServerSupabase } from "@/utils/supabase/query";

export type ReportLine = {
  date: IsoDate;
  positionName: string;
  scheme: BonusScheme;
  amount: number;
  carryOver: boolean;
};

export type ReportRow = {
  employeeId: string;
  name: string;
  nationalId: string | null;
  bonusDays: number;
  periodAmount: number;
  carryOverAmount: number;
  total: number;
  lines: ReportLine[];
};

export type CloseReport = {
  rows: ReportRow[];
  periodAmount: number;
  carryOverAmount: number;
  total: number;
};

/**
 * What a closed period paid, per person. Amounts are the frozen settled_amount values, never
 * recalculated: what was paid is what is reported. An assignment deleted after it was paid is
 * still here, because the money still went out.
 *
 * The scheme shown for a date is the one its paid amounts were settled under: it considers only
 * assignments settled by this close or an earlier one, so a trigger recorded later does not
 * rewrite how an earlier payment is explained.
 */
export async function loadCloseReport(supabase: ServerSupabase, period: Period): Promise<CloseReport> {
  const settled = orThrow(
    await supabase
      .from("assignments")
      .select("date, employee_id, position_id, settled_amount, employees(first_name, last_name, national_id)")
      .eq("settled_in_period_id", period.id),
  );
  const dates = [...new Set(settled.map((row) => row.date))];

  const [positions, periods, settledOnDates] = await Promise.all([
    supabase.from("positions").select("id, name, triggers_equal_share"),
    supabase.from("periods").select("id, closed_at").eq("status", "CLOSED"),
    dates.length
      ? supabase
          .from("assignments")
          .select("date, position_id, settled_in_period_id")
          .in("date", dates)
          .not("settled_in_period_id", "is", null)
      : Promise.resolve({ data: [], error: null }),
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

  const byEmployee = new Map<string, ReportRow>();
  for (const row of settled) {
    const employee = row.employees;
    const amount = row.settled_amount ?? 0;
    const carryOver = row.date < period.start_date;
    const entry = byEmployee.get(row.employee_id) ?? {
      employeeId: row.employee_id,
      name: employee ? fullName(employee) : "",
      nationalId: employee?.national_id ?? null,
      bonusDays: 0,
      periodAmount: 0,
      carryOverAmount: 0,
      total: 0,
      lines: [],
    };
    entry.bonusDays += 1;
    entry.total += amount;
    if (carryOver) entry.carryOverAmount += amount;
    else entry.periodAmount += amount;
    entry.lines.push({
      date: row.date,
      positionName: positionsById.get(row.position_id)?.name ?? "",
      scheme: equalShareDates.has(row.date) ? "EQUAL_SHARE" : "POSITION_RATE",
      amount,
      carryOver,
    });
    byEmployee.set(row.employee_id, entry);
  }

  const rows = [...byEmployee.values()]
    .map((row) => ({ ...row, lines: row.lines.sort((a, b) => a.date.localeCompare(b.date)) }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  return {
    rows,
    periodAmount: rows.reduce((sum, row) => sum + row.periodAmount, 0),
    carryOverAmount: rows.reduce((sum, row) => sum + row.carryOverAmount, 0),
    total: rows.reduce((sum, row) => sum + row.total, 0),
  };
}
