"use client";

import posthog from "posthog-js";
import { useEffect, useRef } from "react";
import type { AppRole } from "@/utils/supabase/currentProfile";

/** Ties PostHog events to the signed-in user. Renders nothing. */
export function AnalyticsIdentity({
  userId,
  username,
  role,
}: {
  userId: string;
  username: string | null;
  role: AppRole | null;
}) {
  const identifiedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (identifiedUserId.current === userId) return;
    if (identifiedUserId.current) posthog.reset();

    posthog.identify(userId, { username, role });
    identifiedUserId.current = userId;
  }, [role, userId, username]);

  return null;
}
