"use client";

import posthog from "posthog-js";
import { signOut } from "@/app/(app)/actions";
import { authCopy } from "@/copy/auth";
import styles from "./AppHeader.module.css";

/** Signs out and forgets the PostHog identity, so the next user on this device starts clean. */
export function SignOutButton() {
  return (
    <form action={signOut} onSubmit={() => posthog.reset()}>
      <button type="submit" className={styles.signOut}>
        {authCopy.signOut}
      </button>
    </form>
  );
}
