"use client";

import { X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo, useState } from "react";
import { Input, ScrollShadow } from "@heroui/react";
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from "@injishi/ui";
import { pluralize } from "@injishi/utils";
import { SearchIcon } from "@/components/icons";
import { exploreHref, parseIntent } from "@/lib/search-params";
import type { Destination } from "@/data/destinations";
import { usePublishedStays } from "@/data/published-stays";

/**
 * Full-screen search.
 *
 * The prototype appended this markup to `<body>` as a template and toggled it
 * from a delegated click handler, filtering an in-file catalogue by scanning
 * the rendered DOM for listing cards. Here it is a Dialog over the same
 * catalogue, and submitting hands the query to /explore.
 */
export function SearchOverlay(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  /*
   * The boundary lives HERE, not at the two call sites.
   *
   * This overlay reads `useSearchParams` so a search launched from a filtered
   * results page keeps the trip the guest already described. Both headers
   * mount it from a layout that wraps 14 statically generated pages, and an
   * unsuspended `useSearchParams` inside a layout opts every one of them out
   * of static rendering. Owning the boundary in this file means neither header
   * can forget it. `null` is the right fallback: the overlay draws nothing
   * until it is opened.
   */
  return (
    <Suspense fallback={null}>
      <SearchOverlayInner {...props} />
    </Suspense>
  );
}

function SearchOverlayInner({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState("");

  // The published properties, read once the overlay first opens.
  const stays = usePublishedStays(open);
  const matches = useMemo(() => matchStays(stays, query), [stays, query]);

  /**
   * The /explore URL for a typed term.
   *
   * This overlay was the second search entry point and it pushed `?q=` and
   * nothing else, so opening it from a filtered results page threw away the
   * dates and the party the guest had already given. It keeps the TRIP facts
   * now and replaces only the place: the dates, the flex window and the party
   * ride across, while any district filter is cleared, because the term the
   * guest just typed is them restating where they want to be.
   */
  const hrefFor = useCallback(
    (term: string) =>
      exploreHref({ ...parseIntent(params), query: term, districts: [] }),
    [params],
  );

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    onOpenChange(false);
    router.push(hrefFor(trimmed));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="animate-slide-down h-dvh w-screen max-w-none rounded-none bg-black p-0"
      >
        <DialogTitle className="sr-only">Search stays</DialogTitle>
        <DialogDescription className="sr-only">
          Search verified stays across Rwanda by name, area, or district
        </DialogDescription>

        <div className="relative flex h-full flex-col overflow-hidden pt-6 lg:pt-10">
          <Watermark />

          <div className="container-left-padding container-right-padding relative z-10 flex items-center justify-between">
            <Link href="/" onClick={() => onOpenChange(false)} aria-label="Injishi home">
              <Image
                src="/assets/logo.svg"
                alt="Injishi"
                width={133}
                height={32}
                className="brightness-0 invert"
              />
            </Link>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close"
              onClick={() => onOpenChange(false)}
              className="text-white hover:opacity-70"
            >
              <X width={26} height={26} strokeWidth={1.6} aria-hidden />
            </Button>
          </div>

          <div className="relative z-10 flex h-[calc(100%-32px)] flex-col gap-7 pt-8 lg:gap-15 lg:pt-20">
            <form onSubmit={submit} className="container-left-padding shrink-0">
              {/* The rule under the row IS the field, and it is the focus
                  indicator too. The input used to carry HeroUI's `ring-2
                  ring-focus`, which boxed the placeholder in orange on an
                  otherwise chrome-free black screen. A bare line is what this
                  screen was described as from the start; it brightens on
                  keyboard focus and stays quiet for a mouse, which is the one
                  thing a ring was doing that had to survive. */}
              <div className="relative flex w-full items-center gap-4 border-b border-white/15 pb-3 transition-colors duration-200 has-[:focus-visible]:border-white/80 lg:w-fit">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-slate-line">
                  <SearchIcon className="text-white/50" />
                </span>
                {/* A bare line over the overlay's black ground, not a boxed
                    field: the field roles are overridden on the element for
                    the same unlayered-rule reason.

                    THE ROLE IS `--field`, NOT `--field-background`. This
                    carried the latter and painted a WHITE box on the dark
                    overlay, with `--field-foreground` set to white on top of
                    it, so a typed query was white on white. The variable is
                    real but only in the other layer: `_injishi-app.css`
                    declares `--field: var(--field-background)`, and the public
                    layer takes its roles from
                    `@injishi/design-tokens/heroui.css`, which sets `--field`
                    directly and reads `--field-background` nowhere. Hover and
                    focus paint from their own roles, so all three are set. */}
                <Input
                  type="text"
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search stays, areas, districts"
                  aria-label="Search stays"
                  className="w-full border-0 px-0 pr-4 text-2xl leading-none shadow-none outline-none [--field-foreground:var(--color-white)] [--field-focus:transparent] [--field-hover:transparent] [--field:transparent] [--focus:transparent] placeholder:text-2xl placeholder:text-white/60 lg:w-[800px] lg:text-display-md lg:placeholder:text-display-md"
                />
              </div>
            </form>

            <ScrollShadow className="search-results results flex-1 scrollbar overflow-y-auto pb-10">
              <SearchResults query={query} matches={matches} hrefFor={hrefFor} />
            </ScrollShadow>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SearchResults({
  query,
  matches,
  hrefFor,
}: {
  query: string;
  matches: Destination[];
  hrefFor: (term: string) => string;
}) {
  if (!query.trim()) return null;

  if (matches.length === 0) {
    return (
      <p className="container-left-padding pt-2 text-lg text-white/60">
        No stays match “{query.trim()}” yet.
      </p>
    );
  }

  return (
    <>
      <p className="container-left-padding pb-1 text-xs uppercase tracking-wide text-white/40">
        {pluralize(matches.length, "stay")}
      </p>
      {matches.slice(0, 8).map((stay) => (
        <Link
          key={stay.id}
          href={hrefFor(stay.label)}
          className="container-left-padding container-right-padding group flex items-center justify-between gap-4 border-b border-white/10 py-3 transition-colors duration-150 hover:bg-white/5"
        >
          <span className="flex flex-col">
            <span className="text-lg text-white transition-colors group-hover:text-secondary lg:text-xl">
              {stay.label}
            </span>
            <span className="text-sm text-white/50">{stay.context}</span>
          </span>
        </Link>
      ))}
    </>
  );
}

function matchStays(stays: Destination[], query: string): Destination[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return stays.filter((stay) =>
    [stay.label, stay.context].some((field) => field.toLowerCase().includes(q)),
  );
}

/** The Injishi mark, hairline-stroked, bleeding off the left edge. */
function Watermark() {
  return (
    <svg
      width="1200"
      height="1069"
      viewBox="0 0 431 384"
      fill="none"
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 hidden h-full object-cover lg:block"
    >
      <path
        d="M400.02,162.42c-.68,1.32-1.89,2.18-3.41,2.43-1.8.3-3.67-.38-5.03-1.8-13.98-14.6-30.86-26.55-49.28-34.95-2.14-.98-4.39,1.2-3.49,3.38,5.77,14,13.14,27.59,20.31,40.81,14.13,26.04,28.74,52.96,31,82.92.25,3.39-.68,8.04-3.34,10.25-1.44,1.2-3.18,1.58-5.04,1.08-2.55-.67-4.54-2.9-5.07-5.69-3.65-19.31-9.16-38.37-16.39-56.66-5.27-13.37-12.31-28.39-24.53-38.5-15.33-12.69-36.34-15.77-57.23-17.1-1.77-.11-3.15,1.52-2.71,3.23,7.61,29.75,7.49,62.91-.38,96.38-7.27,30.87-20.72,61.72-41.12,94.29-1.73,2.76-4.1,6.54-8.59,7.54-.53.12-1.07.17-1.6.17-2.08,0-4.04-.88-5.28-2.44-2.93-3.72-.4-8.08.81-10.18,20.57-35.44,32.89-63.8,39.94-91.94,8.5-33.88,8.42-66.66-.21-95.07-.36-1.17-1.52-1.91-2.73-1.75-63.75,8.55-124.86,40.5-168.15,88.04-1.23,1.34-2.44,2.7-3.65,4.06-4.45,4.98-9.05,10.13-14.25,14.61-.26.22-.58.52-.94.86-2.75,2.54-7.34,6.8-11.03,4.62-1.24-.73-2.03-1.87-2.3-3.28-.75-3.95,2.94-8.82,3.36-9.36,46.06-59.04,114.28-100.1,187.94-113.35,1.79-.32,2.74-2.32,1.81-3.89-10.16-17.16-28.02-30.7-49.92-37.67-19.93-6.32-42.97-7.54-70.43-3.71-30.91,4.31-60.65,13.73-88.39,28-1.72.89-5.76,2.97-8.78-.41-1.21-1.36-1.77-3.19-1.53-5.01.26-1.93,1.36-3.65,3.02-4.73,33.42-21.71,77.35-32.87,127.03-32.32,38.05.44,75.87,7.25,112.69,14.61,2.55.51,4.21-2.62,2.34-4.43-18.85-18.27-42.26-32.23-67.2-39.94-2.01-.62-3.6-2.06-4.25-3.87-.86-2.41.05-4.74,2.44-6.22,1.68-1.04,4.07-1.64,6.36-1.64.66,0,1.3.05,1.92.15,22.93,3.71,42.11,18.21,56.26,30.42,4.26,3.68,8.5,7.52,12.59,11.24,8.48,7.69,17.16,15.58,26.53,22.4,1.97,1.43,4.65-.35,4.09-2.72l-6.85-28.82c-.32-1.35-1.17-4.95,2.18-6.7,1.29-.68,2.89-.78,4.39-.27,8.24,2.81,15.78,7.66,21.82,14.01,1.24,1.31,1.66,3.19,1.1,4.92-.56,1.7-1.98,2.96-3.72,3.28-1.39.25-2.81.3-4.19.14-1.59-.18-3.01,1.01-2.98,2.61.17,10.21,6.66,19.67,13.46,25.64,7.03,6.18,15.65,10.62,23.99,14.9,2.6,1.33,5.28,2.71,7.88,4.12,9.96,5.41,22.18,13.23,28.27,25.8.97,2,1.68,5.17.46,7.51Z"
        fill="none"
        stroke="var(--color-white)"
        strokeWidth="0.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.18"
      />
    </svg>
  );
}
