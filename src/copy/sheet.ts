import type { RangeDays } from "@/sections/sheet/rangePlan";

const cells = (count: number) => (count === 1 ? "1 celda vacía" : `${count} celdas vacías`);
const days = (count: number) => (count === 1 ? "1 día" : `${count} días`);
const RANGE_DAYS_TEXT: Record<RangeDays, string> = {
  ALL: "corridos",
  MON_FRI: "de lunes a viernes",
  MON_SAT: "de lunes a sábado",
};

export const sheetCopy = {
  previousPeriod: "Período anterior",
  nextPeriod: "Período siguiente",
  range: (from: string, to: string) => `${from} al ${to}`,
  open: "Abierto",
  closed: "Cerrado",
  upcoming: (previous: string) => `Se crea al cerrar ${previous}`,
  upcomingFirst: "Todavía no hay períodos",
  changeEnd: "Cambiar fecha de cierre",

  readModeNotice: "Modo lectura. Aprieta «Editar» para hacer cambios.",
  editModeNotice: "Modo edición. Toca una celda y elige el puesto; se guarda al elegir.",
  edit: "Editar",
  finishEditing: "Terminar edición",

  legendLine: "Línea de cardas",
  legendTrigger: "Reparto igualitario (Packing ACM, Mantas Rieter)",
  legendOther: "Otros puestos",
  legendAbsence: "Ausencias",
  legendDuplicated: "Puesto repetido",
  legendLate: "Atraso (sin bono)",
  legendLeftEarly: "Salida temprana (sin bono)",
  hint: "Toca un día para ver su resumen; toca una celda para ver o cambiar el puesto.",

  /** Sunday first, as Date.getUTCDay counts. */
  weekdayInitials: ["D", "L", "M", "M", "J", "V", "S"],
  monthAbbreviations: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
  employeeColumn: "Trabajador",
  periodTotal: "Bono del período",
  dayTotal: "Bono del día",
  daySummaryFor: (date: string) => `Resumen del ${date}`,
  cellFor: (name: string, date: string, position: string) => `${name}, ${date}: ${position}`,
  noPosition: "Sin puesto",
  pending: "Por enviar",
  flagged: "Día con aviso",

  previousWeek: "Semana anterior",
  nextWeek: "Semana siguiente",
  weekRange: (from: string, to: string) => `${from} – ${to}`,

  position: "Puesto",
  dayBonus: "Bono ese día",
  noBonus: "Sin bono",
  incompleteBonus: (late: boolean, leftEarly: boolean) =>
    late && leftEarly
      ? "Sin bono: atraso y salida temprana"
      : late
        ? "Sin bono: llegó atrasado"
        : "Sin bono: se retiró temprano",
  attendance: "Asistencia",
  incompleteTitle: "Día incompleto",
  incompleteHint:
    "Sigue en su puesto, pero ese día no recibe bono ni cuenta para el reparto. El bono es solo para quien trabaja el día completo.",
  lateGroup: "Llegó atrasado",
  withNotice: "Con aviso",
  withoutNotice: "Sin aviso",
  leftEarlyGroup: "Salida",
  leftEarly: "Se retiró temprano",
  readOnlyCell: "Modo lectura. Aprieta «Editar» para cambiar el puesto.",
  historyLoading: "Cargando cambios…",
  historyFailed: "No se pudieron cargar los cambios. Revisa la señal y vuelve a abrir la celda.",
  clearPosition: "Vaciar",
  previousDay: "← Día anterior",
  nextDay: "Día siguiente →",
  openDayView: "Abrir este día en la vista Día",

  copyFrom: (day: string, count: number) => `Copiar los puestos del ${day} en ${cells(count)}`,
  copyPreviousHint: "Solo llena las celdas vacías. No cambia lo que ya está registrado.",
  nothingToCopy: "No hay celdas vacías que llenar con el día anterior.",
  copied: "Copiado. Se guarda igual que cualquier cambio.",

  endTitle: "Fecha de cierre",
  startLabel: "Desde",
  startFixed: "Empieza el día siguiente al cierre anterior. No se puede cambiar.",
  endLabel: "Hasta",
  endHint: "La fija el contador. Se puede cambiar hasta que el período se cierre.",
  endEffect: (days: number, from: string, to: string, nextStart: string) =>
    `${days === 1 ? "1 día" : `${days} días`}, del ${from} al ${to}. El período siguiente empezará el ${nextStart}.`,
  saveEnd: "Guardar fecha de cierre",
  savingEnd: "Guardando…",
  endWho: "Lo pueden cambiar RRHH y el administrador. Cerrar el período sigue siendo tarea del administrador.",
  endBeforeStart: "La fecha de término tiene que ser igual o posterior a la de inicio.",
  endNotMovable: "Este período ya no se puede cambiar: está cerrado o ya hay uno después.",
  endNoPermission: "Tu usuario no puede cambiar la fecha de cierre.",
  unavailable: "No se pudo guardar. Revisa la señal y vuelve a intentarlo.",

  holidayTag: "Feriado",
  calendarTitle: "Feriado y bono día no hábil",
  holidayLabel: "Este día es feriado",
  dayRateLabel: "Bono día no hábil para esta fecha",
  dayRateHint: (fallback: string) => `Déjalo vacío para usar el monto normal${fallback}.`,
  dayRateFallback: (amount: string) => ` (${amount})`,
  saveCalendar: "Guardar",
  savingCalendar: "Guardando…",
  calendarWho: "Lo pueden cambiar RRHH y el administrador.",
  invalidDayRate: "Escribe un monto en pesos, sin puntos, o déjalo vacío.",
  calendarNoPermission: "Tu usuario no puede marcar feriados ni cambiar el bono día no hábil.",

  assignRange: "Asignar por rango",
  rangeIntro:
    "El mismo puesto en varios días seguidos, para licencias, vacaciones o un puesto fijo. Reemplaza lo que haya en esos días.",
  rangeEmployee: "Trabajador",
  rangeChooseEmployee: "Elige a la persona",
  rangePosition: "Puesto",
  rangeFrom: "Desde",
  rangeTo: "Hasta",
  rangeLengths: "Cuántos días:",
  rangeLength: (count: number) => days(count),
  rangeDaysLabel: "Qué días",
  rangeDays: { ALL: "Todos", MON_FRI: "Lun a vie", MON_SAT: "Lun a sáb" } satisfies Record<RangeDays, string>,
  rangeNote: "Nota para todos esos días",
  rangeNoteHint: "Opcional. Si la dejas vacía, cada día conserva la nota que tenga.",
  rangeEndBeforeStart: "La fecha «Hasta» tiene que ser igual o posterior a «Desde».",
  rangeTooLong: "Elige un rango de hasta un año.",
  rangePreviewTitle: "Qué va a cambiar",
  rangeSpan: (count: number, which: RangeDays, from: string, to: string) =>
    `${count === 1 ? "1 día" : `${count} días ${RANGE_DAYS_TEXT[which]}`}, ${from === to ? `el ${from}` : `del ${from} al ${to}`}`,
  rangeReplace: (count: number) => `Reemplaza ${days(count)} que ya tenían otro puesto.`,
  rangeClear: (count: number) => `Deja ${count === 1 ? "vacío 1 día" : `vacíos ${count} días`} que tenían puesto.`,
  rangeFill: (count: number) => `Llena ${count === 1 ? "1 día vacío" : `${count} días vacíos`}.`,
  rangeNoteOnly: (count: number) => `Cambia la nota de ${days(count)} que ya tenían ese puesto.`,
  rangeSame: (count: number) => (count === 1 ? "1 día queda igual." : `${count} días quedan igual.`),
  rangePaid: (count: number) =>
    count === 1
      ? "1 día ya se pagó y no se cambia. Solo un administrador puede cambiarlo."
      : `${count} días ya se pagaron y no se cambian. Solo un administrador puede cambiarlos.`,
  rangeAfterEnd: (count: number, from: string) =>
    `${count === 1 ? "1 día es" : `${count} días son`} del período siguiente, desde el ${from}.`,
  rangeChoose: "Elige la persona y el puesto para ver qué cambia.",
  rangeTilesHint: "En cada día: arriba lo que hay hoy, abajo lo que queda.",
  rangeLoading: "Revisando esos días…",
  rangeLoadFailed: "No se pudieron revisar esos días. Revisa la señal y vuelve a intentarlo.",
  rangeApply: (position: string, count: number) => `Asignar ${position} en ${days(count)}`,
  rangeApplyClear: (count: number) => `Vaciar ${days(count)}`,
  rangeNothingToChange: "No hay nada que cambiar",
  rangeSaving: "Guardando…",
  rangeCancel: "Cancelar",
  rangeOffline: "Sin conexión. Para asignar varios días a la vez se necesita señal.",
  rangeNoPermission: "Tu usuario no puede hacer este cambio.",
  rangeDone: (name: string, position: string, from: string, to: string, count: number) =>
    `Listo. ${name} queda con ${position} del ${from} al ${to} (${days(count)} cambiados).`,
  rangeDoneCleared: (name: string, from: string, to: string, count: number) =>
    `Listo. ${name} queda sin puesto del ${from} al ${to} (${days(count)} cambiados).`,
  rangeUndo: "Deshacer",
  rangeUndone: "Se deshizo. Se guarda igual que cualquier cambio.",
  rangeDismiss: "Cerrar aviso",
  fromCellTitle: "Varios días",
  fromCellHint: "Para una licencia, vacaciones o un puesto fijo: elige el puesto una vez para un rango de fechas, desde este día.",
  fromCellButton: "Asignar a varios días",
} as const;
