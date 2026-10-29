import { describe, expect, it } from "vitest";
import { describeMovement } from "./movementText";

const name = (id: string | null) => (id === "rie" ? "Rieter" : id === "acm" ? "ACM" : "Vacía");
const task = (id: string) => (id === "truck" ? "Descarga de camión" : "");

const UNRECORDED = {
  previous_late: null,
  new_late: null,
  previous_late_notified: null,
  new_late_notified: null,
  previous_left_early: null,
  new_left_early: null,
  previous_bonus_task_id: null,
  new_bonus_task_id: null,
};
const ON_TIME = {
  previous_late: false,
  new_late: false,
  previous_late_notified: null,
  new_late_notified: null,
  previous_left_early: false,
  new_left_early: false,
  previous_bonus_task_id: null,
  new_bonus_task_id: null,
};

describe("a history row in words", () => {
  it("names the positions a cell moved between", () => {
    expect(describeMovement({ previous_position_id: "rie", new_position_id: "acm", ...ON_TIME }, name, task)).toBe(
      "Rieter → ACM",
    );
  });

  it("names a late arrival with its notice", () => {
    const movement = { previous_position_id: "rie", new_position_id: "rie", ...ON_TIME, new_late: true };

    expect(describeMovement({ ...movement, new_late_notified: true }, name, task)).toBe("Atraso con aviso");
    expect(describeMovement({ ...movement, new_late_notified: false }, name, task)).toBe("Atraso sin aviso");
  });

  it("names a change of notice alone", () => {
    const movement = {
      previous_position_id: "rie",
      new_position_id: "rie",
      ...ON_TIME,
      previous_late: true,
      new_late: true,
      previous_late_notified: true,
      new_late_notified: false,
    };

    expect(describeMovement(movement, name, task)).toBe("Atraso sin aviso");
  });

  it("names a late mark recorded before the notice was asked for", () => {
    expect(
      describeMovement({ previous_position_id: "rie", new_position_id: "rie", ...ON_TIME, new_late: true }, name, task),
    ).toBe("Atraso");
  });

  it("names leaving early, and its removal", () => {
    const marked = { previous_position_id: "rie", new_position_id: "rie", ...ON_TIME, new_left_early: true };
    const cleared = { ...marked, previous_left_early: true, new_left_early: false };

    expect(describeMovement(marked, name, task)).toBe("Salida temprana");
    expect(describeMovement(cleared, name, task)).toBe("Se quitó la salida temprana");
  });

  it("adds the marks a moved cell carries", () => {
    const movement = {
      previous_position_id: "rie",
      new_position_id: "acm",
      ...ON_TIME,
      previous_late: true,
      new_late: true,
      new_left_early: true,
    };

    expect(describeMovement(movement, name, task)).toBe("Rieter → ACM (atrasado) (salió temprano)");
  });

  it("falls back to the positions on a row from before any mark was recorded", () => {
    expect(describeMovement({ previous_position_id: null, new_position_id: "rie", ...UNRECORDED }, name, task)).toBe(
      "Vacía → Rieter",
    );
  });

  it("names a task marked, and the one taken away, when the position stayed", () => {
    const marked = { previous_position_id: "rie", new_position_id: "rie", ...ON_TIME, new_bonus_task_id: "truck" };
    const cleared = { ...marked, previous_bonus_task_id: "truck", new_bonus_task_id: null };

    expect(describeMovement(marked, name, task)).toBe("Tarea: Descarga de camión");
    expect(describeMovement(cleared, name, task)).toBe("Se quitó la tarea: Descarga de camión");
  });

  it("adds the task to a move between positions", () => {
    const moved = { previous_position_id: "rie", new_position_id: "acm", ...ON_TIME, new_bonus_task_id: "truck" };

    expect(describeMovement(moved, name, task)).toBe("Rieter → ACM (Descarga de camión)");
  });
});
