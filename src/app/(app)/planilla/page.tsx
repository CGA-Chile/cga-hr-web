import { loadAnomalousDates } from "@/sections/bonus/anomalousDates";
import { loadDailyBonuses } from "@/sections/bonus/dailyBonuses";
import { groupPositionsForPicker } from "@/sections/day/positionGroups";
import { fullName, loadCellHistory, loadPositions, loadRangeRows } from "@/sections/day/queries";
import { loadPeriods } from "@/sections/periods/queries";
import type { SheetParams } from "@/sections/sheet/paths";
import { SheetAbbreviations } from "@/sections/sheet/SheetCellLabel";
import { SheetGrid } from "@/sections/sheet/SheetGrid";
import { buildSheet, copyFromPreviousDate } from "@/sections/sheet/sheetModel";
import { CellPanel, DayPanel, PeriodEndPanel } from "@/sections/sheet/SheetPanels";
import { datesOf, resolveSheetRanges, resolveWeek } from "@/sections/sheet/sheetRange";
import { SheetView } from "@/sections/sheet/SheetView";
import { addDays, isIsoDate, todayInChile } from "@/utils/chileDate";
import { createSupabaseServerClient } from "@/utils/supabase/server";

/** How far before the range the column copy looks for a date to copy from. */
const LOOK_BACK_DAYS = 7;

type SearchParam = string | string[] | undefined;
type SheetPageProps = {
  searchParams: Promise<{
    desde?: SearchParam;
    semana?: SearchParam;
    modo?: SearchParam;
    dia?: SearchParam;
    persona?: SearchParam;
    panel?: SearchParam;
  }>;
};

function single(value: SearchParam): string | null {
  return typeof value === "string" ? value : null;
}

function date(value: SearchParam): string | null {
  const text = single(value);
  return text && isIsoDate(text) ? text : null;
}

export default async function SheetPage({ searchParams }: SheetPageProps) {
  const query = await searchParams;
  const today = todayInChile();
  const supabase = await createSupabaseServerClient();

  const periods = await loadPeriods(supabase);
  const ranges = resolveSheetRanges(periods, date(query.desde), today);
  const { start, end } = ranges.current;
  const week = resolveWeek(ranges.current, date(query.semana), today);
  const openDate = date(query.dia);
  const panelDate = openDate && openDate >= start && openDate <= end ? openDate : null;
  const params: SheetParams = {
    start,
    week: date(query.semana) ? week.start : null,
    editing: single(query.modo) === "editar",
    date: panelDate,
    employeeId: panelDate ? single(query.persona) : null,
    endPanel: single(query.panel) === "cierre" && ranges.current.endMovable,
  };

  const [positions, { employees, assignments }, dailyBonuses, anomalousDates, cellHistory] = await Promise.all([
    loadPositions(supabase),
    loadRangeRows(supabase, addDays(start, -LOOK_BACK_DAYS), end),
    loadDailyBonuses(supabase, start, end),
    loadAnomalousDates(supabase),
    params.date && params.employeeId ? loadCellHistory(supabase, params.date, params.employeeId) : null,
  ]);
  const inRange = assignments.filter((assignment) => assignment.date >= start);
  const sheet = buildSheet({ dates: datesOf(start, end), employees, assignments: inRange, dailyBonuses });
  const positionsById = new Map(positions.map((position) => [position.id, position]));
  const namesById = new Map(employees.map((employee) => [employee.id, fullName(employee)]));
  const cellEmployee = employees.find((employee) => employee.id === params.employeeId);
  const cellBonus = dailyBonuses.find((bonus) => bonus.date === params.date);
  const previousName = periods.find((period) => period.end_date === addDays(start, -1))?.name ?? null;

  return (
    <SheetAbbreviations entries={positions.map((position) => [position.id, position.abbreviation])}>
      <SheetView
        ranges={ranges}
        week={week}
        params={params}
        previousName={previousName}
        anomalousDateCount={anomalousDates.length}
        grid={<SheetGrid sheet={sheet} positionsById={positionsById} params={params} weekStart={week.start} />}
      />
      {params.date && !params.employeeId && (
        <DayPanel
          date={params.date}
          params={params}
          dailyBonus={cellBonus ?? null}
          positions={positions}
          employeeName={(id) => namesById.get(id) ?? ""}
          columnCopy={params.editing ? copyFromPreviousDate(params.date, sheet.rows, assignments) : null}
        />
      )}
      {params.date && cellEmployee && cellHistory && (
        <CellPanel
          date={params.date}
          params={params}
          range={{ start, end }}
          employee={cellEmployee}
          assignment={
            inRange.find((assignment) => assignment.date === params.date && assignment.employee_id === cellEmployee.id) ??
            null
          }
          amount={cellBonus?.result?.perEmployee.find((entry) => entry.employeeId === cellEmployee.id)?.amount ?? null}
          history={cellHistory}
          positionsById={positionsById}
          positionGroups={groupPositionsForPicker(positions)}
        />
      )}
      {params.endPanel && ranges.current.period && (
        <PeriodEndPanel periodId={ranges.current.period.id} start={start} end={end} params={params} />
      )}
    </SheetAbbreviations>
  );
}

