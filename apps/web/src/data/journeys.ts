import type { GalleryImage } from "@/data/properties";
import type { DistrictSlug } from "@/data/search-options";

/**
 * The travel knowledge the district pages print: places and drive times.
 *
 * EDITORIAL, and marked for the team to review. Nothing here is measured by
 * the platform. The drive times are typical road times in a private car with
 * no stops, rounded to the half hour: the kind of fact a guide book prints,
 * which a guest reads as advice, not as a promise. Stay COUNTS are never
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
  /** Typical drive from central Kigali, in hours. Zero for Kigali itself. */
  hoursFromKigali: number;
  image: GalleryImage;
  province: string;
  /** Three things a visitor comes for. */
  bestFor: { label: string }[];
}

export const DISTRICT_PLACES: DistrictPlace[] = [
  {
    slug: "kigali",
    name: "Kigali",
    known: "The capital, on its hills",
    hoursFromKigali: 0,
    image: { stem: "kigali-skyline-01", alt: "The Kigali skyline" },
    province: "City of Kigali",
    bestFor: [{ label: "Culture" }, { label: "Food & drink" }, { label: "Business" }],
  },
  {
    slug: "musanze",
    name: "Musanze",
    known: "Kinigi and the Volcanoes park gate",
    hoursFromKigali: 2,
    image: { stem: "volcanoes-np-03", alt: "A volcano above the farmland" },
    province: "Northern Province",
    bestFor: [{ label: "Gorilla treks" }, { label: "Volcanoes" }, { label: "Nature" }],
  },
  {
    slug: "rubavu",
    name: "Rubavu",
    known: "Gisenyi, on Lake Kivu's north shore",
    hoursFromKigali: 3,
    image: { stem: "lake-kivu-01", alt: "Lake Kivu shoreline at Rubavu" },
    province: "Western Province",
    bestFor: [{ label: "Beaches" }, { label: "Boating" }, { label: "Sunsets" }],
  },
  {
    slug: "karongi",
    name: "Karongi",
    known: "Kibuye's bays and islands",
    hoursFromKigali: 2.5,
    image: { stem: "karongi-02", alt: "A bay at Karongi on Lake Kivu" },
    province: "Western Province",
    bestFor: [{ label: "Islands" }, { label: "Boating" }, { label: "Quiet" }],
  },
  {
    slug: "rusizi",
    name: "Rusizi",
    known: "Kamembe, and the edge of Nyungwe",
    hoursFromKigali: 5.5,
    image: { stem: "lake-kivu-02", alt: "Boats on Lake Kivu" },
    province: "Western Province",
    bestFor: [{ label: "Rainforest" }, { label: "Lakeside" }, { label: "Nature" }],
  },
  {
    slug: "nyagatare",
    name: "Nyagatare",
    known: "The savannah north of Akagera",
    hoursFromKigali: 2.5,
    image: { stem: "akagera-np-01", alt: "Savannah in Akagera National Park" },
    province: "Eastern Province",
    bestFor: [{ label: "Wildlife" }, { label: "Nature" }, { label: "Camping" }],
  },
  // Kayonza and Huye joined the facets on 2026-10-21 (`data/search-options.ts`).
  {
    slug: "kayonza",
    name: "Kayonza",
    known: "Akagera's southern gate and Lake Ihema",
    hoursFromKigali: 2.5,
    image: { stem: "akagera-np-03", alt: "Akagera National Park" },
    province: "Eastern Province",
    bestFor: [{ label: "Wildlife" }, { label: "Lakeside" }, { label: "Camping" }],
  },
  {
    slug: "huye",
    name: "Huye",
    known: "Butare, the museums and the road to Nyungwe",
    hoursFromKigali: 2.5,
    image: { stem: "rwanda-tea-01", alt: "Tea plantations in southern Rwanda" },
    province: "Southern Province",
    bestFor: [{ label: "Culture" }, { label: "Quiet" }, { label: "Rainforest" }],
  },
];

/** "2h", "2½h", "5½h". The half is the only fraction the table uses. */
export function formatHours(hours: number): string {
  const whole = Math.floor(hours);
  return `${whole}${hours - whole >= 0.5 ? "½" : ""}h`;
}
