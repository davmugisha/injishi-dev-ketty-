import type { GalleryImage } from "@/data/properties";
import type { DistrictSlug } from "@/data/search-options";

/**
 * The home page's travel knowledge: moods, routes, drive times and seasons.
 *
 * EDITORIAL, and marked for the team to review. Nothing here is measured by
 * the platform. The drive times are typical road times in a private car with
 * no stops, rounded to the half hour; the seasons are Rwanda's well-known two
 * dry and two wet seasons. Both are the kind of fact a guide book prints, and
 * a guest reads them as advice, not as a promise. Stay COUNTS are never
 * written here: the page counts the live inventory and passes them in.
 *
 * TODO(content): have someone who drives these roads check every number.
 */

/* ------------------------------------------------------------------ places */

export interface DistrictPlace {
  slug: DistrictSlug;
  /** What a visitor calls it, which is not always the district's name. */
  name: string;
  /** The towns or sights a reader knows it by. */
  known: string;
  /** Where the dot sits on the at-a-glance map. */
  latitude: number;
  longitude: number;
  /** Typical drive from central Kigali, in hours. Zero for Kigali itself. */
  hoursFromKigali: number;
  image: GalleryImage;
  province: string;
  /** The mark on the at-a-glance map; the component maps it to an icon. */
  mark: PlaceMark;
  /** Three things a visitor comes for, each with its icon key. */
  bestFor: { label: string; icon: TagIcon }[];
}

export type PlaceMark = "city" | "volcano" | "lake" | "island" | "forest" | "savannah";
export type TagIcon =
  | "culture" | "food" | "business"
  | "trek" | "volcano" | "nature"
  | "beach" | "boat" | "sunset"
  | "island" | "quiet"
  | "forest" | "lake"
  | "wildlife" | "camping";

export const DISTRICT_PLACES: DistrictPlace[] = [
  {
    slug: "kigali",
    name: "Kigali",
    known: "The capital, on its hills",
    latitude: -1.9536,
    longitude: 30.0605,
    hoursFromKigali: 0,
    image: { stem: "kigali-skyline-01", alt: "The Kigali skyline" },
    province: "City of Kigali",
    mark: "city",
    bestFor: [{ label: "Culture", icon: "culture" }, { label: "Food & drink", icon: "food" }, { label: "Business", icon: "business" }],
  },
  {
    slug: "musanze",
    name: "Musanze",
    known: "Kinigi and the Volcanoes park gate",
    latitude: -1.499,
    longitude: 29.634,
    hoursFromKigali: 2,
    image: { stem: "volcanoes-np-03", alt: "A volcano above the farmland" },
    province: "Northern Province",
    mark: "volcano",
    bestFor: [{ label: "Gorilla treks", icon: "trek" }, { label: "Volcanoes", icon: "volcano" }, { label: "Nature", icon: "nature" }],
  },
  {
    slug: "rubavu",
    name: "Rubavu",
    known: "Gisenyi, on Lake Kivu's north shore",
    latitude: -1.681,
    longitude: 29.2624,
    hoursFromKigali: 3,
    image: { stem: "lake-kivu-01", alt: "Lake Kivu shoreline at Rubavu" },
    province: "Western Province",
    mark: "lake",
    bestFor: [{ label: "Beaches", icon: "beach" }, { label: "Boating", icon: "boat" }, { label: "Sunsets", icon: "sunset" }],
  },
  {
    slug: "karongi",
    name: "Karongi",
    known: "Kibuye's bays and islands",
    latitude: -2.0567,
    longitude: 29.3833,
    hoursFromKigali: 2.5,
    image: { stem: "karongi-02", alt: "A bay at Karongi on Lake Kivu" },
    province: "Western Province",
    mark: "island",
    bestFor: [{ label: "Islands", icon: "island" }, { label: "Boating", icon: "boat" }, { label: "Quiet", icon: "quiet" }],
  },
  {
    slug: "rusizi",
    name: "Rusizi",
    known: "Kamembe, and the edge of Nyungwe",
    latitude: -2.484,
    longitude: 28.907,
    hoursFromKigali: 5.5,
    image: { stem: "lake-kivu-02", alt: "Boats on Lake Kivu" },
    province: "Western Province",
    mark: "forest",
    bestFor: [{ label: "Rainforest", icon: "forest" }, { label: "Lakeside", icon: "lake" }, { label: "Nature", icon: "nature" }],
  },
  {
    slug: "nyagatare",
    name: "Nyagatare",
    known: "The savannah north of Akagera",
    latitude: -1.2925,
    longitude: 30.3273,
    hoursFromKigali: 2.5,
    image: { stem: "akagera-np-01", alt: "Savannah in Akagera National Park" },
    province: "Eastern Province",
    mark: "savannah",
    bestFor: [{ label: "Wildlife", icon: "wildlife" }, { label: "Nature", icon: "nature" }, { label: "Camping", icon: "camping" }],
  },
  // Kayonza and Huye joined the facets on 2026-10-21 (`data/search-options.ts`).
  {
    slug: "kayonza",
    name: "Kayonza",
    known: "Akagera's southern gate and Lake Ihema",
    latitude: -1.879,
    longitude: 30.645,
    hoursFromKigali: 2.5,
    image: { stem: "akagera-np-03", alt: "Akagera National Park" },
    province: "Eastern Province",
    mark: "savannah",
    bestFor: [{ label: "Wildlife", icon: "wildlife" }, { label: "Lakeside", icon: "lake" }, { label: "Camping", icon: "camping" }],
  },
  {
    slug: "huye",
    name: "Huye",
    known: "Butare, the museums and the road to Nyungwe",
    latitude: -2.5967,
    longitude: 29.7394,
    hoursFromKigali: 2.5,
    image: { stem: "rwanda-tea-01", alt: "Tea plantations in southern Rwanda" },
    province: "Southern Province",
    mark: "forest",
    bestFor: [{ label: "Culture", icon: "culture" }, { label: "Quiet", icon: "quiet" }, { label: "Rainforest", icon: "forest" }],
  },
];

/** "2h", "2½h", "5½h". The half is the only fraction the table uses. */
export function formatHours(hours: number): string {
  const whole = Math.floor(hours);
  return `${whole}${hours - whole >= 0.5 ? "½" : ""}h`;
}

/* ------------------------------------------------------------------- moods */

export interface Mood {
  id: string;
  /** Finishes the sentence "Where do you want to wake up?" */
  label: string;
  districts: DistrictSlug[];
  /** The places, in words, under the label. */
  places: string;
  /** What the hero says while this mood is hovered. */
  line: string;
  image: GalleryImage;
}

/**
 * The hero's four postcards. Each one is a set of districts, so a click is an
 * ordinary Explore search and the count on the card is the count Explore shows.
 */
export const MOODS: Mood[] = [
  {
    id: "lake",
    label: "By the lake",
    districts: ["rubavu", "karongi", "rusizi"],
    places: "The Lake Kivu shore",
    line: "Beaches, boats at dawn and sunsets over the Kivu shore.",
    image: { stem: "lake-kivu-01", alt: "Lake Kivu shoreline" },
  },
  {
    id: "mist",
    label: "In the mist",
    districts: ["musanze"],
    places: "Musanze · Kinigi",
    line: "Lodges under the Virunga volcanoes, minutes from the gorillas.",
    image: { stem: "volcanoes-np-03", alt: "A volcano above the farmland" },
  },
  {
    id: "city",
    label: "In the city",
    districts: ["kigali"],
    places: "Kigali",
    line: "Kigali's hills: galleries, markets and dinner on the ridge.",
    image: { stem: "kigali-skyline-01", alt: "The Kigali skyline" },
  },
  {
    id: "safari",
    label: "On safari",
    // Kayonza first: the park's southern gate, where most of its lodges are.
    districts: ["kayonza", "nyagatare"],
    places: "Akagera · Kayonza · Nyagatare",
    line: "Big game on the plains and lakes of Akagera.",
    image: { stem: "akagera-np-01", alt: "Savannah in Akagera National Park" },
  },
];

/* ------------------------------------------------------------------ routes */

export interface RouteStop {
  district: DistrictSlug;
  /** The name on the stop, which can be narrower than the district. */
  name: string;
  nights: number;
  /** Hours on the road to reach this stop from the one before it. */
  driveHours: number | null;
  /** One line on why you stop here. */
  why: string;
  /** Where the stop sits on the route map: [latitude, longitude]. */
  at: readonly [number, number];
  image: GalleryImage;
}

export interface TripRoute {
  id: string;
  label: string;
  summary: string;
  /** The route card's cover: never a photograph a stop below already uses. */
  image: GalleryImage;
  stops: RouteStop[];
}

export const TRIP_ROUTES: TripRoute[] = [
  {
    id: "gorillas",
    label: "Gorilla trek",
    summary: "Land in Kigali, trek in the Virungas, rest by the lake.",
    image: { stem: "rwanda-district-musanze", alt: "Mist over the Virunga volcanoes above Musanze" },
    stops: [
      {
        district: "kigali",
        name: "Kigali",
        nights: 1,
        driveHours: null,
        why: "Land, change money, sleep before the road north.",
        at: [-1.9536, 30.0605],
        image: { stem: "kigali-skyline-01", alt: "The Kigali skyline" },
      },
      {
        district: "musanze",
        name: "Kinigi",
        nights: 2,
        driveHours: 2,
        why: "Fifteen minutes from the park gate for the 07:00 briefing.",
        at: [-1.429, 29.596],
        image: { stem: "mountain-gorilla-01", alt: "A mountain gorilla in the forest" },
      },
      {
        district: "rubavu",
        name: "Lake Kivu",
        nights: 1,
        driveHours: 1.5,
        why: "Tired legs, warm water, a sunset over the lake.",
        at: [-1.702, 29.258],
        image: { stem: "lake-kivu-01", alt: "Lake Kivu shoreline at Rubavu" },
      },
    ],
  },
  {
    id: "lake",
    label: "Lake escape",
    summary: "Down the Kivu shore on the Congo-Nile road.",
    image: { stem: "karongi-01", alt: "Karongi hillside above Lake Kivu" },
    stops: [
      {
        district: "rubavu",
        name: "Rubavu",
        nights: 2,
        driveHours: 3,
        why: "Beaches, a lakeside promenade, boats at dawn.",
        at: [-1.702, 29.258],
        image: { stem: "lake-kivu-03", alt: "Hills meeting Lake Kivu" },
      },
      {
        district: "karongi",
        name: "Karongi",
        nights: 2,
        driveHours: 2.5,
        why: "Quiet bays and island trips from Kibuye.",
        at: [-2.06, 29.348],
        image: { stem: "karongi-02", alt: "A bay at Karongi on Lake Kivu" },
      },
      {
        district: "rusizi",
        name: "Rusizi",
        nights: 1,
        driveHours: 3,
        why: "The southern shore, a short drive to Nyungwe.",
        at: [-2.48, 28.907],
        image: { stem: "lake-kivu-02", alt: "Boats on Lake Kivu" },
      },
    ],
  },
  {
    id: "city",
    label: "City break",
    summary: "Three nights in Kigali, one day out to the volcanoes.",
    image: { stem: "kigali-night-panorama-02", alt: "Kigali at night" },
    stops: [
      {
        district: "kigali",
        name: "Kigali",
        nights: 3,
        driveHours: null,
        why: "Markets, memorial, galleries, and dinner on Kimihurura's ridge.",
        at: [-1.9536, 30.0605],
        image: { stem: "kigali-skyline-01", alt: "The Kigali skyline" },
      },
      {
        district: "musanze",
        name: "Musanze",
        nights: 1,
        driveHours: 2,
        why: "The twin lakes and a volcano view before you fly.",
        at: [-1.499, 29.634],
        image: { stem: "volcanoes-np-03", alt: "A volcano above the farmland" },
      },
    ],
  },
  {
    id: "safari",
    label: "Safari",
    summary: "Big game on the eastern plains, two hours from the airport.",
    image: { stem: "akagera-np-03", alt: "Grassland in Akagera National Park" },
    stops: [
      {
        district: "kigali",
        name: "Kigali",
        nights: 1,
        driveHours: null,
        why: "Arrive, rest, leave early for the park.",
        at: [-1.9536, 30.0605],
        image: { stem: "kigali-skyline-01", alt: "The Kigali skyline" },
      },
      {
        // Kayonza, not Nyagatare: the stop's own point (`at`) is the southern
        // gate, which is in Kayonza district.
        district: "kayonza",
        name: "Akagera",
        nights: 2,
        driveHours: 2.5,
        why: "Game drives at dawn and dusk, a boat on Lake Ihema.",
        at: [-1.88, 30.62],
        image: { stem: "akagera-np-01", alt: "Savannah in Akagera National Park" },
      },
    ],
  },
];

/* ----------------------------------------------------------------- seasons */

export type Season = "dry" | "short-rains" | "long-rains";

interface MonthNote {
  /** 0 = January. */
  month: number;
  season: Season;
  /** Five words or so, shown when the month is picked. */
  note: string;
  /** Relative rainfall, 0 (dry) to 3 (wettest). Drawn, never printed. */
  rain: 0 | 1 | 2 | 3;
}

/** The photograph behind each season. */
export const SEASON_IMAGE: Readonly<Record<Season, GalleryImage>> = {
  dry: { stem: "akagera-np-03", alt: "Dry grassland in Akagera National Park" },
  "short-rains": { stem: "rwanda-tea-02", alt: "Tea fields in the Rwandan hills" },
  "long-rains": { stem: "nyungwe-forest-03", alt: "Rainforest at Nyungwe" },
};

export const SEASON_LABEL: Readonly<Record<Season, string>> = {
  dry: "Dry season",
  "short-rains": "Short rains",
  "long-rains": "Long rains",
};

export const MONTHS: MonthNote[] = [
  { month: 0, season: "dry", note: "Short dry spell, green hills", rain: 1 },
  { month: 1, season: "dry", note: "Dry, good trekking, fewer people", rain: 1 },
  { month: 2, season: "long-rains", note: "Rains begin, lower rates", rain: 2 },
  { month: 3, season: "long-rains", note: "The wettest month; muddy trails", rain: 3 },
  { month: 4, season: "long-rains", note: "Rains easing, lush and quiet", rain: 2 },
  { month: 5, season: "dry", note: "Long dry season begins", rain: 0 },
  { month: 6, season: "dry", note: "Peak trekking and safari", rain: 0 },
  { month: 7, season: "dry", note: "Peak season; book early", rain: 0 },
  { month: 8, season: "dry", note: "Dry and clear, last of the peak", rain: 1 },
  { month: 9, season: "short-rains", note: "Short rains, afternoon showers", rain: 2 },
  { month: 10, season: "short-rains", note: "Showers, quiet parks", rain: 2 },
  { month: 11, season: "dry", note: "Drying out for the holidays", rain: 1 },
];
