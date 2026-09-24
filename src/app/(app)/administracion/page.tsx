import Link from "next/link";
import { Drawer } from "@/components/Drawer";
import { adminCopy } from "@/copy/admin";
import { EmployeesTable, PositionsTable, RateVersions } from "@/sections/admin/AdminTables";
import styles from "@/sections/admin/Admin.module.css";
import { EmployeeForm } from "@/sections/admin/EmployeeForm";
import { PositionForm } from "@/sections/admin/PositionForm";
import {
  loadAdminEmployees,
  loadAdminPositions,
  loadRateVersions,
  type AdminEmployee,
  type AdminPosition,
} from "@/sections/admin/queries";
import { RateVersionForm } from "@/sections/admin/RateVersionForm";
import { addDays, todayInChile } from "@/utils/chileDate";
import { loadCurrentProfile } from "@/utils/supabase/currentProfile";
import { createSupabaseServerClient } from "@/utils/supabase/server";

type Section = keyof typeof adminCopy.sections;
type SearchParam = string | string[] | undefined;
type AdminPageProps = {
  searchParams: Promise<{ seccion?: SearchParam; editar?: SearchParam; nuevo?: SearchParam }>;
};

const SECTIONS: Section[] = ["trabajadores", "puestos", "tarifas"];

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

  const [employees, positions, versions] = await Promise.all([
    loadAdminEmployees(supabase),
    loadAdminPositions(supabase),
    loadRateVersions(supabase),
  ]);
  const positionName = (id: string) => positions.find((position) => position.id === id)?.name ?? "";
  const editHref = (id: string) => `${sectionPath}&editar=${id}`;
  const rateBearing = positions.filter((p) => p.bonus_eligible && !p.triggers_equal_share && p.active);
  const current = versions.find((version) => version.effective_to === null);

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

      {section === "tarifas" && <p className={styles.intro}>{adminCopy.rates.intro}</p>}
      <div className={styles.toolbar}>
        <Link href={`${sectionPath}&nuevo=1`} scroll={false} className={styles.button}>
          {section === "trabajadores"
            ? adminCopy.employees.new
            : section === "puestos"
              ? adminCopy.positions.new
              : adminCopy.rates.new}
        </Link>
      </div>

      {section === "trabajadores" && <EmployeesTable employees={employees} editHref={editHref} />}
      {section === "puestos" && <PositionsTable positions={positions} editHref={editHref} />}
      {section === "tarifas" && <RateVersions versions={versions} positionName={positionName} />}

      {section === "trabajadores" && (creating || editing) && (
        <EmployeeDrawer employee={employees.find((e) => e.id === editing) ?? null} doneHref={sectionPath} />
      )}
      {section === "puestos" && (creating || editing) && (
        <PositionDrawer position={positions.find((p) => p.id === editing) ?? null} doneHref={sectionPath} />
      )}
      {section === "tarifas" && creating && (
        <Drawer title={adminCopy.rates.newTitle} closeHref={sectionPath} closeLabel={adminCopy.cancel}>
          <RateVersionForm
            positions={rateBearing}
            triggerNames={positions.filter((p) => p.triggers_equal_share).map((p) => p.name).join(", ")}
            doneHref={sectionPath}
            defaults={{
              effectiveFrom: addDays(todayInChile(), 1),
              dailyCap: String(current?.daily_cap ?? ""),
              maxAmountPerPerson: String(current?.max_amount_per_person ?? ""),
              rates: Object.fromEntries(
                rateBearing.map((p) => [p.id, String(current?.rates.find((r) => r.position_id === p.id)?.amount ?? "")]),
              ),
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
          type: position?.type === "ABSENCE" ? "ABSENCE" : "WORK",
          bonusEligible: position?.bonus_eligible ?? false,
          triggersEqualShare: position?.triggers_equal_share ?? false,
          displayOrder: String(position?.display_order ?? 300),
          active: position?.active ?? true,
        }}
      />
    </Drawer>
  );
}
