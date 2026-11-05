import type { WorkeraCredentials } from "./client";

/** Server-side only. These must never carry the NEXT_PUBLIC_ prefix. */
export function workeraCredentials(): WorkeraCredentials {
  const user = process.env.WORKERA_API_USER;
  const key = process.env.WORKERA_API_KEY;
  if (!user || !key) throw new Error("WORKERA_API_USER and WORKERA_API_KEY must be set");
  return { user, key };
}
