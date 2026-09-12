import type { Metadata, Viewport } from "next";
import { fixed } from "@injishi/design-tokens";

/**
 * Shared PWA <head> additions, merged into every root layout.
 *
 * There is deliberately no `icons` key here, and there must not be one in any
 * layout either. Next resolves the App Router icon files — `app/favicon.ico`,
 * `app/icon.svg`, `app/icon.png`, `app/apple-icon.png` — into the metadata ONLY
 * when no segment set `icons` dynamically (see `resolve-metadata.ts`). With
 * five roots, one explicit `icons` anywhere silently discarded all four files
 * for every route, which is how this app ended up shipping two different
 * favicon URLs and no apple-touch icon on the public site.
 *
 * So the file convention is the single definition. Regenerate the files with
 * `pnpm icons`; do not re-add an `icons` key to buy a one-off.
 */
export const pwaMetadata: Metadata = {
  applicationName: "Injishi",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Injishi",
    statusBarStyle: "default",
  },
};

// Adaptive toolbar tint: white in light mode, brand ink in dark mode.
// viewport-fit=cover makes standalone mode respect notches/safe areas.
export const pwaViewport: Viewport = {
  themeColor: [
    // ADR-010 supporting call 6b: both values read from the token package in
    // TypeScript rather than being repeated as hex here.
    { media: "(prefers-color-scheme: light)", color: fixed.white },
    { media: "(prefers-color-scheme: dark)", color: fixed.ink },
  ],
  colorScheme: "light dark",
  viewportFit: "cover",
};
