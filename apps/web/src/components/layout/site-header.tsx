"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@injishi/ui";
import { cn } from "@injishi/utils";
import { SearchIcon } from "@/components/icons";
import { AccountMenu } from "@/components/layout/account-menu";
import { HostCta } from "@/components/layout/host-cta";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SearchOverlay } from "@/components/layout/search-overlay";
import { PRIMARY_NAV, headerVariantFor } from "@/data/navigation";
import { useScrolled } from "@/hooks/use-scrolled";
import { useHeaderSearch } from "@/lib/header-search";

/**
 * The site header: a centred bar that contracts into a floating pill on scroll.
 *
 * It was a full-bleed band that settled onto a black bar. It is a `max-w-page`
 * bar at rest which, past 24px of scroll, lifts off the top edge, narrows to
 * `max-w-page`, rounds to a full pill, takes a border and a blurred background,
 * and picks up a shadow
 * ([ADR-024](../../../../injishi.context/dox/adrs/024-header-pill-and-menu.md)).
 * Only the pill rounds and lifts: below `md` it stays edge to edge, because a
 * floating pill on a 390px screen is mostly margin.
 *
 * CONTENT COLOUR has one rule and it is worth stating plainly, because the
 * version before this had three overlapping ones. There is exactly one case
 * that needs a fixed colour: a transparent bar resting over a photographic
 * hero, where the ground is a picture and the theme cannot be consulted. That
 * is `onPhoto`, and it is white. Every other state — scrolled onto the pill's
 * own background, or resting over a page that opens white — is `text-foreground`,
 * which follows the theme. The old code used `text-black` for the resting
 * white-header routes, which is correct in light and invisible in dark.
 *
 * `headerVariantFor` still decides which routes open on photography; that
 * register lives in `data/navigation.ts` and this file only reads it.
 *
 * The MENU is `MobileNav`. It used to be shared with `explore-header.tsx`;
 * that header is deleted and this bar is the only one left, so there is no
 * second caller to keep in step. The trigger stays in this bar while the panel
 * is open, so the panel hangs below the bar rather than covering it.
 *
 * THREE CLUSTERS, AND THE MIDDLE ONE IS ACTUALLY CENTRED. The wordmark alone
 * left; the three `PRIMARY_NAV` destinations plus the language and search
 * controls centre; identity and the host action right. The outer two carry
 * `flex-1 basis-0` rather than sitting at their natural width, which is what
 * makes the centre optically centred in the BAR rather than centred between two
 * unequal neighbours — the wordmark is 112px and the right cluster is three
 * controls, so `justify-between` alone pushed the links left of centre and
 * moved them again whenever the right cluster changed width. It changes width
 * on every sign-in, so that was not a one-off offset but a jump on resolve.
 *
 * ONLY THE LINKS HIDE BELOW `lg`, NOT THE CLUSTER THAT HOLDS THEM, and the
 * distinction is the whole reason there is now one search control instead of
 * two. The bar used to carry a desktop `SearchOverlay` trigger inside the
 * hidden middle group and a second `lg:hidden` copy in the right cluster —
 * one action spelled twice, because hiding the group hid the search with it.
 * The `max-lg:hidden` sits on an inner wrapper around the links, so the
 * language and search controls stay in the centre at every width and are
 * declared once. Below `lg` the bar reads: wordmark, globe and magnifier,
 * menu trigger.
 *
 * The LANGUAGE switcher is here, in the middle cluster beside search. It came
 * across when `/explore`'s own header was deleted and the marketplace dropped
 * to one bar. `language-menu.tsx` owns it and says plainly that nothing reads
 * its value yet.
 *
 * The HOST ACTION is no longer a fixed link to `/host`. `host-cta.tsx` owns
 * what it says, and reads the workspaces the caller actually HOLDS rather than
 * whether a session exists — a signed-in guest is not a host, and somebody
 * mid-registration must not be invited to start again.
 *
 * THERE IS NO THEME CONTROL HERE, and re-adding one is a regression rather than
 * an improvement. `ThemePill` in the footer is the one theme control on the
 * marketplace: it names both values as separate buttons, which is what keeps
 * the literal `"system"` out of `localStorage["injishi-theme"]` (see
 * `theme-provider.tsx`). The bar carried a second, single-button copy of the
 * same setting, so one setting had two controls and the bar had one more icon
 * than it needed.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const variant = headerVariantFor(pathname);
  const scrolled = useScrolled(24);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const isWhite = variant === "white";
  /** Explore pins its own search band under the header. A floating pill there
   *  stacks two floating pills with page showing between them, so on Explore
   *  the bar stays one flat, solid strip at the top and the band locks flush
   *  beneath it. */
  const docked = pathname?.startsWith("/explore") ?? false;
  const floating = scrolled && !docked;
  /** The page's own search bar has scrolled away: its summary takes the
   *  centre of the bar (`lib/header-search.ts`). */
  const headerSearch = useHeaderSearch();
  const compact = headerSearch.shown ? headerSearch.search : null;
  /** The one state whose ground is a photograph, so the ink cannot follow the
   *  theme. `menuOpen` cancels it: the panel behind the bar is the theme's own
   *  background, and white content on it is invisible. */
  const onPhoto = !isWhite && !scrolled && !menuOpen;
  const content = onPhoto ? "text-white" : "text-foreground";
  /** `/host` is the listing page. Sign In and List Accommodation are one pair:
   *  they show and hide together, and Sign In is a white pill while the bar
   *  rests on the photograph. */
  const onHost = pathname === "/host";

  return (
    <>
      <header
        className={cn(
          // `z-[999999]` belongs HERE, not only on the bar inside. A fixed element
          // creates its own stacking context, so a z-index on the child is
          // resolved INSIDE this one and can never climb over the hero. Dropping
          // it from this line is what made the whole header disappear on `/`.
          "z-[999999] w-full",
          // The bar itself is fixed, so this element is only the space it
          // occupies. Over a photographic hero it reserves nothing and the bar
          // floats; on a page that opens white it has to hold the bar's height
          // at every width, or the first heading slides underneath it.
          isWhite ? "h-16 md:h-20" : "fixed top-0",
        )}
      >
        <div
          className={cn(
            "fixed inset-x-0 z-[999999] flex justify-center px-0 transition-all duration-300 ease-out md:px-4",
            floating ? "top-0 md:top-4" : "top-0",
            docked && "bg-background",
            docked && scrolled && "border-b border-border",
          )}
        >
          <div
            className={cn(
              // The two opacities are a floor, not a taste: the pill can settle over
              // a dark hero photograph, and `text-foreground` is near-ink in the light
              // theme. At 60% the ground composited to mid-brown and the links read at
              // roughly 2:1. 85% keeps the glass and holds the text above AA.
              "w-full max-w-page border-b border-transparent transition-all duration-300 ease-out md:rounded-full md:border",
              floating &&
                "border-border bg-background/95 backdrop-blur-lg supports-[backdrop-filter]:bg-background/85 md:max-w-page md:shadow-lg",
              // The panel it opens is opaque, so the bar has to be too, or the
              // hero shows through the strip above the menu.
              menuOpen && "border-border bg-background",
            )}
          >
            <nav
              className={cn(
                "flex h-16 w-full items-center justify-between gap-3 transition-all duration-300 ease-out md:h-16",
                floating ? "px-4 md:px-4" : "px-4 md:px-6",
              )}
            >
              {/* LEFT — the wordmark, and nothing else. `min-w-0` so this
                  cluster yields rather than squeezing the centre when the bar
                  narrows. */}
              <div className="flex min-w-0 flex-1 basis-0 items-center">
                <Link href="/" aria-label="Injishi home" className="shrink-0">
                  <Image
                    src="/assets/logo.svg"
                    alt="Injishi"
                    width={112}
                    height={27}
                    priority
                    // The wordmark ships without a fill, so it paints black.
                    // Invert it wherever the ground behind it is dark: always
                    // over a hero photograph, and in the dark theme everywhere
                    // else. Two filters rather than two files, so the asset and
                    // the colour it needs cannot drift apart.
                    className={cn(
                      "h-5 w-auto md:h-6",
                      onPhoto ? "brightness-0 invert" : "dark:brightness-0 dark:invert",
                    )}
                  />
                </Link>
              </div>

              {/* CENTRE — the destinations, then the two icon controls. */}
              <div className="flex shrink-0 items-center gap-1.5">
                {/* The hidden thing is THIS wrapper, not the cluster above it.
                    Hiding the cluster took search and the language menu down
                    with the links, which is why the bar used to carry a second
                    search button for small screens. */}
                {compact ? (
                  <button
                    type="button"
                    data-header-search
                    onClick={compact.expand}
                    aria-label={`Search: ${compact.place}, ${compact.dates}, ${compact.guests}. Edit search`}
                    className="animate-fade-up group flex h-12 items-center rounded-full bg-card pl-5 pr-1.5 text-sm font-semibold text-foreground opacity-0 shadow-control ring-1 ring-border transition-shadow duration-quick [animation-duration:0.3s] [animation-fill-mode:forwards] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-lg:hidden"
                  >
                    <span className="max-w-[18ch] truncate">{compact.place}</span>
                    <span aria-hidden className="mx-4 h-5 w-px bg-border" />
                    <span className="whitespace-nowrap">{compact.dates}</span>
                    <span aria-hidden className="mx-4 h-5 w-px bg-border" />
                    <span className="whitespace-nowrap font-medium text-muted-foreground group-hover:text-foreground">
                      {compact.guests}
                    </span>
                    <span className="ml-4 flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
                      <SearchIcon className="size-4" />
                    </span>
                  </button>
                ) : null}
                <div className={cn("flex items-center gap-1.5 max-lg:hidden", compact && "hidden")}>
                  {PRIMARY_NAV.map((item) => (
                    <Button
                      key={item.href}
                      asChild
                      variant="ghost"
                      size="md"
                      className={content}
                    >
                      <Link href={item.href}>{item.label}</Link>
                    </Button>
                  ))}
                </div>

                {/* `LanguageMenu` stood here: a globe offering English,
                    Français and Kinyarwanda that changed nothing, because no
                    locale layer reads the choice (its own file says so). A
                    visitor who picked Kinyarwanda got English and a control
                    that had lied to them, so it is unmounted until the site can
                    speak the languages it offers (2026-10-21). The component is
                    kept for that day; mount it here again with the locale
                    layer. */}

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSearchOpen(true)}
                  aria-label="Search"
                  // The summary pill is the search while it shows; a second
                  // magnifier beside it would be two doors to one room.
                  className={cn(content, compact && "lg:hidden")}
                >
                  <SearchIcon className="size-5" />
                </Button>
              </div>

              {/* RIGHT — identity, the host action, the menu. */}
              <div className="flex flex-1 basis-0 items-center justify-end gap-2">
                {/* Sign In, or the person. This slot held a bare link to
                    /sign-in, so the bar looked identical before and after a
                    successful sign-in — `account-menu.tsx` says why that is
                    worse than it sounds and what each session state renders. */}
                <AccountMenu
                  onPhoto={onHost && onPhoto}
                  className={cn(
                    onHost && onPhoto ? undefined : content,
                    onHost ? "max-md:hidden" : "max-lg:hidden",
                  )}
                />

                {/* Below `md` the menu carries this same action at full width,
                    so a second, abbreviated copy in the bar is one control
                    named two ways. The bar keeps the wordmark, language, search
                    and the menu trigger, and nothing else. On `/host` Sign In
                    uses the same breakpoint, so the pair is never split. */}
                <HostCta className="max-md:hidden" />

                <MobileNav inkTrigger={!onPhoto} onOpenChange={setMenuOpen} />
              </div>
            </nav>
          </div>
        </div>
      </header>

      <SearchOverlay open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
