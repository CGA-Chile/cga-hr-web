import { notFound } from "next/navigation";
import { CellDrawer } from "@/sections/day/CellDrawer";
import { DayView } from "@/sections/day/DayView";
import { EmployeeDrawer } from "@/sections/day/EmployeeDrawer";
import { groupPositionsForPicker } from "@/sections/day/positionGroups";
import {
  loadCellHistory,
  loadDayRows,
  loadEmployeeMonth,
  loadModifiedEmployeeIds,
  loadPositions,
} from "@/sections/day/queries";
import { isIsoDate, todayInChile } from "@/utils/chileDate";
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
  const [positions, rows, modifiedEmployeeIds, employeeMonth, cellHistory] = await Promise.all([
    loadPositions(supabase),
    loadDayRows(supabase, fecha),
    loadModifiedEmployeeIds(supabase, fecha),
    employeeId ? loadEmployeeMonth(supabase, employeeId, fecha) : null,
    cellEmployeeId ? loadCellHistory(supabase, fecha, cellEmployeeId) : null,
  ]);
  const positionsById = new Map(positions.map((position) => [position.id, position]));
  const cellRow = rows.find((row) => row.employee.id === cellEmployeeId);

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
