import { screens } from "@injishi/data";
import type {
  ArrivalGuideEntry,
  CancellationTier,
  GuestBooking,
  GuestMessage,
  GuestTrip,
  HotelDepartment,
} from "@injishi/data/fixtures/guest";
import { GuestTripView } from "@injishi/product-pms/web";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PmsMount } from "@/features/pms/pms-mount";
import { requirePersona } from "@/lib/session";
import { getCollection, getDocument } from "@/server/data";

export const metadata: Metadata = { title: screens.GuestTrip.pageTitle };

export default async function GuestTripPage({ searchParams }: { searchParams: Promise<{ claim?: string }> }) {
  const persona = await requirePersona("GuestTrip");
  const [trips, guide, tiers, departments, messages] = await Promise.all([
    getCollection<GuestTrip>("guest.trips"),
    getCollection<ArrivalGuideEntry>("guest.arrivalGuide"),
    getCollection<CancellationTier>("guest.cancellationTiers"),
    getCollection<HotelDepartment>("guest.departments"),
    getCollection<GuestMessage>("guest.messages"),
  ]);
  const upcoming = trips.find((t) => t.status === "upcoming");
  const booking = upcoming ? await getDocument<GuestBooking>("guest.bookings", upcoming.id) : undefined;
  if (!booking || !departments.length) notFound();
  const { claim } = await searchParams;
  return (
    <PmsMount>
      <GuestTripView
        persona={persona}
        data={{ trips, booking, guide, tiers, departments, messages: messages.filter((m) => m.thread === "booking") }}
        claim={claim === "unclaimed" ? "unclaimed" : "linked"}
      />
    </PmsMount>
  );
}
