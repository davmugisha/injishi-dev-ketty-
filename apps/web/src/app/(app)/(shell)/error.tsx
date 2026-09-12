"use client";

import { RouteFailure } from "@/components/shared/route-failure";

/**
 * A personal screen that throws — trips, saved, the stay hub, a receipt.
 *
 * It sits inside `(shell)/layout.tsx`, so the sidebar and topbar stay: a
 * person whose receipt page broke is still signed in, and a screen that
 * swallows the whole shell says otherwise. That is the reassurance this copy
 * makes explicit, because "it broke" and "I've been signed out" feel identical
 * from the outside.
 */
export default function ShellError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteFailure
      error={error}
      reset={reset}
      context="app shell: screen failed to render"
      title="This screen didn't load"
      home={{ href: "/trips", label: "Back to my trips" }}
    >
      Something on our side stopped it. You are still signed in and nothing has
      changed on your account — trying again is usually enough.
    </RouteFailure>
  );
}
