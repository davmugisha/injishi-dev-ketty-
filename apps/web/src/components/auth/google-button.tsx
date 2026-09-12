"use client";

import { useEffect, useState } from "react";
import { Button } from "@injishi/ui";
import { GoogleMark } from "@/components/icons/marks";
import { InlineError } from "@/components/auth/auth-feedback";
import { authClient } from "@/lib/auth-client";
import { absoluteRedirect } from "@/lib/redirect";

/**
 * Every sentence this button can say, and none of them is Better Auth's.
 *
 * `failed.message` used to be rendered straight through, so a guest could read
 * whatever the library or the provider happened to put in it. Each of these
 * says what happened, whether they are signed in, and the one next step — which
 * is always "or use your email", because that path is right there and works.
 */
const GOOGLE_MESSAGES = {
  bounced:
    "Google sign-in didn't finish, so you're not signed in. Try again, or use your email below.",
  refused:
    "Google sign-in couldn't start. Try again, or use your email below.",
  unreachable:
    "We couldn't reach Google sign-in just now — that's on our side. Try again, or use your email below.",
} as const;

/**
 * Google sign-in (ADR-017, AC-11).
 *
 * THIS HALF STAYS IN THE BROWSER AND CANNOT MOVE TO THE SERVER ACTION.
 * `authClient.signIn.social` has to redirect the browser itself, and the
 * session that comes back belongs to the API origin. A Server Action on the
 * web origin could neither perform that navigation nor receive the cookie.
 *
 * `redirectTo` is already resolved: the page ran it through `safeRedirect`
 * before rendering, so the exact-origin allowlist has done its work. It is
 * turned into an absolute url here because a callback url cannot be a path,
 * and because it may legitimately point at another Injishi app.
 */
export default function GoogleButton({
  redirectTo,
  bounced,
}: {
  redirectTo: string;
  bounced?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    bounced ? GOOGLE_MESSAGES.bounced : null,
  );
  const [attempt, setAttempt] = useState(0);

  /**
   * Coming BACK from Google has to clear the wait.
   *
   * A person who reaches Google, changes their mind and presses Back lands on a
   * restored page — this component is not re-created, so "Opening Google…" was
   * still sitting there, on a button that had nothing left to open.
   */
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) setBusy(false);
    };
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, []);

  function fail(message: string) {
    setError(message);
    setAttempt((n) => n + 1);
    setBusy(false);
  }

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const { error: failed } = await authClient.signIn.social({
        provider: "google",
        // Land on the resolver, which enforces the second factor and routes
        // by role, rather than on the destination itself (F-S02).
        callbackURL: absoluteRedirect(
          `/start?redirect=${encodeURIComponent(redirectTo)}`,
        ),
        errorCallbackURL:
          `${window.location.origin}/sign-in?error=google` +
          `&redirect=${encodeURIComponent(redirectTo)}`,
      });
      // `failed.message` is the library's, not ours, and is never shown.
      if (failed) fail(GOOGLE_MESSAGES.refused);
      // On success the client navigates the browser to Google, so there is
      // nothing to reset: this page is on its way out.
    } catch {
      fail(GOOGLE_MESSAGES.unreachable);
    }
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <Button
        variant="secondary"
        className="w-full"
        onClick={start}
        pending={busy}
        data-cy="google-button"
      >
        <GoogleMark className="size-4 shrink-0" />
        {busy ? "Opening Google…" : "Continue with Google"}
      </Button>
      {error ? <InlineError key={attempt}>{error}</InlineError> : null}
    </div>
  );
}
