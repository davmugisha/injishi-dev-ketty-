import { DISTRICT_PLACES, formatHours, type DistrictPlace } from "@/data/journeys";
import type { DistrictSlug } from "@/data/search-options";
import { stayCount } from "@/lib/stay-count";

/**
 * The destination pages, `/stays` and `/stays/<district>` (2026-10-21).
 *
 * "Hotels in Musanze" and "guesthouse in Kigali" are what people actually
 * search, and the site answered neither: a district existed only as an Explore
 * filter (`/explore?district=musanze`), a query string whose results render in
 * the browser, so a crawler saw a heading and nothing under it. Each district
 * now has a page of its own, rendered on the server, with the live stays on it.
 *
 * NOTHING HERE IS NEW EDITORIAL. The facts are the ones the home page already
 * prints (`DISTRICT_PLACES`: province, drive time, what a district is known
 * and best for), and the questions are answered from them and from the live
 * count. A destination page that invented a sight, a price or a distance would
 * be the first thing on it to go stale.
 */

/**
 * The guides written about each district, by slug, most specific first. A
 * district no guide covers yet gets the all-districts guide (`guidesFor`),
 * which is not listed here so it never reads as being about one district.
 */
const GUIDES_FOR: Readonly<Record<DistrictSlug, string[]>> = {
  kigali: ["kigali-stays-explore-the-heart-of-rwanda"],
  musanze: ["discover-musanze-volcanoes-trails-twin-lakes"],
  rubavu: ["rubavu-stays-discover-the-lake-kivu-shore", "lake-kivu-guide-beaches-boats-lakeside-calm"],
  karongi: ["lake-kivu-guide-beaches-boats-lakeside-calm"],
  rusizi: ["lake-kivu-guide-beaches-boats-lakeside-calm"],
  huye: ["huye-stays-the-cultural-soul-of-the-south"],
  kayonza: [],
  nyagatare: [],
};

const ALL_DISTRICTS_GUIDE = "rwanda-stays-your-complete-district-guide";

/** Every district with a page, in the home page's order. */
export const DESTINATIONS: DistrictPlace[] = DISTRICT_PLACES;

export function findDestination(slug: string): DistrictPlace | undefined {
  return DESTINATIONS.find((place) => place.slug === slug);
}

export function destinationPath(slug: DistrictSlug): string {
  return `/stays/${slug}`;
}

/** The guides a district's page offers: its own, else the all-districts one. */
export function guidesFor(slug: DistrictSlug): string[] {
  return GUIDES_FOR[slug].length > 0 ? GUIDES_FOR[slug] : [ALL_DISTRICTS_GUIDE];
}

/** The districts a guide is written about; empty for a guide about them all. */
export function districtsCoveredBy(guideSlug: string): DistrictPlace[] {
  return DESTINATIONS.filter((place) => GUIDES_FOR[place.slug].includes(guideSlug));
}

/** "About 2h by road from Kigali", or "The capital" for Kigali itself. */
export function driveLine(place: DistrictPlace): string {
  return place.hoursFromKigali > 0
    ? `About ${formatHours(place.hoursFromKigali)} by road from Kigali`
    : "Where most visitors land";
}

/** The questions a destination page answers, from the data it already shows. */
export function destinationFaq(place: DistrictPlace, count: number): { question: string; answer: string }[] {
  const listed = stayCount(count);
  const bestFor = place.bestFor.map((tag) => tag.label.toLowerCase()).join(", ");
  return [
    {
      question: `How many places to stay are there in ${place.name}?`,
      answer: listed
        ? `${listed} in ${place.name} on Injishi today, each one verified before it was listed. The list on this page is the live one.`
        : `None is listed in ${place.name} on Injishi yet. Places appear here as their owners pass verification, so check back, or ask us to tell you when the first one opens.`,
    },
    {
      question: `How far is ${place.name} from Kigali?`,
      answer:
        place.hoursFromKigali > 0
          ? `${driveLine(place)}, in the ${place.province}.`
          : `${place.name} is the capital, in the ${place.province}, and where most visitors arrive.`,
    },
    {
      question: `What is ${place.name} best for?`,
      answer: `${place.known}. Visitors come for ${bestFor}.`,
    },
    {
      question: `How do I pay for a stay in ${place.name}?`,
      answer:
        "By mobile money, MTN MoMo or Airtel Money, in Rwandan francs. The payment is held in escrow rather than sent straight to the host, and your party's total shows before you pay.",
    },
  ];
}
