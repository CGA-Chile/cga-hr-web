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
