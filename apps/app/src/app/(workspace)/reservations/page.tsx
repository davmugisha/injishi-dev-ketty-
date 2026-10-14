import { screens } from "@injishi/data";
import type {
  BookingRequest,
  CancellationTier,
  Reservation,
  ReservationRecord,
  ReservationsSummary,
  ReservationView,
} from "@injishi/data/fixtures/frontdesk";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReservationsView } from "@/features/frontdesk/ReservationsView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.Reservations.pageTitle };

/** `?booking=BK-…` opens the list with that booking in the inspector; `?view=requests` opens the requests. */
export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ booking?: string; view?: string }>;
}) {
  const persona = await requirePersona("Reservations");
  const [bookings, views, summaries, requests, tiers, records] = await Promise.all([
    getCollection<Reservation>("frontdesk.reservations"),
    getCollection<ReservationView>("frontdesk.reservationViews"),
    getCollection<ReservationsSummary>("frontdesk.reservationsSummary"),
    getCollection<BookingRequest>("frontdesk.bookingRequests"),
    getCollection<CancellationTier>("frontdesk.cancellationTiers"),
    getCollection<ReservationRecord>("frontdesk.reservationRecords"),
  ]);
  const summary = summaries[0];
  if (!summary) notFound();
  const { booking, view } = await searchParams;
  return (
    <ReservationsView
      persona={persona}
      data={{ bookings, views, summary, requests, tiers, recordIds: records.map((r) => r.id) }}
      initialBooking={booking ?? null}
      initialView={view === "requests" ? "requests" : "all"}
    />
  );
}
