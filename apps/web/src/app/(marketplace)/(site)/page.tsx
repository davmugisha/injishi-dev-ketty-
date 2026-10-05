import { BrowseByCategory } from "@/components/home/browse-by-category";
import { ExploreByDistrict } from "@/components/home/explore-by-district";
import { HomeHero } from "@/components/home/home-hero";
import { HostBanner } from "@/components/home/host-banner";
import { LatestGuides } from "@/components/home/latest-guides";
import { MostBookedCities } from "@/components/home/most-booked-cities";
import { PromoBar } from "@/components/home/promo-bar";
import { PromoPair } from "@/components/home/promo-pair";
import { PublishedStays } from "@/components/home/published-stays";
import { StaysForEveryTrip } from "@/components/home/stays-for-every-trip";
import { StaysThisWeek } from "@/components/home/stays-this-week";
import { WhyBook } from "@/components/home/why-book";
import { ContinueBrowsing } from "@/components/stays/recently-viewed";
import { databaseListings } from "@/data/discovery";
import { LISTINGS } from "@/data/listings";
import { toRecentStay } from "@/data/recent-stay";

/**
 * The landing page, in the ADR-022 band order.
 *
 * `StaysThisWeek` holds the slot the coverflow (`FeaturedStays`) held; the
 * deck component stays in the tree unrendered until ratification confirms
 * the swap. The promo bar and the promo pair render from `data/promotions.ts`, a single fixture standing in until the
 * Promotions module exists. The copy there carries no number, so nothing on
 * this page can expire into a lie.
 *
 * `PublishedStays` follows it: the properties businesses published from the
 * operator app, read from the API on the server exactly as Explore reads them
 * (`data/discovery.ts`), so the front door and the results page list the same
 * inventory. An unreachable API renders no band rather than an error.
 */
export default async function HomePage() {
  const published = await databaseListings();

  return (
    <div className="flex flex-col overflow-x-hidden">
      <HomeHero />
      {/* Empty, and so absent, until the visitor has opened a stay. */}
      <ContinueBrowsing stays={[...published, ...LISTINGS].map(toRecentStay)} />
      <PromoBar />
      <StaysThisWeek />
      <PublishedStays listings={published} />
      <PromoPair />
      <WhyBook />
      <BrowseByCategory />
      <ExploreByDistrict />
      <MostBookedCities />
      <StaysForEveryTrip />
      <HostBanner />
      <LatestGuides />
    </div>
  );
}
