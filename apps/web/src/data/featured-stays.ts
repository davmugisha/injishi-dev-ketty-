import { ACCOMMODATION_CLASS_LABEL } from "@injishi/contracts";
import {
  PROPERTIES,
  type GalleryImage,
  type Rating,
} from "@/data/properties";
import { toSentenceCase } from "@/data/search-options";

/**
 * The home page's "Featured stays" deck.
 *
 * Derived from the properties marked with a `featuredRank`, so the deck can
 * only ever hold stays that have a page. It previously named six stays of
 * which four had no record at all — `amahoro-suites`,
 * `kacyiru-hilltop-residence`, `virunga-view-lodge` and
 * `nyamirambo-boutique-rooms` — and every one of them 404ed on click.
 */

export interface FeaturedStay {
  slug: string;
  /** Rendered bold, ahead of `nameRest`. */
  nameLead: string;
  nameRest: string;
  location: string;
  summary: string;
  /** Null where the property publishes no rate. */
  nightlyRateRwf: number | null;
  priceBasis: string;
  image: GalleryImage;
  /**
   * Where to hold the crop.
   *
   * The photo box is about 1.4:1 and almost everything we own is landscape at
   * roughly 1.5:1, so `object-fit: cover` scales to fill the height and trims
   * width. Only the X half of this value does anything on such a source — the
   * whole frame is already showing vertically, so there is nothing for Y to
   * move. Y is live only on the `rwanda-district-*` stems, which were shot
   * portrait and are far taller than the box.
   */
  imagePosition: string;
  /** The chip above the name. `kind` is the enum; this is the word for it. */
  kindLabel: string;
  starClass: number | null;
  /** Real and attributed, or absent. Nothing here is invented. */
  rating: Rating | null;
}

/**
 * The class spelled for a reader.
 *
 * Sentence case rather than title case: it sits beside a district in the same
 * chip row, and "Guest House in Kimihurura" reads like a headline fragment
 * where "Guest house in Kimihurura" reads like a fact.
 *
 * Derived from `ACCOMMODATION_CLASS_LABEL`, never retyped, so this deck and the
 * filter rail can never disagree about what a class is called (ADR-011 call 6).
 * The two do render the same class in different case, which is the point rather
 * than an oversight.
 */

/**
 * What the deck shows, where the card image is not what the deck should show.
 *
 * `cardImage` was chosen for a wide landscape tile and this deck crops nearer
 * to square, which is a different question about the same photograph, so the
 * answer lives here rather than in `properties.ts` — that file is generated
 * from the reference data and must not be hand-edited.
 *
 * `stem` only ever names a photograph already in that property's own gallery.
 * These are real, named, operating businesses; borrowing a better-composed
 * picture from somewhere else would be illustrating one company's listing with
 * another company's building.
 *
 * Every value below was read off the rendered crop, not guessed. The box is
 * wide enough now that a landscape source shows about 93% of its own width, so
 * X barely moves any of them and the choice of photograph matters far more than
 * the choice of offset:
 *
 *   amberhill   0%   the hotel's crescent block sits at the far left of the
 *                    frame; even a small centre bias slices it.
 *   bisate     40%   holds the silverback's head and chest whole.
 *   kivu       60%Y  native portrait, so here it is Y that bites; 60% trims sky
 *                    rather than lake.
 *
 * Four stems are swapped outright.
 *
 *   karongi-02          flat, grey, and with identifiable children in frame,
 *                       which is not a photograph to put on a marketing deck.
 *   rwanda-tea-01       60% blank sky once cropped.
 *   mille-collines-02   a terrace behind glass, which at the back of the deck
 *                       read as a blue sliver with a stray parasol in it.
 *                       `-01` is the hotel itself: the portico lit at dusk,
 *                       the flags, the front drive. It was passed over when
 *                       the box was 4:5 and a tall crop kept only a grid of
 *                       balconies; the wider box shows the building.
 *   kigali-night-       the strongest single frame in the deck and the wrong
 *   panorama-02         one for it. Two critics said the same thing
 *                       independently: it is the only night photograph among
 *                       five daylight ones, so the set does not key together.
 *                       `kigali-skyline-01` is the same city in daylight.
 *
 * Lanternhouse is still the weak card of the six and no value here fixes it:
 * every photograph in its gallery is a view of Kigali rather than of the hotel.
 * That is a sourcing gap, not a layout one, and it wants a photograph of the
 * building.
 */
const DECK_IMAGE: Record<string, { stem?: string; alt?: string; position: string }> = {
  "amberhill-convention-hotel": { position: "0% 50%" },
  "mistridge-lodge": { position: "40% 50%" },
  "hotel-des-sept-sentiers": {
    stem: "mille-collines-01",
    alt: "Hôtel des Sept Sentiers, Kiyovu: the front portico at dusk",
    position: "50% 50%",
  },
  "lanternhouse-hotel-kiyovu": {
    stem: "kigali-skyline-01",
    alt: "Lanternhouse Hotel Kiyovu, Kiyovu: the Kigali hills above the city",
    position: "40% 50%",
  },
  "sunbird-bay-hotel": {
    stem: "rwanda-district-rubavu",
    alt: "Sunbird Bay Hotel, Gisenyi: the lake shore at Rubavu",
    position: "50% 60%",
  },
  "mossgrove-forest-house": {
    stem: "rwanda-tea-02",
    alt: "Mossgrove Forest House: the tea terraces at Gisakura",
    position: "50% 50%",
  },
};

export const FEATURED_STAYS: FeaturedStay[] = PROPERTIES.filter(
  (property) => property.featuredRank !== undefined,
)
  .sort((a, b) => a.featuredRank! - b.featuredRank!)
  .map((property) => {
    const deck = DECK_IMAGE[property.slug];

    return {
      slug: property.slug,
      nameLead: property.cardName.lead,
      nameRest: property.cardName.rest,
      location: property.location,
      summary: property.summary,
      nightlyRateRwf: property.nightlyRateRwf,
      priceBasis: property.price.basis,
      image: {
        stem: deck?.stem ?? property.cardImage.stem,
        alt: deck?.alt ?? property.cardImage.alt,
      },
      imagePosition: deck?.position ?? "50% 50%",
      kindLabel: toSentenceCase(ACCOMMODATION_CLASS_LABEL[property.kind]),
      starClass: property.starClass,
      rating: property.rating,
    };
  });
