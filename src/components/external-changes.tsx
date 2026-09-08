"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

/** Notice SQLite writes from the separate MCP process without disturbing editors. */
export function ExternalChanges({ revision }: { revision: number }) {
  const router = useRouter();
  const seen = useRef(revision);
  const [, startTransition] = useTransition();
  useEffect(() => {
    seen.current = revision;
  }, [revision]);
  useEffect(() => {
    let stopped = false;
    let inFlight = false;
    let request: AbortController | undefined;
    async function check() {
      if (
        stopped ||
        inFlight ||
        document.hidden ||
        document.querySelector("dialog[open]")
      )
        return;
      inFlight = true;
      request = new AbortController();
      const timeout = setTimeout(() => request?.abort(), 5000);
      try {
        const response = await fetch("/api/revision", {
          cache: "no-store",
          signal: request.signal,
        });
        if (!response.ok) return;
        const result = (await response.json()) as { revision?: number };
        if (
          !stopped &&
          !document.querySelector("dialog[open]") &&
          typeof result.revision === "number" &&
          result.revision !== seen.current
        ) {
          // Only the new server-rendered prop advances 'seen': failed refreshes retry.
          startTransition(() => router.refresh());
        }
      } catch {
        /* Offline or restarting: keep the current UI and retry later. */
      } finally {
        clearTimeout(timeout);
        inFlight = false;
      }
    }
    const interval = setInterval(() => {
      void check();
    }, 3000);
    const onFocus = () => {
      void check();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      stopped = true;
      clearInterval(interval);
      request?.abort();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [router]);
  return null;
}
