"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@injishi/utils";
import { ShelfStayCard } from "@/components/home/shelf-stay-card";
import { SectionHeading } from "@/components/shared/section-heading";
import type { Listing } from "@/data/listings";

export interface ShelfTab {
  id: string;
  label: string;
  /** Where "See all" goes for this tab. */
  href: string;
  /** Every stay the tab's search holds, not just the four shown. */
  total: number;
  stays: Listing[];
}

/**
 * The one shelf of stays on the home page.
 *
 * It replaced three bands that each showed four cards — "this week",
 * "published", "most booked" — with overlapping stays and, twice, the same
 * photograph. One heading, a few tabs, the Explore card: the same card, the
 * same honest per-person price and party line the guest will meet on Explore.
 */
export function StaysShelf({ tabs }: { tabs: ShelfTab[] }) {
  const [tabId, setTabId] = useState(tabs[0]?.id);
  const tab = tabs.find((candidate) => candidate.id === tabId) ?? tabs[0];
  if (!tab) return null;

  return (
    <section className="section-y container flex flex-col gap-6">
      <SectionHeading
        lead="Stays "
        emphasis="to book"
        action={{ label: `See all ${tab.total}`, href: tab.href }}
      />

      <div
        role="tablist"
        aria-label="Stays"
        className="-mx-4 flex overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex gap-1 rounded-full bg-surface-secondary p-1 ring-1 ring-border">
          {tabs.map((candidate) => {
            const selected = candidate.id === tab.id;
            return (
              <button
                key={candidate.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTabId(candidate.id)}
                className={cn(
                  "h-9 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors duration-quick focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected
                    ? "bg-card text-foreground shadow-control"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {candidate.label}
                <span className={cn("ml-1.5 text-xs", selected ? "text-accent-text" : "opacity-70")}>
                  {candidate.total}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel" aria-label={tab.label} key={tab.id} className="animate-fade-up opacity-0 [animation-fill-mode:forwards]">
        {tab.stays.length > 0 ? (
          <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 pt-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-5 sm:pb-0 sm:overflow-visible sm:px-0 lg:grid-cols-4 [&::-webkit-scrollbar]:hidden">
            {tab.stays.map((stay) => (
              <ShelfStayCard
                key={stay.slug}
                listing={stay}
                className="w-[78%] shrink-0 snap-start sm:w-auto"
              />
            ))}
          </div>
        ) : (
          <p className="text-base text-muted-foreground">
            Nothing listed here yet.{" "}
            <Link href="/explore" className="font-semibold text-foreground underline underline-offset-4">
              Browse every stay
            </Link>
          </p>
        )}
      </div>
    </section>
  );
}
