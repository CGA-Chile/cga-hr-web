import type { IsoDate } from "@/domain/bonus/types";
import { addDays, isIsoDate } from "@/utils/chileDate";
import { sheetPath } from "./paths";

export type CellSelection = { date: IsoDate; employeeId: string };
export type DateRange = { start: IsoDate; end: IsoDate };
/** The current query string: URLSearchParams on the server and in tests, useSearchParams() in the browser. */
type Query = Pick<URLSearchParams, "get" | "has">;

/** The cell the URL opens: a date inside the range on screen and a person. A date alone is the day's summary. */
export function readCellSelection(query: Query, range: DateRange): CellSelection | null {
  const date = query.get("dia");
  const employeeId = query.get("persona");
  if (!date || !employeeId || !isIsoDate(date) || !inRange(date, range)) return null;
  return { date, employeeId };
}

type SheetChanges = { cell?: CellSelection | null; editing?: boolean };

/**
 * The sheet's URL after opening or closing a cell, or switching the mode, computed from the
 * current one so the range, the week and whatever is left untouched survive. Opening a cell
 * closes the period-end panel, as a link to the cell always did.
 */
export function sheetHrefFor(query: Query, changes: SheetChanges): string {
  const cell =
    changes.cell === undefined ? { date: query.get("dia"), employeeId: query.get("persona") } : changes.cell;
  return sheetPath({
    start: query.get("desde"),
    week: query.get("semana"),
    editing: changes.editing ?? query.get("modo") === "editar",
    date: cell?.date ?? null,
    employeeId: cell?.employeeId ?? null,
    endPanel: changes.cell === undefined && query.get("panel") === "cierre",
  });
}

type ClickLike = Pick<MouseEvent, "button" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey" | "defaultPrevented">;

/** A plain left click opens the panel in place; a modified or middle click keeps its browser meaning. */
export function opensInPlace(event: ClickLike): boolean {
  if (event.defaultPrevented || event.button !== 0) return false;
  return !(event.ctrlKey || event.metaKey || event.shiftKey || event.altKey);
}

/** The panel's arrows: the same person, some dates away, or null past the edge of the range. */
export function stepSelection(selection: CellSelection, days: number, range: DateRange): CellSelection | null {
  const date = addDays(selection.date, days);
  return inRange(date, range) ? { date, employeeId: selection.employeeId } : null;
}

function inRange(date: IsoDate, range: DateRange): boolean {
  return date >= range.start && date <= range.end;
}

export type ServerPanel = { date: IsoDate } | { periodEnd: true };

/**
 * Whether a panel the server rendered is still the one the URL asks for. The server renders the
 * day's summary and the period-end panel from the URL it saw, but the cell panel changes the URL
 * in the browser without asking it, so what the server drew can go stale.
 */
export function showsServerPanel(query: Query, panel: ServerPanel): boolean {
  if (query.has("persona")) return false;
  return "date" in panel ? query.get("dia") === panel.date : query.get("panel") === "cierre";
}
