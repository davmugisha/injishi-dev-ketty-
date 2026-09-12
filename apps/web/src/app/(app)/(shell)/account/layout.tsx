import type { Metadata } from "next";

/**
 * `page.tsx` in this segment is a Client Component, and a Client Component
 * cannot export `metadata` — so the route shipped with no <title> at all:
 * a blank browser tab, and nothing for a screen reader to announce on
 * navigation. A segment layout is the smallest server boundary that can name
 * the screen, and Next merges its metadata with the page's.
 *
 * The same fix `activate/layout.tsx` and `claim-org/layout.tsx` already carry.
 * `/account` was the last route in this layer without a title (ADR-021, AC-6).
 * The bare form matches its five siblings under `(shell)`, which name the screen
 * and nothing else.
 */
export const metadata: Metadata = { title: "Account" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
