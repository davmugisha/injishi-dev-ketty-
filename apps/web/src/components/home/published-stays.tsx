import { SectionHeading } from "@/components/shared/section-heading";
import { ListingCard } from "@/components/stays/listing-card";
import type { Listing } from "@/data/listings";

/**
 * "Published on Injishi": the stays businesses published themselves.
 *
 * Explore already lists the database's published properties beside the
 * catalogue (`data/discovery.ts`), but the landing page was built only from the
 * curated catalogue, so a business that set up and published its property in
 * the operator app never reached the marketplace's front door. This band is
 * that door. The page reads the listings on the server and hands them in, so
 * the band renders nothing (not an empty heading) when the API is unreachable
 * or nothing is published.
 *
 * A grid of the same shipped `ListingCard` the "Stays this week" band uses,
 * capped at eight so a busy platform cannot turn the home page into a list.
 */
const MAX_CARDS = 8;

export function PublishedStays({ listings }: { listings: Listing[] }) {
  if (listings.length === 0) return null;

  return (
    <section className="section-y container flex flex-col gap-8">
      <SectionHeading
        lead="Published "
        emphasis="on Injishi"
        lede="Stays their owners set up and published on Injishi themselves, open to book."
        action={{ label: "All stays", href: "/explore" }}
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {listings.slice(0, MAX_CARDS).map((listing) => (
          <ListingCard key={listing.slug} listing={listing} compact />
        ))}
      </div>
    </section>
  );
}
