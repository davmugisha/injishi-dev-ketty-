import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import type { ReactNode } from "react";
import { THEME_MIGRATION } from "@/lib/theme";
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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="mouve-light"
      className={outfit.variable}
      suppressHydrationWarning
    >
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static pre-paint script, no user input (Next "Preventing Flash" guide) */}
        <script dangerouslySetInnerHTML={{ __html: THEME_MIGRATION }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
