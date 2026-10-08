import { notFound } from "next/navigation";
import { findDuplicatedPositions } from "@/domain/bonus/duplicates";
import { DailySummary } from "@/sections/bonus/DailySummary";
import { DuplicateSummary } from "@/sections/bonus/DuplicateSummary";
import { loadAnomalousDates } from "@/sections/bonus/anomalousDates";
import { loadDailyBonuses, toBonusPosition } from "@/sections/bonus/dailyBonuses";
import { loadDuplicateDates } from "@/sections/bonus/duplicateDates";
import { CellDrawer } from "@/sections/day/CellDrawer";
import { DayView } from "@/sections/day/DayView";
import { EmployeeDrawer } from "@/sections/day/EmployeeDrawer";
import { groupPositionsForPicker } from "@/sections/day/positionGroups";
import {
  fullName,
  loadCellHistory,
  loadDayRows,
  loadEmployeeMonth,
  loadModifiedEmployeeIds,
  loadPositions,
} from "@/sections/day/queries";
import { isIsoDate, todayInChile } from "@/utils/chileDate";
import { loadCurrentProfile, seesAmounts } from "@/utils/supabase/currentProfile";
import { createSupabaseServerClient } from "@/utils/supabase/server";

type SearchParam = string | string[] | undefined;
type DayPageProps = {
  params: Promise<{ fecha: string }>;
  searchParams: Promise<{ modo?: SearchParam; persona?: SearchParam; celda?: SearchParam }>;
};

function single(value: SearchParam): string | null {
  return typeof value === "string" ? value : null;
}

export default async function DayPage({ params, searchParams }: DayPageProps) {
  const { fecha } = await params;
  const query = await searchParams;
  if (!isIsoDate(fecha)) notFound();
  const editing = single(query.modo) === "editar";
  const employeeId = single(query.persona);
  const cellEmployeeId = single(query.celda);

  const supabase = await createSupabaseServerClient();
  const showAmounts = seesAmounts(await loadCurrentProfile(supabase));
  const [positions, rows, modifiedEmployeeIds, dailyBonuses, anomalousDateCount, employeeMonth, cellHistory] =
    await Promise.all([
      loadPositions(supabase),
      loadDayRows(supabase, fecha),
      loadModifiedEmployeeIds(supabase, fecha),
      showAmounts ? loadDailyBonuses(supabase, fecha, fecha) : [],
      (showAmounts ? loadAnomalousDates(supabase) : loadDuplicateDates(supabase)).then((dates) => dates.length),
      employeeId ? loadEmployeeMonth(supabase, employeeId, fecha) : null,
      cellEmployeeId ? loadCellHistory(supabase, fecha, cellEmployeeId) : null,
    ]);
  const positionsById = new Map(positions.map((position) => [position.id, position]));
  const cellRow = rows.find((row) => row.employee.id === cellEmployeeId);
  const namesById = new Map(rows.map((row) => [row.employee.id, fullName(row.employee)]));

  return (
    <>
      <DayView
        date={fecha}
        today={todayInChile()}
        editing={editing}
        rows={rows}
        positionsById={positionsById}
        positionGroups={groupPositionsForPicker(positions)}
        modifiedEmployeeIds={modifiedEmployeeIds}
        anomalousDateCount={anomalousDateCount}
        summary={
          showAmounts ? (
            <DailySummary
              dailyBonus={dailyBonuses[0] ?? null}
              positions={positions}
              employeeName={(id) => namesById.get(id) ?? ""}
            />
          ) : (
            <DuplicateSummary
              duplicates={findDuplicatedPositions(
                rows.flatMap(({ employee, assignment }) =>
                  assignment ? [{ employeeId: employee.id, positionId: assignment.position_id, late: assignment.late }] : [],
                ),
                positions.map(toBonusPosition),
              )}
              positionName={(id) => positionsById.get(id)?.name ?? ""}
            />
          )
        }
      />
      {employeeMonth && (
        <EmployeeDrawer
          date={fecha}
          editing={editing}
          employee={employeeMonth.employee}
          assignments={employeeMonth.assignments}
          positionsById={positionsById}
        />
      )}
      {cellRow && cellHistory && (
        <CellDrawer
          date={fecha}
          editing={editing}
          employee={cellRow.employee}
          assignment={cellRow.assignment}
          history={cellHistory}
          positionsById={positionsById}
        />
      )}
    </>
  );
}
