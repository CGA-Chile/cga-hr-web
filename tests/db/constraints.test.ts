import { describe, expect, it } from "vitest";
import { service } from "./support";

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
    const first = await service.from("periods").insert({
      name: "Primero",
      start_date: "4000-01-25",
      end_date: "4000-02-24",
      status: "OPEN",
    });
    expect(first.error).toBeNull();

    const overlapping = await service.from("periods").insert({
      name: "Traslapado",
      start_date: "4000-02-24",
      end_date: "4000-03-24",
      status: "OPEN",
    });

    expect(overlapping.error?.code).toBe("23P01");
  });

  it("the moment of closing is stamped by the database, never taken from the client", async () => {
    const forged = "2000-01-01T00:00:00.000Z";

    const period = await service
      .from("periods")
      .insert({
        name: "Cerrado",
        start_date: "4200-01-01",
        end_date: "4200-01-31",
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
