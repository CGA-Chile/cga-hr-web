import * as z from "zod";
import { adminCopy } from "@/copy/admin";
import { daysInRange, isIsoDate } from "@/utils/chileDate";

/** About what fits in one request: Workera took close to ten seconds per day of clockings. */
export const MAX_REREAD_DAYS = 21;

const copy = adminCopy.sync;
const isoDate = z.string().refine(isIsoDate, copy.invalidDate);

export const rereadSchema = z
  .object({ from: isoDate, to: isoDate })
  .refine(({ from, to }) => from <= to, { message: copy.rangeReversed, path: ["to"] })
  .refine(({ from, to }) => daysInRange(from, to) <= MAX_REREAD_DAYS, { message: copy.rangeTooLong, path: ["to"] });

export type RereadValues = z.output<typeof rereadSchema>;

/** Empty turns the mismatches off. */
export const mismatchesFromSchema = z.object({ from: z.union([z.literal(""), isoDate]) });

export type MismatchesFromValues = z.output<typeof mismatchesFromSchema>;

/** Empty turns stage 2 off: the marks stay manual. */
export const appliesFromSchema = z.object({ from: z.union([z.literal(""), isoDate]) });

export type AppliesFromValues = z.output<typeof appliesFromSchema>;

/** Minutes of grace before a clocking counts as late or as leaving early. Zero is valid. */
export const toleranceSchema = z.object({
  minutes: z.coerce.number<string>().int(copy.invalidTolerance).min(0, copy.invalidTolerance),
});

export type ToleranceInput = z.input<typeof toleranceSchema>;
export type ToleranceValues = z.output<typeof toleranceSchema>;
