import * as z from "zod";

/** The first name in lowercase, unaccented: `gonzalo`, `jose`. */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z]+$/);

/** Six digits, because Supabase treats the PIN as a password with a 6-character minimum. */
export const pinSchema = z.string().regex(/^\d{6}$/);

export const signInSchema = z.object({
  username: usernameSchema,
  pin: pinSchema,
});

export type SignInInput = z.infer<typeof signInSchema>;

const SYNTHETIC_EMAIL_DOMAIN = "cga.local";

/** Supabase Auth needs an email; users never see this one. */
export function syntheticEmailFor(username: string): string {
  return `${username}@${SYNTHETIC_EMAIL_DOMAIN}`;
}
