import * as z from "zod";
import { adminCopy } from "@/copy/admin";

const required = z.string().trim().min(1, adminCopy.required);
const pesos = z.coerce.number<string>().int(adminCopy.rates.invalidAmount).positive(adminCopy.rates.invalidAmount);

export const employeeSchema = z.object({
  firstName: required,
  lastName: required,
  nationalId: z
    .string()
    .trim()
    .regex(/^(\d{7,8}-[\dkK])?$/, adminCopy.employees.invalidNationalId),
});
export type EmployeeInput = z.infer<typeof employeeSchema>;

export const positionSchema = z
  .object({
    code: z.string().trim().regex(/^[A-Z0-9_]+$/, adminCopy.positions.invalidCode),
    name: required,
    type: z.enum(["WORK", "ABSENCE"]),
    bonusEligible: z.boolean(),
    triggersEqualShare: z.boolean(),
    displayOrder: z.coerce.number<string>().int(),
    active: z.boolean(),
  })
  .refine((position) => !position.triggersEqualShare || position.bonusEligible, {
    message: adminCopy.positions.triggerNeedsBonus,
    path: ["triggersEqualShare"],
  });
export type PositionInput = z.input<typeof positionSchema>;
export type PositionValues = z.output<typeof positionSchema>;

export const rateVersionSchema = z.object({
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, adminCopy.required),
  dailyCap: pesos,
  maxAmountPerPerson: pesos,
  rates: z.record(z.string(), pesos),
});
export type RateVersionInput = z.input<typeof rateVersionSchema>;
export type RateVersionValues = z.output<typeof rateVersionSchema>;
