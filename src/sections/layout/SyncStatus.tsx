"use client";

import { syncCopy } from "@/copy/sync";
import { usePendingWrites } from "@/hooks/usePendingWrites";
import styles from "./SyncStatus.module.css";

/** Where the device's changes stand, in words, with the count that matters. */
export function SyncStatus() {
  const { pending, sending, online } = usePendingWrites();
  const count = pending.length;

  const [text, tone] = !online
    ? [syncCopy.offline(count), "offline"]
    : sending
      ? [syncCopy.sending, "sending"]
      : count > 0
        ? [syncCopy.waiting(count), "offline"]
        : [syncCopy.allSaved, "saved"];

  return (
    <span role="status" className={styles.status} data-tone={tone}>
      {text}
    </span>
  );
}
