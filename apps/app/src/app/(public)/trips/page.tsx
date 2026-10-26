import { screens } from "@injishi/data";
import type {
  GuestConsent,
  GuestProfile,
  GuestReviewItem,
  Option,
  PastTrip,
  ReviewToWrite,
  SavedCollection,
  UpcomingTrip,
} from "@injishi/data/fixtures/market";
import type { Metadata } from "next";
import { marketVisitor } from "@/features/market/format";
import { GuestAccountView } from "@/features/market/GuestAccountView";
import { requireScreen } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.GuestAccount.pageTitle };

/** Guest web account: trips, saved places, reviews, and privacy. */
export default async function GuestAccountPage() {
  const persona = await requireScreen("GuestAccount");
  const [profiles, upcoming, past, collections, toWrite, reviews, consents, languages] = await Promise.all([
    getCollection<GuestProfile>("market.guestProfiles"),
    getCollection<UpcomingTrip>("market.upcomingTrips"),
    getCollection<PastTrip>("market.pastTrips"),
    getCollection<SavedCollection>("market.savedCollections"),
    getCollection<ReviewToWrite>("market.reviewsToWrite"),
    getCollection<GuestReviewItem>("market.guestReviews"),
    getCollection<GuestConsent>("market.consents"),
    getCollection<Option>("market.languages"),
  ]);
  const profile = profiles[0];
  if (!profile) return null;
  return (
    <GuestAccountView
      visitor={marketVisitor(persona, profile)}
      profile={profile}
      upcoming={upcoming}
      past={past}
      collections={collections}
      toWrite={toWrite}
      reviews={reviews}
      consents={consents}
      languages={languages}
    />
  );
}
