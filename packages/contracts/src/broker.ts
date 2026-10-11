import { z } from "zod";
import { AdminPlacementStatus } from "./admin";
import { Uuid } from "./primitives";
import { BrokerStatus } from "./registration";
/**
 * The broker's own surface (ADR-038 child 6, `/api/v1/ops/broker/*`).
 *
 * A broker workspace belongs to one person and runs no departments, so none of
 * these shapes carries a permission. What they carry instead is the answer to
 * the three questions the broker screens ask: which residence units can I place
 * a tenant in, what did revealing a landlord cost me, and what has the work
 * earned.
 *
 * Two departures from the child 6 spec, both the schema's call:
 *
 *   - A placement is `initiated | converted | abandoned | unavailable`
 *     (`placement_status`), not the spec's `viewing -> offer -> placed`. A
 *     placement converts when the landlord records the broker on a lease
 *     (FL19); the broker has no step to advance in between.
 *   - A reveal buys a LISTING's contact, not a unit's. `contact_reveals` keys on
 *     `listing_id`, and a property has one contact however many unit types it
 *     lets, so every unit card on that listing opens together.
 */
// ---------------------------------------------------------------------------
// Directory
// ---------------------------------------------------------------------------
/**
 * The landlord contact a broker paid for, as it stood when they paid.
 *
 * A snapshot, never a join: a landlord who changes their number later has not
 * changed what the broker was sold. Absent entirely until revealed; the server
 * sends no masked string for a client to unmask.
 */
export const BrokerContact = z.object({
    phone: z.string().nullable(),
    email: z.string().nullable(),
    revealedAt: z.string(),
});
export type BrokerContact = z.infer<typeof BrokerContact>;
/** One unit type on a listing, and how many of its rooms have no active lease. */
export const BrokerDirectoryUnit = z.object({
    roomTypeId: Uuid,
    name: z.string(),
    monthlyRentRwf: z.number().int().nullable(),
    cautionRwf: z.number().int().nullable(),
    vacantUnits: z.number().int(),
    totalUnits: z.number().int(),
});
export type BrokerDirectoryUnit = z.infer<typeof BrokerDirectoryUnit>;
export const BrokerDirectoryListing = z.object({
    listingId: Uuid,
    propertyName: z.string(),
    landlordName: z.string(),
    district: z.string().nullable(),
    units: z.array(BrokerDirectoryUnit),
    /** Null until this broker reveals the listing. */
    contact: BrokerContact.nullable(),
    /** The broker's open (`initiated`) placement on this listing, if any. */
    openPlacementId: Uuid.nullable(),
});
export type BrokerDirectoryListing = z.infer<typeof BrokerDirectoryListing>;
export const BrokerDirectory = z.object({
    brokerStatus: BrokerStatus,
    /** `sum(delta)` over the credit ledger. Never stored. */
    balance: z.number().int(),
    /** What one reveal spends. The product's number, sent so a screen can say it. */
    revealCost: z.number().int(),
    listings: z.array(BrokerDirectoryListing),
});
export type BrokerDirectory = z.infer<typeof BrokerDirectory>;
/** The answer to a reveal. `charged` is false when the listing was already revealed. */
export const BrokerReveal = z.object({
    listingId: Uuid,
    contact: BrokerContact,
    balance: z.number().int(),
    charged: z.boolean(),
});
export type BrokerReveal = z.infer<typeof BrokerReveal>;
// ---------------------------------------------------------------------------
// Credits
// ---------------------------------------------------------------------------
export const BrokerCreditEntry = z.object({
    id: Uuid,
    /** Positive grants, negative spends. Credits, not money. */
    delta: z.number().int(),
    /** `plan_grant | reveal | refund | correction`. */
    reason: z.string(),
    note: z.string().nullable(),
    /** The listing a spend revealed, resolved through `reveal_id`. */
    propertyName: z.string().nullable(),
    createdAt: z.string(),
});
export type BrokerCreditEntry = z.infer<typeof BrokerCreditEntry>;
export const BrokerCredits = z.object({
    balance: z.number().int(),
    entries: z.array(BrokerCreditEntry),
});
export type BrokerCredits = z.infer<typeof BrokerCredits>;
// ---------------------------------------------------------------------------
// Placements and earnings
// ---------------------------------------------------------------------------
export const BrokerPlacementFeeStatus = z.enum(["pending", "disbursed"]);
export type BrokerPlacementFeeStatus = z.infer<typeof BrokerPlacementFeeStatus>;
export const BrokerPlacement = z.object({
    id: Uuid,
    listingId: Uuid.nullable(),
    propertyName: z.string().nullable(),
    landlordName: z.string().nullable(),
    status: AdminPlacementStatus,
    initiatedAt: z.string(),
    /** The lease the placement became. Null until the landlord records one. */
    lease: z
        .object({
        id: Uuid,
        unitLabel: z.string().nullable(),
        tenantName: z.string().nullable(),
        status: z.string(),
        startDate: z.string().nullable(),
    })
        .nullable(),
    /** The fee that lease raised. Earned when the lease activates (F-R08). */
    fee: z
        .object({
        amountRwf: z.number().int().nullable(),
        status: BrokerPlacementFeeStatus,
    })
        .nullable(),
});
export type BrokerPlacement = z.infer<typeof BrokerPlacement>;
export const BrokerPlacementList = z.object({ placements: z.array(BrokerPlacement) });
export type BrokerPlacementList = z.infer<typeof BrokerPlacementList>;
export const BrokerFee = z.object({
    id: Uuid,
    leaseId: Uuid,
    tenantName: z.string().nullable(),
    unitLabel: z.string().nullable(),
    landlordName: z.string().nullable(),
    amountRwf: z.number().int().nullable(),
    status: BrokerPlacementFeeStatus,
    /** When the fee last moved: raised, or disbursed. */
    updatedAt: z.string(),
});
export type BrokerFee = z.infer<typeof BrokerFee>;
export const BrokerEarnings = z.object({
    /** Disbursed since 1 January, in the server's clock. */
    disbursedThisYearRwf: z.number().int(),
    pendingRwf: z.number().int(),
    balance: z.number().int(),
    fees: z.array(BrokerFee),
});
export type BrokerEarnings = z.infer<typeof BrokerEarnings>;
