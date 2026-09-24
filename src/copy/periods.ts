const days = (count: number) => (count === 1 ? "1 día" : `${count} días`);

export const periodsCopy = {
  title: "Cierres",
  intro: "Cada cierre paga los bonos hasta su fecha de término. Lo que se registre tarde se paga en el cierre siguiente.",
  empty: "Todavía no hay cierres.",
  open: "Abierto",
  closed: "Cerrado",
  range: (from: string, to: string) => `Del ${from} al ${to}`,
  view: "Ver",

  newTitle: "Nuevo cierre",
  startLabel: "Desde",
  startFixed: "Empieza el día siguiente al cierre anterior.",
  endLabel: "Hasta",
  endHint: "Normalmente el 24. Cámbialo si RRHH definió otra fecha.",
  nameLabel: "Nombre",
  create: "Crear cierre",
  onlyAdminCreates: "Solo un administrador puede crear cierres.",
  invalidRange: "La fecha de término tiene que ser igual o posterior a la de inicio.",
  notContiguous: "El cierre tiene que empezar el día siguiente al anterior, sin días sueltos.",
  unavailable: "No se pudo guardar. Revisa la señal y vuelve a intentarlo.",

  periodDays: "Días del período",
  carryOver: "Arrastre de períodos anteriores",
  carryOverHint: "Días de cierres anteriores que se registraron tarde. Se pagan ahora.",
  total: "Total a pagar",
  nothingToSettle: "No hay bonos pendientes hasta esta fecha.",

  gateTitle: "No se puede cerrar todavía",
  gateIntro: (count: number) =>
    `${days(count)} con algo que corregir. Corrige cada uno y vuelve a esta página. La app no elige por ti.`,
  unpriced: "No hay tarifas vigentes para esta fecha.",
  goFix: "Ir a corregir",

  excessTitle: "Días sobre el tope que no se pueden corregir",
  excessValidated: "Validado por el administrador.",

  ready: "Todo en orden para cerrar.",
  close: "Cerrar período",
  confirmTitle: "¿Cerrar este período?",
  confirmBody: (total: string) =>
    `Se pagarán ${total}. Los montos quedan congelados: un cambio posterior no los reescribe.`,
  confirm: "Sí, cerrar",
  cancel: "Cancelar",
  closing: "Cerrando…",
  onlyAdminCloses: "Solo un administrador puede cerrar un período.",
  changedMeanwhile: "Algo cambió mientras preparabas el cierre. Revisa la página y vuelve a intentarlo.",
  gateBlocks: "Hay días que corregir antes de cerrar.",
  closedOn: (when: string, who: string) => `Cerrado el ${when} por ${who}.`,
  someone: "alguien",
} as const;
