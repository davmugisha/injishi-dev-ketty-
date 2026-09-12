/**
 * The fixed, coded vocabularies inventory is built from.
 *
 * Amenities publish to booking channels, so a host picks from this list and
 * never types: free text would not survive the trip, and the Kinyarwanda column
 * would have nothing to translate. Every entry is scoped — `r` belongs to a room
 * type, `p` to the whole property.
 *
 * Content owner: mfp-demo.md § Amenity catalogue.
 */

/** [code, English, Kinyarwanda, scope]. */
export type AmenityEntry = [string, string, string, "r" | "p"];

export interface AmenityGroup {
  cat: string;
  items: AmenityEntry[];
}

/** [code, label]. */
export const BEDS: [string, string][] = [
  ["single", "Single"],
  ["double", "Double"],
  ["queen", "Queen"],
  ["king", "King"],
  ["twin", "Twin"],
  ["bunk", "Bunk bed"],
  ["sofa", "Sofa bed"],
  ["floor", "Floor mattress"],
];

export const AMENITIES: AmenityGroup[] = [
  {
    cat: "Essentials",
    items: [
      ["wifi", "Wi-Fi", "Interineti ya Wi-Fi", "r"],
      ["tv", "Flat-screen TV", "Televiziyo", "r"],
      ["desk", "Work desk", "Ameza yo gukorera", "r"],
      ["net", "Mosquito net", "Inzitiramibu", "r"],
      ["ac", "Air conditioning", "Icyuma gikonjesha", "r"],
      ["wardrobe", "Wardrobe", "Akabati k'imyenda", "r"],
    ],
  },
  {
    cat: "Bathroom",
    items: [
      ["hotwater", "Hot water", "Amazi ashyushye", "r"],
      ["shower", "Walk-in shower", "Dushe", "r"],
      ["towels", "Towels & linens", "Amashuka n'ibitambaro", "r"],
      ["hairdry", "Hair dryer", "Icyuma cyumisha umusatsi", "r"],
      ["toiletries", "Toiletries", "Ibikoresho by'isuku", "r"],
    ],
  },
  {
    cat: "Food & drink",
    items: [
      ["breakfast", "Breakfast available", "Ifunguro rya mu gitondo", "p"],
      ["restaurant", "Restaurant", "Resitora", "p"],
      ["kettle", "Electric kettle", "Ibirika ry'amashanyarazi", "r"],
      ["fridge", "Mini-fridge", "Firigo ntoya", "r"],
      ["water", "Bottled water", "Amazi yo kunywa", "r"],
    ],
  },
  {
    cat: "Outdoors & views",
    items: [
      ["garden", "Garden", "Ubusitani", "p"],
      ["terrace", "Terrace", "Varanda", "p"],
      ["pool", "Swimming pool", "Ipisine", "p"],
      ["parking", "Free parking", "Aho guhagarika imodoka ku buntu", "p"],
      ["view", "Lake or hill view", "Ahareba ikiyaga cyangwa imisozi", "r"],
    ],
  },
  {
    cat: "Services",
    items: [
      ["laundry", "Laundry service", "Serivisi yo kumesa", "p"],
      ["shuttle", "Airport shuttle", "Gutwara ku kibuga cy'indege", "p"],
      ["front24", "24-hour front desk", "Icyakira abashyitsi amasaha 24", "p"],
      ["housekeeping", "Daily housekeeping", "Isuku ya buri munsi", "p"],
      ["momo", "Mobile money accepted", "Kwishyura kuri mobile money", "p"],
    ],
  },
  {
    cat: "Safety",
    items: [
      ["smoke", "Smoke alarm", "Icyuma kimenya umwotsi", "r"],
      ["safe", "In-room safe", "Agasanduku k'umutekano", "r"],
      ["guard", "Security on site", "Umuzamu w'umutekano", "p"],
      ["generator", "Backup generator", "Jeneratori y'ingoboka", "p"],
      ["firstaid", "First-aid kit", "Agasanduku k'ubutabazi", "p"],
    ],
  },
];

/** Shared spaces describe a property. They can never be booked. */
export const SHARED_SPACES: string[] = [
  "Shared kitchen",
  "Shared lounge",
  "Garden",
  "Rooftop terrace",
  "Pool area",
  "Parking yard",
  "Laundry room",
];

const BED_LABEL = new Map(BEDS);
const AMENITY_INDEX = new Map(AMENITIES.flatMap((g) => g.items).map((a) => [a[0], a]));

export function bedLabel(code: string): string {
  return BED_LABEL.get(code) ?? code;
}

export function amenity(code: string): AmenityEntry | undefined {
  return AMENITY_INDEX.get(code);
}

/** "2 × Twin" / "1 × King + 1 × Sofa bed" — how a bed config reads to a guest. */
export function bedSummary(beds: [string, number][]): string {
  if (beds.length === 0) return "no beds yet";
  return beds.map(([code, n]) => `${n} × ${bedLabel(code)}`).join(" + ");
}
