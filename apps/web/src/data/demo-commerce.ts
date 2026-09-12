/**
 * EVERY INVENTED COMMERCE NUMBER ON A CARD, IN ONE FILE.
 *
 * Read this before you trust anything it returns. The card design this file
 * feeds was rebuilt to match a reference that prints five things the platform
 * does not yet have anywhere: a review COUNT, a total price, the price that
 * total was struck down from, a discount badge, and a paid-placement mark. The
 * checkout rail added a sixth: a scarcity line naming how often a stay is
 * booked. None of them exist. There is no Reviews module, no Pricing module
 * that totals a stay, no Promotions module that discounts one, no Occupancy
 * module that knows a booking rate, and nothing sells placement. So they are
 * made up here, deliberately and in one place.
 *
 * This is NOT the standing of `data/properties.ts` or `data/home-curations.ts`.
 * Those are curated fixtures: hand-picked, but every fact in them is true of a
 * real property. Everything below is fabricated. It must not be quoted to a
 * guest, screenshotted for a pitch, or read as a product claim.
 *
 * WHEN THE REAL MODULES LAND, DELETE THIS FILE. Each field names the module
 * that owes it, so the swap is one import per field and this file shrinks to
 * nothing rather than lingering as a second source.
 *
 * Everything is derived from the slug by a pure function, never from
 * `Math.random`. A random number would differ between the server render and
 * the client hydration, and React would tear the card down and rebuild it on
 * every load. Derived from the slug, a property shows the same numbers on
 * every render, on both sides, for ever.
 */
import type { Listing } from "@/data/listings";

/** Rwanda's VAT rate, the one real number in this file. */
const VAT = 0.18;

export type DemoDeal =
  | { kind: "member" }
  | { kind: "off"; amountRwf: number };

export interface DemoCommerce {
  /** Owed by the Reviews module. How many guests left the score. */
  reviewCount: number;
  /** Owed by the Pricing module. One night plus VAT. */
  totalRwf: number | null;
  /** Owed by Pricing. What the total was before the deal, or null when there is none. */
  wasTotalRwf: number | null;
  /** Owed by the Promotions module. */
  deal: DemoDeal | null;
  /** Owed by an Ads module that is not on any roadmap. Paid placement. */
  sponsored: boolean;
  /**
   * Owed by an Occupancy module that does not exist. The checkout rail's
   * "usually booked" line — never shown for a listing that is not also `busy`
   * above, so the platform is never one voice claiming a property is quiet on
   * the card and scarce on the checkout page.
   */
  rareFind: boolean;
}

/**
 * A stable 32-bit hash of the slug.
 *
 * FNV-1a. Chosen because it is four lines and has no dependencies, not because
 * the distribution matters here; nothing downstream is security sensitive or
 * statistically load bearing.
 */
function hash(slug: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < slug.length; i += 1) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Pull a deterministic integer in [min, max] out of the hash at `offset`. */
function pick(seed: number, offset: number, min: number, max: number): number {
  const shifted = (seed >>> offset) & 0xffff;
  return min + (shifted % (max - min + 1));
}

export function demoCommerceFor(listing: Listing): DemoCommerce {
  const seed = hash(listing.slug);

  // A real catalogue is lopsided: most properties carry a handful of reviews
  // and a few carry hundreds. A flat range would make every card look equally
  // established, which is the one thing a review count is read for.
  const busy = pick(seed, 0, 0, 9) < 3;
  const reviewCount = busy ? pick(seed, 4, 120, 900) : pick(seed, 4, 3, 64);

  // Only a busy listing can plausibly be "usually booked", and even among
  // those it is roughly one in three, or the line loses its meaning.
  const rareFind = busy && pick(seed, 20, 0, 2) === 0;

  const nightly = listing.nightlyRateRwf;
  if (nightly === null) {
    // A tenth of the catalogue quotes per itinerary. No nightly rate means no
    // total and no discount off one, so the card prints neither.
    return {
      reviewCount,
      totalRwf: null,
      wasTotalRwf: null,
      deal: null,
      sponsored: false,
      rareFind,
    };
  }

  const totalRwf = Math.round((nightly * (1 + VAT)) / 100) * 100;

  // Three states, roughly a third each: a member price, a cash discount, or
  // no deal at all. A page where every card shouts a discount reads as a
  // liquidation sale, not a marketplace.
  const bucket = pick(seed, 8, 0, 2);
  let deal: DemoDeal | null = null;
  let wasTotalRwf: number | null = null;

  if (bucket === 0) {
    deal = { kind: "member" };
  } else if (bucket === 1) {
    const percent = pick(seed, 12, 10, 35);
    const was = Math.round((totalRwf / (1 - percent / 100)) / 100) * 100;
    deal = { kind: "off", amountRwf: was - totalRwf };
    wasTotalRwf = was;
  }

  return {
    reviewCount,
    totalRwf,
    wasTotalRwf,
    deal,
    sponsored: pick(seed, 16, 0, 5) === 0,
    rareFind,
  };
}
