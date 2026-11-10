import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { catalogs, DEFAULT_LOCALE, isLocale } from "@injishi/i18n";
import { InlineScript } from "@/components/inline-script";
import { THEME_MIGRATION } from "@/lib/theme";
import { currentApi, currentSessionCookie } from "@/lib/session";
import { Providers } from "./providers";
import "./globals.css";

// Outfit for body and headings, as the saved design system "Injishi.hs" sets
// them (ADR-068, synced 2026-11-03). `@injishi/ui/styles/injishi.css` reads it
// as --font-outfit.
const outfit = Outfit({ subsets: ["latin", "latin-ext"], variable: "--font-outfit", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Injishi", template: "%s · Injishi" },
  description: "Hospitality platform for Rwanda — a workspace shaped for every person who runs the business.",
  icons: { icon: "/brand/injishi-mark.png" },
};

export const viewport: Viewport = {
  // The light canvas of the design system (`--background`, DESIGN.md #EDF1EE).
  themeColor: "#EDF1EE",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const chosen = (await cookies()).get("NEXT_LOCALE")?.value;
  let locale = isLocale(chosen) ? chosen : DEFAULT_LOCALE;
  if (await currentSessionCookie()) {
    try {
      const preference = await (await currentApi()).get<{ locale?: unknown }>("/api/v1/me/preferences/language");
      if (isLocale(preference.locale)) locale = preference.locale;
    } catch {
      // A profile preference outage must not prevent the app from rendering; keep the browser choice or English.
    }
  }
  return (
    <html
      lang={locale}
      data-theme="mouve-light"
      className={outfit.variable}
      suppressHydrationWarning
    >
      <head>
        {/* The saved theme is put on <html> while the browser parses this, before the first paint, so a dark
            theme never flashes light (Next: "Preventing flash before hydration"). InlineScript keeps the
            server copy executable and the client copy inert, so React does not warn about a script tag. */}
        <InlineScript html={THEME_MIGRATION} />
      </head>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <Providers locale={locale} messages={catalogs[locale]}>{children}</Providers>
      </body>
    </html>
  );
}
