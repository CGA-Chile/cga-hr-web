const people = (count: number) => (count === 1 ? "1 persona" : `${count} personas`);

export const summaryCopy = {
  title: "Resumen del día",
  equalShare: (presence: string, amount: string) =>
    `Reparto igualitario — ${presence}. Todos los puestos de la línea ganan ${amount}.`,
  triggerPresence: (count: number, positionName: string) => `hay ${people(count)} en ${positionName}`,
  positionRate: (triggerNames: string) =>
    `Tarifa por puesto — no hay nadie en ${triggerNames}. Cada puesto gana su tarifa.`,
  noLine: "Nadie trabajó hoy en la línea de cardas. No hay bono.",
  noSettings: "No hay tarifas vigentes para esta fecha. Pídele al administrador que las registre.",
  employeeColumn: "Trabajador",
  positionColumn: "Puesto",
  amountColumn: "Monto",
  total: "Total del día",
  aboveCap: (total: string, cap: string) => `Total del día: ${total} — sobre el tope de ${cap}.`,
  duplicateAffectsAmount: (positionName: string, count: number) =>
    `${positionName} tiene ${people(count)} — afecta el monto del día.`,
  duplicateHarmlessToday: (positionName: string, count: number) =>
    `${positionName} tiene ${people(count)} — hoy no afecta el monto.`,
  or: " ni ",
  and: " y ",
} as const;
