import Link from "next/link";
import { notFound } from "next/navigation";
import { Drawer } from "@/components/Drawer";
import { periodsCopy } from "@/copy/periods";
import { loadPositions } from "@/sections/day/queries";
import { CloseButton } from "@/sections/periods/CloseButton";
import { loadClosePlan } from "@/sections/periods/closePlan";
import { ClosePlanView } from "@/sections/periods/ClosePlanView";
import { loadPeriod, loadUsername } from "@/sections/periods/queries";
import styles from "@/sections/periods/Periods.module.css";
import { ValidateExcessForm } from "@/sections/periods/ValidateExcessForm";
import { formatDateTimeInChile, formatLongDate } from "@/utils/chileDate";
import { formatPesos } from "@/utils/money";
import { loadCurrentProfile } from "@/utils/supabase/currentProfile";
import { createSupabaseServerClient } from "@/utils/supabase/server";

type PeriodPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ validar?: string | string[] }>;
};

export default async function PeriodPage({ params, searchParams }: PeriodPageProps) {
  const { id } = await params;
  const { validar } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const [period, profile, positions] = await Promise.all([
    loadPeriod(supabase, id),
    loadCurrentProfile(supabase),
    loadPositions(supabase),
  ]);
  if (!period) notFound();

  const isAdmin = profile?.role === "admin";
  const names = new Map(positions.map((position) => [position.id, position.name]));
  const loaded = period.status === "OPEN" ? await loadClosePlan(supabase, period) : null;
  const closedBy = period.closed_by ? await loadUsername(supabase, period.closed_by) : null;
  const excessToValidate = isAdmin
    ? loaded?.plan.excessesRequiringValidation.find((excess) => excess.date === validar && !excess.validated)
    : undefined;
  const pagePath = `/cierres/${period.id}`;

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
          excessControl={(date) =>
            isAdmin ? (
              <Link href={`${pagePath}?validar=${date}`} scroll={false}>
                {periodsCopy.reviewAndValidate}
              </Link>
            ) : (
              <p className={styles.muted}>{periodsCopy.excessNeedsAdmin}</p>
            )
          }
          closeControl={
            !isAdmin ? (
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
      {excessToValidate && (
        <Drawer title={periodsCopy.validateTitle} closeHref={pagePath} closeLabel={periodsCopy.cancel}>
          <p className={styles.dateLine}>{formatLongDate(excessToValidate.date)}</p>
          <p>
            {periodsCopy.excessExplained(
              formatPesos(excessToValidate.settledTotal),
              formatPesos(excessToValidate.dailyCap),
            )}
          </p>
          <p className={styles.muted}>{periodsCopy.validateWhy}</p>
          <ValidateExcessForm
            periodId={period.id}
            date={excessToValidate.date}
            total={formatPesos(excessToValidate.settledTotal)}
          />
        </Drawer>
      )}
    </main>
  );
}
