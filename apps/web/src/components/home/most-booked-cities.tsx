"use client";

import Link from "next/link";
import * as React from "react";
import { Button } from "@injishi/ui";
import { SectionHeading } from "@/components/shared/section-heading";
import { ListingCard } from "@/components/stays/listing-card";
import { MOST_BOOKED_CITIES } from "@/data/home-curations";
import { EMPTY_INTENT, exploreHref } from "@/lib/search-params";

/**
 * "Most booked cities" — band 06 of ADR-022.
 *
 * Five city tabs over a row of the shipped listing cards. The list is CURATED
 * fixture data, not measured — nothing counts bookings yet, and the ADR
 * records that as the owed decision. Huye keeps its tab with no stays behind
 * it: the empty state is the true answer, and a tab that vanished would hide
 * the gap instead of naming it (AC-6).
 *
 * The band sits on a canvas ground so it reads as its own chapter between two
 * white sections, the role the ink band played for the coverflow.
 */
export function MostBookedCities() {
  const [activeId, setActiveId] = React.useState(MOST_BOOKED_CITIES[0]?.id);
  const active =
    MOST_BOOKED_CITIES.find((city) => city.id === activeId) ??
    MOST_BOOKED_CITIES[0];

  if (!active) return null;

  return (
    <section className="section-y-loose bg-canvas">
      <div className="container flex flex-col gap-6">
        <SectionHeading
          lead="Most booked "
          emphasis="cities"
          lede="Where guests book most across Rwanda."
          action={{ label: "All stays", href: "/explore" }}
        />

        <div
          role="tablist"
          aria-label="Cities"
          className="flex flex-wrap items-center gap-2.5"
        >
          {MOST_BOOKED_CITIES.map((city) => {
            const selected = city.id === active.id;
            return (
              /* The two variants carry the selected state, not a `bg-*`
                 override: HeroUI paints buttons from unlayered rules that
                 beat the utility layer (the coverflow dots documented it). */
              <Button
                key={city.id}
                role="tab"
                aria-selected={selected}
                variant={selected ? "primary" : "outline"}
                onClick={() => setActiveId(city.id)}
                className="rounded-full px-5"
              >
                {city.label}
              </Button>
            );
          })}
        </div>

        {active.stays.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {active.stays.map((listing) => (
              <ListingCard
                key={listing.slug}
                listing={listing}
                showRating
                showVerified
                compact
              />
            ))}
          </div>
        ) : (
          /* The empty state, not borrowed cards: a city with no verified
             stays says so (AC-6). */
          <div className="flex flex-col items-start gap-3 rounded-card border border-border bg-background p-8">
            <p className="text-lg font-medium text-page-fg">
              No stays listed in {active.label} yet.
            </p>
            <p className="max-w-form text-sm text-page-fg-70">
              Every stay on Injishi is verified before it lists. When a
              {" "}{active.label} property clears verification, it shows here.
            </p>
            <Link
              href="/explore"
              className="text-sm text-page-fg underline underline-offset-[4px]"
            >
              Browse all stays
            </Link>
          </div>
        )}

        {active.district ? (
          <div>
            <Link
              href={exploreHref({ ...EMPTY_INTENT, districts: [active.district] })}
              className="inline-flex w-max items-center justify-center rounded-full bg-accent px-9 py-4 text-lg font-medium text-accent-foreground transition-all duration-300 hover:bg-accent-hover"
            >
              Explore {active.label}
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
