"use client";

import { useState, useTransition } from "react";
import { acknowledgeReviewItem } from "@/app/(app)/revision/actions";
import { reviewCopy } from "@/copy/review";
import styles from "./ReviewList.module.css";

export function AcknowledgeButton({ historyId }: { historyId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className={styles.acknowledge}>
      <button
        type="button"
        className={styles.button}
        disabled={pending}
        onClick={() => startTransition(async () => setMessage((await acknowledgeReviewItem(historyId))?.message ?? null))}
      >
        {reviewCopy.acknowledge}
      </button>
      {message && <span role="alert">{message}</span>}
    </div>
  );
}
