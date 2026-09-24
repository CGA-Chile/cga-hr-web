import type { IsoDate } from "@/domain/bonus/types";

export function dayPath(date: IsoDate, params: Record<string, string> = {}): string {
  const query = new URLSearchParams(params).toString();
  return `/dia/${date}${query ? `?${query}` : ""}`;
}
