"use client";

import { useEffect } from "react";
import { fixed, ink, green } from "@injishi/design-tokens";

/**
 * The last thing this app can say.
 *
 * A `global-error.tsx` catches what the route groups' own boundaries cannot: a
 * throw in a root layout itself. Next replaces the ROOT DOCUMENT with this
 * file, so — exactly like `global-not-found.tsx` — it inherits nothing: no
 * layout, no stylesheet, no fonts, no theme class. Every style here is
 * therefore inline, and the values come from `@injishi/design-tokens` in
 * TypeScript rather than as hex literals (ADR-010 supporting call 6b).
 * `light-dark()` and `color-scheme` follow the operating system, which is the
 * closest a document with no script gets to the reader's chosen theme.
 *
 * Until this file existed, that failure showed the framework's own error
 * screen: in production a bare "Application error: a client-side exception has
 * occurred", which tells a guest nothing except that something is broken and
 * possibly their fault. This owns it, in one sentence, and offers the two moves
 * that ever help — reload, or go home.
 */
const INK = fixed.ink;
const PAPER = ink[50];
const WHITE = fixed.white;
const GREEN = green[600];

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("web: root layout failed", error);
  }, [error]);

  return (
    <html lang="en" style={{ colorScheme: "light dark" }}>
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          background: `light-dark(${WHITE}, ${INK})`,
          color: `light-dark(${INK}, ${PAPER})`,
          fontFamily:
            "Figtree, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <main
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            maxWidth: "34rem",
            textAlign: "center",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "0.8125rem",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              opacity: 0.6,
            }}
          >
            Injishi
          </p>
          <h1
            style={{
              margin: 0,
              fontFamily: "Spectral, ui-serif, Georgia, serif",
              fontSize: "clamp(2rem, 6vw, 3rem)",
              lineHeight: 1.2,
              fontWeight: 500,
            }}
          >
            Injishi stopped working for a moment
          </h1>
          <p style={{ margin: 0, fontSize: "1rem", opacity: 0.75 }}>
            That is on us, not on you, and nothing on your account has changed.
            Reloading almost always brings it back.
          </p>
          <p style={{ margin: "0.5rem 0 0", display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={reset}
              style={{
                padding: "0.75rem 1.75rem",
                borderRadius: "9999px",
                border: "none",
                background: GREEN,
                color: INK,
                fontFamily: "inherit",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reload the page
            </button>
            <a
              href="/"
              style={{
                display: "inline-block",
                padding: "0.75rem 1.75rem",
                borderRadius: "9999px",
                border: `1px solid light-dark(${INK}, ${PAPER})`,
                color: "inherit",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Back to Injishi
            </a>
          </p>
          {error.digest ? (
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.8125rem", opacity: 0.6 }}>
              Reference for support: {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
