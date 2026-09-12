"use client";

import { Button } from "@injishi/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CONFIGURATION_SUBNAV } from "@/lib/nav";

/**
 * The switcher between Configuration's screens.
 *
 * A client component only because it needs `usePathname` to mark the current
 * screen. Rendered at the top of each Configuration page rather than injected
 * by a route-group layout: a layout would put the same chrome around any future
 * page under `/configuration` whether or not it belongs in this row, and there
 * is nothing here worth hiding that decision behind.
 *
 * Match is exact, not by prefix. `/configuration` is a prefix of
 * `/configuration/fees`, so a `startsWith` test would light both rows at once
 * on the fees screen — the sidebar wants that behaviour for its section row and
 * this row is the opposite case.
 *
 * Each row is a LINK wearing the shared `Button` (`asChild`), not a button: it
 * navigates, so it keeps its href, its middle click and its context menu.
 */
export function ConfigurationSubnav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Configuration screens">
      <ul className="flex flex-wrap gap-2">
        {CONFIGURATION_SUBNAV.map((item) => {
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
