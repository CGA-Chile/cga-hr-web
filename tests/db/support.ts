import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { inject } from "vitest";
import type { Database } from "@/types/database";

export type AppRole = "admin" | "editor";
export type Client = SupabaseClient<Database>;

const connection = inject("supabase");
const PASSWORD = "123456";

/** Bypasses RLS. Used only to arrange data, never to assert what a user may do. */
export const service: Client = createClient<Database>(connection.url, connection.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** A signed-in user whose role is set in app_metadata, which only the service role can write. */
export async function signInAs(role: AppRole | null): Promise<{ client: Client; userId: string }> {
  const email = `${randomUUID()}@test.local`;
  const created = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    app_metadata: role ? { role } : {},
  });
  if (created.error) throw created.error;

  const client = createClient<Database>(connection.url, connection.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signedIn = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signedIn.error) throw signedIn.error;

  return { client, userId: created.data.user.id };
}

export function unwrap<T>(result: { data: T; error: unknown }): NonNullable<T> {
  if (result.error) throw result.error;
  if (result.data === null || result.data === undefined) throw new Error("Expected data, got none");
  return result.data;
}

export async function createEmployee(): Promise<string> {
  const suffix = randomUUID().slice(0, 8);
  const row = unwrap(
    await service
      .from("employees")
      .insert({ first_name: "Test", last_name: suffix, national_id: `${suffix}-0` })
      .select("id")
      .single(),
  );
  return row.id;
}

type PositionFlags = { bonusEligible?: boolean; triggersEqualShare?: boolean };

export async function createPosition(flags: PositionFlags = {}): Promise<string> {
  const code = `TEST_${randomUUID().slice(0, 8).toUpperCase()}`;
  const row = unwrap(
    await service
      .from("positions")
      .insert({
        code,
        name: code,
        type: "WORK",
        bonus_eligible: flags.bonusEligible ?? true,
        triggers_equal_share: flags.triggersEqualShare ?? false,
        display_order: 1000,
      })
      .select("id")
      .single(),
  );
  return row.id;
}

/** A date far from any other test's, so tests sharing one database never collide. */
export function uniqueDate(): string {
  const day = Math.floor(Math.random() * 2_500_000);
  return new Date(Date.UTC(3000, 0, 1) + day * 86_400_000).toISOString().slice(0, 10);
}
