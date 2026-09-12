import { ACCOMMODATION_CLASS_LABEL } from "@injishi/contracts";
import type { Listing } from "@/data/listings";
import { LISTINGS } from "@/data/listings";
import { SEARCH_DISTRICTS } from "@/data/search-options";
import {
  ACCESS_FEATURES,
  ACTIVITY_KINDS,
  CANCELLATION_OPTIONS,
  EXPERIENCE_KINDS,
  MEAL_PLANS,
  PAYMENT_OPTIONS,
  PROPERTY_AMENITIES,
  ROOM_AMENITIES,
  VIEW_KINDS,
} from "@/data/stay-facets";
import { demoCommerceFor } from "@/data/demo-commerce";

/**
 * The explore filter rail: what it offers, and how many stays sit behind each
 * option.
 *
 * **Every option and every count is COMPUTED from the catalogue, never written
 * down.** This is the rule `data/search-options.ts` already states and the
 * reason it states it: the hand-maintained lists it replaced drifted three
 * separate times and produced five live filter bugs of one kind — a control
 * offering something no property was, or omitting something properties were.
 * A rail with twenty groups has twenty chances to make that mistake, so
 * nothing here is typed by hand except the VOCABULARY, and even that is
 * filtered down to the members that have a stay behind them.
 *
 * **A count is what the option would ADD, not what it currently shows.** Each
 * count is measured against the listings that survive every OTHER group, with
 * this group's own selection ignored. That is what makes "Pool (17)" mean
 * "ticking this leaves you 17" rather than "17 stays have a pool somewhere in
 * the catalogue", and it is why ticking one box does not send every other
 * count in the same group to zero.
 *
 * **An option with a count of zero is not offered.** A rail that lists a
 * facet nobody can choose is the drift bug wearing a different hat. Groups
 * that empty out entirely drop away with their options.
 */

/* --------------------------------------------------------------- popular */

export interface PopularFilter {
  id: string;
  label: string;
  matches: (listing: Listing) => boolean;
}

/**
 * The reference's "Popular filters" block: a shortcut row of the questions
 * most guests ask, each of which is answerable from a facet further down the
 * rail. They are shortcuts rather than a second vocabulary — every one of them
 * is defined in terms of data the other groups already read.
 */
export const POPULAR_FILTERS: PopularFilter[] = [
  {
    id: "breakfast",
    label: "Breakfast included",
    matches: (l) => l.facets.meals.includes("breakfast"),
  },
  {
    id: "free_cancellation",
    label: "Fully refundable",
    matches: (l) => l.facets.cancellation.includes("fully_refundable"),
  },
  { id: "pool", label: "Pool", matches: (l) => l.facets.amenityKeys.includes("Pool") },
  {
    id: "wifi",
    label: "WiFi included",
    matches: (l) => l.facets.amenityKeys.includes("Free WiFi"),
  },
  {
    id: "parking",
    label: "Parking",
    matches: (l) => l.facets.amenityKeys.includes("Parking"),
  },
  { id: "vip", label: "VIP Access", matches: (l) => l.facets.vip },
  {
    id: "under_50k",
    label: "Under RWF 50,000 a night",
    matches: (l) => l.nightlyRateRwf !== null && l.nightlyRateRwf <= 50_000,
  },
  {
    id: "rated_8",
    label: "Guest score 8 and above",
    matches: (l) => (l.rating?.score ?? 0) >= 8,
  },
];

/* ---------------------------------------------------------------- groups */

/** How a group's options behave. The rail renders the shape it is told. */
export type FacetShape = "checkbox" | "radio";

export interface FacetOption {
  /** The value written to the URL. */
  value: string;
  label: string;
  /** Stays that would remain if this option were chosen. */
  count: number;
  /** The cheapest nightly rate among those stays, or null. Printed as "From". */
  fromRwf: number | null;
}

export interface FacetGroup {
  /** The `data-facet-group` id, and the key the rail keys its state by. */
  id: string;
  title: string;
  shape: FacetShape;
  /** Which field of `ExploreRefinement` this group writes. */
  field: FacetField;
  options: FacetOption[];
  /** Options past this index sit behind a "See more" expander. */
  visible: number;
  /** Print a "From <rate>" column beside each option. */
  showFrom?: boolean;
}

/**
 * The refinement fields a facet group may write.
 *
 * Named as a union rather than `string` so a group naming a field that does
 * not exist is a compile error rather than a control that silently does
 * nothing — which is the exact defect the old accommodation-type pill had.
 */
export type FacetField =
  | "popular"
  | "districts"
  | "classes"
  | "rating"
  | "kinds"
  | "amenities"
  | "roomAmenities"
  | "experience"
  | "available"
  | "views"
  | "activities"
  | "payment"
  | "cancellation"
  | "meals"
  | "access"
  | "bedrooms";

/** What a listing must hold for one option of one group. */
type Predicate = (listing: Listing) => boolean;

/** The top bedroom bucket. At and above this, the option means "or more". */
const BEDROOM_CAP = 4;

/**
 * Whether a listing belongs to one bedroom bucket.
 *
 * EXACT below the cap, "or more" at it. It used to be `>= count` for every
 * option, which made the first one — "1+" — match the entire catalogue: a
 * control that was permanently a no-op, sitting in the rail looking like a
 * filter. Every bucket now excludes something.
 *
 * Exported because `lib/filter-listings.ts` must apply the SAME rule the count
 * beside the option was computed with. Two copies of this is how a rail comes
 * to promise "3 bedrooms (7)" and then return nine.
 */
export function matchesBedrooms(listing: Listing, count: number): boolean {
  return count >= BEDROOM_CAP
    ? listing.bedrooms >= BEDROOM_CAP
    : listing.bedrooms === count;
}

export function bedroomLabel(count: number): string {
  if (count >= BEDROOM_CAP) return `${BEDROOM_CAP}+ bedrooms`;
  if (count === 1) return "Studio or 1 bedroom";
  return `${count} bedrooms`;
}

interface GroupSpec {
  id: string;
  title: string;
  shape: FacetShape;
  field: FacetField;
  visible: number;
  showFrom?: boolean;
  options: { value: string; label: string; matches: Predicate }[];
}

const has = (key: string): Predicate => (l) => l.facets.amenityKeys.includes(key);

function specs(): GroupSpec[] {
  return [
    {
      id: "popular",
      title: "Popular filters",
      shape: "checkbox",
      field: "popular",
      visible: 6,
      options: POPULAR_FILTERS.map((filter) => ({
        value: filter.id,
        label: filter.label,
        matches: filter.matches,
      })),
    },
    {
      id: "neighbourhood",
      title: "Neighbourhood",
      shape: "checkbox",
      field: "districts",
      visible: 6,
      options: SEARCH_DISTRICTS.map((district) => ({
        value: district.slug,
        label: district.name,
        matches: (l) => l.district === district.slug,
      })),
    },
    {
      id: "property-class",
      title: "Property class",
      shape: "checkbox",
      field: "classes",
      visible: 4,
      showFrom: true,
      options: [5, 4, 3, 2].map((stars) => ({
        value: String(stars),
        label: `${stars}-star`,
        matches: (l) => l.starClass === stars,
      })),
    },
    {
      id: "guest-rating",
      title: "Guest rating",
      shape: "radio",
      field: "rating",
      visible: 4,
      showFrom: true,
      options: [
        { value: "9", label: "Exceptional 9+" },
        { value: "8", label: "Very good 8+" },
        { value: "7", label: "Good 7+" },
      ].map((option) => ({
        ...option,
        matches: (l: Listing) => (l.rating?.score ?? 0) >= Number(option.value),
      })),
    },
    {
      id: "property-type",
      title: "Property type",
      shape: "checkbox",
      field: "kinds",
      visible: 4,
      showFrom: true,
      // Every class with a stay behind it, in the contract's own declaration
      // order. No label is written here: `ACCOMMODATION_CLASS_LABEL` is the
      // one spelling of a class anywhere in this app.
      options: (Object.keys(ACCOMMODATION_CLASS_LABEL) as (keyof typeof ACCOMMODATION_CLASS_LABEL)[]).map(
        (kind) => ({
          value: kind,
          label: ACCOMMODATION_CLASS_LABEL[kind],
          matches: (l: Listing) => l.kind === kind,
        }),
      ),
    },
    {
      id: "property-amenities",
      title: "Property amenities",
      shape: "checkbox",
      field: "amenities",
      visible: 5,
      options: PROPERTY_AMENITIES.map((amenity) => ({
        value: amenity.id,
        label: amenity.label,
        matches: has(amenity.id),
      })),
    },
    {
      id: "room-amenities",
      title: "Room amenities",
      shape: "checkbox",
      field: "roomAmenities",
      visible: 5,
      options: ROOM_AMENITIES.map((amenity) => ({
        value: amenity.id,
        label: amenity.label,
        matches: has(amenity.id),
      })),
    },
    {
      id: "traveller-experience",
      title: "Traveller experience",
      shape: "checkbox",
      field: "experience",
      visible: 4,
      options: EXPERIENCE_KINDS.map((kind) => ({
        value: kind.id,
        label: kind.label,
        matches: (l) => l.facets.experience.includes(kind.id),
      })),
    },
    {
      id: "availability",
      title: "Availability",
      shape: "checkbox",
      field: "available",
      visible: 1,
      options: [
        {
          value: "1",
          label: "Only show available properties",
          matches: (l) => l.facets.roomsLeft !== 0,
        },
      ],
    },
    {
      id: "views",
      title: "Room views",
      shape: "checkbox",
      field: "views",
      visible: 4,
      options: VIEW_KINDS.map((view) => ({
        value: view.id,
        label: view.label,
        matches: (l) => l.facets.views.includes(view.id),
      })),
    },
    {
      id: "activities",
      title: "Nearby activities",
      shape: "checkbox",
      field: "activities",
      visible: 4,
      options: ACTIVITY_KINDS.map((activity) => ({
        value: activity.id,
        label: activity.label,
        matches: (l) => l.facets.activities.includes(activity.id),
      })),
    },
    {
      id: "payment",
      title: "Payment type",
      shape: "checkbox",
      field: "payment",
      visible: 3,
      options: PAYMENT_OPTIONS.map((payment) => ({
        value: payment.id,
        label: payment.label,
        matches: (l) => l.facets.payment.includes(payment.id),
      })),
    },
    {
      id: "cancellation",
      title: "Property cancellation options",
      shape: "checkbox",
      field: "cancellation",
      visible: 2,
      options: CANCELLATION_OPTIONS.map((option) => ({
        value: option.id,
        label: option.label,
        matches: (l) => l.facets.cancellation.includes(option.id),
      })),
    },
    {
      id: "meals",
      title: "Meal plans available",
      shape: "checkbox",
      field: "meals",
      visible: 4,
      options: MEAL_PLANS.map((plan) => ({
        value: plan.id,
        label: plan.label,
        matches: (l) => l.facets.meals.includes(plan.id),
      })),
    },
    {
      id: "accessibility",
      title: "Accessibility",
      shape: "checkbox",
      field: "access",
      visible: 3,
      options: ACCESS_FEATURES.map((feature) => ({
        value: feature.id,
        label: feature.label,
        matches: (l) => l.facets.access.includes(feature.id),
      })),
    },
    {
      id: "bedrooms",
      title: "Number of bedrooms",
      shape: "radio",
      field: "bedrooms",
      visible: 4,
      options: [1, 2, 3, 4].map((count) => ({
        value: String(count),
        label: bedroomLabel(count),
        matches: (l: Listing) => matchesBedrooms(l, count),
      })),
    },
  ];
}

/**
 * Build the rail for a given result set.
 *
 * `pool` is the listings that survive every group EXCEPT the one being
 * counted; the caller supplies one pool per group id. Where a group has no
 * pool of its own the whole result set is used, which is the right answer for
 * a group nothing else constrains.
 */
export function buildFacetGroups(
  poolFor: (groupId: string, field: FacetField) => Listing[],
): FacetGroup[] {
  const groups: FacetGroup[] = [];

  for (const spec of specs()) {
    const pool = poolFor(spec.id, spec.field);
    const options: FacetOption[] = [];

    for (const option of spec.options) {
      const hits = pool.filter(option.matches);
      if (hits.length === 0) continue;
      options.push({
        value: option.value,
        label: option.label,
        count: hits.length,
        fromRwf: cheapest(hits),
      });
    }

    if (options.length === 0) continue;
    groups.push({
      id: spec.id,
      title: spec.title,
      shape: spec.shape,
      field: spec.field,
      options,
      visible: spec.visible,
      showFrom: spec.showFrom,
    });
  }

  return groups;
}

function cheapest(listings: Listing[]): number | null {
  let best: number | null = null;
  for (const listing of listings) {
    const rate = listing.nightlyRateRwf;
    if (rate === null) continue;
    if (best === null || rate < best) best = rate;
  }
  return best;
}

/* ------------------------------------------------------------- histogram */

export interface PriceHistogram {
  /** Bar heights normalised to 0..1, cheapest bucket first. */
  bars: number[];
  /** The RWF value at the left edge of each bucket. */
  edges: number[];
  minRwf: number;
  maxRwf: number;
  step: number;
}

/**
 * The distribution the rail draws above its price range.
 *
 * Real: it is a histogram of the catalogue's own rates. The reference draws
 * one because a range control with no distribution behind it gives a guest no
 * idea where to put the handles — the whole value of the picture is that it
 * shows the market is bunched under 150,000 RWF with a long tail above it.
 *
 * Stays with no published rate are excluded rather than counted at zero; a
 * tenth of the catalogue quotes per itinerary and a phantom bar at the left
 * edge would misdescribe the market.
 */
export function priceHistogram(
  listings: Listing[],
  buckets = 28,
): PriceHistogram | null {
  const rates = listings
    .map((listing) => listing.nightlyRateRwf)
    .filter((rate): rate is number => rate !== null)
    .sort((a, b) => a - b);
  if (rates.length === 0) return null;

  const minRwf = 0;
  // The 95th percentile ALONE is not a strong enough trim on a catalogue this
  // small. Five per cent of ~50 stays is two of them, so the two dearest rates
  // still set the whole scale: with a 4,894,000 RWF stay in the pool the top
  // came out at 4,425,000, every bucket was 158,000 RWF wide, and 26 of the 28
  // bars were empty. The rail drew one spike and a flat line — a picture of
  // nothing, which is the exact failure the paragraph above set out to avoid.
  //
  // Pairing it with a multiple of the MEDIAN fixes that, because the median
  // cannot be moved by a tail at all: whichever of the two is lower wins, so
  // p95 still governs an evenly spread catalogue and the median governs a
  // long-tailed one. Three medians is the usual trim for a right-skewed price
  // distribution, and it keeps the bulk of the market across the middle of the
  // chart rather than crushed against the left edge.
  const at = (q: number) => rates[Math.min(rates.length - 1, Math.floor(rates.length * q))]!;
  const top = Math.min(at(0.95), at(0.5) * 3);
  const roundedTop = Math.max(50_000, Math.ceil(top / 25_000) * 25_000);
  const step = roundedTop / buckets;

  const counts = new Array<number>(buckets).fill(0);
  for (const rate of rates) {
    // Everything above the top lands in the last bucket rather than falling
    // out of the picture: the tail is small but it is real.
    const index = Math.min(buckets - 1, Math.floor(rate / step));
    counts[index] = (counts[index] ?? 0) + 1;
  }

  const tallest = Math.max(...counts, 1);
  return {
    bars: counts.map((count) => count / tallest),
    edges: counts.map((_, index) => Math.round(index * step)),
    minRwf,
    maxRwf: roundedTop,
    step: Math.round(step),
  };
}

/** The rail's default range, computed once from the whole catalogue. */
export const CATALOGUE_HISTOGRAM = priceHistogram(LISTINGS);

/**
 * The ceiling the range slider runs to, in RWF.
 *
 * Read from the histogram rather than typed, so adding an expensive stay moves
 * the control rather than leaving it unable to reach the new top.
 */
export const PRICE_CEILING = CATALOGUE_HISTOGRAM?.maxRwf ?? 500_000;

/** The same distribution over TOTALS, for when the rail is switched to totals. */
export function totalHistogram(listings: Listing[]): PriceHistogram | null {
  return priceHistogram(
    listings.map((listing) => ({
      ...listing,
      nightlyRateRwf: demoCommerceFor(listing).totalRwf,
    })),
  );
}
