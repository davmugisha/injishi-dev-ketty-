import { screens } from "@injishi/data";
import type {
  ListingAmenity,
  ListingCheck,
  ListingDraft,
  ListingHistoryEntry,
  ListingModeOption,
  ListingPhoto,
  ListingPolicy,
} from "@injishi/data/fixtures/commercial";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingView } from "@/features/commercial/ListingView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.Listing.pageTitle };

export default async function ListingPage() {
  const persona = await requirePersona("Listing");
  const [drafts, photos, modes, amenities, policies, checks, history] = await Promise.all([
    getCollection<ListingDraft>("commercial.listingDrafts"),
    getCollection<ListingPhoto>("commercial.listingPhotos"),
    getCollection<ListingModeOption>("commercial.listingModes"),
    getCollection<ListingAmenity>("commercial.listingAmenities"),
    getCollection<ListingPolicy>("commercial.listingPolicies"),
    getCollection<ListingCheck>("commercial.listingChecks"),
    getCollection<ListingHistoryEntry>("commercial.listingHistory"),
  ]);
  const draft = drafts[0];
  if (!draft) notFound();
  return <ListingView persona={persona} data={{ draft, photos, modes, amenities, policies, checks, history }} />;
}
