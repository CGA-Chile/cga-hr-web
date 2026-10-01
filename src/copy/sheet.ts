const cells = (count: number) => (count === 1 ? "1 celda vacía" : `${count} celdas vacías`);

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
  legendTrigger: "Packing ACM (reparto igualitario)",
  legendOther: "Otros puestos",
  legendAbsence: "Ausencias",
  legendDuplicated: "Puesto repetido",
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
  readOnlyCell: "Modo lectura. Aprieta «Editar» para cambiar el puesto.",
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
} as const;
