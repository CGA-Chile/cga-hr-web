import { periodsCopy } from "@/copy/periods";
import { NewPeriodForm } from "@/sections/periods/NewPeriodForm";
import { PeriodList } from "@/sections/periods/PeriodList";
import { loadPeriods, nextPeriodStart, periodNameFor, proposedEnd } from "@/sections/periods/queries";
import styles from "@/sections/periods/Periods.module.css";
import { todayInChile } from "@/utils/chileDate";
import { loadCurrentProfile } from "@/utils/supabase/currentProfile";
import { createSupabaseServerClient } from "@/utils/supabase/server";

export default async function PeriodsPage() {
  const supabase = await createSupabaseServerClient();
  const [periods, profile] = await Promise.all([loadPeriods(supabase), loadCurrentProfile(supabase)]);
  const start = nextPeriodStart(periods);
  const end = proposedEnd(start ?? todayInChile());
  const hasOpenPeriod = periods.some((period) => period.status === "OPEN");

  return (
    <main className="page">
      <h1 className={styles.title}>{periodsCopy.title}</h1>
      <p className={styles.intro}>{periodsCopy.intro}</p>
      <div className={styles.layout}>
        <PeriodList periods={periods} />
        {profile?.role === "admin" && !hasOpenPeriod ? (
          <NewPeriodForm start={start} proposedEnd={end} proposedName={periodNameFor(end)} />
        ) : null}
      </div>
    </main>
  );
}
