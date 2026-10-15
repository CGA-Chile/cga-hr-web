"use client";

import { useEffect, useRef, useState } from "react";

export type BrowserRead<T> = { status: "LOADING" } | { status: "FAILED" } | { status: "LOADED"; data: T };

/**
 * A read made straight from the browser, under the same RLS as a server read, for one `key`. It
 * runs again whenever the key or `freshness` changes; the sheet passes its latest server data as
 * freshness, so an edit that lands is read again too. While a new read is in flight, or if it
 * fails, data already shown for the same key stays on screen; a response for another key is never
 * shown.
 */
export function useBrowserRead<T>(key: string, load: () => Promise<T>, freshness: unknown): BrowserRead<T> {
  const [result, setResult] = useState<{ key: string; read: BrowserRead<T> } | null>(null);
  const latestLoad = useRef(load);

  useEffect(() => {
    latestLoad.current = load;
  });

  useEffect(() => {
    let current = true;
    latestLoad.current().then(
      (data) => current && setResult({ key, read: { status: "LOADED", data } }),
      () =>
        current &&
        setResult((previous) =>
          previous?.key === key && previous.read.status === "LOADED" ? previous : { key, read: { status: "FAILED" } },
        ),
    );
    return () => {
      current = false;
    };
  }, [key, freshness]);

  return result?.key === key ? result.read : { status: "LOADING" };
}
