"use client";

import { useState, useTransition } from "react";
import posthog from "posthog-js";
import { acknowledgeReviewItem, type ReviewKind } from "@/app/(app)/revision/actions";
import { reviewCopy } from "@/copy/review";
import styles from "./ReviewList.module.css";

export function AcknowledgeButton({ historyId, kind }: { historyId: string; kind: ReviewKind }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className={styles.acknowledge}>
      <button
        type="button"
        className={styles.button}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await acknowledgeReviewItem(historyId, kind);
            if (!result) posthog.capture("review_item_acknowledged", { review_kind: kind.toLowerCase() });
            setMessage(result?.message ?? null);
          })
        }
      >
        {reviewCopy.acknowledge}
      </button>
      {message && <span role="alert">{message}</span>}
    </div>
  );
}
