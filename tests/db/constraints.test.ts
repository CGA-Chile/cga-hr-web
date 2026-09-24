import { describe, expect, it } from "vitest";
import { addDays } from "@/utils/chileDate";
import { appendPeriod, nextPeriodStart, service } from "./support";

// Constraints hold for every role, so these arrange and assert through the service client.

describe("positions", () => {
  it("rejects a scheme trigger that is not bonus-eligible", async () => {
    const result = await service.from("positions").insert({
      code: "TRIGGER_WITHOUT_BONUS",
      name: "Trigger without bonus",
      type: "WORK",
      bonus_eligible: false,
      triggers_equal_share: true,
      display_order: 1,
    });

    expect(result.error?.code).toBe("23514");
  });
});

describe("periods", () => {
  it("rejects a period that overlaps another, even by one day", async () => {
    const first = await appendPeriod("OPEN", 31);

    const overlapping = await service.from("periods").insert({
      name: "Traslapado",
      start_date: first.startDate,
      end_date: addDays(first.endDate, 30),
      status: "OPEN",
    });

    expect(overlapping.error?.code).toBe("23P01");
  });

  it("rejects a period that leaves a gap after the previous one", async () => {
    const start = addDays(await nextPeriodStart(), 1);

    const gapped = await service
      .from("periods")
      .insert({ name: "Con hueco", start_date: start, end_date: addDays(start, 30), status: "OPEN" });

    expect(gapped.error?.code).toBe("23514");
  });

  it("does not let a period's start move once created", async () => {
    const period = await appendPeriod("OPEN", 31);

    const moved = await service
      .from("periods")
      .update({ start_date: addDays(period.startDate, 1) })
      .eq("id", period.id);

    expect(moved.error?.code).toBe("23514");
  });

  it("the moment of closing is stamped by the database, never taken from the client", async () => {
    const forged = "2000-01-01T00:00:00.000Z";
    const start = await nextPeriodStart();

    const period = await service
      .from("periods")
      .insert({
        name: "Cerrado",
        start_date: start,
        end_date: addDays(start, 30),
        status: "CLOSED",
        closed_at: forged,
      })
      .select("closed_at")
      .single();

    expect(period.error).toBeNull();
    expect(Date.parse(period.data?.closed_at ?? forged)).toBeGreaterThan(Date.parse(forged));
  });
});

describe("bonus_settings", () => {
  it("rejects a version whose effective range overlaps another, open-ended ones included, so one date never has two rate sets", async () => {
    const bounded = await service.from("bonus_settings").insert({
      effective_from: "1901-01-01",
      effective_to: "1901-12-31",
      daily_cap: 15_000,
      max_amount_per_person: 2_500,
    });
    expect(bounded.error).toBeNull();

    const overlapping = await service.from("bonus_settings").insert({
      effective_from: "1900-06-01",
      effective_to: null,
      daily_cap: 18_000,
      max_amount_per_person: 3_000,
    });

    expect(overlapping.error?.code).toBe("23P01");
  });
});
