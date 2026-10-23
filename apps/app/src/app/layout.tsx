import type { Metadata, Viewport } from "next";
import { Figtree, Instrument_Sans } from "next/font/google";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import { ThemeMigrationScript } from "./theme-migration-script";
import "./globals.css";

const figtree = Figtree({ subsets: ["latin", "latin-ext"], variable: "--font-figtree", display: "swap" });
const instrumentSans = Instrument_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-instrument-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Injishi", template: "%s · Injishi" },
  description: "Hospitality platform for Rwanda — a workspace shaped for every person who runs the business.",
  icons: { icon: "/brand/injishi-mark.png" },
};

export const viewport: Viewport = {
  themeColor: "#e8f3f0",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="mouve-light"
      data-vibrant-palette="true"
      className={`${figtree.variable} ${instrumentSans.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeMigrationScript />
      </head>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
