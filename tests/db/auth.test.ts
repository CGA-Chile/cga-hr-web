import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, inject, it } from "vitest";
import type { Database } from "@/types/database";
import { nextPeriodStart, service, signInAs, unwrap } from "./support";

describe("the role lives in profiles, and only the server can grant it", () => {
  it("creating a user with a role produces its profile, by trigger", async () => {
    const { userId } = await signInAs("editor");

    const profile = unwrap(await service.from("profiles").select("role").eq("id", userId).single());

    expect(profile.role).toBe("editor");
  });

  it("a profile carries the username the user signs in with, so history can say who changed a cell", async () => {
    const username = `u${randomUUID().replaceAll("-", "").slice(0, 10)}`;
    const created = await service.auth.admin.createUser({
      email: `${username}@cga.local`,
      password: "135790",
      email_confirm: true,
      app_metadata: { role: "editor" },
    });
    if (created.error) throw created.error;

    const profile = unwrap(
      await service.from("profiles").select("username").eq("id", created.data.user.id).single(),
    );

    expect(profile.username).toBe(username);
  });

  it("a user claiming admin in their own metadata changes nothing", async () => {
    const { client: editor } = await signInAs("editor");

    const claimed = await editor.auth.updateUser({ data: { role: "admin" } });
    expect(claimed.error).toBeNull();
    await editor.auth.refreshSession();

    const start = await nextPeriodStart();
    const attempt = await editor.from("periods").insert({ name: "Intento", start_date: start, end_date: start });
    expect(attempt.error?.code).toBe("42501");
  });
});

describe("signing in with a PIN", () => {
  it("does not lock the account after repeated wrong PINs", async () => {
    const email = `${randomUUID()}@cga.local`;
    const created = await service.auth.admin.createUser({
      email,
      password: "246810",
      email_confirm: true,
      app_metadata: { role: "editor" },
    });
    if (created.error) throw created.error;
    const connection = inject("supabase");
    const device = createClient<Database>(connection.url, connection.anonKey, {
      auth: { persistSession: false },
    });

    for (const wrongPin of ["000000", "111111", "222222", "333333", "444444"]) {
      const failed = await device.auth.signInWithPassword({ email, password: wrongPin });
      expect(failed.error).not.toBeNull();
    }
    const signedIn = await device.auth.signInWithPassword({ email, password: "246810" });

    expect(signedIn.error).toBeNull();
  });
});
