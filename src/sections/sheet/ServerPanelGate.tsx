"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { showsServerPanel, type ServerPanel } from "./cellSelection";

/** Shows a panel the server rendered only while the URL, which the cell panel changes in the browser, still asks for it. */
export function ServerPanelGate({ panel, children }: { panel: ServerPanel; children: ReactNode }) {
  return showsServerPanel(useSearchParams(), panel) ? children : null;
}
