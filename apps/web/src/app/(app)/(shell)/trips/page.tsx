import { TripsScreen } from "@/components/app/trips-screen";

export const metadata = { title: "Trips" };

/**
 * The stays this person booked (ADR-018, move 4, AC-10).
 *
 * It lives HERE, in the marketplace they booked from, and not in a tool built
 * for hotel staff (D-b). A guest who operates nothing should never be sent to
 * the operator app at all.
 *
 * **It reads real bookings now.** This page was a hardcoded empty state for as
 * long as no endpoint served a guest their own stays, and the copy had to hedge
 * — "we're still connecting this page" — because a fixed empty state cannot tell
 * a guest with no bookings apart from a guest whose booking nothing could fetch.
 * `GET /api/v1/me/trips` answers that now, so the work is in `<TripsScreen/>`:
 * loading, empty, failed and signed-out, each saying only what is true.
 */
export default function Page() {
  return <TripsScreen />;
}
