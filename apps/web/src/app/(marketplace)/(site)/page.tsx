import { BrowseByCategory } from "@/components/home/browse-by-category";
import { ExploreByDistrict } from "@/components/home/explore-by-district";
import { HomeHero } from "@/components/home/home-hero";
import { HostBanner } from "@/components/home/host-banner";
import { LatestGuides } from "@/components/home/latest-guides";
import { MostBookedCities } from "@/components/home/most-booked-cities";
import { PromoBar } from "@/components/home/promo-bar";
import { PromoPair } from "@/components/home/promo-pair";
import { StaysForEveryTrip } from "@/components/home/stays-for-every-trip";
import { StaysThisWeek } from "@/components/home/stays-this-week";
import { WhyBook } from "@/components/home/why-book";

/**
 * The landing page, in the ADR-022 band order.
 *
 * `StaysThisWeek` holds the slot the coverflow (`FeaturedStays`) held; the
 * deck component stays in the tree unrendered until ratification confirms
 * the swap. The promo bar and the promo pair render from `data/promotions.ts`, a single fixture standing in until the
 * Promotions module exists. The copy there carries no number, so nothing on
 * this page can expire into a lie.
 */
export default function HomePage() {
  return (
    <div className="flex flex-col overflow-x-hidden">
      <HomeHero />
      <PromoBar />
      <StaysThisWeek />
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
