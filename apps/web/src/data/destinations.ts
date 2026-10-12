/**
 * The destination index behind the hero search typeahead.
 *
 * Three kinds of place a guest might type, ranked in this order when scores
 * tie: a district, a landmark or park, then a neighbourhood. Named stays are
 * the published properties, added at runtime (`data/published-stays.ts`).
 * The reference bar (vrbo.com) matches place names literally; Rwandan places
 * carry pre-1994 and colloquial names that are still what people type, so the
 * index carries them as `aliases` — someone searching "Gisenyi" or "Butare"
 * means Rubavu and Huye and should not be told there are no matches.
 *
 * Geography, not inventory: these are real places, and nothing here says how
 * many stays sit in each. Shaped so `GET /api/v1/destinations` can replace it
 * as a change of source, not of consumers.
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
  /** Set on stays: the listing slug, so a pick can go straight to the page. */
  slug?: string;
}

const DISTRICTS: Destination[] = [
  {
    id: "d-kigali",
    label: "Kigali",
    context: "Rwanda · Capital",
    kind: "district",
    district: "kigali",
  },
  {
    id: "d-musanze",
    label: "Musanze",
    context: "Northern Province",
    kind: "district",
    district: "musanze",
    aliases: ["ruhengeri"],
  },
  {
    id: "d-rubavu",
    label: "Rubavu",
    context: "Western Province · Lake Kivu",
    kind: "district",
    district: "rubavu",
    aliases: ["gisenyi"],
  },
  {
    id: "d-karongi",
    label: "Karongi",
    context: "Western Province · Lake Kivu",
    kind: "district",
    district: "karongi",
    aliases: ["kibuye"],
  },
  {
    id: "d-huye",
    label: "Huye",
    context: "Southern Province",
    kind: "district",
    district: "huye",
    aliases: ["butare"],
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
  },
  {
    id: "l-kivu",
    label: "Lake Kivu",
    context: "Rubavu & Karongi",
    kind: "landmark",
    district: "rubavu",
    aliases: ["kivu lake", "lakeside", "beach"],
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
  },
  {
    id: "l-akagera",
    label: "Akagera National Park",
    context: "Eastern Province · Safari",
    kind: "landmark",
    // Kayonza, not Kigali. The park is a three-hour drive east, so resolving
    // it to the capital would have filtered to stays nowhere near it.
    district: "kayonza",
    aliases: ["safari", "big five"],
  },
];

const AREAS: Destination[] = [
  {
    id: "a-kacyiru",
    label: "Kacyiru",
    context: "Kigali · Gasabo",
    kind: "area",
    district: "kigali",
  },
  {
    id: "a-kimihurura",
    label: "Kimihurura",
    context: "Kigali · Gasabo",
    kind: "area",
    district: "kigali",
  },
  {
    id: "a-remera",
    label: "Remera",
    context: "Kigali · Gasabo",
    kind: "area",
    district: "kigali",
  },
  {
    id: "a-nyamirambo",
    label: "Nyamirambo",
    context: "Kigali · Nyarugenge",
    kind: "area",
    district: "kigali",
  },
  {
    id: "a-nyarutarama",
    label: "Nyarutarama",
    context: "Kigali · Gasabo",
    kind: "area",
    district: "kigali",
  },
  {
    id: "a-kiyovu",
    label: "Kiyovu",
    context: "Kigali · Nyarugenge",
    kind: "area",
    district: "kigali",
  },
  {
    id: "a-kinigi",
    label: "Kinigi",
    context: "Musanze · Park gate",
    kind: "area",
    district: "musanze",
    aliases: ["park gate"],
  },
];

export const DESTINATIONS: Destination[] = [
  ...DISTRICTS,
  ...LANDMARKS,
  ...AREAS,
];

/**
 * What the panel shows before a key is pressed.
 *
 * The reference fills this space with example phrasings; concrete places are
 * more useful than a lesson in how to phrase a query, and they are one tap
 * rather than a sentence to type. The first five, in the order written above.
 */
export const POPULAR_DESTINATIONS: Destination[] = [...DISTRICTS, ...LANDMARKS].slice(0, 5);
