import { execSync } from "node:child_process";
import type { TestProject } from "vitest/node";

/**
 * Resets the LOCAL database to the committed migrations and seed, then hands the local API URL
 * and keys to the tests. Keys are read at run time from `supabase status`, never committed.
 */
export default function setup(project: TestProject) {
  execSync("npx supabase db reset --local", { stdio: "ignore" });
  const env = parseEnv(execSync("npx supabase status -o env", { encoding: "utf8" }));

  project.provide("supabase", {
    url: required(env, "API_URL"),
    anonKey: required(env, "ANON_KEY"),
    serviceRoleKey: required(env, "SERVICE_ROLE_KEY"),
  });
}

function parseEnv(output: string): Map<string, string> {
  const entries = output
    .split(/\r?\n/)
    .map((line) => /^([A-Z_]+)="?(.*?)"?$/.exec(line.trim()))
    .filter((match) => match !== null)
    .map((match): [string, string] => [match[1], match[2]]);
  return new Map(entries);
}

function required(env: Map<string, string>, name: string): string {
  const value = env.get(name);
  if (!value) throw new Error(`supabase status did not report ${name}; is the local stack running?`);
  return value;
}

declare module "vitest" {
  export interface ProvidedContext {
    supabase: { url: string; anonKey: string; serviceRoleKey: string };
  }
}
