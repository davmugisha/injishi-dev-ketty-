import { LISTINGS } from "@/data/listings";

/**
 * The destination index behind the hero search typeahead.
 *
 * Four kinds of thing a guest might type, ranked in this order when scores
 * tie: a district, a landmark or park, a neighbourhood, then a named stay.
 * The reference bar (vrbo.com) matches place names literally; Rwandan places
 * carry pre-1994 and colloquial names that are still what people type, so the
 * index carries them as `aliases` — someone searching "Gisenyi" or "Butare"
 * means Rubavu and Huye and should not be told there are no matches.
 *
 * Fixture data standing in for `GET /api/v1/destinations`. Shaped so the swap
 * is a change of source, not of consumers.
 */

export type DestinationKind = "district" | "landmark" | "area" | "stay";

export interface Destination {
  id: string;
  /** What the field fills with when chosen. */
  label: string;
  /** The line under the label — the parent place, or the stay's address. */
  context: string;
  kind: DestinationKind;
  /** The district slug this resolves to, for the /explore query. */
  district?: string;
  /** Other names for the same place. Matched, never displayed. */
  aliases?: string[];
  /** Listings behind it. Breaks score ties and renders as the row's right rail. */
  count?: number;
  /** Set on stays: the listing slug, so a pick can go straight to the page. */
  slug?: string;
}

/**
 * Listings per district, counted from the catalogue the results page filters.
 *
 * The number on a row is a promise about what the next screen holds, so it is
 * derived rather than written down: a hand-set "27" next to Rubavu would
 * survive right up until the guest picked it and landed on an empty grid.
 * Places with nothing in them carry no number at all.
 */
const COUNT_BY_DISTRICT: Record<string, number> = LISTINGS.reduce<
  Record<string, number>
>((counts, listing) => {
  counts[listing.district] = (counts[listing.district] ?? 0) + 1;
  return counts;
}, {});

/** Listings whose location line names this area, e.g. "Kacyiru, Kigali". */
function areaCount(area: string): number | undefined {
  const needle = area.toLowerCase();
  return (
    LISTINGS.filter((listing) => listing.location.toLowerCase().includes(needle))
      .length || undefined
  );
}

function districtCount(slug: string): number | undefined {
  return COUNT_BY_DISTRICT[slug] || undefined;
}

const DISTRICTS: Destination[] = [
  {
    id: "d-kigali",
    label: "Kigali",
    context: "Rwanda · Capital",
    kind: "district",
    district: "kigali",
    count: districtCount("kigali"),
  },
  {
    id: "d-musanze",
    label: "Musanze",
    context: "Northern Province",
    kind: "district",
    district: "musanze",
    aliases: ["ruhengeri"],
    count: districtCount("musanze"),
  },
  {
    id: "d-rubavu",
    label: "Rubavu",
    context: "Western Province · Lake Kivu",
    kind: "district",
    district: "rubavu",
    aliases: ["gisenyi"],
    count: districtCount("rubavu"),
  },
  {
    id: "d-karongi",
    label: "Karongi",
    context: "Western Province · Lake Kivu",
    kind: "district",
    district: "karongi",
    aliases: ["kibuye"],
    count: districtCount("karongi"),
  },
  {
    id: "d-huye",
    label: "Huye",
    context: "Southern Province",
    kind: "district",
    district: "huye",
    aliases: ["butare"],
    count: districtCount("huye"),
  },
];

const LANDMARKS: Destination[] = [
  {
    id: "l-volcanoes",
    label: "Volcanoes National Park",
    context: "Musanze · Gorilla trekking",
    kind: "landmark",
    district: "musanze",
    aliases: ["gorillas", "gorilla trekking", "virunga", "parc des volcans"],
    count: districtCount("musanze"),
  },
  {
    id: "l-kivu",
    label: "Lake Kivu",
    context: "Rubavu & Karongi",
    kind: "landmark",
    district: "rubavu",
    aliases: ["kivu lake", "lakeside", "beach"],
    count: districtCount("rubavu"),
  },
  {
    id: "l-nyungwe",
    label: "Nyungwe Forest",
    context: "Southern Province · Canopy walk",
    kind: "landmark",
    // Huye is the district guests base themselves in for Nyungwe; the forest
    // itself straddles Nyamasheke and Rusizi, neither of which the catalogue
    // covers yet.
    district: "huye",
    aliases: ["nyungwe national park", "canopy"],
    count: districtCount("huye"),
  },
  {
    id: "l-akagera",
    label: "Akagera National Park",
    context: "Eastern Province · Safari",
    kind: "landmark",
    // Kayonza, not Kigali. The park is a three-hour drive east, so resolving
    // it to the capital would have filtered to stays nowhere near it and
    // inherited the capital's inventory count while doing so.
    district: "kayonza",
    aliases: ["safari", "big five"],
    count: districtCount("kayonza"),
  },
];

const AREAS: Destination[] = [
  {
    id: "a-kacyiru",
    label: "Kacyiru",
    context: "Kigali · Gasabo",
    kind: "area",
    district: "kigali",
    count: areaCount("Kacyiru"),
  },
  {
    id: "a-kimihurura",
    label: "Kimihurura",
    context: "Kigali · Gasabo",
    kind: "area",
    district: "kigali",
    count: areaCount("Kimihurura"),
  },
  {
    id: "a-remera",
    label: "Remera",
    context: "Kigali · Gasabo",
    kind: "area",
    district: "kigali",
    count: areaCount("Remera"),
  },
  {
    id: "a-nyamirambo",
    label: "Nyamirambo",
    context: "Kigali · Nyarugenge",
    kind: "area",
    district: "kigali",
    count: areaCount("Nyamirambo"),
  },
  {
    id: "a-nyarutarama",
    label: "Nyarutarama",
    context: "Kigali · Gasabo",
    kind: "area",
    district: "kigali",
    count: areaCount("Nyarutarama"),
  },
  {
    id: "a-kiyovu",
    label: "Kiyovu",
    context: "Kigali · Nyarugenge",
    kind: "area",
    district: "kigali",
    count: areaCount("Kiyovu"),
  },
  {
    id: "a-kinigi",
    label: "Kinigi",
    context: "Musanze · Park gate",
    kind: "area",
    district: "musanze",
    aliases: ["park gate"],
    count: areaCount("Kinigi"),
  },
];

/**
 * Named stays, folded in from the listings the results page reads.
 *
 * A guest who already knows the property name should reach it from the hero
 * rather than being made to search and then scan. They rank below places so a
 * bare "Kigali" never surfaces a stay above the city itself.
 *
 * Sourced from `LISTINGS` rather than `STAY_CATALOG`: the catalogue holds only
 * the first word of a multi-word name (the card splits it across `nameLead`
 * and `nameRest`), which put entries reading "Kigali", "Kivu" and "Gasabo"
 * into the panel directly under the real places of those names.
 */
const STAYS: Destination[] = LISTINGS.map((listing) => ({
  id: `s-${listing.slug}`,
  label: [listing.nameLead, listing.nameRest].filter(Boolean).join(" "),
  context: listing.location,
  kind: "stay" as const,
  district: listing.district,
  slug: listing.slug,
}));

export const DESTINATIONS: Destination[] = [
  ...DISTRICTS,
  ...LANDMARKS,
  ...AREAS,
  ...STAYS,
];

/**
 * What the panel shows before a key is pressed.
 *
 * The reference fills this space with example phrasings; concrete places are
 * more useful than a lesson in how to phrase a query, and they are one tap
 * rather than a sentence to type. Ordered by inventory so the openers are the
 * ones that actually lead somewhere — a suggestion is a promise about the next
 * screen, and an empty grid is a bad first answer.
 */
export const POPULAR_DESTINATIONS: Destination[] = [...DISTRICTS, ...LANDMARKS]
  .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
  .slice(0, 5);
