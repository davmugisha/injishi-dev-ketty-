"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExtendFoundItemRetentionRequest = exports.ProposeFoundItemDisposalRequest = exports.ReleaseFoundItemRequest = exports.OpenFoundItemClaimRequest = exports.LogFoundItemRequest = exports.FoundItemList = exports.FoundItemPerson = exports.FoundItem = exports.FoundItemEvent = exports.FoundItemEventKind = exports.FoundItemReleaseMethod = exports.FoundItemCategory = exports.FoundItemStatus = void 0;
const zod_1 = require("zod");
const primitives_1 = require("./primitives");
/**
 * The lost and found register (`/api/v1/ops/found-items`): what was found where, who holds it, the
 * chain of custody, claims, release to the owner and disposal after retention.
 *
 * Every step is a custody event, appended and never edited, because the register is what the hotel
 * shows when a guest says "you lost my ring". Release needs the claimant's description matched and
 * their identity checked; disposal is final, so the person approving it can never be the person who
 * proposed it.
 */
exports.FoundItemStatus = zod_1.z.enum(["stored", "claimed", "returned", "disposal_pending", "disposed"]);
exports.FoundItemCategory = zod_1.z.enum([
    "electronics",
    "jewellery",
    "clothing",
    "accessories",
    "documents",
    "cash",
    "other",
]);
exports.FoundItemReleaseMethod = zod_1.z.enum(["in_person", "authorised_person", "courier"]);
exports.FoundItemEventKind = zod_1.z.enum([
    "found",
    "handed_over",
    "stored",
    "logged",
    "claim_opened",
    "verified",
    "returned",
    "disposal_proposed",
    "disposal_approved",
    "retention_extended",
    "note",
]);
exports.FoundItemEvent = zod_1.z.object({
    id: primitives_1.Uuid,
    kind: exports.FoundItemEventKind,
    summary: zod_1.z.string(),
    actorName: zod_1.z.string().nullable(),
    detail: zod_1.z.string().nullable(),
    occurredAt: zod_1.z.string(),
});
exports.FoundItem = zod_1.z.object({
    id: primitives_1.Uuid,
    /** "LF-26-041": printed on the tag and the bag. Unique per business. */
    reference: zod_1.z.string(),
    propertyId: primitives_1.Uuid,
    description: zod_1.z.string(),
    category: exports.FoundItemCategory,
    valuable: zod_1.z.boolean(),
    /** Where, as staff say it: "Room 204", "Lake Bar". */
    foundLocation: zod_1.z.string(),
    /** The exact spot: "bedside drawer". */
    foundSpot: zod_1.z.string().nullable(),
    roomId: primitives_1.Uuid.nullable(),
    foundAt: zod_1.z.string(),
    foundByUserId: primitives_1.Uuid.nullable(),
    foundByName: zod_1.z.string(),
    custodianUserId: primitives_1.Uuid.nullable(),
    custodianName: zod_1.z.string().nullable(),
    storageLocation: zod_1.z.string().nullable(),
    status: exports.FoundItemStatus,
    retentionUntil: zod_1.z.string(),
    retentionNote: zod_1.z.string().nullable(),
    claim: zod_1.z
        .object({
        claimantName: zod_1.z.string(),
        bookingReference: zod_1.z.string().nullable(),
        statement: zod_1.z.string(),
        /** The claimant's booking covers the room and the day the item was found. */
        matched: zod_1.z.boolean(),
        matchNote: zod_1.z.string(),
        openedAt: zod_1.z.string(),
        openedByName: zod_1.z.string().nullable(),
    })
        .nullable(),
    release: zod_1.z
        .object({ method: exports.FoundItemReleaseMethod, releasedAt: zod_1.z.string(), releasedByName: zod_1.z.string().nullable() })
        .nullable(),
    disposal: zod_1.z
        .object({
        note: zod_1.z.string(),
        rule: zod_1.z.string(),
        proposedByName: zod_1.z.string().nullable(),
        proposedAt: zod_1.z.string(),
        approvedByName: zod_1.z.string().nullable(),
        approvedAt: zod_1.z.string().nullable(),
    })
        .nullable(),
    closedNote: zod_1.z.string().nullable(),
    /** Oldest first. */
    events: zod_1.z.array(exports.FoundItemEvent),
});
exports.FoundItemPerson = zod_1.z.object({ userId: primitives_1.Uuid, name: zod_1.z.string() });
exports.FoundItemList = zod_1.z.object({
    items: zod_1.z.array(exports.FoundItem),
    /** Staff who appear on the register (finders, custodians): who an intake can name. */
    people: zod_1.z.array(exports.FoundItemPerson),
    /** The retention rule every item is held under, in words. */
    retentionRule: zod_1.z.string(),
});
exports.LogFoundItemRequest = zod_1.z.object({
    propertyId: primitives_1.Uuid.optional(),
    description: zod_1.z.string().trim().min(1).max(300),
    category: exports.FoundItemCategory,
    valuable: zod_1.z.boolean(),
    foundLocation: zod_1.z.string().trim().min(1).max(120),
    foundSpot: zod_1.z.string().trim().max(200).optional(),
    foundAt: zod_1.z.string().datetime({ offset: true }),
    /** A staff member who found it; or just a name, for someone without an account. */
    foundByUserId: primitives_1.Uuid.optional(),
    foundByName: zod_1.z.string().trim().min(1).max(120),
    /** Who takes custody (the supervisor or the night desk). */
    custodianUserId: primitives_1.Uuid.optional(),
    storageLocation: zod_1.z.string().trim().max(200).optional(),
    photoCount: zod_1.z.number().int().min(0).max(20).optional(),
});
exports.OpenFoundItemClaimRequest = zod_1.z.object({
    claimantName: zod_1.z.string().trim().min(1).max(120),
    bookingReference: zod_1.z.string().trim().max(40).optional(),
    statement: zod_1.z.string().trim().min(1).max(1000),
});
/** Both checks are the releaser's word, recorded against their name; neither may be skipped. */
exports.ReleaseFoundItemRequest = zod_1.z.object({
    method: exports.FoundItemReleaseMethod,
    descriptionMatched: zod_1.z.literal(true),
    idChecked: zod_1.z.literal(true),
});
exports.ProposeFoundItemDisposalRequest = zod_1.z.object({ note: zod_1.z.string().trim().min(1).max(500) });
exports.ExtendFoundItemRetentionRequest = zod_1.z.object({
    days: zod_1.z.number().int().min(1).max(365),
    reason: zod_1.z.string().trim().min(1).max(300),
});
//# sourceMappingURL=lost-found.js.map