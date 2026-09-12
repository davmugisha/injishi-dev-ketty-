import type { Metadata } from "next";

/**
 * `page.tsx` in this segment is a Client Component, and a Client Component
 * cannot export `metadata` — so the route shipped with no <title> at all:
 * a blank browser tab, and nothing for a screen reader to announce on
 * navigation. A segment layout is the smallest server boundary that can name
 * the screen, and Next merges its metadata with the page's.
 */
export const metadata: Metadata = { title: "Claim your business — Injishi" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
