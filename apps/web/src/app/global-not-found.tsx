import type { Metadata } from "next";
import { fixed, ink, green } from "@injishi/design-tokens";

/**
 * The 404 for a URL that matches no route group at all.
 *
 * It sits above every group, so it inherits **nothing**: no layout, no
 * stylesheet, no fonts, no theme class on `<html>`. That is not an oversight in
 * the tree, it is what `experimental.globalNotFound` means — the file renders
 * its own document. So every style here is inline: there is no CSS custom
 * property to reach for, because nothing declared one on this page. The values
 * still come from `@injishi/design-tokens` in TypeScript rather than as hex
 * literals, the way `manifest.ts` and `lib/pwa-metadata.ts` already do
 * (ADR-013 call 7, ADR-010 supporting call 6b).
 *
 * The one thing it can still do is follow the operating system, through
 * `light-dark()` and a `color-scheme` declaration. No script runs, so it cannot
 * read the stored `injishi-theme` choice; matching the OS is the closest a
 * document with no JavaScript gets.
 */
export const metadata: Metadata = {
  title: "Page not found | Injishi",
  robots: { index: false, follow: false },
};

const INK = fixed.ink;
const PAPER = ink[50];
const WHITE = fixed.white;
const GREEN = green[600];

export default function GlobalNotFound() {
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
            This page does not exist
          </h1>
          <p style={{ margin: 0, fontSize: "1rem", opacity: 0.75 }}>
            The address may have changed, or it may never have been one of ours.
          </p>
          <p style={{ margin: "0.5rem 0 0" }}>
            <a
              href="/"
              style={{
                display: "inline-block",
                padding: "0.75rem 1.75rem",
                borderRadius: "9999px",
                background: GREEN,
                color: INK,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Back to Injishi
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}
