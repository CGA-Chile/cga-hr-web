import { describe, expect, it } from "vitest";
import { fetchAllRows } from "./query";

/** A table of `total` rows behind a server that never returns more than `cap` at once. */
function pagedTable(total: number, cap: number) {
  const rows = Array.from({ length: total }, (_, index) => index);
  return async (from: number, to: number) => ({ data: rows.slice(from, Math.min(to + 1, from + cap)), error: null });
}

describe("fetchAllRows", () => {
  it("reads past one response", async () => {
    expect(await fetchAllRows(pagedTable(2_500, 1_000))).toHaveLength(2_500);
  });

  it("reads everything when the total lands exactly on a page boundary", async () => {
    expect(await fetchAllRows(pagedTable(2_000, 1_000))).toHaveLength(2_000);
  });

  it("does not mistake a server cap below the page size for the end of the rows", async () => {
    expect(await fetchAllRows(pagedTable(2_500, 300))).toHaveLength(2_500);
  });

  it("returns no rows for an empty read", async () => {
    expect(await fetchAllRows(pagedTable(0, 1_000))).toEqual([]);
  });

  it("surfaces a failed page instead of returning what it had so far", async () => {
    const failure = new Error("boom");
    const failing = async (from: number) => (from === 0 ? { data: [1], error: null } : { data: null, error: failure });

    await expect(fetchAllRows(failing)).rejects.toBe(failure);
  });
});
