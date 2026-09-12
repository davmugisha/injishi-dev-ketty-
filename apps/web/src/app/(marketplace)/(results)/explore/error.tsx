"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@injishi/ui";

/**
 * The results page, when it throws.
 *
 * `/explore` had no error boundary, so anything thrown below it climbed to the
 * root and replaced the whole document with the framework's own screen: header,
 * footer and all, gone. This keeps the chrome (the boundary sits inside
 * `(results)/layout.tsx`, which renders the shared `SiteHeader` and
 * `SiteFooter`) and keeps the two ways out of a broken search page reachable.
 *
 * It reads as a refusal, not as a stack trace. `ui-rules.md` § Do Nots: never
 * show a raw error message. `error.digest` is the server-side correlation id
 * and is the one thing worth printing, because it is what support can look up.
 */
export default function ExploreError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The console is the only sink this app has today. When Sentry lands
    // (`[planned]` in library-docs.md) this is the call site that changes.
    console.error("explore: results failed to render", error);
  }, [error]);

  return (
    <div className="page-y container">
      <div className="mx-auto flex max-w-[46ch] flex-col items-center gap-4 py-24 text-center">
        <h1 className="text-2xl text-page-fg">Search is not loading</h1>
        <p className="text-sm text-page-fg-70">
          Something on our side stopped this page from building your results. Your
          search has not been lost, so trying again is usually enough.
        </p>

        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button asChild variant="outline">
            <Link href="/">Back to home</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/support">Contact support</Link>
          </Button>
        </div>

        {error.digest ? (
          <p className="mt-2 text-xs text-page-fg-70">
            Reference for support: {error.digest}
          </p>
        ) : null}
      </div>
    </div>
  );
}
