"use client";

import Link from "next/link";
import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@injishi/ui";
import { SectionHeading } from "@/components/shared/section-heading";
import { destinationAvgNightly, TRIP_STYLES } from "@/data/home-curations";
import { formatRateNumber } from "@/lib/price";
import { EMPTY_INTENT, exploreHref } from "@/lib/search-params";

/**
 * "Stays for every kind of trip" — band 07 of ADR-022.
 *
 * The filter is the reason for the trip, not the place: lakeside, gorilla
 * trekking, city break, safari, business. Each tab shows four real
 * destinations from the curated fixtures; each card links into explore at its
 * district where one exists, and at plain `/explore` where none does. The
 * tabs become saved explore filters when explore grows them — the ADR records
 * that as deferred, not forgotten.
 *
 * **The tabs are underlined text, not filled pills.** Five filled pills across
 * the top of a band read as five calls to action competing with the band's
 * own cards. An underline says "you are here" and nothing else, which is what
 * a tab is for, and it lets the row scroll sideways on a phone without five
 * fat buttons wrapping onto three lines.
 *
 * **They are the shared `Tabs`, `underline` variant** (2026-09-12). The row
 * used to be five bare `<button>`s with a `border-b-2` each, and the public
 * stylesheet rounds every bare button into a pill, so the selected tab's rule
 * rendered as a curve under the label. The shared trigger carries the corner
 * that opts out of that rule, and Radix supplies the roving focus and arrow
 * keys a tablist owes. The selected look is the variant's: the label in
 * `foreground` at the row's one weight, the rule in `accent-text`. The band
 * used to set the selected label itself in bold `accent-text`, and gave that
 * up for the shared look rather than carry a private one.
 *
 * **The price is DERIVED, not invented.** `destinationAvgNightly` averages
 * the real published nightly rates of the stays the app carries in that
 * district. It is not the fabricated commerce data the listing card prints
 * (see `data/demo-commerce.ts`); nothing here quotes a price no property
 * charges. Where nothing can be averaged the tile prints no price at all.
 *
 * The words under the figure come back WITH it rather than being written here,
 * because they are not always the same words: a district that only ever quotes
 * per person says so.
 */
export function StaysForEveryTrip() {
  const [activeId, setActiveId] = React.useState(TRIP_STYLES[0]?.id);
  const active =
    TRIP_STYLES.find((style) => style.id === activeId) ?? TRIP_STYLES[0];

  if (!active) return null;

  return (
    <section className="section-y container flex flex-col gap-6">
      <SectionHeading
        lead="Stays for "
        emphasis="every kind of trip"
        lede="Pick the trip; the right districts follow."
      />

      <Tabs value={active.id} onValueChange={setActiveId} className="flex flex-col gap-6">
        {/* The variant draws the hairline and the selected rule. This call
            site adds only the band's own step and the bleed into the
            container gutter that lets the row scroll edge to edge on a phone. */}
        <TabsList
          variant="underline"
          aria-label="Trip styles"
          className="-mx-1 scrollbar overflow-x-auto px-1 lg:mx-0 lg:gap-8 lg:px-0"
        >
          {TRIP_STYLES.map((style) => (
            <TabsTrigger key={style.id} value={style.id} className="text-base">
              {style.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Only the open panel is rendered: the four tiles are the same
            component whichever tab is on, and mounting five panels of
            photographs to show one is the cost Radix would otherwise pay. */}
        <TabsContent
          value={active.id}
          // The panel opens with a tile link, so it is not a tab stop of its
          // own; Radix would otherwise make it one, and an empty stop on a
          // scroll strip is a keystroke that changes nothing on screen.
          tabIndex={-1}
          className="-mx-1 flex snap-x snap-mandatory gap-4 scrollbar overflow-x-auto px-1 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-5 lg:overflow-visible lg:px-0 lg:pb-0"
        >
          {active.destinations.map((destination) => {
            const avg = destinationAvgNightly(destination);
            return (
              <Link
                key={`${active.id}-${destination.name}`}
                href={
                  destination.district
                    ? exploreHref({
                        ...EMPTY_INTENT,
                        districts: [destination.district],
                      })
                    : "/explore"
                }
                className="group flex shrink-0 basis-[62%] snap-start flex-col gap-3 sm:basis-[40%] lg:shrink lg:basis-auto"
              >
                {/* Ratio on the wrapper: a bare <picture> is inline and collapses. */}
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-card">
                  <picture className="block h-full w-full">
                    <source
                      type="image/avif"
                      sizes="(max-width: 1024px) 62vw, 25vw"
                      srcSet={`/assets/${destination.image.stem}.avif`}
                    />
                    <img
                      src={`/assets/${destination.image.stem}.jpg`}
                      sizes="(max-width: 1024px) 62vw, 25vw"
                      width={430}
                      height={322}
                      alt={destination.image.alt}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover object-center transition-transform duration-travel group-hover:scale-105"
                    />
                  </picture>

                  {/* Near-solid ink, not a translucent scrim. The badge lands on
                      twenty different photographs and a scrim that holds on a
                      lake at dusk washes out over a savannah at noon. */}
                  {destination.tag ? (
                    <span className="absolute left-3 top-3 rounded bg-black/85 px-2.5 py-1 text-xs font-bold text-white">
                      {destination.tag}
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-col gap-0.5">
                  <h3 className="font-sans text-lg font-bold text-page-fg">
                    {destination.name}
                  </h3>
                  <p className="text-sm text-page-fg-70">{destination.note}</p>

                  {avg ? (
                    <>
                      <p className="mt-2 text-xl font-bold text-page-fg">
                        {formatRateNumber(avg.amountRwf)} RWF
                      </p>
                      <p className="text-sm text-page-fg-70">{avg.basis}</p>
                    </>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </TabsContent>
      </Tabs>
    </section>
  );
}
