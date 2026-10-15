"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { sheetHrefFor } from "./cellSelection";

type EditModeLinkProps = { editing: boolean; className: string; children: ReactNode };

/** Switches the mode from the URL as the browser has it, so a cell opened in place stays open. */
export function EditModeLink({ editing, className, children }: EditModeLinkProps) {
  return (
    <Link href={sheetHrefFor(useSearchParams(), { editing: !editing })} scroll={false} className={className}>
      {children}
    </Link>
  );
}
