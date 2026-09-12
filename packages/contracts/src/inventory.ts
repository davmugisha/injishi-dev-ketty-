import { z } from "zod";
import { BookingMode, CancellationTier } from "./booking";
import { Domain, Uuid } from "./primitives";
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
export const ListingStatus = z.enum(["draft", "published"]);
export type ListingStatus = z.infer<typeof ListingStatus>;
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
export const WorkspaceScoped = z.object({ workspaceId: Uuid });
export type WorkspaceScoped = z.infer<typeof WorkspaceScoped>;
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
    name: z
        .string()
        .trim()
        .min(2, "Give the property a name guests will recognise.")
        .max(200, "That name is too long for our records."),
    sectorId: z.number().int().positive("Choose a sector."),
    /** The street line, e.g. "KG 11 Ave". Optional: not every plot has one. */
    street: z.string().trim().max(200).optional(),
    description: z.string().trim().max(4000).optional(),
    /** `HH:MM` or `HH:MM:SS`; the column is a bare `time`. */
    checkInTime: z
        .string()
        .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use a time like 14:00.")
        .optional(),
    checkOutTime: z
        .string()
        .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use a time like 11:00.")
        .optional(),
    houseRules: z.string().trim().max(4000).optional(),
    /**
     * Hide the exact pin from the public until a stay is confirmed. Already
     * respected by the public read path, so this is a real toggle, not a stub.
     */
    locationPrivacy: z.boolean().optional(),
};
export const CreatePropertyRequest = WorkspaceScoped.extend(propertyFields);
export type CreatePropertyRequest = z.infer<typeof CreatePropertyRequest>;
/**
 * Editing replaces only the fields sent.
 *
 * A partial rather than a full replace because the operator screens edit one
 * card at a time, and a full replace would make an untouched section silently
 * clear itself.
 */
export const UpdatePropertyRequest = WorkspaceScoped.extend(z.object(propertyFields).partial().shape);
export type UpdatePropertyRequest = z.infer<typeof UpdatePropertyRequest>;
/** Reading is the same question, asked with a query string. */
export const PropertyQuery = WorkspaceScoped;
export type PropertyQuery = z.infer<typeof PropertyQuery>;
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
export const PropertyAddress = z.object({
    provinceId: z.number().int().nullable(),
    provinceName: z.string().nullable(),
    districtId: z.number().int().nullable(),
    districtName: z.string().nullable(),
    sectorId: z.number().int().nullable(),
    sectorName: z.string().nullable(),
    street: z.string().nullable(),
});
export type PropertyAddress = z.infer<typeof PropertyAddress>;
/** One row in the operator's property list. */
export const OperatorPropertySummary = z.object({
    id: Uuid,
    name: z.string(),
    address: PropertyAddress,
    listingStatus: ListingStatus,
    publishedAt: z.string().nullable(),
    roomTypeCount: z.number().int(),
    /** Sellable rooms across every active room type. The inventory truth. */
    sellableRoomCount: z.number().int(),
});
export type OperatorPropertySummary = z.infer<typeof OperatorPropertySummary>;
/**
 * One property in full, as its owner sees it.
 *
 * `photos` is always empty today and says so: object storage is unbuilt
 * (F-S09), so the field exists to be honest about the gap rather than to be
 * filled (ADR-009 AC-13).
 */
export const OperatorProperty = OperatorPropertySummary.extend({
    description: z.string().nullable(),
    checkInTime: z.string().nullable(),
    checkOutTime: z.string().nullable(),
    houseRules: z.string().nullable(),
    locationPrivacy: z.boolean(),
    timezone: z.string(),
    photos: z.array(z.string()),
    /**
     * Empty until feature 2 builds the room type write path. An empty array is a
     * real answer here: a property with no room types is exactly what a newly
     * created one is, and it is why publishing refuses.
     */
    roomTypes: z.array(z.object({
        id: Uuid,
        name: z.string(),
        domain: Domain,
        status: z.enum(["active", "archived"]),
        basePriceRwf: z.number().int().nullable(),
        sellableRoomCount: z.number().int(),
    })),
});
export type OperatorProperty = z.infer<typeof OperatorProperty>;
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
export const OperatorRatePlan = z.object({
    id: Uuid,
    roomTypeId: Uuid,
    roomTypeName: z.string().nullable(),
    name: z.string(),
    status: z.enum(["active", "archived"]),
    /** Exactly one per room type, which the database enforces. */
    isDefault: z.boolean(),
    basePriceRwf: z.number().int().nullable(),
    cautionRwf: z.number().int().nullable(),
    baseOccupancy: z.number().int().nullable(),
    singleOccupancyPriceRwf: z.number().int().nullable(),
    cancellationTier: CancellationTier.nullable(),
    nonRefundable: z.boolean(),
    bookingMode: BookingMode.nullable(),
    minStay: z.number().int().nullable(),
    maxStay: z.number().int().nullable(),
    /** Set when this plan FOLLOWS another one (F-L03). */
    parentRatePlanId: Uuid.nullable(),
    parentRatePlanName: z.string().nullable(),
    derivationKind: z.enum(["percentage", "fixed_amount"]).nullable(),
    derivationValue: z.number().nullable(),
});
export type OperatorRatePlan = z.infer<typeof OperatorRatePlan>;
export const OperatorRatePlanList = z.object({
    ratePlans: z.array(OperatorRatePlan),
});
export type OperatorRatePlanList = z.infer<typeof OperatorRatePlanList>;
export const OperatorPropertyList = z.object({
    properties: z.array(OperatorPropertySummary),
});
export type OperatorPropertyList = z.infer<typeof OperatorPropertyList>;
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
export const PublishBlocker = z.enum([
    "org_not_active",
    "missing_name",
    "missing_sector",
    "no_active_room_type",
    "no_priced_room_type",
    "no_sellable_room",
]);
export type PublishBlocker = z.infer<typeof PublishBlocker>;
export const PUBLISH_BLOCKER_LABEL: Readonly<Record<PublishBlocker, string>> = {
    org_not_active: "This business is not approved yet.",
    missing_name: "Give the property a name.",
    missing_sector: "Choose the sector the property is in.",
    no_active_room_type: "Add at least one room type.",
    no_priced_room_type: "At least one room type needs a price.",
    no_sellable_room: "At least one room has to be available to sell.",
};
/** Which screen a blocker sends the operator back to. */
export function stepForPublishBlocker(blocker: PublishBlocker): "registration" | "property" | "room_types" {
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