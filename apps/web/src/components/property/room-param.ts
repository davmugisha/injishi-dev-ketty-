/**
 * The room a guest picked on a property page, kept in the page's address as
 * `?roomType=<room type id>`: the same name checkout reads, and not `room`,
 * which Explore already uses for its room-amenity filter.
 *
 * In the address rather than in component state because two parts of the page
 * set it — the "Choose" button on each row of the Rooms list and the booking
 * card's own Room field — and the card has to price whichever was pressed
 * last. It also survives a reload and a shared link, the same as the dates and
 * the party already do.
 *
 * Absent means "no choice": the card sells the cheapest room the party fits.
 */
export const ROOM_PARAM = "roomType";

/** The anchor the booking card sits under. */
export const BOOKING_ANCHOR = "booking";
