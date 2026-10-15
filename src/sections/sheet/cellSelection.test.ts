import { describe, expect, it } from "vitest";
import { opensInPlace, readCellSelection, readRangeOpening, sheetHrefFor, showsServerPanel, stepSelection } from "./cellSelection";

const RANGE = { start: "2026-09-25", end: "2026-10-24" };

describe("readCellSelection", () => {
  it("reads the date and the person of the open cell", () => {
    const query = new URLSearchParams("desde=2026-09-25&dia=2026-10-03&persona=ana");
    expect(readCellSelection(query, RANGE)).toEqual({ date: "2026-10-03", employeeId: "ana" });
  });

  it("finds no cell when only a date is open, which is the day's summary", () => {
    expect(readCellSelection(new URLSearchParams("dia=2026-10-03"), RANGE)).toBeNull();
  });

  it("finds no cell for a date outside the range on screen", () => {
    expect(readCellSelection(new URLSearchParams("dia=2026-10-25&persona=ana"), RANGE)).toBeNull();
    expect(readCellSelection(new URLSearchParams("dia=2026-09-24&persona=ana"), RANGE)).toBeNull();
  });

  it("finds no cell for a date that is not a date", () => {
    expect(readCellSelection(new URLSearchParams("dia=ayer&persona=ana"), RANGE)).toBeNull();
  });
});

describe("sheetHrefFor", () => {
  const query = new URLSearchParams("desde=2026-09-25&semana=2026-09-28&modo=editar&panel=cierre");

  it("opens a cell keeping the range, the week and the mode, and closes any other panel", () => {
    expect(sheetHrefFor(query, { cell: { date: "2026-10-03", employeeId: "ana" } })).toBe(
      "/planilla?desde=2026-09-25&semana=2026-09-28&modo=editar&dia=2026-10-03&persona=ana",
    );
  });

  it("closes the cell and leaves the rest of the sheet as it was", () => {
    const open = new URLSearchParams("desde=2026-09-25&modo=editar&dia=2026-10-03&persona=ana");
    expect(sheetHrefFor(open, { cell: null })).toBe("/planilla?desde=2026-09-25&modo=editar");
  });

  it("switches the mode and keeps the open cell, so pressing Editar does not close it", () => {
    const open = new URLSearchParams("dia=2026-10-03&persona=ana");
    expect(sheetHrefFor(open, { editing: true })).toBe("/planilla?modo=editar&dia=2026-10-03&persona=ana");
    const editing = new URLSearchParams("modo=editar&dia=2026-10-03&persona=ana");
    expect(sheetHrefFor(editing, { editing: false })).toBe("/planilla?dia=2026-10-03&persona=ana");
  });
});

describe("the range panel in the URL", () => {
  it("opens from a cell keeping its person and date, which the panel starts from", () => {
    const open = new URLSearchParams("desde=2026-09-25&modo=editar&dia=2026-10-14&persona=ana");
    const href = sheetHrefFor(open, { range: true });
    expect(href).toBe("/planilla?desde=2026-09-25&modo=editar&dia=2026-10-14&persona=ana&rango=1");
    expect(readRangeOpening(new URLSearchParams(href.split("?")[1]))).toEqual({ employeeId: "ana", from: "2026-10-14" });
  });

  it("opens with nothing chosen from the sheet's own button", () => {
    const href = sheetHrefFor(new URLSearchParams("modo=editar&panel=cierre"), { range: true });
    expect(href).toBe("/planilla?modo=editar&rango=1");
    expect(readRangeOpening(new URLSearchParams("modo=editar&rango=1"))).toEqual({ employeeId: null, from: null });
  });

  it("is not open without its parameter, and ignores a date that is not a date", () => {
    expect(readRangeOpening(new URLSearchParams("dia=2026-10-14&persona=ana"))).toBeNull();
    expect(readRangeOpening(new URLSearchParams("dia=ayer&rango=1"))).toEqual({ employeeId: null, from: null });
  });

  it("closes together with the cell it opened from, and stays closed when another cell opens", () => {
    const open = new URLSearchParams("modo=editar&dia=2026-10-14&persona=ana&rango=1");
    expect(sheetHrefFor(open, { range: false, cell: null })).toBe("/planilla?modo=editar");
    expect(sheetHrefFor(open, { cell: { date: "2026-10-15", employeeId: "ana" } })).toBe(
      "/planilla?modo=editar&dia=2026-10-15&persona=ana",
    );
  });

  it("hides any panel the server drew", () => {
    expect(showsServerPanel(new URLSearchParams("panel=cierre&rango=1"), { periodEnd: true })).toBe(false);
  });
});

describe("opensInPlace", () => {
  const plain = { button: 0, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, defaultPrevented: false };

  it("opens the panel in place on a plain click", () => {
    expect(opensInPlace(plain)).toBe(true);
  });

  it("leaves a click that asks for a new tab or window to the browser", () => {
    expect(opensInPlace({ ...plain, ctrlKey: true })).toBe(false);
    expect(opensInPlace({ ...plain, metaKey: true })).toBe(false);
    expect(opensInPlace({ ...plain, shiftKey: true })).toBe(false);
    expect(opensInPlace({ ...plain, button: 1 })).toBe(false);
  });

  it("leaves a click someone else already handled", () => {
    expect(opensInPlace({ ...plain, defaultPrevented: true })).toBe(false);
  });
});

describe("stepSelection", () => {
  const cell = { date: "2026-10-03", employeeId: "ana" };

  it("walks along the person's row, a date at a time", () => {
    expect(stepSelection(cell, 1, RANGE)).toEqual({ date: "2026-10-04", employeeId: "ana" });
    expect(stepSelection(cell, -1, RANGE)).toEqual({ date: "2026-10-02", employeeId: "ana" });
  });

  it("crosses the end of a month inside the range", () => {
    expect(stepSelection({ date: "2026-09-30", employeeId: "ana" }, 1, RANGE)).toEqual({
      date: "2026-10-01",
      employeeId: "ana",
    });
  });

  it("stops at the edges of the range on screen", () => {
    expect(stepSelection({ date: "2026-10-24", employeeId: "ana" }, 1, RANGE)).toBeNull();
    expect(stepSelection({ date: "2026-09-25", employeeId: "ana" }, -1, RANGE)).toBeNull();
  });
});

describe("showsServerPanel", () => {
  it("shows the day's summary while the URL holds that date alone", () => {
    expect(showsServerPanel(new URLSearchParams("dia=2026-10-03"), { date: "2026-10-03" })).toBe(true);
  });

  it("hides the day's summary once a cell opens over it, or the URL moves to another date", () => {
    expect(showsServerPanel(new URLSearchParams("dia=2026-10-03&persona=ana"), { date: "2026-10-03" })).toBe(false);
    expect(showsServerPanel(new URLSearchParams("dia=2026-10-04"), { date: "2026-10-03" })).toBe(false);
    expect(showsServerPanel(new URLSearchParams(""), { date: "2026-10-03" })).toBe(false);
  });

  it("shows the period-end panel only while the URL asks for it", () => {
    expect(showsServerPanel(new URLSearchParams("panel=cierre"), { periodEnd: true })).toBe(true);
    expect(showsServerPanel(new URLSearchParams("dia=2026-10-03&persona=ana"), { periodEnd: true })).toBe(false);
  });
});
