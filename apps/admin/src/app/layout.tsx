import type { Metadata } from "next";
import localFont from "next/font/local";
import { AdminShell } from "@/components/shell/admin-shell";
import { StaffBoundary } from "@/components/shell/staff-boundary";
import "./globals.css";

const figtree = localFont({
  src: "../fonts/Figtree-Variable.woff2",
  variable: "--font-figtree",
  weight: "300 900",
  display: "swap",
});

const spectral = localFont({
  src: [
    { path: "../fonts/Spectral-Medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/Spectral-Bold.woff2", weight: "700", style: "normal" },
    { path: "../fonts/Spectral-ExtraBold.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-spectral",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Injishi Admin",
    template: "Injishi Admin — %s",
  },
  description:
    "Injishi internal control tower — orgs, users, brokers, money, compliance and platform health.",
  robots: { index: false, follow: false },
};

/** Applies the persisted theme before first paint (no flash of wrong theme). */
const THEME_SCRIPT =
  "try{if(localStorage.getItem('injishi-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${figtree.variable} ${spectral.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="overflow-hidden">
        {/*
         * The gate is OUTSIDE the chrome, and it is a server component.
         *
         * `AdminShell` used to wrap itself in `StaffBoundary`, which put the
         * decision inside a client component and therefore inside the browser.
         * Composing them here instead means the shell element is created but
         * never rendered when the boundary refuses, so nothing about the
         * console — not the sidebar, not the section names — reaches a caller
         * who is not staff. See `staff-boundary.tsx` for why that matters.
         */}
        <StaffBoundary>
          <AdminShell>{children}</AdminShell>
        </StaffBoundary>
      </body>
    </html>
  );
}
