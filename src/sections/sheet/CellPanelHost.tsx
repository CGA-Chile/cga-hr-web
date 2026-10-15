"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, type MouseEvent, type ReactNode } from "react";
import { groupPositionsForPicker } from "../day/positionGroups";
import type { Employee, Position } from "../day/queries";
import { CellPanel } from "./CellPanel";
import {
  opensInPlace,
  readCellSelection,
  sheetHrefFor,
  stepSelection,
  type CellSelection,
  type DateRange,
} from "./cellSelection";
import { cellKey, findPanelCell, type PanelCells } from "./sheetModel";

type CellPanelHostProps = {
  range: DateRange;
  editing: boolean;
  /** Names only: the RUT never leaves the server for this. */
  employees: readonly Pick<Employee, "id" | "first_name" | "last_name">[];
  cells: PanelCells;
  positions: readonly Position[];
  children: ReactNode;
};

/**
 * Opens the cell panel in the browser. The grid stays server-rendered with plain links; a plain
 * click on one is caught here and turned into a URL change through the History API, which Next
 * syncs with useSearchParams without a server render. A modified or middle click, or a page
 * without JavaScript, follows the link as before.
 */
export function CellPanelHost({ range, editing, employees, cells, positions, children }: CellPanelHostProps) {
  const query = useSearchParams();
  const selection = readCellSelection(query, range);
  const employee = selection ? employees.find((candidate) => candidate.id === selection.employeeId) : undefined;
  const open = selection && employee ? selection : null;

  const positionsById = useMemo(() => new Map(positions.map((position) => [position.id, position])), [positions]);
  const positionGroups = useMemo(() => groupPositionsForPicker(positions), [positions]);

  const close = useCallback(() => {
    window.history.pushState(null, "", sheetHrefFor(new URLSearchParams(window.location.search), { cell: null }));
  }, []);

  const isOpen = open !== null;
  useEffect(() => {
    if (!isOpen) return;
    // Escape while typing a note belongs to the field: closing would drop an unsaved note.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented && !isTextEntry(event.target)) close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close]);

  const openInPlace = (event: MouseEvent<HTMLDivElement>) => {
    const link = event.target instanceof Element ? event.target.closest("a[data-cell-link]") : null;
    const href = link?.getAttribute("href");
    if (!href || !opensInPlace(event)) return;
    event.preventDefault();
    window.history.pushState(null, "", href);
  };

  const stepHref = (days: number) => {
    const target = open && stepSelection(open, days, range);
    return target ? sheetHrefFor(query, { cell: target }) : null;
  };

  return (
    <div data-cell-panel onClick={openInPlace}>
      {children}
      {open && employee && (
        <>
          <style>{selectionCss(open)}</style>
          <CellPanel
            key={cellKey(open.date, open.employeeId)}
            selection={open}
            editing={editing}
            employee={employee}
            {...findPanelCell(cells, open)}
            positionsById={positionsById}
            positionGroups={positionGroups}
            previousHref={stepHref(-1)}
            nextHref={stepHref(1)}
            freshness={cells}
            onClose={close}
          />
        </>
      )}
    </div>
  );
}

function isTextEntry(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

/**
 * Marks the open cell, its row and its date header, which the server can no longer do since it
 * never sees the selection. The values are a validated date and a known employee id, never raw
 * URL text. Anchored on the host so they outrank the grid's own rules without !important.
 */
function selectionCss({ date, employeeId }: CellSelection): string {
  return `
[data-cell-panel] td[data-cell="${cellKey(date, employeeId)}"] > a { box-shadow: inset 0 0 0 2px var(--color-text); }
[data-cell-panel] tr[data-employee="${employeeId}"] > th,
[data-cell-panel] th[data-date="${date}"] { background: var(--color-accent-surface); }
`;
}
