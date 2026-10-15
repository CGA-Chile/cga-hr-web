import type { createSupabaseBrowserClient } from "./client";
import type { createSupabaseServerClient } from "./server";

export type ServerSupabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;
export type BrowserSupabase = ReturnType<typeof createSupabaseBrowserClient>;

/** Unwraps a query result, turning a failed query into an exception the error boundary shows. */
export function orThrow<T>(result: { data: T | null; error: unknown }): T {
  if (result.error) throw result.error;
  if (result.data === null) throw new Error("Query returned no data");
  return result.data;
}
