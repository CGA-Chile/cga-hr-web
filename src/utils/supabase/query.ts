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

const PAGE_SIZE = 1000;

/**
 * Every row of a read that can outgrow one response. PostgREST cuts a response at its max_rows
 * setting without reporting an error, so a read that scales with history silently loses rows
 * once it crosses that line. `readPage` must order by a unique column, or rows can repeat or go
 * missing between pages. Stopping on an empty page, not a short one, keeps this right whatever
 * the server's cap is.
 */
export async function fetchAllRows<T>(
  readPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const page = orThrow(await readPage(rows.length, rows.length + PAGE_SIZE - 1));
    if (page.length === 0) return rows;
    rows.push(...page);
  }
}
