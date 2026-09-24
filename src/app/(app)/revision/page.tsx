import { reviewCopy } from "@/copy/review";
import { loadPeriods } from "@/sections/periods/queries";
import { loadReviewEntries } from "@/sections/review/queries";
import { ReviewList } from "@/sections/review/ReviewList";
import { orThrow } from "@/utils/supabase/query";
import { createSupabaseServerClient } from "@/utils/supabase/server";

type ReviewPageProps = { searchParams: Promise<{ ver?: string | string[] }> };

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  const { ver } = await searchParams;
  const acknowledged = ver === "revisados";
  const supabase = await createSupabaseServerClient();
  const [entries, employees, positions, profiles, periods] = await Promise.all([
    loadReviewEntries(supabase, acknowledged),
    supabase.from("employees").select("id, first_name, last_name"),
    supabase.from("positions").select("id, name"),
    supabase.from("profiles").select("id, username"),
    loadPeriods(supabase),
  ]);
  const lookup = <T extends { id: string }>(rows: T[], label: (row: T) => string) => {
    const byId = new Map(rows.map((row) => [row.id, label(row)]));
    return (id: string | null) => (id ? (byId.get(id) ?? "") : "");
  };
  const usernames = lookup(orThrow(profiles), (profile) => profile.username ?? "");

  return (
    <ReviewList
      entries={entries}
      acknowledged={acknowledged}
      employeeName={lookup(orThrow(employees), (employee) => `${employee.first_name} ${employee.last_name}`)}
      positionName={lookup(orThrow(positions), (position) => position.name)}
      username={(id) => usernames(id) || reviewCopy.someone}
      periodName={lookup(periods, (period) => period.name)}
    />
  );
}
