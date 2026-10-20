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
    abbreviation: z.string().trim().toUpperCase().regex(/^[A-Z0-9.]{1,5}$/, adminCopy.positions.invalidAbbreviation),
    type: z.enum(["WORK", "ABSENCE"]),
    bonusEligible: z.boolean(),
    triggersEqualShare: z.boolean(),
    productionBonus: z.boolean(),
    complianceBonus: z.boolean(),
    complianceStrike: z.boolean(),
    displayOrder: z.coerce.number<string>().int(),
    active: z.boolean(),
  })
  .refine((position) => !position.triggersEqualShare || position.bonusEligible, {
    message: adminCopy.positions.triggerNeedsBonus,
    path: ["triggersEqualShare"],
  })
  .refine((position) => position.type === "WORK" || (!position.productionBonus && !position.complianceBonus), {
    message: adminCopy.positions.periodBonusNeedsWork,
    path: ["complianceBonus"],
  })
  .refine((position) => position.type === "ABSENCE" || !position.complianceStrike, {
    message: adminCopy.positions.strikeNeedsAbsence,
    path: ["complianceStrike"],
  });
export type PositionInput = z.input<typeof positionSchema>;
export type PositionValues = z.output<typeof positionSchema>;

export const rateVersionSchema = z.object({
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, adminCopy.required),
  dailyCap: pesos,
  maxAmountPerPerson: pesos,
  saturdayDayRate: pesos,
  sundayDayRate: pesos,
  holidayDayRate: pesos,
  productionAmount: pesos,
  complianceAmount: pesos,
  strikeDeduction: pesos,
  strikeLimit: z.coerce.number<string>().int(adminCopy.rates.invalidCount).positive(adminCopy.rates.invalidCount),
  rates: z.record(z.string(), pesos),
});
export type RateVersionInput = z.input<typeof rateVersionSchema>;
export type RateVersionValues = z.output<typeof rateVersionSchema>;
