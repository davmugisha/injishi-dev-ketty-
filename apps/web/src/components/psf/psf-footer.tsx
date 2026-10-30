import Link from "next/link";

const LINKS = [
  { href: "/psf/register", label: "Register" },
  { href: "/psf/track", label: "Track an application" },
  { href: "/psf#how", label: "How it works" },
  { href: "/psf#memberships", label: "Memberships" },
];

/**
 * The footer of the PSF pages (the `(partner)` chrome, 2026-10-23): PSF's mark,
 * its name, and the same few destinations as the header, in the quiet one-row
 * form of the waitlist footer. No Injishi wordmark and no `MobileTabBar`: every
 * tab it carries is a site destination.
 */
export function PsfFooter() {
  return (
    <footer className="mt-auto">
      <div className="container flex max-w-page flex-col gap-5 border-t border-border py-8 md:flex-row-reverse md:items-center md:justify-between">
        <nav aria-label="Footer">
          <ul className="flex flex-wrap items-center gap-x-7 gap-y-3">
            {LINKS.map((link) => (
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

        <div className="flex items-center gap-3">
          <img src="/assets/partners/psf.png" alt="" className="h-7 w-auto" />
          <p className="text-sm text-muted-foreground">
            Private Sector Federation, Rwanda <span aria-hidden>·</span> Powered by MemberDesk
          </p>
        </div>
      </div>
    </footer>
  );
}
