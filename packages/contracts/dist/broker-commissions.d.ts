import { z } from "zod";
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
export declare const BrokerCommissionStatus: z.ZodEnum<["owed", "collected"]>;
export type BrokerCommissionStatus = z.infer<typeof BrokerCommissionStatus>;
/** Where the broker's share is: not yet (still owed), on its way, waiting for a payout number, paid, refused. */
export declare const BrokerShareStatus: z.ZodEnum<["waiting_for_hotel", "held", "queued", "paid", "failed"]>;
export type BrokerShareStatus = z.infer<typeof BrokerShareStatus>;
export declare const BrokerCommission: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<["percent", "bulk_fixed"]>;
    broker: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string | null;
        id: string;
    }, {
        name: string | null;
        id: string;
    }>;
    hotel: z.ZodObject<{
        orgId: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        orgId: string;
    }, {
        name: string;
        orgId: string;
    }>;
    groupReference: z.ZodString;
    /** The booking a percent commission was earned on; null for a bulk one (the whole group). */
    bookingReference: z.ZodNullable<z.ZodString>;
    guestName: z.ZodNullable<z.ZodString>;
    /** What the percent was taken of: the room price for the nights stayed. Null for a bulk sum. */
    baseRwf: z.ZodNullable<z.ZodNumber>;
    nightsStayed: z.ZodNullable<z.ZodNumber>;
    commissionRwf: z.ZodNumber;
    injishiRwf: z.ZodNumber;
    brokerRwf: z.ZodNumber;
    /** How much has come off the hotel's payouts so far, and what it still owes. */
    collectedRwf: z.ZodNumber;
    owedRwf: z.ZodNumber;
    status: z.ZodEnum<["owed", "collected"]>;
    earnedAt: z.ZodString;
    collectedAt: z.ZodNullable<z.ZodString>;
    share: z.ZodObject<{
        status: z.ZodEnum<["waiting_for_hotel", "held", "queued", "paid", "failed"]>;
        amountRwf: z.ZodNumber;
        destinationMasked: z.ZodNullable<z.ZodString>;
        paidAt: z.ZodNullable<z.ZodString>;
        failureReason: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "held" | "failed" | "paid" | "queued" | "waiting_for_hotel";
        amountRwf: number;
        failureReason: string | null;
        paidAt: string | null;
        destinationMasked: string | null;
    }, {
        status: "held" | "failed" | "paid" | "queued" | "waiting_for_hotel";
        amountRwf: number;
        failureReason: string | null;
        paidAt: string | null;
        destinationMasked: string | null;
    }>;
}, "strip", z.ZodTypeAny, {
    status: "owed" | "collected";
    broker: {
        name: string | null;
        id: string;
    };
    hotel: {
        name: string;
        orgId: string;
    };
    id: string;
    kind: "percent" | "bulk_fixed";
    guestName: string | null;
    commissionRwf: number;
    brokerRwf: number;
    injishiRwf: number;
    groupReference: string;
    bookingReference: string | null;
    baseRwf: number | null;
    nightsStayed: number | null;
    collectedRwf: number;
    owedRwf: number;
    earnedAt: string;
    collectedAt: string | null;
    share: {
        status: "held" | "failed" | "paid" | "queued" | "waiting_for_hotel";
        amountRwf: number;
        failureReason: string | null;
        paidAt: string | null;
        destinationMasked: string | null;
    };
}, {
    status: "owed" | "collected";
    broker: {
        name: string | null;
        id: string;
    };
    hotel: {
        name: string;
        orgId: string;
    };
    id: string;
    kind: "percent" | "bulk_fixed";
    guestName: string | null;
    commissionRwf: number;
    brokerRwf: number;
    injishiRwf: number;
    groupReference: string;
    bookingReference: string | null;
    baseRwf: number | null;
    nightsStayed: number | null;
    collectedRwf: number;
    owedRwf: number;
    earnedAt: string;
    collectedAt: string | null;
    share: {
        status: "held" | "failed" | "paid" | "queued" | "waiting_for_hotel";
        amountRwf: number;
        failureReason: string | null;
        paidAt: string | null;
        destinationMasked: string | null;
    };
}>;
export type BrokerCommission = z.infer<typeof BrokerCommission>;
export declare const BrokerCommissionList: z.ZodObject<{
    commissions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<["percent", "bulk_fixed"]>;
        broker: z.ZodObject<{
            id: z.ZodString;
            name: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            name: string | null;
            id: string;
        }, {
            name: string | null;
            id: string;
        }>;
        hotel: z.ZodObject<{
            orgId: z.ZodString;
            name: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            orgId: string;
        }, {
            name: string;
            orgId: string;
        }>;
        groupReference: z.ZodString;
        /** The booking a percent commission was earned on; null for a bulk one (the whole group). */
        bookingReference: z.ZodNullable<z.ZodString>;
        guestName: z.ZodNullable<z.ZodString>;
        /** What the percent was taken of: the room price for the nights stayed. Null for a bulk sum. */
        baseRwf: z.ZodNullable<z.ZodNumber>;
        nightsStayed: z.ZodNullable<z.ZodNumber>;
        commissionRwf: z.ZodNumber;
        injishiRwf: z.ZodNumber;
        brokerRwf: z.ZodNumber;
        /** How much has come off the hotel's payouts so far, and what it still owes. */
        collectedRwf: z.ZodNumber;
        owedRwf: z.ZodNumber;
        status: z.ZodEnum<["owed", "collected"]>;
        earnedAt: z.ZodString;
        collectedAt: z.ZodNullable<z.ZodString>;
        share: z.ZodObject<{
            status: z.ZodEnum<["waiting_for_hotel", "held", "queued", "paid", "failed"]>;
            amountRwf: z.ZodNumber;
            destinationMasked: z.ZodNullable<z.ZodString>;
            paidAt: z.ZodNullable<z.ZodString>;
            failureReason: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            status: "held" | "failed" | "paid" | "queued" | "waiting_for_hotel";
            amountRwf: number;
            failureReason: string | null;
            paidAt: string | null;
            destinationMasked: string | null;
        }, {
            status: "held" | "failed" | "paid" | "queued" | "waiting_for_hotel";
            amountRwf: number;
            failureReason: string | null;
            paidAt: string | null;
            destinationMasked: string | null;
        }>;
    }, "strip", z.ZodTypeAny, {
        status: "owed" | "collected";
        broker: {
            name: string | null;
            id: string;
        };
        hotel: {
            name: string;
            orgId: string;
        };
        id: string;
        kind: "percent" | "bulk_fixed";
        guestName: string | null;
        commissionRwf: number;
        brokerRwf: number;
        injishiRwf: number;
        groupReference: string;
        bookingReference: string | null;
        baseRwf: number | null;
        nightsStayed: number | null;
        collectedRwf: number;
        owedRwf: number;
        earnedAt: string;
        collectedAt: string | null;
        share: {
            status: "held" | "failed" | "paid" | "queued" | "waiting_for_hotel";
            amountRwf: number;
            failureReason: string | null;
            paidAt: string | null;
            destinationMasked: string | null;
        };
    }, {
        status: "owed" | "collected";
        broker: {
            name: string | null;
            id: string;
        };
        hotel: {
            name: string;
            orgId: string;
        };
        id: string;
        kind: "percent" | "bulk_fixed";
        guestName: string | null;
        commissionRwf: number;
        brokerRwf: number;
        injishiRwf: number;
        groupReference: string;
        bookingReference: string | null;
        baseRwf: number | null;
        nightsStayed: number | null;
        collectedRwf: number;
        owedRwf: number;
        earnedAt: string;
        collectedAt: string | null;
        share: {
            status: "held" | "failed" | "paid" | "queued" | "waiting_for_hotel";
            amountRwf: number;
            failureReason: string | null;
            paidAt: string | null;
            destinationMasked: string | null;
        };
    }>, "many">;
    totals: z.ZodObject<{
        /** Still owed by hotels. */
        owedRwf: z.ZodNumber;
        /** Taken off the hotels' payouts. */
        collectedRwf: z.ZodNumber;
        /** Paid to the broker (their 85% of what was collected). */
        paidToBrokerRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        collectedRwf: number;
        owedRwf: number;
        paidToBrokerRwf: number;
    }, {
        collectedRwf: number;
        owedRwf: number;
        paidToBrokerRwf: number;
    }>;
}, "strip", z.ZodTypeAny, {
    totals: {
        collectedRwf: number;
        owedRwf: number;
        paidToBrokerRwf: number;
    };
    commissions: {
        status: "owed" | "collected";
        broker: {
            name: string | null;
            id: string;
        };
        hotel: {
            name: string;
            orgId: string;
        };
        id: string;
        kind: "percent" | "bulk_fixed";
        guestName: string | null;
        commissionRwf: number;
        brokerRwf: number;
        injishiRwf: number;
        groupReference: string;
        bookingReference: string | null;
        baseRwf: number | null;
        nightsStayed: number | null;
        collectedRwf: number;
        owedRwf: number;
        earnedAt: string;
        collectedAt: string | null;
        share: {
            status: "held" | "failed" | "paid" | "queued" | "waiting_for_hotel";
            amountRwf: number;
            failureReason: string | null;
            paidAt: string | null;
            destinationMasked: string | null;
        };
    }[];
}, {
    totals: {
        collectedRwf: number;
        owedRwf: number;
        paidToBrokerRwf: number;
    };
    commissions: {
        status: "owed" | "collected";
        broker: {
            name: string | null;
            id: string;
        };
        hotel: {
            name: string;
            orgId: string;
        };
        id: string;
        kind: "percent" | "bulk_fixed";
        guestName: string | null;
        commissionRwf: number;
        brokerRwf: number;
        injishiRwf: number;
        groupReference: string;
        bookingReference: string | null;
        baseRwf: number | null;
        nightsStayed: number | null;
        collectedRwf: number;
        owedRwf: number;
        earnedAt: string;
        collectedAt: string | null;
        share: {
            status: "held" | "failed" | "paid" | "queued" | "waiting_for_hotel";
            amountRwf: number;
            failureReason: string | null;
            paidAt: string | null;
            destinationMasked: string | null;
        };
    }[];
}>;
export type BrokerCommissionList = z.infer<typeof BrokerCommissionList>;
/** The MoMo number a broker's commission is paid to. One per broker. */
export declare const BrokerPayoutAccount: z.ZodObject<{
    accountName: z.ZodString;
    network: z.ZodEnum<["mtn", "airtel"]>;
    phoneMasked: z.ZodString;
}, "strip", z.ZodTypeAny, {
    network: "mtn" | "airtel";
    phoneMasked: string;
    accountName: string;
}, {
    network: "mtn" | "airtel";
    phoneMasked: string;
    accountName: string;
}>;
export type BrokerPayoutAccount = z.infer<typeof BrokerPayoutAccount>;
/** `PUT /ops/broker/payout-account`. */
export declare const SetBrokerPayoutAccountRequest: z.ZodObject<{
    accountName: z.ZodString;
    /** As typed: `0788 123 456` or `+250788123456`; `normalizeRwPhone` reads it, `momoNetworkOf` names its network. */
    phone: z.ZodString;
}, "strip", z.ZodTypeAny, {
    phone: string;
    accountName: string;
}, {
    phone: string;
    accountName: string;
}>;
export type SetBrokerPayoutAccountRequest = z.infer<typeof SetBrokerPayoutAccountRequest>;
//# sourceMappingURL=broker-commissions.d.ts.map