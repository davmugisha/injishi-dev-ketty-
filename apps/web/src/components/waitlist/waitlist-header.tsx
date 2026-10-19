"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@injishi/ui";
import { cn } from "@injishi/utils";
import { AccountMenu, AccountMenuMobile } from "@/components/layout/account-menu";
import { HostCta, HostCtaMobile } from "@/components/layout/host-cta";
import { MenuToggleIcon } from "@/components/layout/menu-toggle-icon";
import { ThemePill } from "@/components/layout/theme-pill";
import { useScrolled } from "@/hooks/use-scrolled";

/**
 * The waitlist bar, in the marketplace header's shape.
 *
 * Past 24px of scroll it lifts, rounds to a pill and takes a blurred ground —
 * the same transition `SiteHeader` uses. Sign In and List Accommodation sit
 * together in the bar from `md` up, and in the panel below that, so the pair
 * is never split across two breakpoints. The gated destinations stay out:
 * Explore, Saved and Services bounce straight back here while the gate is up.
 */
export function WaitlistHeader() {
  const scrolled = useScrolled(24);
  const [menuOpen, setMenuOpen] = useState(false);
  const floating = scrolled && !menuOpen;

  useEffect(() => {
    const root = document.documentElement;
    const el = document.getElementById("waitlist-theme");
    if (!el) return;
    const sync = () => {
      el.setAttribute(
        "data-theme",
        root.classList.contains("dark") ? "mouve-dark" : "mouve-light",
      );
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <header className="z-[999999] h-16 w-full md:h-20">
      <div
        className={cn(
          "fixed inset-x-0 z-[999999] flex justify-center px-0 transition-all duration-300 ease-out md:px-4",
          floating ? "top-0 md:top-4" : "top-0",
        )}
      >
        <div
          className={cn(
            "w-full max-w-page border-b border-transparent transition-all duration-300 ease-out md:rounded-full md:border",
            floating &&
              "border-border bg-background/95 backdrop-blur-lg supports-[backdrop-filter]:bg-background/85 md:shadow-lg",
            menuOpen && "border-border bg-background",
          )}
        >
          <nav
            className={cn(
              "flex h-16 w-full items-center justify-between gap-3 px-4 transition-all duration-300 ease-out",
              floating ? "md:px-4" : "md:px-6",
            )}
          >
            <Link href="/waitlist" aria-label="Injishi" className="shrink-0">
              <Image
                src="/assets/logo.svg"
                alt="Injishi"
                width={112}
                height={27}
                priority
                className="h-5 w-auto md:h-6 dark:brightness-0 dark:invert"
              />
            </Link>

            <div className="flex items-center gap-2">
              <ThemePill tone="page" />
              <AccountMenu className="max-md:hidden" />
              <HostCta className="max-md:hidden" />

              <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
                    aria-expanded={menuOpen}
                    className="text-foreground md:hidden"
                  >
                    <MenuToggleIcon open={menuOpen} className="size-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="top"
                  showCloseButton={false}
                  className="top-16 h-auto gap-0 rounded-none border-t p-0 md:hidden"
                >
                  <SheetTitle className="sr-only">Navigation</SheetTitle>
                  <SheetDescription className="sr-only">
                    Sign in or list your accommodation
                  </SheetDescription>
                  <div className="flex flex-col gap-2 p-4">
                    <AccountMenuMobile onNavigate={() => setMenuOpen(false)} />
                    <HostCtaMobile onNavigate={() => setMenuOpen(false)} />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
