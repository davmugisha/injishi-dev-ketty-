import { z } from "zod";
import { Uuid } from "./primitives";

/**
 * The lost and found register (`/api/v1/ops/found-items`): what was found where, who holds it, the
 * chain of custody, claims, release to the owner and disposal after retention.
 *
 * Every step is a custody event, appended and never edited, because the register is what the hotel
 * shows when a guest says "you lost my ring". Release needs the claimant's description matched and
 * their identity checked; disposal is final, so the person approving it can never be the person who
 * proposed it.
 */

export const FoundItemStatus = z.enum(["stored", "claimed", "returned", "disposal_pending", "disposed"]);
export type FoundItemStatus = z.infer<typeof FoundItemStatus>;

export const FoundItemCategory = z.enum([
    "electronics",
    "jewellery",
    "clothing",
    "accessories",
    "documents",
    "cash",
    "other",
]);
export type FoundItemCategory = z.infer<typeof FoundItemCategory>;

export const FoundItemReleaseMethod = z.enum(["in_person", "authorised_person", "courier"]);
export type FoundItemReleaseMethod = z.infer<typeof FoundItemReleaseMethod>;

export const FoundItemEventKind = z.enum([
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
export type FoundItemEventKind = z.infer<typeof FoundItemEventKind>;

export const FoundItemEvent = z.object({
    id: Uuid,
    kind: FoundItemEventKind,
    summary: z.string(),
    actorName: z.string().nullable(),
    detail: z.string().nullable(),
    occurredAt: z.string(),
});
export type FoundItemEvent = z.infer<typeof FoundItemEvent>;

export const FoundItem = z.object({
    id: Uuid,
    /** "LF-26-041": printed on the tag and the bag. Unique per business. */
    reference: z.string(),
    propertyId: Uuid,
    description: z.string(),
    category: FoundItemCategory,
    valuable: z.boolean(),
    /** Where, as staff say it: "Room 204", "Lake Bar". */
    foundLocation: z.string(),
    /** The exact spot: "bedside drawer". */
    foundSpot: z.string().nullable(),
    roomId: Uuid.nullable(),
    foundAt: z.string(),
    foundByUserId: Uuid.nullable(),
    foundByName: z.string(),
    custodianUserId: Uuid.nullable(),
    custodianName: z.string().nullable(),
    storageLocation: z.string().nullable(),
    status: FoundItemStatus,
    retentionUntil: z.string(),
    retentionNote: z.string().nullable(),
    claim: z
        .object({
            claimantName: z.string(),
            bookingReference: z.string().nullable(),
            statement: z.string(),
            /** The claimant's booking covers the room and the day the item was found. */
            matched: z.boolean(),
            matchNote: z.string(),
            openedAt: z.string(),
            openedByName: z.string().nullable(),
        })
        .nullable(),
    release: z
        .object({ method: FoundItemReleaseMethod, releasedAt: z.string(), releasedByName: z.string().nullable() })
        .nullable(),
    disposal: z
        .object({
            note: z.string(),
            rule: z.string(),
            proposedByName: z.string().nullable(),
            proposedAt: z.string(),
            approvedByName: z.string().nullable(),
            approvedAt: z.string().nullable(),
        })
        .nullable(),
    closedNote: z.string().nullable(),
    /** Oldest first. */
    events: z.array(FoundItemEvent),
});
export type FoundItem = z.infer<typeof FoundItem>;

export const FoundItemPerson = z.object({ userId: Uuid, name: z.string() });
export type FoundItemPerson = z.infer<typeof FoundItemPerson>;

export const FoundItemList = z.object({
    items: z.array(FoundItem),
    /** Staff who appear on the register (finders, custodians): who an intake can name. */
    people: z.array(FoundItemPerson),
    /** The retention rule every item is held under, in words. */
    retentionRule: z.string(),
});
export type FoundItemList = z.infer<typeof FoundItemList>;

export const LogFoundItemRequest = z.object({
    propertyId: Uuid.optional(),
    description: z.string().trim().min(1).max(300),
    category: FoundItemCategory,
    valuable: z.boolean(),
    foundLocation: z.string().trim().min(1).max(120),
    foundSpot: z.string().trim().max(200).optional(),
    foundAt: z.string().datetime({ offset: true }),
    /** A staff member who found it; or just a name, for someone without an account. */
    foundByUserId: Uuid.optional(),
    foundByName: z.string().trim().min(1).max(120),
    /** Who takes custody (the supervisor or the night desk). */
    custodianUserId: Uuid.optional(),
    storageLocation: z.string().trim().max(200).optional(),
    photoCount: z.number().int().min(0).max(20).optional(),
});
export type LogFoundItemRequest = z.infer<typeof LogFoundItemRequest>;

export const OpenFoundItemClaimRequest = z.object({
    claimantName: z.string().trim().min(1).max(120),
    bookingReference: z.string().trim().max(40).optional(),
    statement: z.string().trim().min(1).max(1000),
});
export type OpenFoundItemClaimRequest = z.infer<typeof OpenFoundItemClaimRequest>;

/** Both checks are the releaser's word, recorded against their name; neither may be skipped. */
export const ReleaseFoundItemRequest = z.object({
    method: FoundItemReleaseMethod,
    descriptionMatched: z.literal(true),
    idChecked: z.literal(true),
});
export type ReleaseFoundItemRequest = z.infer<typeof ReleaseFoundItemRequest>;

export const ProposeFoundItemDisposalRequest = z.object({ note: z.string().trim().min(1).max(500) });
export type ProposeFoundItemDisposalRequest = z.infer<typeof ProposeFoundItemDisposalRequest>;

export const ExtendFoundItemRetentionRequest = z.object({
    days: z.number().int().min(1).max(365),
    reason: z.string().trim().min(1).max(300),
});
export type ExtendFoundItemRetentionRequest = z.infer<typeof ExtendFoundItemRetentionRequest>;
