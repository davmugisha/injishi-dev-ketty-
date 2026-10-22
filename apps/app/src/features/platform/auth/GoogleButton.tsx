"use client";

import { Button } from "@heroui/react";
import { useEffect, useState } from "react";
import { signInErrorMessage } from "@/lib/sign-in-messages";

/** Where the browser reaches the API (Better Auth is mounted at /api/auth on it). */
const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/+$/, "");

/**
 * "Continue with Google", the same exchange web's button makes (ADR-017, AC-11).
 *
 * THIS HALF RUNS IN THE BROWSER. The API answers the start with a state cookie that Google's return is
 * checked against, and only a request the browser itself makes can receive it. A Server Action here
 * would receive it instead, and the return would fail its state check.
 *
 * Google comes back to `/auth/continue` on this app, which sends an operator through the emailed step-up
 * a Google session still owes, then on to `next`. A failure comes back to sign-in with `?error=google`.
 */
export function GoogleButton({ next }: { next: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Back from Google's page without finishing: the restored page must not still say "Opening Google…".
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) setBusy(false);
    };
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, []);

  async function start() {
    setBusy(true);
    setError(null);
    const origin = window.location.origin;
    const carry = next ? `next=${encodeURIComponent(next)}` : "";
    try {
      const response = await fetch(`${API_URL}/api/auth/sign-in/social`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "google",
          callbackURL: `${origin}/auth/continue${carry ? `?${carry}` : ""}`,
          errorCallbackURL: `${origin}/sign-in?error=google${carry ? `&${carry}` : ""}`,
        }),
      });
      const body = (await response.json().catch(() => null)) as { url?: unknown } | null;
      if (response.ok && typeof body?.url === "string") {
        window.location.assign(body.url);
        return;
      }
      setError(signInErrorMessage("google"));
    } catch {
      setError(signInErrorMessage("google-unreachable"));
    }
    setBusy(false);
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <Button variant="secondary" fullWidth isPending={busy} onPress={start} className="rounded-full">
        <span aria-hidden="true" className="font-bold">
          G
        </span>
        {busy ? "Opening Google…" : "Continue with Google"}
      </Button>
      {error ? (
        <p role="alert" className="text-center text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
