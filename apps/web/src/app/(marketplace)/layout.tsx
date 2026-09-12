import type { Metadata, Viewport } from "next";
import { fixed } from "@injishi/design-tokens";
import { cn } from "@injishi/utils";
import { pwaMetadata } from "@/lib/pwa-metadata";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { figtree, spectral } from "@/lib/fonts";
import "../_injishi-public.css";

/**
 * The marketplace root layout — one of TWO, per ADR-006 call 2 and ADR-021.
 *
 * `apps/web` has no `app/layout.tsx` on purpose. The public layer and the
 * signed-in layer are a fork with two Tailwind entries and two theme
 * mechanisms, so each owns its own `<html>` and `<body>`. This file owns the
 * document for every marketplace page; `(app)/layout.tsx` owns the other one.
 *
 * The count in this comment has been wrong twice. It said five, naming `(app)`
 * and `(signin)`; ADR-017 retired `(signin)` and it said three; ADR-018 move 4
 * brought `(app)` back and it was four. ADR-021 folded `(auth)` and
 * `(onboarding)` into `(app)`, so TWO is the whole list, and there is no third
 * place left for it to drift to.
 *
 * THE GROUP IS `(marketplace)`. ADR-021 renamed it, because its old name stated
 * an ACCESS CLASS rather than chrome, which breaks the rule this very comment
 * writes down below. That name only ever made sense while a private group sat
 * beside it, and `(app)` is named for what it is, so the contrast is gone.
 * `_injishi-public.css` keeps its file name on purpose — that file is named for
 * the LAYER, which the corpus still calls the public layer, and the rename does
 * not touch it.
 *
 * Chrome does NOT live here. It lives in the three groups below, because they
 * do not share one. Each group is named for the chrome it puts on, never for
 * the route inside it — `(book)/book` and `(explore)/explore` stuttered, and a
 * group that repeats its only child's name tells a reader nothing:
 *
 *   (site)      — the canonical header and footer.
 *   (results)   — its own nav on a navy band, then a white sheet. Holds /explore.
 *   (checkout)  — a minimal checkout header and no footer. Holds /book.
 *
 * `MobileTabBar` is deliberately not composed here. `SiteFooter` mounts it, so
 * adding it would render a fixed bottom bar twice (ADR-013).
 *
 * Crossing out of this root — `/property/[slug]` to `/sign-in`, `/book` to
 * `/sign-in` — is a full page load. That is inherent to multiple root layouts
 * and is the price ADR-006 accepted for not rewriting working layouts. There is
 * exactly one such crossing left now, this root and the other one.
 */
export const metadata: Metadata = {
  // The public site is the surface the manifest's `start_url` points at, so it
  // carries the same PWA head as the one app root. It used to carry none,
  // and set its own favicon URL instead.
  ...pwaMetadata,
  // `??` lets an env var that is set to "" through, and `new URL("")` throws.
  // That is how a Vercel production build died in page-data collection: the
  // project carried NEXT_PUBLIC_SITE_URL as an empty string. `||` treats empty
  // as absent. VERCEL_PROJECT_PRODUCTION_URL is Vercel's own stable production
  // host, so this follows a custom domain the day one is attached.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "http://localhost:3000"),
  ),
  title: {
    default: "Stay Anywhere in Rwanda: Guesthouses, Lodges & Apartments | Injishi",
    template: "%s | Injishi",
  },
  description:
    "Book verified guesthouses, lodges and serviced apartments across Rwanda. Escrow-backed payment, self check-in, and support from search to arrival.",
};

/**
 * The toolbar tint reads from the token package rather than repeating hex here,
 * the same way `lib/pwa-metadata.ts` does for the app root (ADR-010
 * supporting call 6b). `themeColor` needs a literal colour, so a CSS variable
 * cannot be used — the token is resolved in TypeScript instead.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: fixed.white },
    { media: "(prefers-color-scheme: dark)", color: fixed.ink },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={cn(figtree.variable, spectral.variable)}
      suppressHydrationWarning
    >
      <body className="antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
