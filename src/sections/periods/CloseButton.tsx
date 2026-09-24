"use client";

import { closePeriod } from "@/app/(app)/cierres/actions";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { periodsCopy } from "@/copy/periods";

export function CloseButton({ periodId, total }: { periodId: string; total: string }) {
  return (
    <ConfirmDialog
      triggerLabel={periodsCopy.close}
      title={periodsCopy.confirmTitle}
      body={periodsCopy.confirmBody(total)}
      confirmLabel={periodsCopy.confirm}
      cancelLabel={periodsCopy.cancel}
      pendingLabel={periodsCopy.closing}
      onConfirm={() => closePeriod(periodId)}
    />
  );
}
