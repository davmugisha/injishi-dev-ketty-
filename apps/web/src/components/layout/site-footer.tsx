import Link from "next/link";
import { SocialIcons } from "@/components/icons";
import { InjishiGlyph } from "@/components/icons/marks";
import { AsciiWordmark } from "@/components/layout/ascii-wordmark";
import { LazyFooterGlass } from "@/components/layout/lazy-footer-glass";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { ThemePill } from "@/components/layout/theme-pill";
import { FOOTER_COLUMNS, SOCIAL_LINKS } from "@/data/navigation";

/**
 * The site footer: an outlined wordmark band over a filled accent panel.
 *
 * It replaces the single centred link row that stood here before, which had
 * itself replaced three columns. The columns are back, which is the point of
 * ADR-023 rather than an accident: the row grouped without printing headings,
 * and a reader scanning for "Privacy" had to read all twelve links to find it.
 *
 * Still a Server Component. Two client islands hang off it, and both are their
 * own file for that reason: `FooterGlass` (a WebGL canvas, fetched only once
 * the footer nears the viewport, through `LazyFooterGlass`) and `ThemePill`.
 *
 * THE PANEL COLOUR is derived, not picked. `--accent` is a mid-tone amber at
 * 60% lightness, and near-white body text on it measures 4.09:1 — under the
 * 4.5:1 AA floor, and far under it once a link is dimmed for hierarchy. Mixing
 * 72% accent into `--ink` lands at 6.4:1 for solid text and 4.75:1 for the
 * dimmed link colour, so the whole panel clears AA. The mix is a `color-mix`
 * over two tokens, which is how the token package derives its own hover roles,
 * so the palette is still one source and there is no new literal.
 *
 * THE INK IS FIXED WHITE, and the paragraph above is why. Every line here was
 * `accent-foreground`, which is the right role on the accent FILL and the
 * wrong one here: this panel is not that fill, it is the fill mixed most of
 * the way into ink. ADR-025 repainted the palette teal and made
 * `accent-foreground` INK — correct on mid-tone teal at 5.71:1, and 3.44:1 on
 * this much darker panel, 2.83:1 once a link was dimmed. So the panel had
 * carried dark ink since the day the palette turned, in BOTH themes, and the
 * measurement quoted above (which assumed near-white text) had quietly stopped
 * describing the code. White measures 5.22:1 here and the dim is 90% rather
 * than 80%, which holds 4.57:1. Both halves are FIXED — `--accent` and `--ink`
 * do not invert, so the panel does not, so its ink must not either.
 *
 * `MobileTabBar` is mounted HERE and nowhere else. `(marketplace)/layout.tsx`
 * says so and explains why: composing it in the layout as well would render a
 * fixed bottom bar twice (ADR-013). `max-lg:pb-[...]` is the room that bar
 * needs: 5rem, plus the home-indicator inset the bar now clears.
 */
export function SiteFooter() {
  return (
    <footer className="overflow-hidden bg-background max-lg:pb-[calc(5rem+env(safe-area-inset-bottom))]">
      {/* The wordmark. It is decoration: the readable brand name is the glyph
          and the copyright line inside the panel, so this is hidden from
          assistive tech rather than announced a second time.

          IT USED TO BE ONE OUTLINED `<p>`, and that `<p>` is still here as the
          no-script fallback inside `ascii-wordmark.tsx`, with both rules that
          kept it clear of the panel intact. The live band is a canvas now: the
          word rasterised into a grid of flickering glyphs that part around the
          cursor. Its own file for the reason `FooterGlass` is — this stays a
          Server Component, and the island is the size of the thing that
          actually needs the browser. */}
      <AsciiWordmark />

      <div className="relative bg-[color-mix(in_oklch,var(--accent)_72%,var(--ink))]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <LazyFooterGlass />
        </div>

        <div className="container relative py-14 md:py-20">
          <div className="flex flex-col justify-between gap-14 lg:flex-row lg:gap-8">
            <div className="flex w-full max-w-tile flex-col justify-between gap-12">
              <div>
                <InjishiGlyph className="mb-3 h-auto w-10 shrink-0 text-white" />
                <p className="text-xl font-medium leading-tight text-white md:text-xl">
                  Stay anywhere in Rwanda
                </p>
              </div>

              <div className="flex flex-col gap-5">
                <ul className="flex items-center gap-4">
                  {SOCIAL_LINKS.map(({ network, href, label }) => {
                    const Icon = SocialIcons[network];
                    return (
                      <li key={network}>
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          aria-label={label}
                          className="block text-white/90 transition-colors duration-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-4 focus-visible:ring-offset-transparent"
                        >
                          <Icon className="size-5" />
                        </a>
                      </li>
                    );
                  })}
                </ul>

                <p className="text-sm text-white/90">
                  © {new Date().getFullYear()}{" "}
                  <a
                    href="https://hangaasoftwares.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 transition-colors duration-300 hover:text-white"
                  >
                    Hangaa Softwares
                  </a>
                  . All rights reserved.
                </p>

                <div className="flex">
                  <ThemePill />
                </div>
              </div>
            </div>

            <nav
              aria-label="Footer"
              className="flex flex-wrap gap-x-12 gap-y-10 md:gap-x-20 lg:flex-nowrap"
            >
              {FOOTER_COLUMNS.map((column) => (
                <div key={column.title} className="flex flex-col gap-5">
                  <h2 className="text-lg font-semibold text-white md:text-xl">
                    {column.title}
                  </h2>
                  <ul className="flex flex-col gap-3 md:gap-4">
                    {column.links.map((link) => (
                      <li key={link.href}>
                        <FooterLink href={link.href}>{link.label}</FooterLink>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </div>
        </div>
      </div>

      <MobileTabBar />
    </footer>
  );
}

/**
 * One link in a column.
 *
 * The columns hold routes only — the social accounts are the icon rail — but
 * the element is still picked from the href rather than assumed, so an external
 * link added to a column later gets `noopener` instead of a broken client-side
 * navigation.
 */
function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  const className =
    "text-sm font-medium text-white/90 transition-colors duration-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-4 focus-visible:ring-offset-transparent md:text-base";

  if (href.startsWith("http")) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer nofollow" className={className}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
