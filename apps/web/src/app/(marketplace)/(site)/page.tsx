import type { Metadata } from "next";
import { HomeGuides } from "@/components/home/home-guides";
import { HomeHero } from "@/components/home/home-hero";
import { HostBand } from "@/components/home/host-band";
import { HowAStayWorks } from "@/components/home/how-a-stay-works";
import { OpeningBand } from "@/components/home/opening-band";
import { Reveal } from "@/components/home/reveal";
import { RwandaAtAGlance } from "@/components/home/rwanda-at-a-glance";
import { StaysShelf, type ShelfTab } from "@/components/home/stays-shelf";
import { TripPlanner } from "@/components/home/trip-planner";
import { WhenToGo } from "@/components/home/when-to-go";
import { JsonLd } from "@/components/shared/json-ld";
import { ContinueBrowsing } from "@/components/stays/recently-viewed";
import { databaseListings } from "@/data/discovery";
import { DISTRICT_PLACES, MOODS, TRIP_ROUTES } from "@/data/journeys";
import type { Listing } from "@/data/listings";
import { toRecentStay } from "@/data/recent-stay";
import type { DistrictSlug } from "@/data/search-options";
import { EMPTY_INTENT, exploreHref } from "@/lib/search-params";
import { shareMetadata } from "@/lib/share-metadata";
import { organizationJsonLd, websiteJsonLd } from "@/lib/structured-data";

/** The title and description come from the root layout; this adds the address. */
export const metadata: Metadata = {
  alternates: { canonical: "/" },
  ...shareMetadata({
    title: "Stay anywhere in Rwanda | Injishi",
    description:
      "Book verified guesthouses, lodges and serviced apartments across Rwanda. Pay by mobile money, held in escrow, with support from search to arrival.",
    path: "/",
  }),
};

/** Cards per shelf tab, and stays under each stop of a route. */
const SHELF_SIZE = 4;
const STOP_SIZE = 2;
/** Stays in the at-a-glance panel for the picked district. */
const GLANCE_SIZE = 3;

/**
 * The best `count` stays of `pool`: those with photographs first, then by
 * score. A row of "No photos yet" tiles is a poor first impression when the
 * same district holds a stay that has uploaded some.
 */
function pick(pool: Listing[], count: number): Listing[] {
  return [...pool]
    .sort(
      (a, b) =>
        Number(b.image !== null) - Number(a.image !== null) ||
        (b.rating?.score ?? 0) - (a.rating?.score ?? 0),
    )
    .slice(0, count);
}

const inDistricts = (districts: DistrictSlug[]) =>
  exploreHref({ ...EMPTY_INTENT, districts });

/**
 * The landing page, as a trip is planned: where (the hero's moods), how (a
 * route), how far (the map), when (the seasons), then the stays themselves,
 * how booking works, and something to read.
 *
 * Every count and every stay is the live inventory — the published properties
 * read from the API exactly as Explore reads them (`data/discovery.ts`) — so a
 * number on this page is the number Explore will show.
 * The travel knowledge (routes, road times, seasons) is editorial and lives in
 * `data/journeys.ts`.
 */
export default async function HomePage() {
  const all = await databaseListings();
  const within = (districts: DistrictSlug[]) =>
    all.filter((stay) => districts.includes(stay.district));

  const moods = MOODS.map((mood) => ({
    mood,
    count: within(mood.districts).length,
    href: inDistricts(mood.districts),
  }));

  const staysByDistrict: Partial<Record<DistrictSlug, Listing[]>> = {};
  for (const place of DISTRICT_PLACES) {
    staysByDistrict[place.slug] = pick(within([place.slug]), STOP_SIZE);
  }

  const places = DISTRICT_PLACES.map((place) => ({
    place,
    count: within([place.slug]).length,
    href: inDistricts([place.slug]),
    stays: pick(within([place.slug]), GLANCE_SIZE),
  }));

  const lake: DistrictSlug[] = ["rubavu", "karongi", "rusizi"];
  // A tab with nothing behind it is left out rather than opened on an empty row.
  const shelf: ShelfTab[] = ([
    { id: "all", label: "All stays", href: "/explore", total: all.length, stays: pick(all, SHELF_SIZE) },
    { id: "kigali", label: "Kigali", href: inDistricts(["kigali"]), total: within(["kigali"]).length, stays: pick(within(["kigali"]), SHELF_SIZE) },
    { id: "musanze", label: "Musanze", href: inDistricts(["musanze"]), total: within(["musanze"]).length, stays: pick(within(["musanze"]), SHELF_SIZE) },
    { id: "lake", label: "Lake Kivu", href: inDistricts(lake), total: within(lake).length, stays: pick(within(lake), SHELF_SIZE) },
  ] satisfies ShelfTab[]).filter((tab) => tab.total > 0);

  return (
    <div className="flex flex-col overflow-x-hidden">
      <JsonLd data={organizationJsonLd()} />
      <JsonLd data={websiteJsonLd()} />
      <HomeHero moods={moods} />
      {/* Nothing public yet: say so straight under the hero, before four bands
          of trip planning that have no stay to offer. It goes the moment one
          property is published. */}
      {all.length === 0 ? <OpeningBand /> : null}
      {/* Empty, and so absent, until the visitor has opened a stay. */}
      <ContinueBrowsing stays={all.map(toRecentStay)} />
      <Reveal>
        <TripPlanner routes={TRIP_ROUTES} staysByDistrict={staysByDistrict} />
      </Reveal>
      <Reveal>
        <RwandaAtAGlance places={places} />
      </Reveal>
      <Reveal>
        <WhenToGo />
      </Reveal>
      <Reveal>
        <StaysShelf tabs={shelf} />
      </Reveal>
      <Reveal>
        <HowAStayWorks />
      </Reveal>
      <Reveal>
        <HomeGuides />
      </Reveal>
      <Reveal>
        <HostBand />
      </Reveal>
    </div>
  );
}
