"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { savePosition } from "@/app/(app)/administracion/actions";
import { FormField } from "@/components/FormField";
import { adminCopy } from "@/copy/admin";
import { useServerSubmit } from "@/hooks/useServerSubmit";
import { positionSchema, type PositionInput, type PositionValues } from "@/schemas/admin";
import styles from "./Admin.module.css";

type PositionFormProps = { id: string | null; defaults: PositionInput; doneHref: string };

/**
 * Adding a bonus-eligible position is a row, not a deploy: the flags here are what the
 * calculation obeys. A trigger that is not bonus-eligible is explained before it reaches the
 * database, which would refuse it anyway.
 */
export function PositionForm({ id, defaults, doneHref }: PositionFormProps) {
  const { register, handleSubmit, formState } = useForm<PositionInput, unknown, PositionValues>({
    resolver: zodResolver(positionSchema),
    defaultValues: defaults,
  });
  const { serverError, submit } = useServerSubmit((values: PositionValues) => savePosition(id, values), doneHref);
  const copy = adminCopy.positions;

  return (
    <form onSubmit={handleSubmit(submit)} className={styles.form} noValidate>
      <FormField label={copy.code} hint={copy.codeHint} error={formState.errors.code?.message}>
        <input {...register("code")} autoCapitalize="characters" />
      </FormField>
      <FormField label={copy.name} error={formState.errors.name?.message}>
        <input {...register("name")} />
      </FormField>
      <FormField label={copy.type}>
        <select {...register("type")}>
          <option value="WORK">{copy.types.WORK}</option>
          <option value="ABSENCE">{copy.types.ABSENCE}</option>
        </select>
      </FormField>
      <label className={styles.check}>
        <input type="checkbox" {...register("bonusEligible")} />
        {copy.bonusEligible}
      </label>
      <label className={styles.check}>
        <input type="checkbox" {...register("triggersEqualShare")} />
        {copy.triggersEqualShare}
      </label>
      {formState.errors.triggersEqualShare && (
        <p role="alert" className={styles.alert}>
          {formState.errors.triggersEqualShare.message}
        </p>
      )}
      <FormField label={copy.displayOrder} hint={copy.displayOrderHint} error={formState.errors.displayOrder?.message}>
        <input type="number" inputMode="numeric" {...register("displayOrder")} />
      </FormField>
      <label className={styles.check}>
        <input type="checkbox" {...register("active")} />
        {copy.active}
      </label>
      {serverError && (
        <p role="alert" className={styles.alert}>
          {serverError}
        </p>
      )}
      <button type="submit" className={styles.primary}>
        {formState.isSubmitting ? adminCopy.saving : adminCopy.save}
      </button>
    </form>
  );
}
