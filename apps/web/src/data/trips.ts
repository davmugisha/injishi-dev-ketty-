import { MyTrips, type GuestTrip } from "@injishi/contracts";
import { apiFetch, type ApiResult } from "@/lib/api";

/**
 * The client for `GET /api/v1/me/trips` — the guest's own stays.
 *
 * This is the read `/trips` never had. The screen shipped a hardcoded empty
 * state, so a guest who had just paid was shown "No trips yet" with their money
 * in escrow, and the copy had to be reworded to admit the page could not list
 * anything. The endpoint exists now, so the empty state can go back to meaning
 * what it says.
 *
 * Through `apiFetch`, like every other call here: one definition of where the
 * API is, `credentials: "include"` so the session cookie crosses from :3000 to
 * :8000, and a ceiling so the screen cannot wait for ever.
 *
 * The answer is validated against the contract's own schema. A response that
 * does not match is reported as `failed` rather than rendered: half a trip card
 * with an undefined price is worse than an honest "we couldn't load this".
 */
export async function fetchMyTrips(): Promise<ApiResult<GuestTrip[]>> {
  const result = await apiFetch<unknown>("/api/v1/me/trips");
  if (result.status !== "ok") return result;

  const parsed = MyTrips.safeParse(result.data);
  if (!parsed.success) return { status: "failed" };

  return { status: "ok", data: parsed.data.trips };
}

/**
 * The three groups a person actually thinks in, in the order they care about.
 *
 * `in_progress` sits with `upcoming` under one heading rather than getting its
 * own: a stay you are in is the most relevant thing on the page, and a section
 * that holds exactly one card for three days of the year is a heading that reads
 * as clutter the rest of the time. The card says which it is.
 */
type TripGroup = "current" | "past" | "cancelled";

export function groupOf(trip: GuestTrip): TripGroup {
  if (trip.stage === "cancelled") return "cancelled";
  if (trip.stage === "past") return "past";
  return "current";
}

/**
 * Group, keeping the server's order inside each group.
 *
 * The API sorts newest-booked first, which is right for "what did I just do".
 * Upcoming stays are re-sorted by CHECK-IN here, because once a person has more
 * than one, the question changes from "what did I book" to "where am I going
 * next" — and that is a client concern about presentation, not a second opinion
 * about the data.
 */
export function groupTrips(trips: readonly GuestTrip[]): Record<TripGroup, GuestTrip[]> {
  const groups: Record<TripGroup, GuestTrip[]> = { current: [], past: [], cancelled: [] };
  for (const trip of trips) groups[groupOf(trip)].push(trip);
  groups.current.sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  return groups;
}
