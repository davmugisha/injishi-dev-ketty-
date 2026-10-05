"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PropertyCard = exports.PropertyDetail = void 0;
const zod_1 = require("zod");
const booking_1 = require("./booking");
const outlets_1 = require("./outlets");
// --- Read: property detail (F-B15) -----------------------------------------
/**
 * Its own file because `facilities` reaches `outlets.ts`, which reaches
 * `ordering.ts`, which imports `booking.ts`: declared there it would be a load
 * order cycle that leaves a schema undefined at require time.
 */
exports.PropertyDetail = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    /**
     * The property's public address on the marketplace, or null.
     *
     * Null while a property is in the registration pipeline: it has no public
     * page yet, and minting an address for one would publish a business nobody
     * has approved. A consumer that needs to link to the property must handle
     * the null rather than assume one exists.
     */
    slug: zod_1.z.string().min(1).nullable(),
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().nullable(),
    districtName: zod_1.z.string().nullable(),
    latitude: zod_1.z.number().nullable(),
    longitude: zod_1.z.number().nullable(),
    locationPrivacy: zod_1.z.boolean(),
    checkInTime: zod_1.z.string().nullable(),
    checkOutTime: zod_1.z.string().nullable(),
    houseRules: zod_1.z.string().nullable(),
    /**
     * One absolute URL per photograph, in the operator's order, the cover first.
     *
     * Each is the API's photo route (`/api/v1/properties/photos/:photoId`), which
     * answers 302 to a fresh signed URL while the property is public and 404 once
     * it is not (ADR-053, owner ruling of 2026-09-13). Never an object key, and
     * never a signed URL itself, so a cached page cannot hold one that expires.
     */
    photos: zod_1.z.array(zod_1.z.string().url()),
    roomTypes: zod_1.z.array(booking_1.RoomTypeSummary),
    /**
     * What the property offers, amenities and outlets as ONE deduped list
     * (ADR-050 D-k, AC-16): an amenity with an outlet pointing at it is one
     * entry carrying both faces. Only guest visible, active outlets, and a
     * tenant outlet only while its tenancy is active (AC-18).
     */
    facilities: zod_1.z.array(outlets_1.PropertyFacility),
});
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
exports.PropertyCard = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    slug: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().nullable(),
    districtName: zod_1.z.string().nullable(),
    /**
     * Up to five, in the order the property set them, the cover first. The same
     * photo route URLs `PropertyDetail.photos` carries, never an object key.
     */
    photos: zod_1.z.array(zod_1.z.string().url()),
    /** The cheapest priced, sellable room type; null when none is priced. */
    fromNightlyRateRwf: zod_1.z.number().int().nonnegative().nullable(),
    /** The most guests any active room type sleeps; null when none states it. */
    maxGuests: zod_1.z.number().int().positive().nullable(),
    roomTypeCount: zod_1.z.number().int().nonnegative(),
    /**
     * The property's public coordinates, for the Explore map. Null when the
     * property has never set them; a card without a point simply has no pin.
     * The exact lat/lng is the same signal the public address already carries.
     */
    latitude: zod_1.z.number().gte(-90).lte(90).nullable(),
    longitude: zod_1.z.number().gte(-180).lte(180).nullable(),
});
//# sourceMappingURL=property-detail.js.map