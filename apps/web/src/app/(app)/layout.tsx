import type { Metadata } from "next";
import type { ReactNode } from "react";

import BaseChrome from "@/components/app/base-chrome";
import { HeroRouter } from "@/components/heroui/router";
import { AnalyticsScript } from "@/components/shared/analytics-script";
// Build-time Tailwind for this whole layer. One import, one group (ADR-021).
import "../_injishi-app.css";
import { pwaMetadata, pwaViewport } from "@/lib/pwa-metadata";
import { outfit } from "@/lib/fonts";
import { WEB_URL } from "@/lib/web-url";

/**
 * THE ONE ROOT DOCUMENT for the signed-in layer (ADR-021).
 *
 * `apps/web` has no `src/app/layout.tsx`: the public layer and this one are a
 * deliberate fork with two Tailwind entries and two theme mechanisms, so each
 * top-level group owns its own document (ADR-006, call 2a). That call stands.
 * What changed is the COUNT. There used to be four such groups and three of them
 * — `(app)`, `(auth)`, `(onboarding)` — dressed the same person in the same
 * brand from three files that had already drifted: `(onboarding)` still fetched
 * a second stylesheet for its fonts and carried no robots directive at all.
 * Those three are now this one, and there is nowhere left for that drift to
 * happen.
 *
 * THE SHELL IS NOT HERE, and its absence is the whole point. Next composes
 * layouts down the segment path with no way to opt out of a parent, so a root
 * that renders `<AppShell>` cannot host a sign-in screen. Two nested groups sit
 * under this file instead: `(shell)` puts the sidebar and topbar on the six
 * Personal routes, `(entry)` puts nothing on the five sign-in and sign-up
 * routes. Do not move `<AppShell>` back up here.
 *
 * The route group is invisible in the URL, so these pages are `/trips` and
 * `/sign-in`, not `/(app)/trips`. That matters to `proxy.ts`, whose
 * allowlist has to name the real paths, and it is why this change moves eleven
 * folders without moving a single URL.
 *
 * Nothing about the wiring below was chosen here. `_injishi-app.css` carries
 * `@source "./(app)"`, which recurses into both nested groups, so every class in
 * this layer compiles from that one glob. `<BaseChrome/>` is the signed-in theme
 * mechanism (`ThemeBoot`, a pre-paint script reading `injishi-theme`), which is
 * deliberately NOT the public layer's `ThemeProvider`. The brand face
 * arrives through `next/font/local`, which is ADR-017's two-sheet ceiling: not
 * one stylesheet link element is left anywhere under `src/app`. Written out
 * rather than shown as a tag on purpose — `tests/stylesheet-precedence.test.mjs`
 * scans this file as TEXT, so a specimen tag in a comment fails the guard.
 *
 * ROBOTS. Ten of the eleven routes here are private surfaces a crawler must
 * never index, so the directive is set once, at the top, for all of them.
 * `proxy.ts` already refuses the gated ones without a session, but a
 * directive costs nothing and does not depend on the gate. `/register` is the
 * single exception and overrides this on its own page metadata, because Next
 * merges segment metadata deepest-last.
 */
export const metadata: Metadata = {
  ...pwaMetadata,
  // The site share card (`app/opengraph-image.tsx`) reaches these routes too,
  // and a relative image URL needs an origin to become absolute. Without it
  // Next falls back to localhost, which is what a shared `/register` link
  // would have shown.
  metadataBase: new URL(WEB_URL),
  robots: { index: false, follow: false },
};
export const viewport = pwaViewport;

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={outfit.variable}
      suppressHydrationWarning
    >
      <body className="antialiased">
        <BaseChrome />
        <HeroRouter>{children}</HeroRouter>
        {/* The same counter as the marketplace root, so `/host` into `/register`
            and `/sign-in` is one journey in the numbers (`lib/analytics.ts`). */}
        <AnalyticsScript />
      </body>
    </html>
  );
}
