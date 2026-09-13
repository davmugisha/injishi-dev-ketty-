import { z } from "zod";
import { RoomTypeSummary } from "./booking";
import { PropertyFacility } from "./outlets";
// --- Read: property detail (F-B15) -----------------------------------------
/**
 * Its own file because `facilities` reaches `outlets.ts`, which reaches
 * `ordering.ts`, which imports `booking.ts`: declared there it would be a load
 * order cycle that leaves a schema undefined at require time.
 */
export const PropertyDetail = z.object({
    id: z.string().uuid(),
    /**
     * The property's public address on the marketplace, or null.
     *
     * Null while a property is in the registration pipeline: it has no public
     * page yet, and minting an address for one would publish a business nobody
     * has approved. A consumer that needs to link to the property must handle
     * the null rather than assume one exists.
     */
    slug: z.string().min(1).nullable(),
    name: z.string().min(1),
    description: z.string().nullable(),
    districtName: z.string().nullable(),
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
    locationPrivacy: z.boolean(),
    checkInTime: z.string().nullable(),
    checkOutTime: z.string().nullable(),
    houseRules: z.string().nullable(),
    photos: z.array(z.string()),
    roomTypes: z.array(RoomTypeSummary),
    /**
     * What the property offers, amenities and outlets as ONE deduped list
     * (ADR-050 D-k, AC-16): an amenity with an outlet pointing at it is one
     * entry carrying both faces. Only guest visible, active outlets, and a
     * tenant outlet only while its tenancy is active (AC-18).
     */
    facilities: z.array(PropertyFacility),
});
export type PropertyDetail = z.infer<typeof PropertyDetail>;
/**
 * One published property as a discovery list reads it (booking audit,
 * 2026-09-13): `GET /api/v1/properties`.
 *
 * Explore used to be built only from a catalogue kept in the web app, so a
 * property created in the operator app and published could be booked by a
 * guest holding its link and found by nobody. This is what a result card needs,
 * and nothing a card does not show. Only a property with a public address
 * (`slug`) is listed, because a card that links nowhere is not a result.
 */
export const PropertyCard = z.object({
    id: z.string().uuid(),
    slug: z.string().min(1),
    name: z.string().min(1),
    description: z.string().nullable(),
    districtName: z.string().nullable(),
    /** Up to five, in the order the property set them. */
    photos: z.array(z.string()),
    /** The cheapest priced, sellable room type; null when none is priced. */
    fromNightlyRateRwf: z.number().int().nonnegative().nullable(),
    /** The most guests any active room type sleeps; null when none states it. */
    maxGuests: z.number().int().positive().nullable(),
    roomTypeCount: z.number().int().nonnegative(),
});
export type PropertyCard = z.infer<typeof PropertyCard>;
