const CLP = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" });

/** "$15.000". Amounts are integer pesos, so there is never a decimal part. */
export function formatPesos(amount: number): string {
  return CLP.format(amount);
}
