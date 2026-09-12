"use client";

/**
 * The operator app, when a screen throws.
 *
 * There was no error boundary anywhere in this app, so anything thrown below
 * the root replaced the whole document with the framework's own screen — no
 * chrome, no wording, and on a production build no clue at all. A front desk
 * with a guest in front of them got a blank page and a stack trace they cannot
 * read.
 *
 * It reads as ours, not as a fault. Nobody at the desk did anything to cause
 * this, so the copy owns it and offers the two things that actually help:
 * render the screen again (`reset()` retries the boundary's subtree, which is
 * usually enough for a transient failure), and a way back to the workspace.
 *
 * `error.digest` is the server-side correlation id and is the one piece of the
 * error worth printing: it is what support can look up. The message itself is
 * never shown — it is written for whoever wrote the code.
 */

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@injishi/ui";

export default function OperatorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The console is the only sink this app has today. When Sentry lands
    // (`[planned]` in library-docs.md) this is the call site that changes.
    console.error("operator app: screen failed to render", error);
  }, [error]);

  return (
    <div
      className="pms-root"
      style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}
    >
      <div style={{ maxWidth: "44ch", textAlign: "center" }}>
        <h1 className="pms-display" style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)" }}>
          This screen stopped short
        </h1>
        <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.55, color: "var(--muted)" }}>
          Something went wrong on our side while drawing it. Nothing you were looking at
          has been lost, and nothing was changed — opening it again is usually enough.
        </p>

        <div style={{ marginTop: 18, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10 }}>
          <Button size="sm" shape="rounded" onClick={reset}>
            Try this screen again
          </Button>
          <Button asChild variant="outline" size="sm" shape="rounded">
            <Link href="/">Back to your workspace</Link>
          </Button>
        </div>

        {error.digest ? (
          <p className="pms-num" style={{ marginTop: 14, fontSize: 12, color: "var(--faint)" }}>
            Reference for support: {error.digest}
          </p>
        ) : null}
      </div>
    </div>
  );
}
