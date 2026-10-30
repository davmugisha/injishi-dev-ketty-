import { PropertyDetail, type RoomTypeSummary } from "@injishi/contracts";
import { apiFetchParsed, type ApiResult } from "@/lib/api";

/**
 * What the marketplace can actually SELL for a property, read from the API.
 *
 * A property is bookable when the API says it has a published listing with an
 * active hospitality room type, and not otherwise: no flag, no borrowed room,
 * and the same answer in every environment. The rate a guest sees is the room's
 * own, because it is the rate the server will charge.
 *
 * Which room is sold is the guest's choice where they made one (the property
 * page's Rooms list and the booking card's Room field), else the cheapest room
 * their party fits: see `roomToSell`.
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
  // Parsed, not cast: the rates read here are the ones the widget quotes.
  const result = await apiFetchParsed(
    PropertyDetail,
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
export function isSellable(room: RoomTypeSummary): boolean {
  return (
    room.domain === "hospitality" &&
    // A bar's or coffee shop's menu item is listed with its price, never booked.
    room.priceBasis !== "per_item" &&
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
  return sellable.find((room) => fitsParty(room, party)) ?? null;
}

/**
 * The room a booking card sells, given the guest's choice.
 *
 * With no choice, or a choice that is not on sale here (a stale link, a room
 * since archived), the cheapest room the party fits. With a choice, THAT room
 * and only that room: one too small for the party is not swapped for one that
 * fits, because the guest asked for it by name. `room` is then null and
 * `chosenTooSmall` says why, so the card can ask them which to change.
 */
export function roomToSell(
  sellable: RoomTypeSummary[],
  chosenId: string | null,
  party: number,
): { room: RoomTypeSummary | null; chosen: RoomTypeSummary | null; chosenTooSmall: boolean } {
  const chosen = sellable.find((room) => room.id === chosenId) ?? null;
  if (!chosen) return { room: roomForParty(sellable, party), chosen: null, chosenTooSmall: false };
  const fits = fitsParty(chosen, party);
  return { room: fits ? chosen : null, chosen, chosenTooSmall: !fits };
}

/** Whether a room sleeps this party. A room with no stated capacity takes any. */
export function fitsParty(room: RoomTypeSummary, party: number): boolean {
  return room.capacity === null || room.capacity >= party;
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
