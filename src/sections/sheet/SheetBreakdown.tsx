"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { sheetCopy } from "@/copy/sheet";
import styles from "./SheetGrid.module.css";

type Breakdown = {
  employeeIds: readonly string[];
  open: ReadonlySet<string>;
  setOpen: (open: ReadonlySet<string>) => void;
};

const BreakdownContext = createContext<Breakdown | null>(null);

function useBreakdown(): Breakdown {
  const breakdown = useContext(BreakdownContext);
  if (!breakdown) throw new Error("Breakdown components must be rendered inside SheetBreakdown");
  return breakdown;
}

/**
 * Which rows of the sheet show their bonus breakdown. Kept in the browser only: it survives moving
 * between periods, since the provider stays mounted, and resets on reload. The rows themselves are
 * rendered on the server; this only decides whether they are shown.
 */
export function SheetBreakdown({ employeeIds, children }: { employeeIds: readonly string[]; children: ReactNode }) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  return <BreakdownContext.Provider value={{ employeeIds, open, setOpen }}>{children}</BreakdownContext.Provider>;
}

/** The row's total, as the button that opens and closes its breakdown. */
export function BreakdownToggle({
  employeeId,
  name,
  children,
}: {
  employeeId: string;
  name: string;
  children: ReactNode;
}) {
  const { open, setOpen } = useBreakdown();
  const expanded = open.has(employeeId);
  const toggle = () => {
    const next = new Set(open);
    if (expanded) next.delete(employeeId);
    else next.add(employeeId);
    setOpen(next);
  };

  return (
    <button
      type="button"
      className={styles.breakdownToggle}
      aria-expanded={expanded}
      aria-label={expanded ? sheetCopy.breakdownHide(name) : sheetCopy.breakdownShow(name)}
      onClick={toggle}
    >
      <span className={styles.breakdownAmount}>{children}</span>
      <Chevron />
    </button>
  );
}

export function BreakdownAllToggle() {
  const { employeeIds, open, setOpen } = useBreakdown();
  const allOpen = employeeIds.length > 0 && employeeIds.every((id) => open.has(id));
  return (
    <button type="button" className={styles.breakdownAll} onClick={() => setOpen(new Set(allOpen ? [] : employeeIds))}>
      {allOpen ? sheetCopy.breakdownCloseAll : sheetCopy.breakdownOpenAll}
    </button>
  );
}

/** The breakdown rows under one person, shown only while that person is open. */
export function BreakdownRows({ employeeId, children }: { employeeId: string; children: ReactNode }) {
  return useBreakdown().open.has(employeeId) ? children : null;
}

function Chevron() {
  return (
    <svg
      className={styles.chevron}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4.5 2.5 8 6l-3.5 3.5" />
    </svg>
  );
}
