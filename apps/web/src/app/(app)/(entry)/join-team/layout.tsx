import type { Metadata } from "next";

/** The page is a Client Component, so the segment layout names the screen. */
export const metadata: Metadata = { title: "Join your team — Injishi" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
