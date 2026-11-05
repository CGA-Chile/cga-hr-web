import { describe, expect, it } from "vitest";
import { nightlyRange } from "./read";

describe("nightlyRange", () => {
  it("rereads the last seven days and never today", () => {
    expect(nightlyRange("2026-11-06", null)).toEqual({ from: "2026-10-30", to: "2026-11-05" });
  });

  it("reaches back to the open period on the first read", () => {
    expect(nightlyRange("2026-11-06", "2026-10-25")).toEqual({ from: "2026-10-25", to: "2026-11-05" });
  });

  it("does not shorten the week when the open period started this week", () => {
    expect(nightlyRange("2026-11-06", "2026-11-03")).toEqual({ from: "2026-10-30", to: "2026-11-05" });
  });
});
