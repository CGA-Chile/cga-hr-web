"use client";

import { useSearchParams } from "next/navigation";
import type { MouseEvent } from "react";
import { sheetCopy } from "@/copy/sheet";
import { opensInPlace, sheetHrefFor } from "./cellSelection";

/** Opens the range panel in place, as a cell opens, from the bar above the sheet. */
export function RangeLink({ className }: { className: string }) {
  const href = sheetHrefFor(useSearchParams(), { range: true, cell: null });

  const openInPlace = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!opensInPlace(event)) return;
    event.preventDefault();
    window.history.pushState(null, "", href);
  };

  return (
    <a href={href} onClick={openInPlace} className={className}>
      {sheetCopy.assignRange}
    </a>
  );
}
