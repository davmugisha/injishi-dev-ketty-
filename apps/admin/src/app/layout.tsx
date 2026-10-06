import type { Metadata } from "next";
import localFont from "next/font/local";
import { Suspense } from "react";
import { AdminAssistant } from "@/components/assistant/admin-assistant";
import { AdminShell } from "@/components/shell/admin-shell";
import { StaffBoundary } from "@/components/shell/staff-boundary";
import "./globals.css";

const figtree = localFont({
  src: "../fonts/Figtree-Variable.woff2",
  variable: "--font-figtree",
  weight: "300 900",
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
      className={figtree.variable}
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
          {/* The support assistant reads its conversation on the server and
              streams in without holding up the page (ADR-061 slice G). */}
          <AdminShell
            assistant={
              <Suspense fallback={null}>
                <AdminAssistant />
              </Suspense>
            }
          >
            {/*
             * And the section gate is INSIDE the chrome (ADR-049 AC-25), but
             * it is NOT mounted here: each section's own `layout.tsx` mounts
             * `SectionBoundary` with its key.
             *
             * It used to sit on this line, and this layout does not render on
             * a soft navigation, so a `next/link` into a section the staffer
             * does not hold walked straight past it (platform audit H5).
             * `section-boundary.tsx` records why, and
             * `test/section-gates.test.mjs` fails when a section lacks one.
             *
             * The two gates refuse different people, which is why they sit on
             * different sides of the shell. `StaffBoundary` refuses somebody
             * who is not staff, and for them the sidebar itself is the
             * disclosure, so it never renders. `SectionBoundary` refuses a
             * staffer who does not hold THIS section — they are entitled to
             * the console they are already looking at, and taking it away
             * would leave a trainer who mistyped an address with no way back.
             */}
            {children}
          </AdminShell>
        </StaffBoundary>
      </body>
    </html>
  );
}
