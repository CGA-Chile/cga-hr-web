import * as z from "zod";

const CLOCKING_STATUSES = {
  ACTIVO: "ACTIVE",
  INACTIVO: "INACTIVE",
  MODIFICADO: "MODIFIED",
} as const;

function isKnownStatus(status: string): status is keyof typeof CLOCKING_STATUSES {
  return status in CLOCKING_STATUSES;
}

/** Workera documents upper case and sends title case, so both are accepted. */
const clockingStatusSchema = z.string().transform((status, context) => {
  const upper = status.toUpperCase();
  if (isKnownStatus(upper)) return CLOCKING_STATUSES[upper];
  context.addIssue({ code: "custom", message: `Unknown clocking status: ${status}` });
  return z.NEVER;
});

const employeeRefSchema = z.object({ identification: z.string().min(1) });

export const clockingSchema = z.object({
  employee: employeeRefSchema,
  attendanceDate: z.string().min(19),
  attendanceType: z.number().int().min(0).max(5),
  attendanceStatus: clockingStatusSchema,
});

export const employeeScheduleSchema = z.object({
  employee: employeeRefSchema,
  schedules: z.array(
    z.object({
      date: z.string(),
      start: z.string().min(19),
      end: z.string().min(19),
    }),
  ),
});

export const organizationUnitSchema = z.object({ code: z.string().min(1) });

export const pageSchema = z.object({
  totalPages: z.number().int(),
  data: z.array(z.unknown()),
});

export const workeraEmployeeSchema = z.object({
  identification: z.string().min(1),
  name: z.string().nullish(),
  secondName: z.string().nullish(),
  lastName: z.string().nullish(),
  secondLastName: z.string().nullish(),
  employeeStatus: z.string(),
});
