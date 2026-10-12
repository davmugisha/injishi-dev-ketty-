"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrokerEarnings = exports.BrokerFee = exports.BrokerPlacementList = exports.BrokerPlacement = exports.BrokerPlacementFeeStatus = exports.BrokerCredits = exports.BrokerCreditEntry = exports.BrokerReveal = exports.BrokerDirectory = exports.BrokerDirectoryListing = exports.BrokerDirectoryUnit = exports.BrokerContact = void 0;
const zod_1 = require("zod");
const admin_1 = require("./admin");
const primitives_1 = require("./primitives");
const registration_1 = require("./registration");
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
exports.BrokerContact = zod_1.z.object({
    phone: zod_1.z.string().nullable(),
    email: zod_1.z.string().nullable(),
    revealedAt: zod_1.z.string(),
});
/** One unit type on a listing, and how many of its rooms have no active lease. */
exports.BrokerDirectoryUnit = zod_1.z.object({
    roomTypeId: primitives_1.Uuid,
    name: zod_1.z.string(),
    monthlyRentRwf: zod_1.z.number().int().nullable(),
    cautionRwf: zod_1.z.number().int().nullable(),
    vacantUnits: zod_1.z.number().int(),
    totalUnits: zod_1.z.number().int(),
});
exports.BrokerDirectoryListing = zod_1.z.object({
    listingId: primitives_1.Uuid,
    propertyName: zod_1.z.string(),
    landlordName: zod_1.z.string(),
    district: zod_1.z.string().nullable(),
    units: zod_1.z.array(exports.BrokerDirectoryUnit),
    /** Null until this broker reveals the listing. */
    contact: exports.BrokerContact.nullable(),
    /** The broker's open (`initiated`) placement on this listing, if any. */
    openPlacementId: primitives_1.Uuid.nullable(),
});
exports.BrokerDirectory = zod_1.z.object({
    brokerStatus: registration_1.BrokerStatus,
    /** `sum(delta)` over the credit ledger. Never stored. */
    balance: zod_1.z.number().int(),
    /** What one reveal spends. The product's number, sent so a screen can say it. */
    revealCost: zod_1.z.number().int(),
    listings: zod_1.z.array(exports.BrokerDirectoryListing),
});
/** The answer to a reveal. `charged` is false when the listing was already revealed. */
exports.BrokerReveal = zod_1.z.object({
    listingId: primitives_1.Uuid,
    contact: exports.BrokerContact,
    balance: zod_1.z.number().int(),
    charged: zod_1.z.boolean(),
});
// ---------------------------------------------------------------------------
// Credits
// ---------------------------------------------------------------------------
exports.BrokerCreditEntry = zod_1.z.object({
    id: primitives_1.Uuid,
    /** Positive grants, negative spends. Credits, not money. */
    delta: zod_1.z.number().int(),
    /** `plan_grant | reveal | refund | correction`. */
    reason: zod_1.z.string(),
    note: zod_1.z.string().nullable(),
    /** The listing a spend revealed, resolved through `reveal_id`. */
    propertyName: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string(),
});
exports.BrokerCredits = zod_1.z.object({
    balance: zod_1.z.number().int(),
    entries: zod_1.z.array(exports.BrokerCreditEntry),
});
// ---------------------------------------------------------------------------
// Placements and earnings
// ---------------------------------------------------------------------------
exports.BrokerPlacementFeeStatus = zod_1.z.enum(["pending", "disbursed"]);
exports.BrokerPlacement = zod_1.z.object({
    id: primitives_1.Uuid,
    listingId: primitives_1.Uuid.nullable(),
    propertyName: zod_1.z.string().nullable(),
    landlordName: zod_1.z.string().nullable(),
    status: admin_1.AdminPlacementStatus,
    initiatedAt: zod_1.z.string(),
    /** The lease the placement became. Null until the landlord records one. */
    lease: zod_1.z
        .object({
        id: primitives_1.Uuid,
        unitLabel: zod_1.z.string().nullable(),
        tenantName: zod_1.z.string().nullable(),
        status: zod_1.z.string(),
        startDate: zod_1.z.string().nullable(),
    })
        .nullable(),
    /** The fee that lease raised. Earned when the lease activates (F-R08). */
    fee: zod_1.z
        .object({
        amountRwf: zod_1.z.number().int().nullable(),
        status: exports.BrokerPlacementFeeStatus,
    })
        .nullable(),
});
exports.BrokerPlacementList = zod_1.z.object({ placements: zod_1.z.array(exports.BrokerPlacement) });
exports.BrokerFee = zod_1.z.object({
    id: primitives_1.Uuid,
    leaseId: primitives_1.Uuid,
    tenantName: zod_1.z.string().nullable(),
    unitLabel: zod_1.z.string().nullable(),
    landlordName: zod_1.z.string().nullable(),
    amountRwf: zod_1.z.number().int().nullable(),
    status: exports.BrokerPlacementFeeStatus,
    /** When the fee last moved: raised, or disbursed. */
    updatedAt: zod_1.z.string(),
});
exports.BrokerEarnings = zod_1.z.object({
    /** Disbursed since 1 January, in the server's clock. */
    disbursedThisYearRwf: zod_1.z.number().int(),
    pendingRwf: zod_1.z.number().int(),
    balance: zod_1.z.number().int(),
    fees: zod_1.z.array(exports.BrokerFee),
});
//# sourceMappingURL=broker.js.map