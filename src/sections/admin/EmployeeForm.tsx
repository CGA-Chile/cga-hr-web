"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { saveEmployee } from "@/app/(app)/administracion/actions";
import { FormField } from "@/components/FormField";
import { adminCopy } from "@/copy/admin";
import { useServerSubmit } from "@/hooks/useServerSubmit";
import { employeeSchema, type EmployeeInput } from "@/schemas/admin";
import styles from "./Admin.module.css";

type EmployeeFormProps = { id: string | null; defaults: EmployeeInput; doneHref: string };

export function EmployeeForm({ id, defaults, doneHref }: EmployeeFormProps) {
  const { register, handleSubmit, formState } = useForm<EmployeeInput>({
    resolver: zodResolver(employeeSchema),
    defaultValues: defaults,
  });
  const { serverError, submit } = useServerSubmit((values: EmployeeInput) => saveEmployee(id, values), doneHref);
  const copy = adminCopy.employees;

  return (
    <form onSubmit={handleSubmit(submit)} className={styles.form} noValidate>
      <FormField label={copy.firstName} error={formState.errors.firstName?.message}>
        <input {...register("firstName")} />
      </FormField>
      <FormField label={copy.lastName} error={formState.errors.lastName?.message}>
        <input {...register("lastName")} />
      </FormField>
      <FormField label={copy.nationalId} hint={copy.nationalIdHint} error={formState.errors.nationalId?.message}>
        <input {...register("nationalId")} autoCapitalize="characters" />
      </FormField>
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
