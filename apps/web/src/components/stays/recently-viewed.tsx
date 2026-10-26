"use client";

import { ChevronLeft, ChevronRight, History, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState, useEffect } from "react";
import { cn } from "@injishi/utils";
import { NoPhoto } from "@/components/stays/no-photo";
import type { RecentStay } from "@/data/recent-stay";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";
import { propertyHref, type StayIntent } from "@/lib/search-params";
import { viewedAgo } from "@/lib/viewed-ago";

/**
 * Recently viewed stays, where a guest might want the way back:
 *
 *  - `RecentlyViewedStrip`  the top of Explore's results below `xl`.
 *  - `ContinueBrowsing`     a row on the home page, at every width.
 *
 * Every surface renders nothing until the guest has opened a stay's page in
 * this browser (`RecordRecentView` on the property page writes the list), so a
 * first visit never meets an empty frame.
 *
 * The surfaces take `RecentStay`, a slim summary, rather than `Listing`: the
 * home page would otherwise ship the whole catalogue to the browser just to
 * print three names.
 */

type Resolved = RecentStay & { at: number };

/** The stored views, resolved against the stays this page knows, newest first. */
function useRecentStays(stays: readonly RecentStay[], limit: number) {
  const { views, remove, clear } = useRecentlyViewed();
  const recent = useMemo(() => {
    const bySlug = new Map(stays.map((s) => [s.slug, s]));
    return views
      .flatMap((v): Resolved[] => {
        const stay = bySlug.get(v.slug);
        return stay ? [{ ...stay, at: v.at }] : [];
      })
      .slice(0, limit);
  }, [views, stays, limit]);
  // Re-read the clock each minute so "5 min ago" does not freeze.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  return { recent, remove, clear, now };
}

const hrefFor = (slug: string, intent?: StayIntent) =>
  intent ? propertyHref(slug, intent) : `/property/${slug}`;

function Heading({ id, onClear }: { id: string; onClear: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2
        id={id}
        className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-widest text-accent-text"
      >
        <History className="size-3.5" strokeWidth={2.4} aria-hidden />
        Recently viewed
      </h2>
      <button
        type="button"
        onClick={onClear}
        className="rounded text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Clear all
      </button>
    </div>
  );
}

function RemoveButton({ name, onRemove, className }: { name: string; onRemove: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onRemove();
      }}
      aria-label={`Remove ${name} from recently viewed`}
      className={cn(
        "z-10 flex size-6 items-center justify-center rounded-full bg-card text-muted-foreground shadow-control ring-1 ring-border transition hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <X className="size-3.5" strokeWidth={2.6} aria-hidden />
    </button>
  );
}

/* ----------------------------------------------------------------- strip */

/**
 * A horizontal row of small cards. On Explore it sits above the results below
 * `xl`; on the home page it is the `ContinueBrowsing` section's body. Arrow buttons appear only when the row overflows.
 */
function RecentlyViewedStrip({
  stays,
  intent,
  limit = 8,
  className,
  headingId = "recently-viewed-strip",
}: {
  stays: readonly RecentStay[];
  intent?: StayIntent;
  limit?: number;
  className?: string;
  headingId?: string;
}) {
  const { recent, remove, clear, now } = useRecentStays(stays, limit);
  const scroller = useRef<HTMLUListElement | null>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const update = () =>
      setEdges({
        start: el.scrollLeft <= 4,
        end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
      });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [recent.length]);

  if (recent.length === 0) return null;

  const scrollBy = (direction: 1 | -1) =>
    scroller.current?.scrollBy({ left: direction * 280, behavior: "smooth" });

  return (
    <section aria-labelledby={headingId} className={cn("flex flex-col gap-3", className)}>
      <Heading id={headingId} onClear={clear} />
      <div className="relative">
        <ul
          ref={scroller}
          className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {recent.map((stay) => (
            <li key={stay.slug} className="group/item relative w-60 shrink-0 snap-start">
              <Link
                href={hrefFor(stay.slug, intent)}
                className="flex items-center gap-3 rounded-card bg-card p-2 pr-3 shadow-control ring-1 ring-border transition hover:ring-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="relative size-16 shrink-0 overflow-hidden rounded-card bg-surface-secondary">
                  {stay.imageSrc ? (
                    <Image
                      src={stay.imageSrc}
                      // An uploaded photo is the API's photo route, on a host
                      // `next.config` does not list; served as is, and never
                      // cached by the optimiser past an unpublish.
                      unoptimized
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover transition-transform duration-travel ease-settle group-hover/item:scale-105"
                    />
                  ) : (
                    <NoPhoto compact />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-sm font-bold leading-tight text-foreground">
                    {stay.name}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-foreground">{stay.rateLabel}</span>
                  <span className="block truncate text-2xs text-muted-foreground">
                    {viewedAgo(stay.at, now) ?? stay.location}
                  </span>
                </span>
              </Link>
              <RemoveButton
                name={stay.name}
                onRemove={() => remove(stay.slug)}
                className="absolute -right-1.5 -top-1.5 opacity-0 group-hover/item:opacity-100"
              />
            </li>
          ))}
        </ul>
        {!edges.start ? (
          <ScrollArrow side="left" onClick={() => scrollBy(-1)} />
        ) : null}
        {!edges.end ? <ScrollArrow side="right" onClick={() => scrollBy(1)} /> : null}
      </div>
    </section>
  );
}

function ScrollArrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Scroll back" : "Scroll for more"}
      className={cn(
        "absolute top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-card text-foreground shadow-control ring-1 ring-border transition hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        side === "left" ? "-left-3" : "-right-3",
      )}
    >
      <Icon className="size-4" strokeWidth={2.4} aria-hidden />
    </button>
  );
}

/* ------------------------------------------------------------------ home */

/** The home page's "Continue browsing" row. Renders nothing for a new visitor. */
export function ContinueBrowsing({ stays }: { stays: readonly RecentStay[] }) {
  return (
    <div className="container pb-10 pt-8 empty:hidden">
      <RecentlyViewedStrip stays={stays} headingId="continue-browsing" />
    </div>
  );
}
