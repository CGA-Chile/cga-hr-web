/**
 * Creates one of the app's users, or resets their PIN and role if they already exist.
 * Accounts are never created from the app: this runs with the service role key, which must
 * never reach a browser.
 *
 *   PIN=123456 node --env-file=.env.local scripts/create-user.ts <username> <admin|editor>
 *
 * The role goes into app_metadata, which only the service role can write; a trigger copies it
 * into profiles, where every RLS policy reads it.
 */
import { createClient } from "@supabase/supabase-js";
import * as z from "zod";
import { pinSchema, syntheticEmailFor, usernameSchema } from "../src/schemas/signIn.ts";

const argsSchema = z.object({
  username: usernameSchema,
  role: z.enum(["admin", "editor"]),
  pin: pinSchema,
  url: z.url(),
  serviceRoleKey: z.string().min(1),
});

const args = argsSchema.parse({
  username: process.argv[2],
  role: process.argv[3],
  pin: process.env.PIN,
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
});

const admin = createClient(args.url, args.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const email = syntheticEmailFor(args.username);
const attributes = { password: args.pin, app_metadata: { role: args.role } };

const existing = await findUserByEmail(email);
const result = existing
  ? await admin.auth.admin.updateUserById(existing, attributes)
  : await admin.auth.admin.createUser({ email, email_confirm: true, ...attributes });
if (result.error) throw result.error;

process.stdout.write(`${existing ? "Updated" : "Created"} ${args.username} as ${args.role}\n`);

async function findUserByEmail(target: string): Promise<string | null> {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.find((user) => user.email === target)?.id ?? null;
}
