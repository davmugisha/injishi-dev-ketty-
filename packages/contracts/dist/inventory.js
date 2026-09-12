"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PUBLISH_BLOCKER_LABEL = exports.PublishBlocker = exports.OperatorPropertyList = exports.OperatorRatePlanList = exports.OperatorRatePlan = exports.OperatorProperty = exports.OperatorPropertySummary = exports.PropertyAddress = exports.PropertyQuery = exports.UpdatePropertyRequest = exports.CreatePropertyRequest = exports.WorkspaceScoped = exports.ListingStatus = void 0;
exports.stepForPublishBlocker = stepForPublishBlocker;
const zod_1 = require("zod");
const booking_1 = require("./booking");
const primitives_1 = require("./primitives");
/**
 * The operator write path for inventory (ADR-009).
 *
 * The public read shapes live in `booking.ts` (`PropertyDetail`,
 * `RoomTypeSummary`) and answer a guest's question: what can I book? These
 * answer an operator's: what do I have, and is it live? Two different questions,
 * two different shapes, so a draft property never accidentally serialises
 * through a public contract.
 *
 * Feature 1 of the shared spine covers properties only. Room types, rates and
 * publishing extend this file when features 2 and 3 land.
 */
/** A listing is a draft until someone publishes it. */
exports.ListingStatus = zod_1.z.enum(["draft", "published"]);
// ---------------------------------------------------------------------------
// Naming the workspace
// ---------------------------------------------------------------------------
/**
 * Every operator route names the workspace it acts in.
 *
 * `WorkspaceGuard` reads this from the body on a write and the query on a read,
 * and refuses a request that names none. It proves the caller HOLDS that
 * workspace and nothing more; whether the target row BELONGS to it is a separate
 * check the service makes (ADR-009 AC-14).
 */
exports.WorkspaceScoped = zod_1.z.object({ workspaceId: primitives_1.Uuid });
// ---------------------------------------------------------------------------
// Writing a property
// ---------------------------------------------------------------------------
/**
 * The address a property carries.
 *
 * Only the SECTOR is sent. A sector resolves upward to its district and its
 * province, so the picker collects all three to drive its cascade and the wire
 * carries the one id that is worth storing. `district_id` is derived server side
 * from the sector, on create and on every edit that changes it, so the two can
 * never disagree (D24, and ADR-009 Value sourcing).
 */
const propertyFields = {
    name: zod_1.z
        .string()
        .trim()
        .min(2, "Give the property a name guests will recognise.")
        .max(200, "That name is too long for our records."),
    sectorId: zod_1.z.number().int().positive("Choose a sector."),
    /** The street line, e.g. "KG 11 Ave". Optional: not every plot has one. */
    street: zod_1.z.string().trim().max(200).optional(),
    description: zod_1.z.string().trim().max(4000).optional(),
    /** `HH:MM` or `HH:MM:SS`; the column is a bare `time`. */
    checkInTime: zod_1.z
        .string()
        .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use a time like 14:00.")
        .optional(),
    checkOutTime: zod_1.z
        .string()
        .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use a time like 11:00.")
        .optional(),
    houseRules: zod_1.z.string().trim().max(4000).optional(),
    /**
     * Hide the exact pin from the public until a stay is confirmed. Already
     * respected by the public read path, so this is a real toggle, not a stub.
     */
    locationPrivacy: zod_1.z.boolean().optional(),
};
exports.CreatePropertyRequest = exports.WorkspaceScoped.extend(propertyFields);
/**
 * Editing replaces only the fields sent.
 *
 * A partial rather than a full replace because the operator screens edit one
 * card at a time, and a full replace would make an untouched section silently
 * clear itself.
 */
exports.UpdatePropertyRequest = exports.WorkspaceScoped.extend(zod_1.z.object(propertyFields).partial().shape);
/** Reading is the same question, asked with a query string. */
exports.PropertyQuery = exports.WorkspaceScoped;
// ---------------------------------------------------------------------------
// Reading a property back
// ---------------------------------------------------------------------------
/**
 * The resolved address, sent with names as well as ids.
 *
 * The ids let the picker reopen on the right selection; the names let a list
 * render without three more requests. Province and district are JOINED from the
 * sector rather than stored, which is the whole reason only the sector is
 * written.
 */
exports.PropertyAddress = zod_1.z.object({
    provinceId: zod_1.z.number().int().nullable(),
    provinceName: zod_1.z.string().nullable(),
    districtId: zod_1.z.number().int().nullable(),
    districtName: zod_1.z.string().nullable(),
    sectorId: zod_1.z.number().int().nullable(),
    sectorName: zod_1.z.string().nullable(),
    street: zod_1.z.string().nullable(),
});
/** One row in the operator's property list. */
exports.OperatorPropertySummary = zod_1.z.object({
    id: primitives_1.Uuid,
    name: zod_1.z.string(),
    address: exports.PropertyAddress,
    listingStatus: exports.ListingStatus,
    publishedAt: zod_1.z.string().nullable(),
    roomTypeCount: zod_1.z.number().int(),
    /** Sellable rooms across every active room type. The inventory truth. */
    sellableRoomCount: zod_1.z.number().int(),
});
/**
 * One property in full, as its owner sees it.
 *
 * `photos` is always empty today and says so: object storage is unbuilt
 * (F-S09), so the field exists to be honest about the gap rather than to be
 * filled (ADR-009 AC-13).
 */
exports.OperatorProperty = exports.OperatorPropertySummary.extend({
    description: zod_1.z.string().nullable(),
    checkInTime: zod_1.z.string().nullable(),
    checkOutTime: zod_1.z.string().nullable(),
    houseRules: zod_1.z.string().nullable(),
    locationPrivacy: zod_1.z.boolean(),
    timezone: zod_1.z.string(),
    photos: zod_1.z.array(zod_1.z.string()),
    /**
     * Empty until feature 2 builds the room type write path. An empty array is a
     * real answer here: a property with no room types is exactly what a newly
     * created one is, and it is why publishing refuses.
     */
    roomTypes: zod_1.z.array(zod_1.z.object({
        id: primitives_1.Uuid,
        name: zod_1.z.string(),
        domain: primitives_1.Domain,
        status: zod_1.z.enum(["active", "archived"]),
        basePriceRwf: zod_1.z.number().int().nullable(),
        sellableRoomCount: zod_1.z.number().int(),
    })),
});
/**
 * A rate plan, as its owner sees it (ADR-035, wave 2 follow-up).
 *
 * **`rate_plans` is one of the richest tables in the schema and nothing read
 * it.** No contract, no repository, no route — so the Rate plans lens was a
 * placeholder and the Room types screen had to say out loud that it would not
 * guess at them.
 *
 * THE DISTINCTION THIS SHAPE CARRIES is the one the screen exists to teach: a
 * room type is WHAT THE GUEST GETS, a rate plan is THE TERMS IT SELLS ON. The
 * same rooms sell several ways at once — flexible, non refundable, bed and
 * breakfast — which is why a plan names its room type rather than the other
 * way round.
 *
 * `parentRatePlanId` and the derivation are on the wire because a DERIVED plan
 * is the whole point of the feature (F-L03): non refundable is flexible minus
 * ten percent, and it MOVES when the parent moves. A screen showing only the
 * computed price would hide the relationship that keeps them in step.
 *
 * `baseOccupancy` is COMMERCIAL and deliberately not the room type's physical
 * `maxGuests`: it is how many people the base price covers, and the gap between
 * the two is what extra person pricing bridges (F-L05).
 */
exports.OperatorRatePlan = zod_1.z.object({
    id: primitives_1.Uuid,
    roomTypeId: primitives_1.Uuid,
    roomTypeName: zod_1.z.string().nullable(),
    name: zod_1.z.string(),
    status: zod_1.z.enum(["active", "archived"]),
    /** Exactly one per room type, which the database enforces. */
    isDefault: zod_1.z.boolean(),
    basePriceRwf: zod_1.z.number().int().nullable(),
    cautionRwf: zod_1.z.number().int().nullable(),
    baseOccupancy: zod_1.z.number().int().nullable(),
    singleOccupancyPriceRwf: zod_1.z.number().int().nullable(),
    cancellationTier: booking_1.CancellationTier.nullable(),
    nonRefundable: zod_1.z.boolean(),
    bookingMode: booking_1.BookingMode.nullable(),
    minStay: zod_1.z.number().int().nullable(),
    maxStay: zod_1.z.number().int().nullable(),
    /** Set when this plan FOLLOWS another one (F-L03). */
    parentRatePlanId: primitives_1.Uuid.nullable(),
    parentRatePlanName: zod_1.z.string().nullable(),
    derivationKind: zod_1.z.enum(["percentage", "fixed_amount"]).nullable(),
    derivationValue: zod_1.z.number().nullable(),
});
exports.OperatorRatePlanList = zod_1.z.object({
    ratePlans: zod_1.z.array(exports.OperatorRatePlan),
});
exports.OperatorPropertyList = zod_1.z.object({
    properties: zod_1.z.array(exports.OperatorPropertySummary),
});
// ---------------------------------------------------------------------------
// Why publishing was refused
// ---------------------------------------------------------------------------
/**
 * A code, not a sentence, for the reason a rejection reason is a code: the
 * operator screen has to send someone back to the part that is wrong, and it
 * cannot read prose to work out which part that is (ADR-009 AC-7).
 *
 * Defined now, with the property level reasons already usable, so feature 3 adds
 * cases to an enum that exists rather than inventing one late.
 */
exports.PublishBlocker = zod_1.z.enum([
    "org_not_active",
    "missing_name",
    "missing_sector",
    "no_active_room_type",
    "no_priced_room_type",
    "no_sellable_room",
]);
exports.PUBLISH_BLOCKER_LABEL = {
    org_not_active: "This business is not approved yet.",
    missing_name: "Give the property a name.",
    missing_sector: "Choose the sector the property is in.",
    no_active_room_type: "Add at least one room type.",
    no_priced_room_type: "At least one room type needs a price.",
    no_sellable_room: "At least one room has to be available to sell.",
};
/** Which screen a blocker sends the operator back to. */
function stepForPublishBlocker(blocker) {
    switch (blocker) {
        case "org_not_active":
            return "registration";
        case "missing_name":
        case "missing_sector":
            return "property";
        case "no_active_room_type":
        case "no_priced_room_type":
        case "no_sellable_room":
            return "room_types";
    }
}
//# sourceMappingURL=inventory.js.map