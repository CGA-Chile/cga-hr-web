"use server";

import { redirect } from "next/navigation";
import { authCopy } from "@/copy/auth";
import { signInSchema, syntheticEmailFor } from "@/schemas/signIn";
import { createSupabaseServerClient } from "@/utils/supabase/server";

export type SignInState = { message: string } | null;

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    username: formData.get("username"),
    pin: formData.get("pin"),
  });
  if (!parsed.success) return { message: authCopy.invalidInput };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: syntheticEmailFor(parsed.data.username),
    password: parsed.data.pin,
  });
  if (error) {
    return {
      message: error.code === "invalid_credentials" ? authCopy.wrongCredentials : authCopy.unavailable,
    };
  }

  redirect("/");
}
