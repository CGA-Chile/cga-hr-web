import { beforeAll, describe, expect, it } from "vitest";
import { addDays } from "@/utils/chileDate";
import {
  appendPeriod,
  createEmployee,
  createPosition,
  nextPeriodStart,
  service,
  signInAs,
  unwrap,
  type Client,
} from "./support";

let admin: Client;
let editor: Client;

beforeAll(async () => {
  ({ client: admin } = await signInAs("admin"));
  ({ client: editor } = await signInAs("editor"));
});

const closedPeriod = () => appendPeriod("CLOSED");

async function reviewItemsFor(assignmentId: string) {
  return unwrap(
    await editor
      .from("review_items")
      .select("history_id, period_id, previous_position_id, new_position_id")
      .eq("assignment_id", assignmentId),
  );
}

describe("review_items: movements on dates already settled, not yet acknowledged", () => {
  it("a change to a settled assignment after its period closed is a review item", async () => {
    const period = await closedPeriod();
    const [from, to] = [await createPosition(), await createPosition()];
    const settled = unwrap(
      await service
        .from("assignments")
        .insert({
          date: period.dateInside,
          employee_id: await createEmployee(),
          position_id: from,
          settled_in_period_id: period.id,
          settled_amount: 4_000,
        })
        .select("id")
        .single(),
    );

    unwrap(await admin.from("assignments").update({ position_id: to }).eq("id", settled.id).select("id"));

    expect(await reviewItemsFor(settled.id)).toContainEqual(
      expect.objectContaining({ period_id: period.id, previous_position_id: from, new_position_id: to }),
    );
  });

  it("a new bonus-eligible assignment dated inside a closed period is a review item", async () => {
    const period = await closedPeriod();
    const late = unwrap(
      await editor
        .from("assignments")
        .insert({
          date: period.dateInside,
          employee_id: await createEmployee(),
          position_id: await createPosition({ bonusEligible: true, triggersEqualShare: true }),
        })
        .select("id")
        .single(),
    );

    expect(await reviewItemsFor(late.id)).toMatchObject([{ period_id: period.id, previous_position_id: null }]);
  });

  it("changing a non-eligible assignment on a closed date to an eligible one is a review item", async () => {
    const period = await closedPeriod();
    const assignment = unwrap(
      await service
        .from("assignments")
        .insert({
          date: period.dateInside,
          employee_id: await createEmployee(),
          position_id: await createPosition({ bonusEligible: false }),
        })
        .select("id")
        .single(),
    );

    unwrap(
      await editor
        .from("assignments")
        .update({ position_id: await createPosition({ bonusEligible: true }) })
        .eq("id", assignment.id)
        .select("id"),
    );

    expect(await reviewItemsFor(assignment.id)).toHaveLength(1);
  });

  it("a new non-eligible assignment on a closed date is not a review item", async () => {
    const period = await closedPeriod();
    const bodega = unwrap(
      await editor
        .from("assignments")
        .insert({
          date: period.dateInside,
          employee_id: await createEmployee(),
          position_id: await createPosition({ bonusEligible: false }),
        })
        .select("id")
        .single(),
    );

    expect(await reviewItemsFor(bodega.id)).toEqual([]);
  });

  it("movements from before the period closed are not review items", async () => {
    const insideNextPeriod = addDays(await nextPeriodStart(), 10);
    const early = unwrap(
      await editor
        .from("assignments")
        .insert({ date: insideNextPeriod, employee_id: await createEmployee(), position_id: await createPosition() })
        .select("id")
        .single(),
    );
    await appendPeriod("CLOSED");

    expect(await reviewItemsFor(early.id)).toEqual([]);
  });

  it("an acknowledged item leaves the list", async () => {
    const period = await closedPeriod();
    const late = unwrap(
      await editor
        .from("assignments")
        .insert({ date: period.dateInside, employee_id: await createEmployee(), position_id: await createPosition() })
        .select("id")
        .single(),
    );
    const [item] = await reviewItemsFor(late.id);
    if (!item?.history_id) throw new Error("Expected the late assignment to be a review item");

    unwrap(
      await editor
        .from("assignment_history")
        .update({ acknowledged_at: new Date().toISOString() })
        .eq("id", item.history_id)
        .select("id"),
    );

    expect(await reviewItemsFor(late.id)).toEqual([]);
  });
});
