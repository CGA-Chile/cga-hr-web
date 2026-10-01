const CLP = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" });

/** "$15.000". Amounts are integer pesos, so there is never a decimal part. */
export function formatPesos(amount: number): string {
  return CLP.format(amount);
}

const THOUSANDS = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1, roundingMode: "trunc" });

/** "26k", "25,5k": a day's total squeezed into a narrow column. Truncates, never rounds up. */
export function formatThousands(amount: number): string {
  return `${THOUSANDS.format(amount / 1000)}k`;
}
