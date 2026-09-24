"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Sends a form's values to a Server Action. On success it goes to `doneHref` (closing the
 * drawer that holds the form); on refusal it keeps the form open with the server's message.
 */
export function useServerSubmit<T>(action: (values: T) => Promise<{ message: string } | null>, doneHref: string) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  async function submit(values: T): Promise<void> {
    const result = await action(values);
    if (result) {
      setServerError(result.message);
      return;
    }
    router.push(doneHref, { scroll: false });
  }

  return { serverError, submit };
}
