import type { Listing } from "@/data/listings";
import { formatRateNumber, NO_RATE, shortBasis } from "@/lib/price";

/**
 * What a "recently viewed" surface needs to draw one stay. A plain module, not
 * a client one, so a server page (the home page) can build these and hand the
 * client only the few fields it prints rather than whole listings.
 */
export type RecentStay = {
  slug: string;
  name: string;
  location: string;
  /** Null when the stay has uploaded no photograph. */
  imageSrc: string | null;
  imageAlt: string;
  /** "412,000 RWF per person / night", or the no-rate wording. */
  rateLabel: string;
};

export function toRecentStay(listing: Listing): RecentStay {
  const rate = formatRateNumber(listing.nightlyRateRwf);
  return {
    slug: listing.slug,
    name: `${listing.nameLead}${listing.nameRest ? ` ${listing.nameRest}` : ""}`,
    location: listing.location,
    imageSrc: listing.image ? (listing.image.src ?? `/assets/${listing.image.stem}.jpg`) : null,
    imageAlt: listing.image?.alt ?? "",
    rateLabel: rate ? `${rate} RWF ${shortBasis(listing.priceBasis)}` : NO_RATE,
  };
}
