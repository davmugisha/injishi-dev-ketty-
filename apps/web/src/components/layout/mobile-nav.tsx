"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@injishi/web-ui";
import { ScrollShadow } from "@heroui/react";
import { cn } from "@injishi/utils";
import { AccountMenuMobile } from "@/components/layout/account-menu";
import { HostCtaMobile } from "@/components/layout/host-cta";
import { MenuToggleIcon } from "@/components/layout/menu-toggle-icon";
import { MOBILE_NAV_GROUPS, PRIMARY_NAV } from "@/data/navigation";

/**
 * The mobile navigation menu.
 *
 * It was a drawer sliding in from the left; it is a full-height panel that
 * drops from under the header now, matching the pill header it hangs off
 * ([ADR-024](../../../../injishi.context/dox/adrs/024-header-pill-and-menu.md)).
 *
 * It is STILL a `Sheet`, and that is the load-bearing part of this file. The
 * reference this panel was rebuilt from is a plain `<div>` toggled between
 * `hidden` and `block`: no focus trap, no Escape, no `aria-modal`, and a
 * scroll lock hand-rolled from a `useEffect` that writes
 * `document.body.style.overflow`. `Sheet` is a Radix dialog and brings all
 * four, so the rebuild changes how the menu LOOKS and keeps what the previous
 * rewrite bought. Do not swap it for a bare div to save the import.
 *
 * The trigger sits in the header and stays visible while the panel is open, so
 * the same button opens and closes it. That is why the panel starts below the
 * bar rather than covering it, and why `showCloseButton` is off: the toggle
 * icon IS the close control, and a second X in the corner would be two ways to
 * do one thing.
 *
 * Rendered by BOTH `site-header.tsx` and `explore-header.tsx`. A change here
 * lands in both, which is the point.
 */
export function MobileNav({
  inkTrigger,
  onOpenChange,
  panelClassName = "top-16 h-[calc(100dvh-4rem)]",
}: {
  inkTrigger: boolean;
  /** Told whenever the panel opens or closes, so the bar above can restyle
   *  itself. The bar sits over the panel while it is open, and a bar painted
   *  for a hero photograph is white content on a light panel: invisible. */
  onOpenChange?: (open: boolean) => void;
  /** Where the panel starts and how tall it is. The default matches the site
   *  header's 64px mobile bar. The explore header's bar is 84px, so it passes
   *  its own; a panel that assumes one height slides under the other. */
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  const setOpenState = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  return (
    <Sheet open={open} onOpenChange={setOpenState}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={open}
          className={cn("lg:hidden", inkTrigger ? "text-foreground" : "text-white")}
        >
          <MenuToggleIcon open={open} className="size-6" />
        </Button>
      </SheetTrigger>

      <SheetContent
        side="top"
        showCloseButton={false}
        /* `side="top"` supplies `inset-x-0 top-0` and the slide; the overrides
           below drop the panel to sit under the bar and run to the bottom of
           the viewport. `dvh`, not `vh`: on mobile Safari `vh` counts the
           space behind the address bar, which put the two actions below the
           fold exactly where a thumb reaches for them. */
        className={cn("gap-0 rounded-none border-t p-0 lg:hidden", panelClassName)}
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SheetDescription className="sr-only">
          Browse stays, districts, and company pages
        </SheetDescription>

        <ScrollShadow className="flex h-full flex-col justify-between gap-6 scrollbar overflow-y-auto p-4">
          <div className="flex flex-col gap-6">
            <ul className="m-0 grid list-none gap-1 p-0">
              {PRIMARY_NAV.map((item) => (
                <li key={item.href}>
                  <Button
                    asChild
                    variant="ghost"
                    className="w-full justify-start px-4 text-base"
                  >
                    <Link href={item.href} onClick={() => setOpenState(false)}>
                      {item.label}
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>

            <ul
              className="m-0 grid list-none grid-cols-2 gap-x-4 gap-y-6 border-t border-border p-0 pt-6"
              aria-label="Site sections"
            >
              {MOBILE_NAV_GROUPS.map((group) => (
                <li key={group.title} className="flex flex-col gap-2.5">
                  <b className="text-sm font-semibold text-foreground">{group.title}</b>
                  <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {group.links.map((link) => (
                      <li key={`${group.title}-${link.label}`}>
                        <Link
                          href={link.href}
                          onClick={() => setOpenState(false)}
                          className="text-base text-muted-foreground transition-colors duration-200 hover:text-foreground"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-4">
            {/* Sign In, or the person. Same three session states as the bar
                above — `account-menu.tsx` owns both renderings so the panel and
                the header can never disagree about who is signed in. */}
            <AccountMenuMobile onNavigate={() => setOpenState(false)} />
            {/* The host action, in the same states the bar renders. It was a
                fixed link to /host here too, so a person mid-registration got
                the same invitation to start over at both widths.
                `host-cta.tsx` owns the standings, and both renderings read one
                hook so the panel and the bar cannot disagree. */}
            <HostCtaMobile onNavigate={() => setOpenState(false)} />
          </div>
        </ScrollShadow>
      </SheetContent>
    </Sheet>
  );
}
