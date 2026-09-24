"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { createRateVersion } from "@/app/(app)/administracion/actions";
import { FormField } from "@/components/FormField";
import { adminCopy } from "@/copy/admin";
import { useServerSubmit } from "@/hooks/useServerSubmit";
import { rateVersionSchema, type RateVersionInput, type RateVersionValues } from "@/schemas/admin";
import styles from "./Admin.module.css";

type RateVersionFormProps = {
  /** Rate-bearing positions: bonus-eligible, not the scheme trigger. */
  positions: readonly { id: string; name: string }[];
  triggerNames: string;
  defaults: RateVersionInput;
  doneHref: string;
};

/** Always a new version from a date; the current one is never edited. */
export function RateVersionForm({ positions, triggerNames, defaults, doneHref }: RateVersionFormProps) {
  const { register, handleSubmit, formState } = useForm<RateVersionInput, unknown, RateVersionValues>({
    resolver: zodResolver(rateVersionSchema),
    defaultValues: defaults,
  });
  const { serverError, submit } = useServerSubmit(createRateVersion, doneHref);
  const copy = adminCopy.rates;

  return (
    <form onSubmit={handleSubmit(submit)} className={styles.form} noValidate>
      <FormField label={copy.effectiveFrom} hint={copy.effectiveFromHint} error={formState.errors.effectiveFrom?.message}>
        <input type="date" {...register("effectiveFrom")} />
      </FormField>
      {positions.map((position) => (
        <FormField
          key={position.id}
          label={copy.rateFor(position.name)}
          error={formState.errors.rates?.[position.id]?.message}
        >
          <input type="number" inputMode="numeric" {...register(`rates.${position.id}`)} />
        </FormField>
      ))}
      {triggerNames && <p className={styles.muted}>{copy.noRateForTrigger(triggerNames)}</p>}
      <FormField label={copy.dailyCap} error={formState.errors.dailyCap?.message}>
        <input type="number" inputMode="numeric" {...register("dailyCap")} />
      </FormField>
      <FormField label={copy.maxAmountPerPerson} error={formState.errors.maxAmountPerPerson?.message}>
        <input type="number" inputMode="numeric" {...register("maxAmountPerPerson")} />
      </FormField>
      {serverError && (
        <p role="alert" className={styles.alert}>
          {serverError}
        </p>
      )}
      <button type="submit" className={styles.primary}>
        {formState.isSubmitting ? adminCopy.saving : copy.new}
      </button>
    </form>
  );
}
