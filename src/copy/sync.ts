const changes = (count: number) => (count === 1 ? "1 cambio guardado" : `${count} cambios guardados`);

export const syncCopy = {
  offline: (count: number) =>
    count === 0 ? "Sin conexión" : `Sin conexión — ${changes(count)} en este dispositivo`,
  sending: "Enviando cambios…",
  waiting: (count: number) => (count === 1 ? "1 cambio por enviar" : `${count} cambios por enviar`),
  allSaved: "Todo guardado",
} as const;
