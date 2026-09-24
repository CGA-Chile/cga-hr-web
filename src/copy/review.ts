export const reviewCopy = {
  title: "Revisión",
  intro:
    "Movimientos sobre días que ya se pagaron. Cada ítem de revisión es algo que ya pasó: revísalo y decide qué hacer. La app no descuenta ni recalcula nada.",
  pending: "Por revisar",
  acknowledged: "Revisados",
  emptyPending: "No hay ítems de revisión pendientes.",
  emptyAcknowledged: "Todavía no hay ítems revisados.",
  movement: (from: string, to: string) => `${from} → ${to}`,
  emptyCell: "(vacío)",
  changedBy: (when: string, who: string) => `Cambiado el ${when} por ${who}`,
  acknowledgedBy: (when: string, who: string) => `Revisado el ${when} por ${who}`,
  paidIn: (periodName: string) => `Día pagado en ${periodName}`,
  acknowledge: "Marcar como revisado",
  someone: "alguien",
  unavailable: "No se pudo guardar. Revisa la señal y vuelve a intentarlo.",
} as const;
