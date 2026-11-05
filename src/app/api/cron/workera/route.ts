import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { todayInChile } from "@/utils/chileDate";
import { createSupabaseServiceClient } from "@/utils/supabase/service";
import { createWorkeraClient } from "@/utils/workera/client";
import { workeraCredentials } from "@/utils/workera/env";
import { firstReadDate, nightlyRange, readWorkeraRange } from "@/utils/workera/read";

/** Workera serves 20 clockings a page, and a page can take over ten seconds. */
export const maxDuration = 300;

/** Vercel Cron calls this each night, sending CRON_SECRET as a bearer token. */
export async function GET(request: NextRequest) {
  if (!isFromCron(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServiceClient();
  const { from, to } = nightlyRange(todayInChile(), await firstReadDate(supabase));
  await readWorkeraRange(createWorkeraClient(workeraCredentials()), supabase, from, to);
  return NextResponse.json({ from, to });
}

function isFromCron(authorization: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !authorization) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authorization);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
