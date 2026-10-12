import type { AccommodationClass } from "@injishi/contracts";
import type { Listing } from "@/data/listings";
import { matchesBedrooms, POPULAR_FILTERS } from "@/data/explore-facets";
import type { FacetField } from "@/data/explore-facets";
import {
  billableGuests,
  type ExploreRefinement,
  type ExploreSort,
  type StayIntent,
  type StayType,
} from "@/lib/search-params";

/**
 * Apply the explore filters, then sort.
 *
 * The vocabulary lives in `search-params.ts`; this module is only the
 * algorithm. It takes the two halves separately because they answer different
 * questions: INTENT is what the guest asked for and REFINEMENT is how they
 * narrowed the answer.
 *
 * **Dates narrow nothing here, and that is not an oversight.** Listings
 * carry no availability calendar, so a date range cannot be honoured against
 * them. It is carried through the URL so it reaches the property page and the
 * booking widget without being asked for twice, and `/explore` says out loud
 * that availability is confirmed at the booking step. Filtering on dates lands
 * with the search endpoint (F-S05); silently returning the same fifty stays
 * while looking like a date filter would be the worse lie.
 *
 * **Every list facet is AND across groups, OR within one.** Ticking Pool and
 * Restaurant means both; ticking Kigali and Musanze means either. That is what
 * every booking site does and what a guest expects, and getting it backwards
 * makes a rail that empties itself the moment a second box is ticked.
 *
 * Runs against the local fixture set. When the search endpoint arrives this
 * moves server-side; the component keeps its shape because it already reads
 * its state from the URL rather than from component state alone.
 */
export function filterListings(
  listings: Listing[],
  intent: StayIntent,
  refinement: ExploreRefinement,
): Listing[] {
  const query = intent.query.trim().toLowerCase();
  const name = refinement.name.trim().toLowerCase();
  const guests = billableGuests(intent.guests);

  const matched = listings.filter((listing) => {
    if (query) {
      const haystack =
        `${listing.nameLead} ${listing.nameRest} ${listing.location}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    // The rail's own name field. Deliberately NOT the address: it sits under
    // the heading "Search by property name", and matching the address there
    // would return every stay in a neighbourhood whose name a guest typed
    // hoping for one hotel.
    if (name) {
      const title = `${listing.nameLead} ${listing.nameRest}`.toLowerCase();
      if (!title.includes(name)) return false;
    }

    if (
      intent.districts.length > 0 &&
      !intent.districts.includes(listing.district)
    ) {
      return false;
    }

    if (!matchesStayType(listing.kind, refinement.stayType)) return false;

    if (refinement.kinds.length > 0 && !refinement.kinds.includes(listing.kind)) {
      return false;
    }

    if (refinement.classes.length > 0) {
      // A stay with no star class cannot satisfy a class filter. Treating a
      // missing class as "any" would put every unrated lodge inside a
      // five-star search, which is the opposite of what was asked.
      if (listing.starClass === null) return false;
      if (!refinement.classes.includes(listing.starClass)) return false;
    }

    if (refinement.rating !== null) {
      if (!listing.rating) return false;
      if (listing.rating.score < refinement.rating) return false;
    }

    // Price. The bound is compared against whichever figure the rail is
    // showing, because a guest who switched the rail to totals and typed a
    // ceiling meant that ceiling on the total.
    const price = listing.nightlyRateRwf;
    if (refinement.minRwf !== null || refinement.maxRwf !== null) {
      if (price === null) return false;
      if (refinement.minRwf !== null && price < refinement.minRwf) return false;
      if (refinement.maxRwf !== null && price > refinement.maxRwf) return false;
    }

    // Through the SAME predicate the rail counted with, not a second copy of
    // the rule. The buckets are exact below the top one and "or more" at it.
    if (refinement.bedrooms !== null && !matchesBedrooms(listing, refinement.bedrooms)) {
      return false;
    }

    const facets = listing.facets;
    if (!hasEvery(facets.amenityKeys, refinement.amenities)) return false;
    if (!hasEvery(facets.amenityKeys, refinement.roomAmenities)) return false;
    if (!hasEvery(facets.experience, refinement.experience)) return false;
    if (!hasEvery(facets.views, refinement.views)) return false;
    if (!hasEvery(facets.activities, refinement.activities)) return false;
    if (!hasEvery(facets.meals, refinement.meals)) return false;

    for (const id of refinement.popular) {
      const filter = POPULAR_FILTERS.find((candidate) => candidate.id === id);
      // An unknown id in the URL narrows nothing rather than emptying the
      // page: somebody edited the link, and an empty result set reads as a
      // broken site where "we ignored that word" reads as a search.
      if (filter && !filter.matches(listing)) return false;
    }

    // Each listing carries a real `maxGuests`, so occupancy is read rather
    // than guessed from the bedroom count as it used to be.
    if (listing.maxGuests < guests) return false;
    return true;
  });

  return sortListings(matched, refinement.sort);
}

/** Every ticked value must be present. An empty selection narrows nothing. */
function hasEvery(has: readonly string[], wanted: readonly string[]): boolean {
  if (wanted.length === 0) return true;
  return wanted.every((value) => has.includes(value));
}

/**
 * The tab-to-class mapping, in one place.
 *
 * `hotels` is what a hospitality business registers under and `homes` is what
 * a private host lists. `other` sits in neither: it is the escape hatch of the
 * RDB vocabulary and putting it in one bucket would be a guess about somebody
 * else's property.
 */
const HOTEL_CLASSES: readonly AccommodationClass[] = [
  "hotel",
  "motel",
  "lodge",
  "guest_house",
  "tented_camp",
];
const HOME_CLASSES: readonly AccommodationClass[] = ["apartment", "villa"];

export function matchesStayType(kind: AccommodationClass, type: StayType): boolean {
  if (type === "all") return true;
  if (type === "hotels") return HOTEL_CLASSES.includes(kind);
  return HOME_CLASSES.includes(kind);
}

function sortListings(listings: Listing[], sort: ExploreSort): Listing[] {
  const sorted = [...listings];

  switch (sort) {
    case "price_asc":
      return sorted.sort(byPrice(1));
    case "price_desc":
      return sorted.sort(byPrice(-1));
    case "rating_desc":
      return sorted.sort(byRating);
    case "bedrooms_asc":
      return sorted.sort((a, b) => a.bedrooms - b.bedrooms);
    case "bedrooms_desc":
      return sorted.sort((a, b) => b.bedrooms - a.bedrooms);
    default:
      // Recommended, and it is exactly what `SORT_EXPLAINER` says it is:
      // score first, then rate.
      return sorted.sort((a, b) => {
        const scoreGap = (b.rating?.score ?? 0) - (a.rating?.score ?? 0);
        if (scoreGap !== 0) return scoreGap;
        return byPrice(1)(a, b);
      });
  }
}

/** Rate-on-request stays sort last in both directions, never as a zero. */
function byPrice(direction: 1 | -1) {
  return (a: Listing, b: Listing): number => {
    const left = a.nightlyRateRwf;
    const right = b.nightlyRateRwf;
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    return (left - right) * direction;
  };
}

/** Unscored stays sort last, never as a zero. */
function byRating(a: Listing, b: Listing): number {
  if (!a.rating && !b.rating) return 0;
  if (!a.rating) return 1;
  if (!b.rating) return -1;
  return b.rating.score - a.rating.score;
}

/**
 * The result set ONE facet group would leave, with every OTHER group's
 * selection still applied.
 *
 * This is what makes the count beside an option answer "if I also tick this,
 * how many am I left with" rather than "how many exist somewhere in the
 * catalogue" — the second question is what a hand-computed, filter-blind count
 * would answer, and it is why a rail can look alive while narrowing nothing:
 * every number stays fixed no matter what else is ticked.
 *
 * `districts` is read off INTENT rather than refinement — it is the one facet
 * this rail shares with the hero's own vocabulary — so it is handled by name
 * rather than through the generic list-field path the rest of the groups use.
 */
export function poolExcluding(
  listings: Listing[],
  intent: StayIntent,
  refinement: ExploreRefinement,
  field: FacetField,
): Listing[] {
  if (field === "districts") {
    return filterListings(listings, { ...intent, districts: [] }, refinement);
  }
  if (field === "rating") {
    return filterListings(listings, intent, { ...refinement, rating: null });
  }
  if (field === "bedrooms") {
    return filterListings(listings, intent, { ...refinement, bedrooms: null });
  }
  return filterListings(listings, intent, { ...refinement, [field]: [] });
}
