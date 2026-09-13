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

/** The rooms a property can sell, and the room list behind them. */
export interface PropertyRooms {
  propertyId: string;
  /** Every active room type, cheapest first, as the API ordered them. */
  roomTypes: RoomTypeSummary[];
  /**
   * Every room type a guest can actually buy, cheapest first.
   *
   * PRICED, hospitality, with a booking mode and at least one unit. Empty when
   * the property has published rooms but none of them can be sold
   * (residence-only inventory, or no rate set), which is a different fact from
   * having no listing and reads the same to a guest.
   */
  sellable: RoomTypeSummary[];
}

/**
 * Read a property's real inventory by its public slug.
 *
 * `refused` with a 404 means the API holds no public property at this slug:
 * never published, unpublished, or its business suspended. That is NOT a
 * failure, and the caller says the stay cannot be booked. `failed` is the
 * opposite case — we could not ask — and must never be worded as the first,
 * because an outage would then tell every guest that every property is closed.
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
      sellable: roomTypes.filter(isSellable),
    },
  };
}

/**
 * Whether a guest can buy this room type at all.
 *
 * `domain === "hospitality"` is load bearing: a residence unit is never
 * bookable as a stay (FL06 §5C), and the API refuses one at `POST /bookings`.
 * Offering it here would put a button on the page whose only outcome is a
 * refusal the guest cannot act on.
 *
 * `filter` keeps the API's order, which is cheapest first — one ordering, and
 * it is the server's.
 */
function isSellable(room: RoomTypeSummary): boolean {
  return (
    room.domain === "hospitality" &&
    room.nightlyRateRwf !== null &&
    room.bookingMode !== null &&
    room.roomCount > 0
  );
}

/**
 * The room a "Review this stay" press sells: the cheapest one the party fits.
 *
 * It used to be the cheapest room, whatever the party. A family of four who
 * arrived from search at a hotel whose cheapest room sleeps two was priced for
 * that room, carried through checkout, and refused at the last screen with
 * "That room type sleeps at most 2" — while the Family Room beside it was on
 * sale. A room with no stated capacity takes any party; the API's own capacity
 * check is the backstop.
 *
 * Null when nothing sellable fits, which the caller words as a party too large
 * rather than as a property that cannot be booked.
 */
export function roomForParty(
  sellable: RoomTypeSummary[],
  party: number,
): RoomTypeSummary | null {
  return sellable.find((room) => room.capacity === null || room.capacity >= party) ?? null;
}

/**
 * The most guests any sellable room here takes, or null when one takes any.
 *
 * This is the guest picker's ceiling once the rooms are known. A catalogue
 * record's own `maxGuests` is an editorial figure and can disagree with the
 * inventory in either direction; the rooms are what checkout will enforce.
 */
export function largestParty(sellable: RoomTypeSummary[]): number | null {
  if (sellable.some((room) => room.capacity === null)) return null;
  return sellable.reduce((most, room) => Math.max(most, room.capacity ?? 0), 0) || null;
}
