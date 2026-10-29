"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { createBonusTask, saveBonusTask } from "@/app/(app)/administracion/actions";
import { FormField } from "@/components/FormField";
import { adminCopy } from "@/copy/admin";
import { useServerSubmit } from "@/hooks/useServerSubmit";
import {
  bonusTaskSchema,
  newBonusTaskSchema,
  type BonusTaskValues,
  type NewBonusTaskInput,
  type NewBonusTaskValues,
} from "@/schemas/admin";
import styles from "./Admin.module.css";

/** A new task takes its amount here; it lands in every rate version (docs/adr/0021). */
export function NewBonusTaskForm({ doneHref }: { doneHref: string }) {
  const { register, handleSubmit, formState } = useForm<NewBonusTaskInput, unknown, NewBonusTaskValues>({
    resolver: zodResolver(newBonusTaskSchema),
    defaultValues: { name: "", amount: "" },
  });
  const { serverError, submit } = useServerSubmit(createBonusTask, doneHref);
  const copy = adminCopy.tasks;

  return (
    <form onSubmit={handleSubmit(submit)} className={styles.form} noValidate>
      <FormField label={copy.name} hint={copy.nameHint} error={formState.errors.name?.message}>
        <input {...register("name")} />
      </FormField>
      <FormField label={copy.amount} hint={copy.amountHint} error={formState.errors.amount?.message}>
        <input type="number" inputMode="numeric" {...register("amount")} />
      </FormField>
      <SubmitRow serverError={serverError} submitting={formState.isSubmitting} />
    </form>
  );
}

/** Name and availability only: the amount is a rate, and rates change by version. */
export function BonusTaskForm({ id, defaults, doneHref }: { id: string; defaults: BonusTaskValues; doneHref: string }) {
  const { register, handleSubmit, formState } = useForm<BonusTaskValues>({
    resolver: zodResolver(bonusTaskSchema),
    defaultValues: defaults,
  });
  const { serverError, submit } = useServerSubmit((values: BonusTaskValues) => saveBonusTask(id, values), doneHref);
  const copy = adminCopy.tasks;

  return (
    <form onSubmit={handleSubmit(submit)} className={styles.form} noValidate>
      <FormField label={copy.name} hint={copy.nameHint} error={formState.errors.name?.message}>
        <input {...register("name")} />
      </FormField>
      <p className={styles.muted}>{copy.amountInRates}</p>
      <label className={styles.check}>
        <input type="checkbox" {...register("active")} />
        {copy.active}
      </label>
      <SubmitRow serverError={serverError} submitting={formState.isSubmitting} />
    </form>
  );
}

function SubmitRow({ serverError, submitting }: { serverError: string | null; submitting: boolean }) {
  return (
    <>
      {serverError && (
        <p role="alert" className={styles.alert}>
          {serverError}
        </p>
      )}
      <button type="submit" className={styles.primary}>
        {submitting ? adminCopy.saving : adminCopy.save}
      </button>
    </>
  );
}
