import Link from "next/link";
import { Drawer } from "@/components/Drawer";
import { adminCopy } from "@/copy/admin";
import { BonusTasksTable, EmployeesTable, PositionsTable, RateVersions } from "@/sections/admin/AdminTables";
import styles from "@/sections/admin/Admin.module.css";
import { BonusTaskForm, NewBonusTaskForm } from "@/sections/admin/BonusTaskForm";
import { EmployeeForm } from "@/sections/admin/EmployeeForm";
import { PositionForm } from "@/sections/admin/PositionForm";
import {
  loadAdminEmployees,
  loadAdminPositions,
  loadRateVersions,
  type AdminEmployee,
  type AdminPosition,
} from "@/sections/admin/queries";
import { loadAttendanceStatus } from "@/sections/admin/attendanceQueries";
import { RateVersionForm } from "@/sections/admin/RateVersionForm";
import { SyncSection } from "@/sections/admin/SyncSection";
import { loadBonusTasks, type BonusTask } from "@/sections/day/queries";
import { addDays, todayInChile } from "@/utils/chileDate";
import { loadCurrentProfile } from "@/utils/supabase/currentProfile";
import { createSupabaseServerClient } from "@/utils/supabase/server";

type Section = keyof typeof adminCopy.sections;
type SearchParam = string | string[] | undefined;
type AdminPageProps = {
  searchParams: Promise<{ seccion?: SearchParam; editar?: SearchParam; nuevo?: SearchParam }>;
};

const SECTIONS: Section[] = ["trabajadores", "puestos", "tareas", "tarifas", "sincronizacion"];

/** A reread of Workera runs as a Server Action of this page, and it is slow. */
export const maxDuration = 300;

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const query = await searchParams;
  const section = SECTIONS.find((candidate) => candidate === query.seccion) ?? "trabajadores";
  const editing = typeof query.editar === "string" ? query.editar : null;
  const creating = query.nuevo === "1";
  const sectionPath = `/administracion?seccion=${section}`;

  const supabase = await createSupabaseServerClient();
  const profile = await loadCurrentProfile(supabase);
  if (profile?.role !== "admin") {
    return (
      <main className="page">
        <h1 className={styles.title}>{adminCopy.title}</h1>
        <p className={styles.muted}>{adminCopy.onlyAdmin}</p>
      </main>
    );
  }

  const attendanceStatus = section === "sincronizacion" ? await loadAttendanceStatus(supabase) : null;
  const [employees, positions, versions, tasks] = await Promise.all([
    loadAdminEmployees(supabase),
    loadAdminPositions(supabase),
    loadRateVersions(supabase),
    loadBonusTasks(supabase),
  ]);
  const positionName = (id: string) => positions.find((position) => position.id === id)?.name ?? "";
  const taskName = (id: string) => tasks.find((task) => task.id === id)?.name ?? "";
  const editHref = (id: string) => `${sectionPath}&editar=${id}`;
  const rateBearing = positions.filter((p) => p.bonus_eligible && !p.triggers_equal_share && p.active);
  const current = versions.find((version) => version.effective_to === null);
  const currentTaskAmount = (id: string) => current?.taskRates.find((rate) => rate.bonus_task_id === id)?.amount ?? null;
  const editingTask = tasks.find((task) => task.id === editing);

  return (
    <main className="page">
      <h1 className={styles.title}>{adminCopy.title}</h1>
      <nav className={styles.tabs}>
        {SECTIONS.map((candidate) => (
          <Link
            key={candidate}
            href={`/administracion?seccion=${candidate}`}
            aria-current={candidate === section ? "page" : undefined}
          >
            {adminCopy.sections[candidate]}
          </Link>
        ))}
      </nav>

      {section === "tareas" && <p className={styles.intro}>{adminCopy.tasks.intro}</p>}
      {section === "tarifas" && <p className={styles.intro}>{adminCopy.rates.intro}</p>}
      {section === "sincronizacion" && <p className={styles.intro}>{adminCopy.sync.intro}</p>}
      {section !== "sincronizacion" && (
        <div className={styles.toolbar}>
          <Link href={`${sectionPath}&nuevo=1`} scroll={false} className={styles.button}>
            {section === "trabajadores"
              ? adminCopy.employees.new
              : section === "puestos"
                ? adminCopy.positions.new
                : section === "tareas"
                  ? adminCopy.tasks.new
                  : adminCopy.rates.new}
          </Link>
        </div>
      )}

      {section === "trabajadores" && <EmployeesTable employees={employees} editHref={editHref} />}
      {section === "puestos" && <PositionsTable positions={positions} editHref={editHref} />}
      {section === "tareas" && <BonusTasksTable tasks={tasks} currentAmount={currentTaskAmount} editHref={editHref} />}
      {section === "tarifas" && <RateVersions versions={versions} positionName={positionName} taskName={taskName} />}
      {attendanceStatus && <SyncSection status={attendanceStatus} />}

      {section === "trabajadores" && (creating || editing) && (
        <EmployeeDrawer employee={employees.find((e) => e.id === editing) ?? null} doneHref={sectionPath} />
      )}
      {section === "puestos" && (creating || editing) && (
        <PositionDrawer position={positions.find((p) => p.id === editing) ?? null} doneHref={sectionPath} />
      )}
      {section === "tareas" && (creating || editingTask) && (
        <BonusTaskDrawer task={editingTask ?? null} doneHref={sectionPath} />
      )}
      {section === "tarifas" && creating && (
        <Drawer title={adminCopy.rates.newTitle} closeHref={sectionPath} closeLabel={adminCopy.cancel}>
          <RateVersionForm
            positions={rateBearing}
            triggerNames={positions.filter((p) => p.triggers_equal_share).map((p) => p.name).join(", ")}
            tasks={tasks}
            doneHref={sectionPath}
            defaults={{
              effectiveFrom: addDays(todayInChile(), 1),
              dailyCap: String(current?.daily_cap ?? ""),
              maxAmountPerPerson: String(current?.max_amount_per_person ?? ""),
              saturdayDayRate: String(current?.saturday_day_rate ?? ""),
              sundayDayRate: String(current?.sunday_day_rate ?? ""),
              holidayDayRate: String(current?.holiday_day_rate ?? ""),
              productionAmount: String(current?.production_amount ?? ""),
              complianceAmount: String(current?.compliance_amount ?? ""),
              strikeDeduction: String(current?.strike_deduction ?? ""),
              strikeLimit: String(current?.strike_limit ?? ""),
              rates: Object.fromEntries(
                rateBearing.map((p) => [p.id, String(current?.rates.find((r) => r.position_id === p.id)?.amount ?? "")]),
              ),
              taskRates: Object.fromEntries(tasks.map((task) => [task.id, String(currentTaskAmount(task.id) ?? "")])),
            }}
          />
        </Drawer>
      )}
    </main>
  );
}

function EmployeeDrawer({ employee, doneHref }: { employee: AdminEmployee | null; doneHref: string }) {
  return (
    <Drawer
      title={employee ? adminCopy.employees.editTitle : adminCopy.employees.newTitle}
      closeHref={doneHref}
      closeLabel={adminCopy.cancel}
    >
      <EmployeeForm
        id={employee?.id ?? null}
        doneHref={doneHref}
        defaults={{
          firstName: employee?.first_name ?? "",
          lastName: employee?.last_name ?? "",
          nationalId: employee?.national_id ?? "",
        }}
      />
    </Drawer>
  );
}

function BonusTaskDrawer({ task, doneHref }: { task: BonusTask | null; doneHref: string }) {
  return (
    <Drawer
      title={task ? adminCopy.tasks.editTitle : adminCopy.tasks.newTitle}
      closeHref={doneHref}
      closeLabel={adminCopy.cancel}
    >
      {task ? (
        <BonusTaskForm id={task.id} doneHref={doneHref} defaults={{ name: task.name, active: task.active }} />
      ) : (
        <NewBonusTaskForm doneHref={doneHref} />
      )}
    </Drawer>
  );
}

function PositionDrawer({ position, doneHref }: { position: AdminPosition | null; doneHref: string }) {
  return (
    <Drawer
      title={position ? adminCopy.positions.editTitle : adminCopy.positions.newTitle}
      closeHref={doneHref}
      closeLabel={adminCopy.cancel}
    >
      <PositionForm
        id={position?.id ?? null}
        doneHref={doneHref}
        defaults={{
          code: position?.code ?? "",
          name: position?.name ?? "",
          abbreviation: position?.abbreviation ?? "",
          type: position?.type === "ABSENCE" ? "ABSENCE" : "WORK",
          bonusEligible: position?.bonus_eligible ?? false,
          triggersEqualShare: position?.triggers_equal_share ?? false,
          productionBonus: position?.production_bonus ?? false,
          complianceBonus: position?.compliance_bonus ?? false,
          complianceStrike: position?.compliance_strike ?? false,
          displayOrder: String(position?.display_order ?? 300),
          active: position?.active ?? true,
        }}
      />
    </Drawer>
  );
}
