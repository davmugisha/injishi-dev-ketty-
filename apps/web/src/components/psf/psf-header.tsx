import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@injishi/ui";
import { ThemePill } from "@/components/layout/theme-pill";

/** PSF's three destinations: the page's own sections, then tracking. */
const NAV = [
  { href: "/psf#how", label: "How it works" },
  { href: "/psf#memberships", label: "Memberships" },
  { href: "/psf/track", label: "Track an application" },
];

/**
 * The header of the PSF pages (the `(partner)` chrome, 2026-10-23).
 *
 * PSF's mark and name, its three destinations and one button, Register. Nothing
 * from the site header: the visitor came for PSF, and a link to Explore or
 * Saved would send them somewhere they never meant to go.
 *
 * Under `md` the links fold away and the mark, the theme control and Register
 * stay; "Track an application" is also on the page itself, under the hero.
 *
 * A Server Component: the theme pill is its own client island.
 */
export function PsfHeader() {
  return (
    <header className="w-full border-b border-border">
      {/* PSF's orange, the colour of its logo's square, as a thin strip. */}
      <div aria-hidden className="h-1 bg-(--psf-orange)" />
      <div className="container flex h-16 max-w-page items-center justify-between gap-4">
        <Link href="/psf" aria-label="PSF MemberDesk, home" className="flex shrink-0 items-center gap-2.5">
          <img src="/assets/partners/psf.png" alt="" className="h-9 w-auto" />
          {/* PSF's name, then the product's: MemberDesk sits under it, in PSF green. */}
          <span className="hidden leading-tight sm:block">
            <span className="block text-sm font-semibold text-page-fg">Private Sector Federation</span>
            <span className="block text-xs font-semibold tracking-wide text-accent-text">MemberDesk</span>
          </span>
        </Link>

        <nav aria-label="PSF" className="hidden md:block">
          <ul className="flex items-center gap-7">
            {NAV.map((link) => (
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

        <div className="flex items-center gap-2">
          <ThemePill />
          <Button asChild size="sm" variant="primary">
            <Link href="/psf/register">
              Register <ArrowRight size={16} aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
