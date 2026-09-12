"use client";

import { RouteFailure } from "@/components/shared/route-failure";

/**
 * Anything under the marketplace that throws.
 *
 * `/explore` had the only boundary in the app, so every other public page —
 * a property, a guide, the support form — replaced the whole document with the
 * framework's screen when it threw, header and footer included. This keeps the
 * chrome (the boundary sits inside `(marketplace)/layout.tsx`) and keeps the
 * ways out reachable. `/explore` keeps its own, worded for a search.
 */
export default function MarketplaceError({
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
      context="marketplace: page failed to render"
      title="This page didn't load"
    >
      Something on our side stopped it, and nothing you did caused it. Nothing
      you were looking at has been lost — trying again is usually enough.
    </RouteFailure>
  );
}
