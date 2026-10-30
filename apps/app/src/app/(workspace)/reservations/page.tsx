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
import { StayBookingsView } from "@/features/pms/stays/StayBookingsView";
import { requirePersona } from "@/lib/session";
import { getCollection, requestContext } from "@/server/data";
import { dayNumber, deskPropertyName } from "@/server/sources/frontdesk";
import { can, staysScope, staysSummary } from "@/server/stays/client";
import { bookingRows, deskRooms, readDesk } from "@/server/stays/desk";

export const metadata: Metadata = { title: screens.Reservations.pageTitle };

/** `?booking=BK-…` opens the list with that booking in the inspector; `?view=requests` opens the requests. */
export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ booking?: string; view?: string }>;
}) {
  const persona = await requirePersona("Reservations");
  // A real stay business gets one table of its bookings, all live; `?booking=` opens one.
  if (await staysSummary()) {
    const [board, scope, { booking }] = await Promise.all([readDesk(), staysScope(), searchParams]);
    return (
      <StayBookingsView
        rows={bookingRows(board)}
        rooms={deskRooms(board)}
        today={board.today}
        openRef={booking ?? null}
        can={{
          approve: scope ? can(scope, "reservation.approve") : false,
          checkIn: scope ? can(scope, "stay.checkin") : false,
          assign: scope ? can(scope, "reservation.assign") : false,
        }}
      />
    );
  }
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
