"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { groupPositionsForPicker } from "../day/positionGroups";
import type { Employee, Position } from "../day/queries";
import { CellPanel } from "./CellPanel";
import {
  opensInPlace,
  readCellSelection,
  readRangeOpening,
  sheetHrefFor,
  stepSelection,
  type CellSelection,
  type DateRange,
} from "./cellSelection";
import { RangeDoneNotice } from "./RangeDoneNotice";
import { RangePanel, type RangeDone } from "./RangePanel";
import { cellKey, findPanelCell, type PanelCells } from "./sheetModel";

type CellPanelHostProps = {
  range: DateRange;
  /** Names only: the RUT never leaves the server for this. */
  employees: readonly Pick<Employee, "id" | "first_name" | "last_name">[];
  cells: PanelCells;
  positions: readonly Position[];
  /** The admin may change a paid date, as with a single cell; the range panel previews it so. */
  mayChangePaid: boolean;
  children: ReactNode;
};

/**
 * Opens the cell panel in the browser. The grid stays server-rendered with plain links; a plain
 * click on one is caught here and turned into a URL change through the History API, which Next
 * syncs with useSearchParams without a server render. A modified or middle click, or a page
 * without JavaScript, follows the link as before.
 */
export function CellPanelHost(props: CellPanelHostProps) {
  const { range, employees, cells, positions, children } = props;
  const router = useRouter();
  const query = useSearchParams();
  // The range panel opens over the cell it came from.
  const rangeOpening = readRangeOpening(query);
  const selection = rangeOpening ? null : readCellSelection(query, range);
  const employee = selection ? employees.find((candidate) => candidate.id === selection.employeeId) : undefined;
  const open = selection && employee ? selection : null;
  // Numbered, so a second range with the same message gets a fresh notice and its own undo.
  const [done, setDone] = useState<{ result: RangeDone; count: number } | null>(null);

  const positionsById = useMemo(() => new Map(positions.map((position) => [position.id, position])), [positions]);
  const positionGroups = useMemo(() => groupPositionsForPicker(positions), [positions]);

  const close = useCallback(() => {
    window.history.pushState(
      null,
      "",
      sheetHrefFor(new URLSearchParams(window.location.search), { cell: null, range: false }),
    );
  }, []);

  const applied = (result: RangeDone) => {
    setDone((previous) => ({ result, count: (previous?.count ?? 0) + 1 }));
    close();
    router.refresh();
  };

  const isOpen = open !== null || rangeOpening !== null;
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
            employee={employee}
            {...findPanelCell(cells, open)}
            positionsById={positionsById}
            positionGroups={positionGroups}
            previousHref={stepHref(-1)}
            nextHref={stepHref(1)}
            freshness={cells}
            rangeHref={sheetHrefFor(query, { range: true })}
            onClose={close}
          />
        </>
      )}
      {rangeOpening && (
        <RangePanel
          key={query.toString()}
          opening={rangeOpening}
          employees={employees}
          positionsById={positionsById}
          positionGroups={positionGroups}
          mayChangePaid={props.mayChangePaid}
          end={range.end}
          freshness={cells}
          onClose={close}
          onApplied={applied}
        />
      )}
      {done && <RangeDoneNotice key={done.count} done={done.result} onDismiss={() => setDone(null)} />}
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
