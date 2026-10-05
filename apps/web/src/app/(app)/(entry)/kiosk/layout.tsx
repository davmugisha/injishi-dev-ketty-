import type { Metadata } from "next";

/**
 * `page.tsx` here is a Client Component and cannot name the screen, so this
 * segment layout does (as `/activate`'s does). No robots: a kiosk is a tablet
 * at a staff door, not a page anyone should find.
 */
export const metadata: Metadata = { title: "Kiosk — Injishi", robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
