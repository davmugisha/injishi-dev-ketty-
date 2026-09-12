import { SectionHeading } from "@/components/shared/section-heading";
import { ListingCard } from "@/components/stays/listing-card";
import { STAYS_THIS_WEEK } from "@/data/home-curations";

/**
 * "Stays this week" — band 02 of ADR-022, the slot the coverflow held.
 *
 * Four cards flat on the page ground, where the deck showed one stay square
 * and turned the rest away. The deck was a poster; this is a comparison row,
 * which is what a booking page's first stays band is for: price against
 * price, score against score, side by side.
 *
 * The cards are the shipped `ListingCard` with the two home-band extras
 * turned on: the attributed score and the verified mark (AC-3). Same curation
 * as the deck, derived from it in `home-curations.ts`.
 */
export function StaysThisWeek() {
  return (
    <section className="section-y container flex flex-col gap-8">
      <SectionHeading
        lead="Stays "
        emphasis="this week"
        lede="We do not list every accommodation; only verified ones. Hand-picked guesthouses, lodges and serviced apartments across Rwanda's districts."
        action={{ label: "All stays", href: "/explore" }}
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {STAYS_THIS_WEEK.map((listing) => (
          <ListingCard
            key={listing.slug}
            listing={listing}
            showRating
            showVerified
            compact
          />
        ))}
      </div>
    </section>
  );
}
