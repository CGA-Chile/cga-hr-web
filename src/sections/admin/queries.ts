import type { Database } from "@/types/database";
import { orThrow, type ServerSupabase } from "@/utils/supabase/query";

type Tables = Database["public"]["Tables"];
export type AdminEmployee = Pick<Tables["employees"]["Row"], "id" | "first_name" | "last_name" | "national_id" | "active">;
export type AdminPosition = Pick<
  Tables["positions"]["Row"],
  "id" | "code" | "name" | "type" | "bonus_eligible" | "triggers_equal_share" | "display_order" | "active"
>;
export type RateVersion = Pick<
  Tables["bonus_settings"]["Row"],
  "id" | "effective_from" | "effective_to" | "daily_cap" | "max_amount_per_person"
> & { rates: { position_id: string; amount: number }[] };

export async function loadAdminEmployees(supabase: ServerSupabase): Promise<AdminEmployee[]> {
  const rows = orThrow(
    await supabase.from("employees").select("id, first_name, last_name, national_id, active").is("deleted_at", null),
  );
  return rows.sort((a, b) =>
    `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, "es"),
  );
}

export async function loadAdminPositions(supabase: ServerSupabase): Promise<AdminPosition[]> {
  return orThrow(
    await supabase
      .from("positions")
      .select("id, code, name, type, bonus_eligible, triggers_equal_share, display_order, active")
      .is("deleted_at", null)
      .order("display_order"),
  );
}

/** Newest first. */
export async function loadRateVersions(supabase: ServerSupabase): Promise<RateVersion[]> {
  const rows = orThrow(
    await supabase
      .from("bonus_settings")
      .select(
        "id, effective_from, effective_to, daily_cap, max_amount_per_person, bonus_position_rates(position_id, amount, deleted_at)",
      )
      .is("deleted_at", null)
      .order("effective_from", { ascending: false }),
  );
  return rows.map(({ bonus_position_rates: rates, ...version }) => ({
    ...version,
    rates: rates.filter((rate) => rate.deleted_at === null),
  }));
}
