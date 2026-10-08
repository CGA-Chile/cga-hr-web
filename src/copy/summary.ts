const people = (count: number) => (count === 1 ? "1 persona" : `${count} personas`);

export const summaryCopy = {
  title: "Resumen del día",
  equalShare: (presence: string, amount: string) =>
    `Reparto igualitario — ${presence}. Todos los puestos de la línea ganan ${amount}.`,
  triggerPresence: (count: number, positionName: string) => `hay ${people(count)} en ${positionName}`,
  positionRate: (triggerNames: string) =>
    `Tarifa por puesto — no hay nadie en ${triggerNames}. Cada puesto gana su tarifa.`,
  dayRate: (reason: string, amount: string) =>
    `Monto del día — ${reason}. Todos los que trabajaron ganan ${amount}, sin importar el puesto.`,
  dayRateReasons: { SATURDAY: "es sábado", SUNDAY: "es domingo", HOLIDAY: "es feriado", WEEKDAY: "RRHH fijó un monto para esta fecha" },
  dayRateSetForDate: "Monto fijado por RRHH para esta fecha.",
  noLine: "Nadie trabajó hoy en la línea de cardas. No hay bono.",
  nobodyWorked: "Nadie trabajó este día. No hay bono.",
  noSettings: "No hay tarifas vigentes para esta fecha. Pídele al administrador que las registre.",
  employeeColumn: "Trabajador",
  positionColumn: "Puesto",
  amountColumn: "Monto",
  total: "Total del día",
  late: "Atraso, $0",
  aboveCap: (total: string, cap: string) => `Total del día: ${total} — sobre el tope de ${cap}.`,
  duplicateAffectsAmount: (positionName: string, count: number) =>
    `${positionName} tiene ${people(count)} — afecta el monto del día.`,
  duplicateHarmlessToday: (positionName: string, count: number) =>
    `${positionName} tiene ${people(count)} — hoy no afecta el monto.`,
  or: " ni ",
  and: " y ",
} as const;
