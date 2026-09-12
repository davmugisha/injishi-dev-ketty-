import type { PropertyDetail, RoomTypeSummary } from "@injishi/contracts";
import { apiFetch, type ApiResult } from "@/lib/api";

/**
 * What the marketplace can actually SELL for a property, read from the API.
 *
 * ## Why this exists
 *
 * `data/properties.ts` is a curated directory of real, operating Rwandan
 * businesses: their addresses, their photographs, their published rack rates,
 * their sources. It is editorial content and it is honest about that. What it
 * is NOT, and was being used as, is a statement that any of them has inventory
 * on this platform.
 *
 * The gap was papered over by `data/demo-listing.ts`, which lent ONE seeded
 * room — Umurage Guesthouse's cheapest — to every property in the catalogue
 * whenever a build flag was set. Its own header said what that meant: opening
 * checkout from the Kigali Marriott priced and reserved a room in Umurage. With
 * the flag off, which is what `.env.production` sets, no property in the
 * catalogue was bookable at all.
 *
 * This replaces both halves of that. A property is bookable when the API says
 * it has a published listing with an active hospitality room type, and not
 * otherwise — no flag, no borrowing, and the same answer in every environment.
 *
 * ## The rate a guest sees
 *
 * When there is a real room, its rate is the one the widget quotes, because it
 * is the rate the server will charge. The catalogue's `nightlyRateRwf` is then
 * a published rack rate the platform is not selling at, and showing it beside a
 * different total is how a quote comes to disagree with a charge.
 */

/** The cheapest bookable room on a property, and the room list behind it. */
export interface PropertyRooms {
  propertyId: string;
  /** Every active room type, cheapest first, as the API ordered them. */
  roomTypes: RoomTypeSummary[];
  /**
   * The room a "Review this stay" press would sell.
   *
   * The cheapest PRICED, hospitality room type — the same "from" price a
   * directory quotes. Null when the property has published rooms but none of
   * them can be sold (residence-only inventory, or no rate set), which is a
   * different fact from having no listing and reads the same to a guest.
   */
  bookable: RoomTypeSummary | null;
}

/**
 * Read a property's real inventory by its public slug.
 *
 * `refused` with a 404 is the ordinary answer for most of the catalogue today
 * and is NOT an error state: it means this business has not published rooms.
 * The caller says "not open for online booking yet" rather than showing a
 * failure, because nothing has failed.
 */
export async function fetchPropertyRooms(
  slug: string,
): Promise<ApiResult<PropertyRooms>> {
  const result = await apiFetch<PropertyDetail>(
    `/api/v1/properties/slug/${encodeURIComponent(slug)}`,
  );
  if (result.status !== "ok") return result;

  const roomTypes = result.data.roomTypes;

  return {
    status: "ok",
    data: {
      propertyId: result.data.id,
      roomTypes,
      bookable: pickBookable(roomTypes),
    },
  };
}

/**
 * The room a guest is offered first.
 *
 * `domain === "hospitality"` is load bearing: a residence unit is never
 * bookable as a stay (FL06 §5C), and the API refuses one at `POST /bookings`.
 * Offering it here would put a button on the page whose only outcome is a
 * refusal the guest cannot act on.
 *
 * The API already returns room types cheapest first, so this takes the first
 * that qualifies rather than sorting again — one ordering, and it is the
 * server's.
 */
function pickBookable(roomTypes: RoomTypeSummary[]): RoomTypeSummary | null {
  return (
    roomTypes.find(
      (room) =>
        room.domain === "hospitality" &&
        room.nightlyRateRwf !== null &&
        room.bookingMode !== null &&
        room.roomCount > 0,
    ) ?? null
  );
}
