import { screens } from "@injishi/data";
import type {
  BookingRequest,
  Reservation,
  ReservationsSummary,
  ReservationView,
} from "@injishi/data/fixtures/frontdesk";
import { ReservationsView } from "@injishi/product-pms/web";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PmsMount } from "@/features/pms/pms-mount";
import { requirePersona } from "@/lib/session";
import { getCollection, requestContext } from "@/server/data";
import { dayNumber, deskPropertyName } from "@/server/sources/frontdesk";

export const metadata: Metadata = { title: screens.Reservations.pageTitle };

/** `?booking=BK-…` opens the list with that booking in the inspector; `?view=requests` opens the requests. */
export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ booking?: string; view?: string }>;
}) {
  const persona = await requirePersona("Reservations");
  const [bookings, views, summaries, requests] = await Promise.all([
    getCollection<Reservation>("frontdesk.reservations"),
    getCollection<ReservationView>("frontdesk.reservationViews"),
    getCollection<ReservationsSummary>("frontdesk.reservationsSummary"),
    getCollection<BookingRequest>("frontdesk.bookingRequests"),
  ]);
  const summary = summaries[0];
  if (!summary) notFound();
  // The day and the property are the desk's own read (the same board the bookings came from).
  const ctx = await requestContext();
  const property = await deskPropertyName(ctx);
  const { booking, view } = await searchParams;
  return (
    <PmsMount>
      <ReservationsView
        persona={persona}
        data={{ bookings, views, summary, requests, today: dayNumber(ctx.today.iso), property }}
        initialBooking={booking ?? null}
        initialView={view === "requests" ? "requests" : "all"}
      />
    </PmsMount>
  );
}
