"use client";

import { Button } from "@injishi/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The switcher between Training's three screens (ADR-049).
 *
 * The same shape as `ConfigurationSubnav`, for the same reasons: a row of
 * links wearing the shared `Button`, rendered at the top of each page rather
 * than injected by a route layout, because `/training/[sessionId]` (a roster)
 * sits under the same prefix and does not belong in this row.
 *
 * NOT A PERMISSION REGISTER. Every row is shown to everybody who reached the
 * section: a trainer holding only `training.view` may READ the venue and
 * course lists (their session form is filled from them), and it is the
 * controls on those screens that are held back, each against its own
 * permission. The section itself is its `NAV` entry's `permission` in `lib/nav.ts`.
 *
 * Sessions matches `/training` exactly and nothing under it, so a roster page
 * does not light the Sessions row it is not part of.
 */
const SCREENS = [
  { href: "/training", label: "Sessions", detail: "Drafts, published and cancelled sessions" },
  { href: "/training/courses", label: "Courses", detail: "What a certificate names, drafts included" },
  { href: "/training/venues", label: "Venues", detail: "Where training may happen" },
] as const;

export function TrainingSubnav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Training screens">
      <ul className="flex flex-wrap gap-2">
        {SCREENS.map((item) => {
          const current = pathname === item.href;
          return (
            <li key={item.href}>
              <Button asChild variant={current ? "primary" : "outline"} size="sm">
                <Link
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  title={item.detail}
                >
                  {item.label}
                </Link>
              </Button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
