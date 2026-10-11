import type { Metadata } from "next";
import { THEME_BOOT } from "@/pms/lib/theme";
import { Providers } from "./providers";
// Tailwind v4 + the shadcn theme bridge; it imports pms-tokens.css, which stays
// the single source of colour. Fonts (Inter, the one family) are self-hosted via the
// linked stylesheet below.
import "./globals.css";

export const metadata: Metadata = {
  title: "Injishi PMS",
  icons: { icon: [{ url: "/shared/img/injishi-short.svg", type: "image/svg+xml" }] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Pre paint theme boot (ADR-037 call 5): stamp `.dark` or `.light` on
            <html> from the shared key before anything renders, so there is no
            flash of the other theme on the way into the operator zone. A RAW
            script tag in <head>, not `next/script`: `beforeInteractive` queues
            the body into `self.__next_s` and runs it from the framework chunk,
            which is after first paint and, measured on 2026-09-06, never ran
            here at all. This runs where it stands. */}
        <script id="injishi-theme-boot" dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      {/* Browser extensions (Grammarly, password managers) stamp their own
          attributes on <body> before React loads, which the dev overlay then
          reports as a hydration error in OUR tree. Suppressed here for the
          same reason as on <html>: the attributes on this one element are not
          ours to match. It is one level deep, so a real mismatch inside the
          app is still reported. */}
      <body suppressHydrationWarning>
        <link rel="stylesheet" href="/shared/css/injishi-fonts.css" precedence="default" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
