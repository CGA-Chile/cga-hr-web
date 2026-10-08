import { loadAnomalousDates } from "@/sections/bonus/anomalousDates";
import { dayRateOn } from "@/domain/bonus/dayRate";
import { findSettingsInForce } from "@/domain/bonus/settingsInForce";
import { findDuplicatedPositions } from "@/domain/bonus/duplicates";
import { DailySummary } from "@/sections/bonus/DailySummary";
import { DuplicateSummary } from "@/sections/bonus/DuplicateSummary";
import { loadCalendar, loadDailyBonuses, loadSettingsVersions, toBonusPosition } from "@/sections/bonus/dailyBonuses";
import { loadDuplicateDates } from "@/sections/bonus/duplicateDates";
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
import { loadCurrentProfile, seesAmounts } from "@/utils/supabase/currentProfile";
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

  const [periods, profile] = await Promise.all([loadPeriods(supabase), loadCurrentProfile(supabase)]);
  const showAmounts = seesAmounts(profile);
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
    endPanel: single(query.panel) === "cierre" && ranges.current.endMovable && showAmounts,
  };

  // A role without amounts gets no calculation at all: the database would refuse it the rates.
  const [positions, { employees, assignments }, dailyBonuses, anomalousDateCount, cellHistory, calendar, versions] =
    await Promise.all([
      loadPositions(supabase),
      loadRangeRows(supabase, addDays(start, -LOOK_BACK_DAYS), end),
      showAmounts ? loadDailyBonuses(supabase, start, end) : [],
      (showAmounts ? loadAnomalousDates(supabase) : loadDuplicateDates(supabase)).then((dates) => dates.length),
      params.date && params.employeeId ? loadCellHistory(supabase, params.date, params.employeeId) : null,
      loadCalendar(supabase, start, end),
      showAmounts ? loadSettingsVersions(supabase) : [],
    ]);
  const inRange = assignments.filter((assignment) => assignment.date >= start);
  const bonusPositions = positions.map(toBonusPosition);
  const sheet = buildSheet({
    dates: datesOf(start, end),
    employees,
    assignments: inRange,
    dailyBonuses,
    positions: bonusPositions,
  });
  const panelDuplicates = params.date
    ? findDuplicatedPositions(
        inRange
          .filter((assignment) => assignment.date === params.date)
          .map((assignment) => ({
            employeeId: assignment.employee_id,
            positionId: assignment.position_id,
            late: assignment.late,
          })),
        bonusPositions,
      )
    : [];
  const positionsById = new Map(positions.map((position) => [position.id, position]));
  const namesById = new Map(employees.map((employee) => [employee.id, fullName(employee)]));
  const cellEmployee = employees.find((employee) => employee.id === params.employeeId);
  const cellBonus = dailyBonuses.find((bonus) => bonus.date === params.date);
  const previousName = periods.find((period) => period.end_date === addDays(start, -1))?.name ?? null;
  const holidays = new Set([...calendar].filter(([, entry]) => entry.holiday).map(([day]) => day));
  const panelCalendar = params.date ? calendar.get(params.date) : undefined;
  const panelSettings = params.date ? findSettingsInForce(params.date, versions) : null;
  const dayRateFallback =
    params.date && panelSettings
      ? (dayRateOn(params.date, panelSettings, { holiday: panelCalendar?.holiday ?? false, dayRate: null })?.amount ??
        null)
      : null;

  return (
    <SheetAbbreviations entries={positions.map((position) => [position.id, position.abbreviation])}>
      <SheetView
        ranges={ranges}
        week={week}
        params={params}
        previousName={previousName}
        anomalousDateCount={anomalousDateCount}
        canChangeEnd={showAmounts}
        grid={
          <SheetGrid
            sheet={sheet}
            positionsById={positionsById}
            params={params}
            weekStart={week.start}
            today={today}
            holidays={holidays}
            showAmounts={showAmounts}
          />
        }
      />
      {params.date && !params.employeeId && (
        <DayPanel
          date={params.date}
          params={params}
          summary={
            showAmounts ? (
              <DailySummary
                dailyBonus={cellBonus ?? null}
                positions={positions}
                employeeName={(id) => namesById.get(id) ?? ""}
              />
            ) : (
              <DuplicateSummary duplicates={panelDuplicates} positionName={(id) => positionsById.get(id)?.name ?? ""} />
            )
          }
          columnCopy={params.editing ? copyFromPreviousDate(params.date, sheet.rows, assignments) : null}
          calendar={panelCalendar}
          dayRateFallback={dayRateFallback}
          canManageCalendar={showAmounts}
        />
      )}
      {params.date && cellEmployee && cellHistory && (
        <CellPanel
          date={params.date}
          params={params}
          range={{ start, end }}
          employee={cellEmployee}
          assignment={
            inRange.find(
              (assignment) => assignment.date === params.date && assignment.employee_id === cellEmployee.id,
            ) ?? null
          }
          amount={
            showAmounts
              ? (cellBonus?.result?.perEmployee.find((entry) => entry.employeeId === cellEmployee.id)?.amount ?? null)
              : undefined
          }
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
