"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SetBrokerPayoutAccountRequest = exports.BrokerPayoutAccount = exports.BrokerCommissionList = exports.BrokerCommission = exports.BrokerShareStatus = exports.BrokerCommissionStatus = void 0;
const zod_1 = require("zod");
const broker_deals_1 = require("./broker-deals");
const primitives_1 = require("./primitives");
const vocab_1 = require("./rentals/vocab");
/**
 * A broker's commission, earned and collected (2026-11-02, phase 3).
 *
 * Earned at check-out, only on a stay that happened:
 * - a percent deal earns its percent of the room price for the nights the
 *   guest actually stayed (the owner's call), one commission per booking;
 * - a bulk deal earns its fixed sum once the last room of the group has
 *   checked out, one commission per group.
 *
 * Collected from the hotel's money, never asked of the broker: the hotel's
 * payout at check-out is smaller by what it owes, oldest commission first. A
 * prepaid stay pays its own commission out of its escrow; a stay paid at the
 * hotel leaves it owed, and the hotel's next payouts take it. Once a commission
 * is fully collected, the broker's 85% is paid to their MoMo number and Injishi
 * keeps 15%.
 */
/** `owed`: the hotel still owes some of it; `collected`: all of it came off the hotel's payouts. */
exports.BrokerCommissionStatus = zod_1.z.enum(["owed", "collected"]);
/** Where the broker's share is: not yet (still owed), on its way, waiting for a payout number, paid, refused. */
exports.BrokerShareStatus = zod_1.z.enum(["waiting_for_hotel", "held", "queued", "paid", "failed"]);
exports.BrokerCommission = zod_1.z.object({
    id: primitives_1.Uuid,
    kind: broker_deals_1.BrokerDealKind,
    broker: zod_1.z.object({ id: primitives_1.Uuid, name: zod_1.z.string().nullable() }),
    hotel: zod_1.z.object({ orgId: primitives_1.Uuid, name: zod_1.z.string() }),
    groupReference: zod_1.z.string(),
    /** The booking a percent commission was earned on; null for a bulk one (the whole group). */
    bookingReference: zod_1.z.string().nullable(),
    guestName: zod_1.z.string().nullable(),
    /** What the percent was taken of: the room price for the nights stayed. Null for a bulk sum. */
    baseRwf: zod_1.z.number().int().nullable(),
    nightsStayed: zod_1.z.number().int().nullable(),
    commissionRwf: zod_1.z.number().int(),
    injishiRwf: zod_1.z.number().int(),
    brokerRwf: zod_1.z.number().int(),
    /** How much has come off the hotel's payouts so far, and what it still owes. */
    collectedRwf: zod_1.z.number().int(),
    owedRwf: zod_1.z.number().int(),
    status: exports.BrokerCommissionStatus,
    earnedAt: zod_1.z.string(),
    collectedAt: zod_1.z.string().nullable(),
    share: zod_1.z.object({
        status: exports.BrokerShareStatus,
        amountRwf: zod_1.z.number().int(),
        destinationMasked: zod_1.z.string().nullable(),
        paidAt: zod_1.z.string().nullable(),
        failureReason: zod_1.z.string().nullable(),
    }),
});
exports.BrokerCommissionList = zod_1.z.object({
    commissions: zod_1.z.array(exports.BrokerCommission),
    totals: zod_1.z.object({
        /** Still owed by hotels. */
        owedRwf: zod_1.z.number().int(),
        /** Taken off the hotels' payouts. */
        collectedRwf: zod_1.z.number().int(),
        /** Paid to the broker (their 85% of what was collected). */
        paidToBrokerRwf: zod_1.z.number().int(),
    }),
});
/** The MoMo number a broker's commission is paid to. One per broker. */
exports.BrokerPayoutAccount = zod_1.z.object({
    accountName: zod_1.z.string(),
    network: vocab_1.MomoNetwork,
    phoneMasked: zod_1.z.string(),
});
/** `PUT /ops/broker/payout-account`. */
exports.SetBrokerPayoutAccountRequest = zod_1.z.object({
    accountName: zod_1.z.string().trim().min(2, "Give the name on the MoMo account.").max(120, "Keep the name under 120 characters."),
    /** As typed: `0788 123 456` or `+250788123456`; `normalizeRwPhone` reads it, `momoNetworkOf` names its network. */
    phone: zod_1.z.string().trim().min(9, "Give the MoMo number.").max(20, "That number is too long."),
});
//# sourceMappingURL=broker-commissions.js.map