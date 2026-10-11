"use client";

import Link from "next/link";
import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@injishi/ui";
import { SectionHeading } from "@/components/shared/section-heading";
import { ListingCard } from "@/components/stays/listing-card";
import { MOST_BOOKED_CITIES, type CityTab } from "@/data/home-curations";
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
 *
 * THE TABS ARE THE SHARED TAB SET, and they were not. This band wrote
 * `<div role="tablist">` around five `<Button role="tab">`, which rendered a
 * tab list holding **zero** tabs: `Button` passes its rest props to React
 * Aria's Button, which filters unrecognised DOM props, so `role` never reached
 * the element. Measured in the browser on 2026-09-17, and `apps/app`'s
 * Calendar view switcher had the identical hand-rolled strip with the
 * identical result. Neither had arrow keys either, because a `role` string is
 * a label and not a behaviour. `@injishi/ui`'s Radix `Tabs` owns the roving
 * tabindex, Home/End, the wrapping arrows and the panel wiring.
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

        <Tabs value={active.id} onValueChange={setActiveId}>
          <TabsList aria-label="Cities" className="flex-wrap gap-2.5">
            {MOST_BOOKED_CITIES.map((city) => (
              <TabsTrigger key={city.id} value={city.id} className="px-5">
                {city.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* One panel per city, so the tab that names a city is wired to the
              stays it names. Radix mounts only the selected panel, so this is
              the same work the single conditional block did. */}
          {MOST_BOOKED_CITIES.map((city) => (
            <TabsContent key={city.id} value={city.id} tabIndex={-1} className="mt-6">
              <CityStays city={city} />
            </TabsContent>
          ))}
        </Tabs>

      </div>
    </section>
  );
}

/**
 * One city's stays, its empty state, and its own "Explore" link.
 *
 * All three were derived from the selected city already; they live in the
 * panel now so the tab that names a city is wired by `aria-controls` to
 * everything that city's tab produces, rather than to a fragment of it.
 */
function CityStays({ city }: { city: CityTab }) {
  return (
    <div className="flex flex-col gap-6">
      {city.stays.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {city.stays.map((listing) => (
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
            No stays listed in {city.label} yet.
          </p>
          <p className="max-w-form text-sm text-page-fg-70">
            Every stay on Injishi is verified before it lists. When a
            {" "}{city.label} property clears verification, it shows here.
          </p>
          <Link
            href="/explore"
            className="text-sm text-page-fg underline underline-offset-[4px]"
          >
            Browse all stays
          </Link>
        </div>
      )}

      {city.district ? (
        <div>
          <Link
            href={exploreHref({ ...EMPTY_INTENT, districts: [city.district] })}
            className="inline-flex w-max items-center justify-center rounded-full bg-accent px-9 py-4 text-lg font-medium text-accent-foreground transition-all duration-300 hover:bg-accent-hover"
          >
            Explore {city.label}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
