/** A RUT without dots and with its check digit in upper case, so two spellings compare equal. */
export function normalizeRut(rut: string): string {
  return rut.replace(/[.\s]/g, "").toUpperCase();
}
