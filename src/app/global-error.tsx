"use client";

import posthog from "posthog-js";
import { useEffect } from "react";
import { appCopy } from "@/copy/app";

export default function GlobalError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  useEffect(() => {
    posthog.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body>
        <main>
          <h1>{appCopy.errorTitle}</h1>
          <p>{appCopy.errorBody}</p>
          <button type="button" onClick={reset}>
            {appCopy.errorRetry}
          </button>
        </main>
      </body>
    </html>
  );
}
