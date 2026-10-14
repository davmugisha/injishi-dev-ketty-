import { screens } from "@injishi/data";
import type { GuestProfile, MarketListing, MarketSearch } from "@injishi/data/fixtures/market";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { marketVisitor } from "@/features/market/format";
import { MarketExploreView } from "@/features/market/MarketExploreView";
import { requireScreen } from "@/lib/session";

export const metadata: Metadata = { title: screens.MarketExplore.pageTitle };

/** Public marketplace search: stays and homes to rent from verified businesses (no sign-in needed). */
export default async function MarketExplorePage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const persona = await requireScreen("MarketExplore");
  const [searches, listings, profiles] = await Promise.all([
    getCollection<MarketSearch>("market.searches"),
    getCollection<MarketListing>("market.listings"),
    getCollection<GuestProfile>("market.guestProfiles"),
  ]);
  const { mode } = await searchParams;
  return (
    <MarketExploreView
      visitor={marketVisitor(persona, profiles[0])}
      data={{ searches, listings }}
      initialMode={mode === "homes" ? "homes" : "stays"}
    />
  );
}
