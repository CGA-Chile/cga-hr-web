export const anomaliesCopy = {
  title: "Días con avisos",
  intro:
    "Días que todavía no se pagan y tienen algo que revisar. Un día sale de esta lista cuando se corrige.",
  empty: "No hay días con avisos.",
  goToDay: "Ir al día",
  link: (count: number) => (count === 0 ? "Días con avisos" : `Días con avisos (${count})`),
} as const;
