"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { rereadWorkera, saveMismatchesFrom } from "@/app/(app)/administracion/attendanceActions";
import { FormField } from "@/components/FormField";
import { adminCopy } from "@/copy/admin";
import {
  mismatchesFromSchema,
  rereadSchema,
  type MismatchesFromValues,
  type RereadValues,
} from "@/schemas/attendance";
import { formatDateTimeInChile, formatNumericDate } from "@/utils/chileDate";
import type { AttendanceStatus } from "./attendanceQueries";
import styles from "./Admin.module.css";

const copy = adminCopy.sync;

/** What was read from Workera, how to read it again, and when the sheet starts using it. */
export function SyncSection({ status }: { status: AttendanceStatus }) {
  return (
    <div className={styles.form}>
      <p className={styles.muted}>
        {status.lastReadAt && status.lastReadDate
          ? copy.lastRead(formatNumericDate(status.lastReadDate), formatDateTimeInChile(status.lastReadAt))
          : copy.neverRead}
      </p>
      {status.failedDates.length > 0 && (
        <p role="alert" className={styles.alert}>
          {copy.failedDates(status.failedDates.map(formatNumericDate).join(", "))}
        </p>
      )}
      <Link href="/administracion?seccion=sincronizacion&mapeo=1" scroll={false} className={styles.button}>
        {copy.openMapping}
      </Link>
      <RereadForm />
      <MismatchesFromForm from={status.mismatchesFrom} />
    </div>
  );
}

function RereadForm() {
  const { register, handleSubmit, formState } = useForm<RereadValues>({
    resolver: zodResolver(rereadSchema),
    defaultValues: { from: "", to: "" },
  });
  const [result, setResult] = useState<{ failed: boolean; message: string } | null>(null);

  async function submit(values: RereadValues): Promise<void> {
    const refused = await rereadWorkera(values);
    setResult(refused ? { failed: true, message: refused.message } : { failed: false, message: copy.readDone });
  }

  return (
    <form onSubmit={handleSubmit(submit)} className={styles.form} noValidate>
      <h2 className={styles.subtitle}>{copy.rereadTitle}</h2>
      <p className={styles.muted}>{copy.rereadHint}</p>
      <FormField label={copy.from} error={formState.errors.from?.message}>
        <input type="date" {...register("from")} />
      </FormField>
      <FormField label={copy.to} error={formState.errors.to?.message}>
        <input type="date" {...register("to")} />
      </FormField>
      {result && (
        <p role={result.failed ? "alert" : "status"} className={result.failed ? styles.alert : styles.muted}>
          {result.message}
        </p>
      )}
      <button type="submit" className={styles.button} disabled={formState.isSubmitting}>
        {formState.isSubmitting ? copy.reading : copy.reread}
      </button>
    </form>
  );
}

function MismatchesFromForm({ from }: { from: string | null }) {
  const { register, handleSubmit, formState } = useForm<MismatchesFromValues>({
    resolver: zodResolver(mismatchesFromSchema),
    defaultValues: { from: from ?? "" },
  });
  const [refusal, setRefusal] = useState<string | null>(null);

  async function submit(values: MismatchesFromValues): Promise<void> {
    setRefusal((await saveMismatchesFrom(values))?.message ?? null);
  }

  return (
    <form onSubmit={handleSubmit(submit)} className={styles.form} noValidate>
      <h2 className={styles.subtitle}>{copy.stageOneTitle}</h2>
      <p className={styles.muted}>{copy.stageOneHint}</p>
      <FormField label={copy.mismatchesFrom} error={formState.errors.from?.message}>
        <input type="date" {...register("from")} />
      </FormField>
      {refusal && (
        <p role="alert" className={styles.alert}>
          {refusal}
        </p>
      )}
      <button type="submit" className={styles.button} disabled={formState.isSubmitting}>
        {formState.isSubmitting ? adminCopy.saving : adminCopy.save}
      </button>
    </form>
  );
}
