"use client";

import { useTransition } from "react";
import posthog from "posthog-js";
import { setEmployeeActive } from "@/app/(app)/administracion/actions";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { adminCopy } from "@/copy/admin";
import styles from "./Admin.module.css";

/** Deactivating asks first; reactivating does not, since it takes nothing away. */
export function EmployeeActiveToggle({ id, name, active }: { id: string; name: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  const copy = adminCopy.employees;

  if (!active) {
    return (
      <button
        type="button"
        className={styles.button}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await setEmployeeActive(id, true);
            if (!result) posthog.capture("employee_active_status_updated", { active: true });
          })
        }
      >
        {copy.reactivate}
      </button>
    );
  }
  return (
    <ConfirmDialog
      triggerLabel={copy.deactivate}
      title={copy.deactivateTitle}
      body={copy.deactivateBody(name)}
      confirmLabel={copy.deactivateConfirm}
      cancelLabel={adminCopy.cancel}
      pendingLabel={copy.deactivating}
      onConfirm={async () => {
        const result = await setEmployeeActive(id, false);
        if (!result) posthog.capture("employee_active_status_updated", { active: false });
        return result;
      }}
    />
  );
}
