import { z } from "zod";
/**
 * The lost and found register (`/api/v1/ops/found-items`): what was found where, who holds it, the
 * chain of custody, claims, release to the owner and disposal after retention.
 *
 * Every step is a custody event, appended and never edited, because the register is what the hotel
 * shows when a guest says "you lost my ring". Release needs the claimant's description matched and
 * their identity checked; disposal is final, so the person approving it can never be the person who
 * proposed it.
 */
export declare const FoundItemStatus: z.ZodEnum<["stored", "claimed", "returned", "disposal_pending", "disposed"]>;
export type FoundItemStatus = z.infer<typeof FoundItemStatus>;
export declare const FoundItemCategory: z.ZodEnum<["electronics", "jewellery", "clothing", "accessories", "documents", "cash", "other"]>;
export type FoundItemCategory = z.infer<typeof FoundItemCategory>;
export declare const FoundItemReleaseMethod: z.ZodEnum<["in_person", "authorised_person", "courier"]>;
export type FoundItemReleaseMethod = z.infer<typeof FoundItemReleaseMethod>;
export declare const FoundItemEventKind: z.ZodEnum<["found", "handed_over", "stored", "logged", "claim_opened", "verified", "returned", "disposal_proposed", "disposal_approved", "retention_extended", "note"]>;
export type FoundItemEventKind = z.infer<typeof FoundItemEventKind>;
export declare const FoundItemEvent: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<["found", "handed_over", "stored", "logged", "claim_opened", "verified", "returned", "disposal_proposed", "disposal_approved", "retention_extended", "note"]>;
    summary: z.ZodString;
    actorName: z.ZodNullable<z.ZodString>;
    detail: z.ZodNullable<z.ZodString>;
    occurredAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    kind: "verified" | "note" | "stored" | "returned" | "found" | "handed_over" | "logged" | "claim_opened" | "disposal_proposed" | "disposal_approved" | "retention_extended";
    detail: string | null;
    occurredAt: string;
    actorName: string | null;
    summary: string;
}, {
    id: string;
    kind: "verified" | "note" | "stored" | "returned" | "found" | "handed_over" | "logged" | "claim_opened" | "disposal_proposed" | "disposal_approved" | "retention_extended";
    detail: string | null;
    occurredAt: string;
    actorName: string | null;
    summary: string;
}>;
export type FoundItemEvent = z.infer<typeof FoundItemEvent>;
export declare const FoundItem: z.ZodObject<{
    id: z.ZodString;
    /** "LF-26-041": printed on the tag and the bag. Unique per business. */
    reference: z.ZodString;
    propertyId: z.ZodString;
    description: z.ZodString;
    category: z.ZodEnum<["electronics", "jewellery", "clothing", "accessories", "documents", "cash", "other"]>;
    valuable: z.ZodBoolean;
    /** Where, as staff say it: "Room 204", "Lake Bar". */
    foundLocation: z.ZodString;
    /** The exact spot: "bedside drawer". */
    foundSpot: z.ZodNullable<z.ZodString>;
    roomId: z.ZodNullable<z.ZodString>;
    foundAt: z.ZodString;
    foundByUserId: z.ZodNullable<z.ZodString>;
    foundByName: z.ZodString;
    custodianUserId: z.ZodNullable<z.ZodString>;
    custodianName: z.ZodNullable<z.ZodString>;
    storageLocation: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["stored", "claimed", "returned", "disposal_pending", "disposed"]>;
    retentionUntil: z.ZodString;
    retentionNote: z.ZodNullable<z.ZodString>;
    claim: z.ZodNullable<z.ZodObject<{
        claimantName: z.ZodString;
        bookingReference: z.ZodNullable<z.ZodString>;
        statement: z.ZodString;
        /** The claimant's booking covers the room and the day the item was found. */
        matched: z.ZodBoolean;
        matchNote: z.ZodString;
        openedAt: z.ZodString;
        openedByName: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        openedAt: string;
        bookingReference: string | null;
        claimantName: string;
        statement: string;
        matched: boolean;
        matchNote: string;
        openedByName: string | null;
    }, {
        openedAt: string;
        bookingReference: string | null;
        claimantName: string;
        statement: string;
        matched: boolean;
        matchNote: string;
        openedByName: string | null;
    }>>;
    release: z.ZodNullable<z.ZodObject<{
        method: z.ZodEnum<["in_person", "authorised_person", "courier"]>;
        releasedAt: z.ZodString;
        releasedByName: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        method: "in_person" | "authorised_person" | "courier";
        releasedAt: string;
        releasedByName: string | null;
    }, {
        method: "in_person" | "authorised_person" | "courier";
        releasedAt: string;
        releasedByName: string | null;
    }>>;
    disposal: z.ZodNullable<z.ZodObject<{
        note: z.ZodString;
        rule: z.ZodString;
        proposedByName: z.ZodNullable<z.ZodString>;
        proposedAt: z.ZodString;
        approvedByName: z.ZodNullable<z.ZodString>;
        approvedAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        rule: string;
        note: string;
        proposedByName: string | null;
        proposedAt: string;
        approvedByName: string | null;
        approvedAt: string | null;
    }, {
        rule: string;
        note: string;
        proposedByName: string | null;
        proposedAt: string;
        approvedByName: string | null;
        approvedAt: string | null;
    }>>;
    closedNote: z.ZodNullable<z.ZodString>;
    /** Oldest first. */
    events: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<["found", "handed_over", "stored", "logged", "claim_opened", "verified", "returned", "disposal_proposed", "disposal_approved", "retention_extended", "note"]>;
        summary: z.ZodString;
        actorName: z.ZodNullable<z.ZodString>;
        detail: z.ZodNullable<z.ZodString>;
        occurredAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        kind: "verified" | "note" | "stored" | "returned" | "found" | "handed_over" | "logged" | "claim_opened" | "disposal_proposed" | "disposal_approved" | "retention_extended";
        detail: string | null;
        occurredAt: string;
        actorName: string | null;
        summary: string;
    }, {
        id: string;
        kind: "verified" | "note" | "stored" | "returned" | "found" | "handed_over" | "logged" | "claim_opened" | "disposal_proposed" | "disposal_approved" | "retention_extended";
        detail: string | null;
        occurredAt: string;
        actorName: string | null;
        summary: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    status: "claimed" | "stored" | "returned" | "disposal_pending" | "disposed";
    id: string;
    reference: string;
    description: string;
    events: {
        id: string;
        kind: "verified" | "note" | "stored" | "returned" | "found" | "handed_over" | "logged" | "claim_opened" | "disposal_proposed" | "disposal_approved" | "retention_extended";
        detail: string | null;
        occurredAt: string;
        actorName: string | null;
        summary: string;
    }[];
    category: "other" | "documents" | "cash" | "electronics" | "jewellery" | "clothing" | "accessories";
    roomId: string | null;
    propertyId: string;
    valuable: boolean;
    foundLocation: string;
    foundSpot: string | null;
    foundAt: string;
    foundByUserId: string | null;
    foundByName: string;
    custodianUserId: string | null;
    custodianName: string | null;
    storageLocation: string | null;
    retentionUntil: string;
    retentionNote: string | null;
    claim: {
        openedAt: string;
        bookingReference: string | null;
        claimantName: string;
        statement: string;
        matched: boolean;
        matchNote: string;
        openedByName: string | null;
    } | null;
    release: {
        method: "in_person" | "authorised_person" | "courier";
        releasedAt: string;
        releasedByName: string | null;
    } | null;
    disposal: {
        rule: string;
        note: string;
        proposedByName: string | null;
        proposedAt: string;
        approvedByName: string | null;
        approvedAt: string | null;
    } | null;
    closedNote: string | null;
}, {
    status: "claimed" | "stored" | "returned" | "disposal_pending" | "disposed";
    id: string;
    reference: string;
    description: string;
    events: {
        id: string;
        kind: "verified" | "note" | "stored" | "returned" | "found" | "handed_over" | "logged" | "claim_opened" | "disposal_proposed" | "disposal_approved" | "retention_extended";
        detail: string | null;
        occurredAt: string;
        actorName: string | null;
        summary: string;
    }[];
    category: "other" | "documents" | "cash" | "electronics" | "jewellery" | "clothing" | "accessories";
    roomId: string | null;
    propertyId: string;
    valuable: boolean;
    foundLocation: string;
    foundSpot: string | null;
    foundAt: string;
    foundByUserId: string | null;
    foundByName: string;
    custodianUserId: string | null;
    custodianName: string | null;
    storageLocation: string | null;
    retentionUntil: string;
    retentionNote: string | null;
    claim: {
        openedAt: string;
        bookingReference: string | null;
        claimantName: string;
        statement: string;
        matched: boolean;
        matchNote: string;
        openedByName: string | null;
    } | null;
    release: {
        method: "in_person" | "authorised_person" | "courier";
        releasedAt: string;
        releasedByName: string | null;
    } | null;
    disposal: {
        rule: string;
        note: string;
        proposedByName: string | null;
        proposedAt: string;
        approvedByName: string | null;
        approvedAt: string | null;
    } | null;
    closedNote: string | null;
}>;
export type FoundItem = z.infer<typeof FoundItem>;
export declare const FoundItemPerson: z.ZodObject<{
    userId: z.ZodString;
    name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    userId: string;
}, {
    name: string;
    userId: string;
}>;
export type FoundItemPerson = z.infer<typeof FoundItemPerson>;
export declare const FoundItemList: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        /** "LF-26-041": printed on the tag and the bag. Unique per business. */
        reference: z.ZodString;
        propertyId: z.ZodString;
        description: z.ZodString;
        category: z.ZodEnum<["electronics", "jewellery", "clothing", "accessories", "documents", "cash", "other"]>;
        valuable: z.ZodBoolean;
        /** Where, as staff say it: "Room 204", "Lake Bar". */
        foundLocation: z.ZodString;
        /** The exact spot: "bedside drawer". */
        foundSpot: z.ZodNullable<z.ZodString>;
        roomId: z.ZodNullable<z.ZodString>;
        foundAt: z.ZodString;
        foundByUserId: z.ZodNullable<z.ZodString>;
        foundByName: z.ZodString;
        custodianUserId: z.ZodNullable<z.ZodString>;
        custodianName: z.ZodNullable<z.ZodString>;
        storageLocation: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<["stored", "claimed", "returned", "disposal_pending", "disposed"]>;
        retentionUntil: z.ZodString;
        retentionNote: z.ZodNullable<z.ZodString>;
        claim: z.ZodNullable<z.ZodObject<{
            claimantName: z.ZodString;
            bookingReference: z.ZodNullable<z.ZodString>;
            statement: z.ZodString;
            /** The claimant's booking covers the room and the day the item was found. */
            matched: z.ZodBoolean;
            matchNote: z.ZodString;
            openedAt: z.ZodString;
            openedByName: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            openedAt: string;
            bookingReference: string | null;
            claimantName: string;
            statement: string;
            matched: boolean;
            matchNote: string;
            openedByName: string | null;
        }, {
            openedAt: string;
            bookingReference: string | null;
            claimantName: string;
            statement: string;
            matched: boolean;
            matchNote: string;
            openedByName: string | null;
        }>>;
        release: z.ZodNullable<z.ZodObject<{
            method: z.ZodEnum<["in_person", "authorised_person", "courier"]>;
            releasedAt: z.ZodString;
            releasedByName: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            method: "in_person" | "authorised_person" | "courier";
            releasedAt: string;
            releasedByName: string | null;
        }, {
            method: "in_person" | "authorised_person" | "courier";
            releasedAt: string;
            releasedByName: string | null;
        }>>;
        disposal: z.ZodNullable<z.ZodObject<{
            note: z.ZodString;
            rule: z.ZodString;
            proposedByName: z.ZodNullable<z.ZodString>;
            proposedAt: z.ZodString;
            approvedByName: z.ZodNullable<z.ZodString>;
            approvedAt: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            rule: string;
            note: string;
            proposedByName: string | null;
            proposedAt: string;
            approvedByName: string | null;
            approvedAt: string | null;
        }, {
            rule: string;
            note: string;
            proposedByName: string | null;
            proposedAt: string;
            approvedByName: string | null;
            approvedAt: string | null;
        }>>;
        closedNote: z.ZodNullable<z.ZodString>;
        /** Oldest first. */
        events: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<["found", "handed_over", "stored", "logged", "claim_opened", "verified", "returned", "disposal_proposed", "disposal_approved", "retention_extended", "note"]>;
            summary: z.ZodString;
            actorName: z.ZodNullable<z.ZodString>;
            detail: z.ZodNullable<z.ZodString>;
            occurredAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
            kind: "verified" | "note" | "stored" | "returned" | "found" | "handed_over" | "logged" | "claim_opened" | "disposal_proposed" | "disposal_approved" | "retention_extended";
            detail: string | null;
            occurredAt: string;
            actorName: string | null;
            summary: string;
        }, {
            id: string;
            kind: "verified" | "note" | "stored" | "returned" | "found" | "handed_over" | "logged" | "claim_opened" | "disposal_proposed" | "disposal_approved" | "retention_extended";
            detail: string | null;
            occurredAt: string;
            actorName: string | null;
            summary: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        status: "claimed" | "stored" | "returned" | "disposal_pending" | "disposed";
        id: string;
        reference: string;
        description: string;
        events: {
            id: string;
            kind: "verified" | "note" | "stored" | "returned" | "found" | "handed_over" | "logged" | "claim_opened" | "disposal_proposed" | "disposal_approved" | "retention_extended";
            detail: string | null;
            occurredAt: string;
            actorName: string | null;
            summary: string;
        }[];
        category: "other" | "documents" | "cash" | "electronics" | "jewellery" | "clothing" | "accessories";
        roomId: string | null;
        propertyId: string;
        valuable: boolean;
        foundLocation: string;
        foundSpot: string | null;
        foundAt: string;
        foundByUserId: string | null;
        foundByName: string;
        custodianUserId: string | null;
        custodianName: string | null;
        storageLocation: string | null;
        retentionUntil: string;
        retentionNote: string | null;
        claim: {
            openedAt: string;
            bookingReference: string | null;
            claimantName: string;
            statement: string;
            matched: boolean;
            matchNote: string;
            openedByName: string | null;
        } | null;
        release: {
            method: "in_person" | "authorised_person" | "courier";
            releasedAt: string;
            releasedByName: string | null;
        } | null;
        disposal: {
            rule: string;
            note: string;
            proposedByName: string | null;
            proposedAt: string;
            approvedByName: string | null;
            approvedAt: string | null;
        } | null;
        closedNote: string | null;
    }, {
        status: "claimed" | "stored" | "returned" | "disposal_pending" | "disposed";
        id: string;
        reference: string;
        description: string;
        events: {
            id: string;
            kind: "verified" | "note" | "stored" | "returned" | "found" | "handed_over" | "logged" | "claim_opened" | "disposal_proposed" | "disposal_approved" | "retention_extended";
            detail: string | null;
            occurredAt: string;
            actorName: string | null;
            summary: string;
        }[];
        category: "other" | "documents" | "cash" | "electronics" | "jewellery" | "clothing" | "accessories";
        roomId: string | null;
        propertyId: string;
        valuable: boolean;
        foundLocation: string;
        foundSpot: string | null;
        foundAt: string;
        foundByUserId: string | null;
        foundByName: string;
        custodianUserId: string | null;
        custodianName: string | null;
        storageLocation: string | null;
        retentionUntil: string;
        retentionNote: string | null;
        claim: {
            openedAt: string;
            bookingReference: string | null;
            claimantName: string;
            statement: string;
            matched: boolean;
            matchNote: string;
            openedByName: string | null;
        } | null;
        release: {
            method: "in_person" | "authorised_person" | "courier";
            releasedAt: string;
            releasedByName: string | null;
        } | null;
        disposal: {
            rule: string;
            note: string;
            proposedByName: string | null;
            proposedAt: string;
            approvedByName: string | null;
            approvedAt: string | null;
        } | null;
        closedNote: string | null;
    }>, "many">;
    /** Staff who appear on the register (finders, custodians): who an intake can name. */
    people: z.ZodArray<z.ZodObject<{
        userId: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        userId: string;
    }, {
        name: string;
        userId: string;
    }>, "many">;
    /** The retention rule every item is held under, in words. */
    retentionRule: z.ZodString;
}, "strip", z.ZodTypeAny, {
    items: {
        status: "claimed" | "stored" | "returned" | "disposal_pending" | "disposed";
        id: string;
        reference: string;
        description: string;
        events: {
            id: string;
            kind: "verified" | "note" | "stored" | "returned" | "found" | "handed_over" | "logged" | "claim_opened" | "disposal_proposed" | "disposal_approved" | "retention_extended";
            detail: string | null;
            occurredAt: string;
            actorName: string | null;
            summary: string;
        }[];
        category: "other" | "documents" | "cash" | "electronics" | "jewellery" | "clothing" | "accessories";
        roomId: string | null;
        propertyId: string;
        valuable: boolean;
        foundLocation: string;
        foundSpot: string | null;
        foundAt: string;
        foundByUserId: string | null;
        foundByName: string;
        custodianUserId: string | null;
        custodianName: string | null;
        storageLocation: string | null;
        retentionUntil: string;
        retentionNote: string | null;
        claim: {
            openedAt: string;
            bookingReference: string | null;
            claimantName: string;
            statement: string;
            matched: boolean;
            matchNote: string;
            openedByName: string | null;
        } | null;
        release: {
            method: "in_person" | "authorised_person" | "courier";
            releasedAt: string;
            releasedByName: string | null;
        } | null;
        disposal: {
            rule: string;
            note: string;
            proposedByName: string | null;
            proposedAt: string;
            approvedByName: string | null;
            approvedAt: string | null;
        } | null;
        closedNote: string | null;
    }[];
    people: {
        name: string;
        userId: string;
    }[];
    retentionRule: string;
}, {
    items: {
        status: "claimed" | "stored" | "returned" | "disposal_pending" | "disposed";
        id: string;
        reference: string;
        description: string;
        events: {
            id: string;
            kind: "verified" | "note" | "stored" | "returned" | "found" | "handed_over" | "logged" | "claim_opened" | "disposal_proposed" | "disposal_approved" | "retention_extended";
            detail: string | null;
            occurredAt: string;
            actorName: string | null;
            summary: string;
        }[];
        category: "other" | "documents" | "cash" | "electronics" | "jewellery" | "clothing" | "accessories";
        roomId: string | null;
        propertyId: string;
        valuable: boolean;
        foundLocation: string;
        foundSpot: string | null;
        foundAt: string;
        foundByUserId: string | null;
        foundByName: string;
        custodianUserId: string | null;
        custodianName: string | null;
        storageLocation: string | null;
        retentionUntil: string;
        retentionNote: string | null;
        claim: {
            openedAt: string;
            bookingReference: string | null;
            claimantName: string;
            statement: string;
            matched: boolean;
            matchNote: string;
            openedByName: string | null;
        } | null;
        release: {
            method: "in_person" | "authorised_person" | "courier";
            releasedAt: string;
            releasedByName: string | null;
        } | null;
        disposal: {
            rule: string;
            note: string;
            proposedByName: string | null;
            proposedAt: string;
            approvedByName: string | null;
            approvedAt: string | null;
        } | null;
        closedNote: string | null;
    }[];
    people: {
        name: string;
        userId: string;
    }[];
    retentionRule: string;
}>;
export type FoundItemList = z.infer<typeof FoundItemList>;
export declare const LogFoundItemRequest: z.ZodObject<{
    propertyId: z.ZodOptional<z.ZodString>;
    description: z.ZodString;
    category: z.ZodEnum<["electronics", "jewellery", "clothing", "accessories", "documents", "cash", "other"]>;
    valuable: z.ZodBoolean;
    foundLocation: z.ZodString;
    foundSpot: z.ZodOptional<z.ZodString>;
    foundAt: z.ZodString;
    /** A staff member who found it; or just a name, for someone without an account. */
    foundByUserId: z.ZodOptional<z.ZodString>;
    foundByName: z.ZodString;
    /** Who takes custody (the supervisor or the night desk). */
    custodianUserId: z.ZodOptional<z.ZodString>;
    storageLocation: z.ZodOptional<z.ZodString>;
    photoCount: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    description: string;
    category: "other" | "documents" | "cash" | "electronics" | "jewellery" | "clothing" | "accessories";
    valuable: boolean;
    foundLocation: string;
    foundAt: string;
    foundByName: string;
    propertyId?: string | undefined;
    foundSpot?: string | undefined;
    foundByUserId?: string | undefined;
    custodianUserId?: string | undefined;
    storageLocation?: string | undefined;
    photoCount?: number | undefined;
}, {
    description: string;
    category: "other" | "documents" | "cash" | "electronics" | "jewellery" | "clothing" | "accessories";
    valuable: boolean;
    foundLocation: string;
    foundAt: string;
    foundByName: string;
    propertyId?: string | undefined;
    foundSpot?: string | undefined;
    foundByUserId?: string | undefined;
    custodianUserId?: string | undefined;
    storageLocation?: string | undefined;
    photoCount?: number | undefined;
}>;
export type LogFoundItemRequest = z.infer<typeof LogFoundItemRequest>;
export declare const OpenFoundItemClaimRequest: z.ZodObject<{
    claimantName: z.ZodString;
    bookingReference: z.ZodOptional<z.ZodString>;
    statement: z.ZodString;
}, "strip", z.ZodTypeAny, {
    claimantName: string;
    statement: string;
    bookingReference?: string | undefined;
}, {
    claimantName: string;
    statement: string;
    bookingReference?: string | undefined;
}>;
export type OpenFoundItemClaimRequest = z.infer<typeof OpenFoundItemClaimRequest>;
/** Both checks are the releaser's word, recorded against their name; neither may be skipped. */
export declare const ReleaseFoundItemRequest: z.ZodObject<{
    method: z.ZodEnum<["in_person", "authorised_person", "courier"]>;
    descriptionMatched: z.ZodLiteral<true>;
    idChecked: z.ZodLiteral<true>;
}, "strip", z.ZodTypeAny, {
    method: "in_person" | "authorised_person" | "courier";
    descriptionMatched: true;
    idChecked: true;
}, {
    method: "in_person" | "authorised_person" | "courier";
    descriptionMatched: true;
    idChecked: true;
}>;
export type ReleaseFoundItemRequest = z.infer<typeof ReleaseFoundItemRequest>;
export declare const ProposeFoundItemDisposalRequest: z.ZodObject<{
    note: z.ZodString;
}, "strip", z.ZodTypeAny, {
    note: string;
}, {
    note: string;
}>;
export type ProposeFoundItemDisposalRequest = z.infer<typeof ProposeFoundItemDisposalRequest>;
export declare const ExtendFoundItemRetentionRequest: z.ZodObject<{
    days: z.ZodNumber;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    days: number;
}, {
    reason: string;
    days: number;
}>;
export type ExtendFoundItemRetentionRequest = z.infer<typeof ExtendFoundItemRetentionRequest>;
//# sourceMappingURL=lost-found.d.ts.map