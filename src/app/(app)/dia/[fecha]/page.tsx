import { notFound } from "next/navigation";
import { DayView } from "@/sections/day/DayView";
import { EmployeeDrawer } from "@/sections/day/EmployeeDrawer";
import { loadDayRows, loadEmployeeMonth, loadPositions } from "@/sections/day/queries";
import { isIsoDate, todayInChile } from "@/utils/chileDate";
import { createSupabaseServerClient } from "@/utils/supabase/server";

type DayPageProps = {
  params: Promise<{ fecha: string }>;
  searchParams: Promise<{ persona?: string | string[] }>;
};

export default async function DayPage({ params, searchParams }: DayPageProps) {
  const { fecha } = await params;
  const { persona } = await searchParams;
  if (!isIsoDate(fecha)) notFound();

  const supabase = await createSupabaseServerClient();
  const [positions, rows, employeeMonth] = await Promise.all([
    loadPositions(supabase),
    loadDayRows(supabase, fecha),
    typeof persona === "string" ? loadEmployeeMonth(supabase, persona, fecha) : null,
  ]);
  const positionsById = new Map(positions.map((position) => [position.id, position]));

  return (
    <>
      <DayView date={fecha} today={todayInChile()} rows={rows} positionsById={positionsById} />
      {employeeMonth && (
        <EmployeeDrawer
          date={fecha}
          employee={employeeMonth.employee}
          assignments={employeeMonth.assignments}
          positionsById={positionsById}
        />
      )}
    </>
  );
}
