import { beforeAll, describe, expect, it } from "vitest";
import { loadRangeRows } from "@/sections/day/queries";
import { loadPeriod } from "@/sections/periods/queries";
import { loadCloseReport } from "@/sections/report/closeReport";
import { addDays } from "@/utils/chileDate";
import { appendPeriod, createEmployee, createPosition, service, unwrap, type TestPeriod } from "./support";

const EMPLOYEES = 45;
const DATES = 25;
const ROWS = EMPLOYEES * DATES;
const SETTLED_AMOUNT = 1_000;

describe("reads above the API's row cap", () => {
  let period: TestPeriod;

  beforeAll(async () => {
    period = await appendPeriod("CLOSED", DATES);
    const position = await createPosition();
    const employees = await Promise.all(Array.from({ length: EMPLOYEES }, createEmployee));
    const rows = employees.flatMap((employee_id) =>
      Array.from({ length: DATES }, (_, offset) => ({
        date: addDays(period.startDate, offset),
        employee_id,
        position_id: position,
        settled_in_period_id: period.id,
        settled_amount: SETTLED_AMOUNT,
      })),
    );
    unwrap(await service.from("assignments").insert(rows).select("id"));
  });

  it("the sheet's range reads every assignment", async () => {
    const { assignments } = await loadRangeRows(service, period.startDate, period.endDate);

    expect(assignments).toHaveLength(ROWS);
  });

  it("the close report totals every settled assignment", async () => {
    const closed = await loadPeriod(service, period.id);
    if (!closed) throw new Error("The arranged period is missing");

    expect((await loadCloseReport(service, closed)).total).toBe(ROWS * SETTLED_AMOUNT);
  });
});
