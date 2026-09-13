import Image from "next/image";
import Link from "next/link";
import { Button } from "@injishi/ui";
import { ThemePill } from "@/components/layout/theme-pill";

/**
 * The header while the gate is up (ADR-048 copy.md §8).
 *
 * The real site header, with the navigation removed. Every destination
 * `SiteHeader` offers — search, the account menu, the host call to action, the
 * three `PRIMARY_NAV` links — leads somewhere the middleware redirects straight
 * back to this page, and a header full of links that bounce you where you
 * already are is worse than a header with none.
 *
 * WHAT STAYS: the wordmark, and it points at `/waitlist` rather than `/`,
 * because `/` is gated and clicking the logo must not feel like a dead end.
 *
 * THE THEME CONTROL LIVES HERE, as `copy.md` §8 says, and nowhere else on the
 * page. It is the site's own `ThemePill` in its `page` tone, painted from
 * surface tokens so it reads on this light ground; the footer no longer
 * carries a second one.
 *
 * This is a Server Component. The pill is its own client island; nothing else
 * here needs the browser: no scroll state, no menu, no session.
 */
export function WaitlistHeader() {
  return (
    <header className="w-full">
      <div className="container flex h-16 max-w-page items-center justify-between">
        <Link href="/waitlist" aria-label="Injishi" className="shrink-0">
          <Image
            src="/assets/logo.svg"
            alt="Injishi"
            width={112}
            height={27}
            priority
            // The wordmark ships without a fill, so it paints black. Invert it
            // in the dark theme, the same two-filters-one-file rule
            // `SiteHeader` uses, so the asset and the colour it needs cannot
            // drift apart.
            className="h-5 w-auto md:h-6 dark:brightness-0 dark:invert"
          />
        </Link>
        <div className="flex items-center gap-2">
          <ThemePill tone="page" />
          {/* The door back in for a pilot operator or a staff member, at the
              top as well as in the footer (copy.md §8). `/sign-in` is on
              `WAITLIST_OPEN_PREFIXES`, so it never bounces back here. */}
          <Button asChild variant="outline" size="sm">
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
