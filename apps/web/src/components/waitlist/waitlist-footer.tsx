import Image from "next/image";
import Link from "next/link";
import {
  WAITLIST_FOOTER_LINE,
  WAITLIST_FOOTER_LINKS,
} from "@/data/waitlist-content";

/**
 * The footer while the gate is up (ADR-048 copy.md §8).
 *
 * The real footer's ground, trimmed to the four destinations that stay open,
 * plus the brand line. The theme control is in the header (copy.md §8).
 *
 * THE `Sign in` LINK IS THE ONE THIS PAGE CANNOT SHIP WITHOUT, and it is worth
 * saying why here as well as in the data file. A cross-check of ADR-048 found
 * that the page as first designed offered no route to the door at all: a pilot
 * operator or a staff member arriving at the domain with no session and no
 * memorised URL would have been locked out by the very gate that was written to
 * keep letting them in. One link fixes that, and a stranger who clicks it
 * reaches a sign-in screen and nothing else.
 *
 * Every href here is on `WAITLIST_OPEN_PREFIXES` in `middleware.ts`. If you add
 * a link, add it there in the same change or it will redirect the reader back
 * to this page (AC-19).
 *
 * `MobileTabBar` is deliberately absent, unlike `SiteFooter`: every tab it
 * carries is a gated destination.
 */
export function WaitlistFooter() {
  return (
    <footer className="mt-auto">
      {/* A hairline and one quiet row, in roles, so it follows the theme. The
          2026-09-13 redesign retired the green band: the closing band above
          already carries the page's one strong ground. */}
      <div className="container flex max-w-page flex-col gap-5 border-t border-border py-8 md:flex-row-reverse md:items-center md:justify-between">
        <nav aria-label="Footer">
          <ul className="flex flex-wrap items-center gap-x-7 gap-y-3">
            {WAITLIST_FOOTER_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="rounded text-sm text-page-fg-70 transition-colors duration-quick ease-settle hover:text-page-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-4">
          <Image
            src="/assets/logo.svg"
            alt="Injishi"
            width={75}
            height={18}
            className="h-4 w-auto dark:brightness-0 dark:invert"
          />
          <p className="text-sm text-muted-foreground">{WAITLIST_FOOTER_LINE}</p>
        </div>
      </div>
    </footer>
  );
}
