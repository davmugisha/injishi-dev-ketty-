"use client";

import { RouterProvider } from "@heroui/react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Hands Next's router to React Aria, so a HeroUI part carrying an `href` (a
 * `Tab`, a `DropdownItem`, a `BreadcrumbsItem`, a `Link`) navigates the way a
 * `next/link` does instead of reloading the document.
 *
 * Without it every one of those is a plain anchor to React Aria: the click
 * works, and throws away the client cache and both route group shells with it.
 * Mounted once in each root layout, inside the theme provider, because those
 * are the only two documents in this app (ADR-021).
 *
 * `next/link` stays the right element for primary navigation: it prefetches,
 * and nothing here does.
 */
export function HeroRouter({ children }: { children: ReactNode }) {
  const router = useRouter();
  return <RouterProvider navigate={(href) => router.push(href)}>{children}</RouterProvider>;
}
