import { notFound } from "next/navigation";
import { periodsCopy } from "@/copy/periods";
import { loadPositions } from "@/sections/day/queries";
import { CloseButton } from "@/sections/periods/CloseButton";
import { loadClosePlan } from "@/sections/periods/closePlan";
import { ClosePlanView } from "@/sections/periods/ClosePlanView";
import { loadPeriod, loadUsername } from "@/sections/periods/queries";
import styles from "@/sections/periods/Periods.module.css";
import { formatDateTimeInChile, formatLongDate } from "@/utils/chileDate";
import { formatPesos } from "@/utils/money";
import { loadCurrentProfile } from "@/utils/supabase/currentProfile";
import { createSupabaseServerClient } from "@/utils/supabase/server";

type PeriodPageProps = { params: Promise<{ id: string }> };

export default async function PeriodPage({ params }: PeriodPageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const [period, profile, positions] = await Promise.all([
    loadPeriod(supabase, id),
    loadCurrentProfile(supabase),
    loadPositions(supabase),
  ]);
  if (!period) notFound();

  const names = new Map(positions.map((position) => [position.id, position.name]));
  const loaded = period.status === "OPEN" ? await loadClosePlan(supabase, period) : null;
  const closedBy = period.closed_by ? await loadUsername(supabase, period.closed_by) : null;

  return (
    <main className="page">
      <h1 className={styles.title}>{period.name}</h1>
      <p className={styles.intro}>
        {periodsCopy.range(formatLongDate(period.start_date), formatLongDate(period.end_date))}
      </p>
      {loaded ? (
        <ClosePlanView
          loaded={loaded}
          positionName={(positionId) => names.get(positionId) ?? ""}
          closeControl={
            profile?.role !== "admin" ? (
              <p className={styles.muted}>{periodsCopy.onlyAdminCloses}</p>
            ) : loaded.canClose ? (
              <>
                <p>{periodsCopy.ready}</p>
                <CloseButton
                  periodId={period.id}
                  total={formatPesos(loaded.plan.periodTotal + loaded.plan.carryOverTotal)}
                />
              </>
            ) : null
          }
        />
      ) : (
        <p>
          {periodsCopy.closedOn(
            period.closed_at ? formatDateTimeInChile(period.closed_at) : "",
            closedBy ?? periodsCopy.someone,
          )}
        </p>
      )}
    </main>
  );
}
