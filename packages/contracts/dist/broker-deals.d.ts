import { z } from "zod";
/**
 * A broker's deal with a hotel (2026-11-02, the owner's call): the broker brings
 * the hotel bookings, and the hotel pays the broker a commission on the stays
 * those bookings become.
 *
 * Two kinds of commission:
 * - `percent`: a share of what the guest paid for the room, on every booking
 *   the broker makes there ("10% of each booking");
 * - `bulk_fixed`: one sum for a booking of at least so many rooms at once
 *   ("RWF 200,000 for a booking of 10 rooms or more").
 *
 * The broker proposes, the hotel's owner accepts or declines, and either side
 * may end a deal that is running. A broker and a hotel have at most one deal
 * that is proposed or running at a time.
 *
 * Injishi takes `BROKER_COMMISSION_INJISHI_SHARE` of every commission and the
 * broker gets the rest. The money itself (the commission taken off the hotel's
 * payout at check-out, or billed when there is no payout) is the next phase;
 * a deal says the terms both sides agreed.
 */
/** Injishi's share of a commission: 15% of what the hotel pays the broker. */
export declare const BROKER_COMMISSION_INJISHI_SHARE = 0.15;
export declare const BrokerDealKind: z.ZodEnum<["percent", "bulk_fixed"]>;
export type BrokerDealKind = z.infer<typeof BrokerDealKind>;
/**
 * - `proposed`: the broker asked, the hotel has not answered;
 * - `active`: the hotel accepted, and it runs until it ends;
 * - `declined`: the hotel said no;
 * - `withdrawn`: the broker took a proposal back before the hotel answered;
 * - `ended`: one side ended a running deal, or its end date passed.
 */
export declare const BrokerDealStatus: z.ZodEnum<["proposed", "active", "declined", "withdrawn", "ended"]>;
export type BrokerDealStatus = z.infer<typeof BrokerDealStatus>;
/** The deal statuses that still bind a pair: a second deal waits until this one is over. */
export declare const BROKER_DEAL_LIVE_STATUSES: readonly ["proposed", "active"];
/** The lowest and highest commission a percent deal may carry, in percent. */
export declare const BROKER_DEAL_PERCENT_MIN = 1;
export declare const BROKER_DEAL_PERCENT_MAX = 30;
export declare const BrokerDealTerms: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
    kind: z.ZodLiteral<"percent">;
    /** Of what the guest paid for the room. Steps of half a percent: 7.5 is fine, 7.25 is not. */
    percent: z.ZodEffects<z.ZodNumber, number, number>;
}, "strip", z.ZodTypeAny, {
    kind: "percent";
    percent: number;
}, {
    kind: "percent";
    percent: number;
}>, z.ZodObject<{
    kind: z.ZodLiteral<"bulk_fixed">;
    /** One sum for the whole booking, whole francs. */
    amountRwf: z.ZodNumber;
    /** The fewest rooms booked together that count as a bulk booking. */
    minRooms: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    kind: "bulk_fixed";
    amountRwf: number;
    minRooms: number;
}, {
    kind: "bulk_fixed";
    amountRwf: number;
    minRooms: number;
}>]>;
export type BrokerDealTerms = z.infer<typeof BrokerDealTerms>;
/** `POST /ops/broker/hotels/:orgId/deals`: the broker proposes a deal to a hotel. */
export declare const ProposeBrokerDealRequest: z.ZodEffects<z.ZodObject<{
    terms: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
        kind: z.ZodLiteral<"percent">;
        /** Of what the guest paid for the room. Steps of half a percent: 7.5 is fine, 7.25 is not. */
        percent: z.ZodEffects<z.ZodNumber, number, number>;
    }, "strip", z.ZodTypeAny, {
        kind: "percent";
        percent: number;
    }, {
        kind: "percent";
        percent: number;
    }>, z.ZodObject<{
        kind: z.ZodLiteral<"bulk_fixed">;
        /** One sum for the whole booking, whole francs. */
        amountRwf: z.ZodNumber;
        /** The fewest rooms booked together that count as a bulk booking. */
        minRooms: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        kind: "bulk_fixed";
        amountRwf: number;
        minRooms: number;
    }, {
        kind: "bulk_fixed";
        amountRwf: number;
        minRooms: number;
    }>]>;
    /** Null: from the day the hotel accepts. */
    startsOn: z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>>;
    /** Null: until one side ends it. */
    endsOn: z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>>;
    /** What the broker wants the hotel to know: who they bring, how many, when. */
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    terms: {
        kind: "percent";
        percent: number;
    } | {
        kind: "bulk_fixed";
        amountRwf: number;
        minRooms: number;
    };
    startsOn?: string | null | undefined;
    note?: string | null | undefined;
    endsOn?: string | null | undefined;
}, {
    terms: {
        kind: "percent";
        percent: number;
    } | {
        kind: "bulk_fixed";
        amountRwf: number;
        minRooms: number;
    };
    startsOn?: string | null | undefined;
    note?: string | null | undefined;
    endsOn?: string | null | undefined;
}>, {
    terms: {
        kind: "percent";
        percent: number;
    } | {
        kind: "bulk_fixed";
        amountRwf: number;
        minRooms: number;
    };
    startsOn?: string | null | undefined;
    note?: string | null | undefined;
    endsOn?: string | null | undefined;
}, {
    terms: {
        kind: "percent";
        percent: number;
    } | {
        kind: "bulk_fixed";
        amountRwf: number;
        minRooms: number;
    };
    startsOn?: string | null | undefined;
    note?: string | null | undefined;
    endsOn?: string | null | undefined;
}>;
export type ProposeBrokerDealRequest = z.infer<typeof ProposeBrokerDealRequest>;
/** `POST /ops/broker-deals/:id/decision`: the hotel accepts or declines a proposal. */
export declare const DecideBrokerDealRequest: z.ZodObject<{
    decision: z.ZodEnum<["accept", "decline"]>;
    /** Said to the broker; most useful with a decline. */
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    decision: "decline" | "accept";
    note?: string | null | undefined;
}, {
    decision: "decline" | "accept";
    note?: string | null | undefined;
}>;
export type DecideBrokerDealRequest = z.infer<typeof DecideBrokerDealRequest>;
/** `POST …/deals/:id/end` (either side) and `…/withdraw` (the broker): why, said to the other side. */
export declare const EndBrokerDealRequest: z.ZodObject<{
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    note?: string | null | undefined;
}, {
    note?: string | null | undefined;
}>;
export type EndBrokerDealRequest = z.infer<typeof EndBrokerDealRequest>;
/** One deal, as either side reads it. */
export declare const BrokerDeal: z.ZodObject<{
    id: z.ZodString;
    status: z.ZodEnum<["proposed", "active", "declined", "withdrawn", "ended"]>;
    terms: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
        kind: z.ZodLiteral<"percent">;
        /** Of what the guest paid for the room. Steps of half a percent: 7.5 is fine, 7.25 is not. */
        percent: z.ZodEffects<z.ZodNumber, number, number>;
    }, "strip", z.ZodTypeAny, {
        kind: "percent";
        percent: number;
    }, {
        kind: "percent";
        percent: number;
    }>, z.ZodObject<{
        kind: z.ZodLiteral<"bulk_fixed">;
        /** One sum for the whole booking, whole francs. */
        amountRwf: z.ZodNumber;
        /** The fewest rooms booked together that count as a bulk booking. */
        minRooms: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        kind: "bulk_fixed";
        amountRwf: number;
        minRooms: number;
    }, {
        kind: "bulk_fixed";
        amountRwf: number;
        minRooms: number;
    }>]>;
    startsOn: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
    endsOn: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
    /** The broker's note with the proposal. */
    note: z.ZodNullable<z.ZodString>;
    broker: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodNullable<z.ZodString>;
        /** Shown to the hotel, so it can call the broker before answering. */
        phone: z.ZodNullable<z.ZodString>;
        email: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string | null;
        id: string;
        email: string | null;
        phone: string | null;
    }, {
        name: string | null;
        id: string;
        email: string | null;
        phone: string | null;
    }>;
    hotel: z.ZodObject<{
        orgId: z.ZodString;
        name: z.ZodString;
        district: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        district: string | null;
        name: string;
        orgId: string;
    }, {
        district: string | null;
        name: string;
        orgId: string;
    }>;
    proposedAt: z.ZodString;
    /** When the hotel accepted or declined, and what it said. */
    decidedAt: z.ZodNullable<z.ZodString>;
    decisionNote: z.ZodNullable<z.ZodString>;
    /** When it was withdrawn or ended, by which side, and why. */
    closedAt: z.ZodNullable<z.ZodString>;
    closedBy: z.ZodNullable<z.ZodEnum<["broker", "hotel"]>>;
    closeNote: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "declined" | "withdrawn" | "proposed" | "ended";
    broker: {
        name: string | null;
        id: string;
        email: string | null;
        phone: string | null;
    };
    hotel: {
        district: string | null;
        name: string;
        orgId: string;
    };
    id: string;
    decidedAt: string | null;
    startsOn: string | null;
    decisionNote: string | null;
    note: string | null;
    closedAt: string | null;
    terms: {
        kind: "percent";
        percent: number;
    } | {
        kind: "bulk_fixed";
        amountRwf: number;
        minRooms: number;
    };
    endsOn: string | null;
    proposedAt: string;
    closedBy: "broker" | "hotel" | null;
    closeNote: string | null;
}, {
    status: "active" | "declined" | "withdrawn" | "proposed" | "ended";
    broker: {
        name: string | null;
        id: string;
        email: string | null;
        phone: string | null;
    };
    hotel: {
        district: string | null;
        name: string;
        orgId: string;
    };
    id: string;
    decidedAt: string | null;
    startsOn: string | null;
    decisionNote: string | null;
    note: string | null;
    closedAt: string | null;
    terms: {
        kind: "percent";
        percent: number;
    } | {
        kind: "bulk_fixed";
        amountRwf: number;
        minRooms: number;
    };
    endsOn: string | null;
    proposedAt: string;
    closedBy: "broker" | "hotel" | null;
    closeNote: string | null;
}>;
export type BrokerDeal = z.infer<typeof BrokerDeal>;
export declare const BrokerDealList: z.ZodObject<{
    deals: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        status: z.ZodEnum<["proposed", "active", "declined", "withdrawn", "ended"]>;
        terms: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
            kind: z.ZodLiteral<"percent">;
            /** Of what the guest paid for the room. Steps of half a percent: 7.5 is fine, 7.25 is not. */
            percent: z.ZodEffects<z.ZodNumber, number, number>;
        }, "strip", z.ZodTypeAny, {
            kind: "percent";
            percent: number;
        }, {
            kind: "percent";
            percent: number;
        }>, z.ZodObject<{
            kind: z.ZodLiteral<"bulk_fixed">;
            /** One sum for the whole booking, whole francs. */
            amountRwf: z.ZodNumber;
            /** The fewest rooms booked together that count as a bulk booking. */
            minRooms: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            kind: "bulk_fixed";
            amountRwf: number;
            minRooms: number;
        }, {
            kind: "bulk_fixed";
            amountRwf: number;
            minRooms: number;
        }>]>;
        startsOn: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
        endsOn: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
        /** The broker's note with the proposal. */
        note: z.ZodNullable<z.ZodString>;
        broker: z.ZodObject<{
            id: z.ZodString;
            name: z.ZodNullable<z.ZodString>;
            /** Shown to the hotel, so it can call the broker before answering. */
            phone: z.ZodNullable<z.ZodString>;
            email: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            name: string | null;
            id: string;
            email: string | null;
            phone: string | null;
        }, {
            name: string | null;
            id: string;
            email: string | null;
            phone: string | null;
        }>;
        hotel: z.ZodObject<{
            orgId: z.ZodString;
            name: z.ZodString;
            district: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            district: string | null;
            name: string;
            orgId: string;
        }, {
            district: string | null;
            name: string;
            orgId: string;
        }>;
        proposedAt: z.ZodString;
        /** When the hotel accepted or declined, and what it said. */
        decidedAt: z.ZodNullable<z.ZodString>;
        decisionNote: z.ZodNullable<z.ZodString>;
        /** When it was withdrawn or ended, by which side, and why. */
        closedAt: z.ZodNullable<z.ZodString>;
        closedBy: z.ZodNullable<z.ZodEnum<["broker", "hotel"]>>;
        closeNote: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "declined" | "withdrawn" | "proposed" | "ended";
        broker: {
            name: string | null;
            id: string;
            email: string | null;
            phone: string | null;
        };
        hotel: {
            district: string | null;
            name: string;
            orgId: string;
        };
        id: string;
        decidedAt: string | null;
        startsOn: string | null;
        decisionNote: string | null;
        note: string | null;
        closedAt: string | null;
        terms: {
            kind: "percent";
            percent: number;
        } | {
            kind: "bulk_fixed";
            amountRwf: number;
            minRooms: number;
        };
        endsOn: string | null;
        proposedAt: string;
        closedBy: "broker" | "hotel" | null;
        closeNote: string | null;
    }, {
        status: "active" | "declined" | "withdrawn" | "proposed" | "ended";
        broker: {
            name: string | null;
            id: string;
            email: string | null;
            phone: string | null;
        };
        hotel: {
            district: string | null;
            name: string;
            orgId: string;
        };
        id: string;
        decidedAt: string | null;
        startsOn: string | null;
        decisionNote: string | null;
        note: string | null;
        closedAt: string | null;
        terms: {
            kind: "percent";
            percent: number;
        } | {
            kind: "bulk_fixed";
            amountRwf: number;
            minRooms: number;
        };
        endsOn: string | null;
        proposedAt: string;
        closedBy: "broker" | "hotel" | null;
        closeNote: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    deals: {
        status: "active" | "declined" | "withdrawn" | "proposed" | "ended";
        broker: {
            name: string | null;
            id: string;
            email: string | null;
            phone: string | null;
        };
        hotel: {
            district: string | null;
            name: string;
            orgId: string;
        };
        id: string;
        decidedAt: string | null;
        startsOn: string | null;
        decisionNote: string | null;
        note: string | null;
        closedAt: string | null;
        terms: {
            kind: "percent";
            percent: number;
        } | {
            kind: "bulk_fixed";
            amountRwf: number;
            minRooms: number;
        };
        endsOn: string | null;
        proposedAt: string;
        closedBy: "broker" | "hotel" | null;
        closeNote: string | null;
    }[];
}, {
    deals: {
        status: "active" | "declined" | "withdrawn" | "proposed" | "ended";
        broker: {
            name: string | null;
            id: string;
            email: string | null;
            phone: string | null;
        };
        hotel: {
            district: string | null;
            name: string;
            orgId: string;
        };
        id: string;
        decidedAt: string | null;
        startsOn: string | null;
        decisionNote: string | null;
        note: string | null;
        closedAt: string | null;
        terms: {
            kind: "percent";
            percent: number;
        } | {
            kind: "bulk_fixed";
            amountRwf: number;
            minRooms: number;
        };
        endsOn: string | null;
        proposedAt: string;
        closedBy: "broker" | "hotel" | null;
        closeNote: string | null;
    }[];
}>;
export type BrokerDealList = z.infer<typeof BrokerDealList>;
/** One hotel a broker may propose a deal to: running, listed, inside the plan's area. */
export declare const BrokerHotel: z.ZodObject<{
    orgId: z.ZodString;
    name: z.ZodString;
    /** "Hotel", "Lodge", "Guest house"… */
    kindLabel: z.ZodNullable<z.ZodString>;
    /** Confirmed by Injishi staff; null until then. */
    stars: z.ZodNullable<z.ZodNumber>;
    district: z.ZodNullable<z.ZodString>;
    sector: z.ZodNullable<z.ZodString>;
    /** The room types on offer. */
    roomTypes: z.ZodNumber;
    /** The lowest nightly price, whole francs; null when none is set. */
    fromRwf: z.ZodNullable<z.ZodNumber>;
    /** This broker's proposed or running deal with the hotel, if any. */
    deal: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        status: z.ZodEnum<["proposed", "active", "declined", "withdrawn", "ended"]>;
        terms: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
            kind: z.ZodLiteral<"percent">;
            /** Of what the guest paid for the room. Steps of half a percent: 7.5 is fine, 7.25 is not. */
            percent: z.ZodEffects<z.ZodNumber, number, number>;
        }, "strip", z.ZodTypeAny, {
            kind: "percent";
            percent: number;
        }, {
            kind: "percent";
            percent: number;
        }>, z.ZodObject<{
            kind: z.ZodLiteral<"bulk_fixed">;
            /** One sum for the whole booking, whole francs. */
            amountRwf: z.ZodNumber;
            /** The fewest rooms booked together that count as a bulk booking. */
            minRooms: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            kind: "bulk_fixed";
            amountRwf: number;
            minRooms: number;
        }, {
            kind: "bulk_fixed";
            amountRwf: number;
            minRooms: number;
        }>]>;
        startsOn: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
        endsOn: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
        /** The broker's note with the proposal. */
        note: z.ZodNullable<z.ZodString>;
        broker: z.ZodObject<{
            id: z.ZodString;
            name: z.ZodNullable<z.ZodString>;
            /** Shown to the hotel, so it can call the broker before answering. */
            phone: z.ZodNullable<z.ZodString>;
            email: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            name: string | null;
            id: string;
            email: string | null;
            phone: string | null;
        }, {
            name: string | null;
            id: string;
            email: string | null;
            phone: string | null;
        }>;
        hotel: z.ZodObject<{
            orgId: z.ZodString;
            name: z.ZodString;
            district: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            district: string | null;
            name: string;
            orgId: string;
        }, {
            district: string | null;
            name: string;
            orgId: string;
        }>;
        proposedAt: z.ZodString;
        /** When the hotel accepted or declined, and what it said. */
        decidedAt: z.ZodNullable<z.ZodString>;
        decisionNote: z.ZodNullable<z.ZodString>;
        /** When it was withdrawn or ended, by which side, and why. */
        closedAt: z.ZodNullable<z.ZodString>;
        closedBy: z.ZodNullable<z.ZodEnum<["broker", "hotel"]>>;
        closeNote: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "declined" | "withdrawn" | "proposed" | "ended";
        broker: {
            name: string | null;
            id: string;
            email: string | null;
            phone: string | null;
        };
        hotel: {
            district: string | null;
            name: string;
            orgId: string;
        };
        id: string;
        decidedAt: string | null;
        startsOn: string | null;
        decisionNote: string | null;
        note: string | null;
        closedAt: string | null;
        terms: {
            kind: "percent";
            percent: number;
        } | {
            kind: "bulk_fixed";
            amountRwf: number;
            minRooms: number;
        };
        endsOn: string | null;
        proposedAt: string;
        closedBy: "broker" | "hotel" | null;
        closeNote: string | null;
    }, {
        status: "active" | "declined" | "withdrawn" | "proposed" | "ended";
        broker: {
            name: string | null;
            id: string;
            email: string | null;
            phone: string | null;
        };
        hotel: {
            district: string | null;
            name: string;
            orgId: string;
        };
        id: string;
        decidedAt: string | null;
        startsOn: string | null;
        decisionNote: string | null;
        note: string | null;
        closedAt: string | null;
        terms: {
            kind: "percent";
            percent: number;
        } | {
            kind: "bulk_fixed";
            amountRwf: number;
            minRooms: number;
        };
        endsOn: string | null;
        proposedAt: string;
        closedBy: "broker" | "hotel" | null;
        closeNote: string | null;
    }>>;
}, "strip", z.ZodTypeAny, {
    district: string | null;
    sector: string | null;
    name: string;
    orgId: string;
    roomTypes: number;
    kindLabel: string | null;
    stars: number | null;
    fromRwf: number | null;
    deal: {
        status: "active" | "declined" | "withdrawn" | "proposed" | "ended";
        broker: {
            name: string | null;
            id: string;
            email: string | null;
            phone: string | null;
        };
        hotel: {
            district: string | null;
            name: string;
            orgId: string;
        };
        id: string;
        decidedAt: string | null;
        startsOn: string | null;
        decisionNote: string | null;
        note: string | null;
        closedAt: string | null;
        terms: {
            kind: "percent";
            percent: number;
        } | {
            kind: "bulk_fixed";
            amountRwf: number;
            minRooms: number;
        };
        endsOn: string | null;
        proposedAt: string;
        closedBy: "broker" | "hotel" | null;
        closeNote: string | null;
    } | null;
}, {
    district: string | null;
    sector: string | null;
    name: string;
    orgId: string;
    roomTypes: number;
    kindLabel: string | null;
    stars: number | null;
    fromRwf: number | null;
    deal: {
        status: "active" | "declined" | "withdrawn" | "proposed" | "ended";
        broker: {
            name: string | null;
            id: string;
            email: string | null;
            phone: string | null;
        };
        hotel: {
            district: string | null;
            name: string;
            orgId: string;
        };
        id: string;
        decidedAt: string | null;
        startsOn: string | null;
        decisionNote: string | null;
        note: string | null;
        closedAt: string | null;
        terms: {
            kind: "percent";
            percent: number;
        } | {
            kind: "bulk_fixed";
            amountRwf: number;
            minRooms: number;
        };
        endsOn: string | null;
        proposedAt: string;
        closedBy: "broker" | "hotel" | null;
        closeNote: string | null;
    } | null;
}>;
export type BrokerHotel = z.infer<typeof BrokerHotel>;
/** `GET /ops/broker/hotels`. */
export declare const BrokerHotels: z.ZodObject<{
    brokerStatus: z.ZodEnum<["active", "suspended"]>;
    hotels: z.ZodArray<z.ZodObject<{
        orgId: z.ZodString;
        name: z.ZodString;
        /** "Hotel", "Lodge", "Guest house"… */
        kindLabel: z.ZodNullable<z.ZodString>;
        /** Confirmed by Injishi staff; null until then. */
        stars: z.ZodNullable<z.ZodNumber>;
        district: z.ZodNullable<z.ZodString>;
        sector: z.ZodNullable<z.ZodString>;
        /** The room types on offer. */
        roomTypes: z.ZodNumber;
        /** The lowest nightly price, whole francs; null when none is set. */
        fromRwf: z.ZodNullable<z.ZodNumber>;
        /** This broker's proposed or running deal with the hotel, if any. */
        deal: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            status: z.ZodEnum<["proposed", "active", "declined", "withdrawn", "ended"]>;
            terms: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
                kind: z.ZodLiteral<"percent">;
                /** Of what the guest paid for the room. Steps of half a percent: 7.5 is fine, 7.25 is not. */
                percent: z.ZodEffects<z.ZodNumber, number, number>;
            }, "strip", z.ZodTypeAny, {
                kind: "percent";
                percent: number;
            }, {
                kind: "percent";
                percent: number;
            }>, z.ZodObject<{
                kind: z.ZodLiteral<"bulk_fixed">;
                /** One sum for the whole booking, whole francs. */
                amountRwf: z.ZodNumber;
                /** The fewest rooms booked together that count as a bulk booking. */
                minRooms: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                kind: "bulk_fixed";
                amountRwf: number;
                minRooms: number;
            }, {
                kind: "bulk_fixed";
                amountRwf: number;
                minRooms: number;
            }>]>;
            startsOn: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
            endsOn: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
            /** The broker's note with the proposal. */
            note: z.ZodNullable<z.ZodString>;
            broker: z.ZodObject<{
                id: z.ZodString;
                name: z.ZodNullable<z.ZodString>;
                /** Shown to the hotel, so it can call the broker before answering. */
                phone: z.ZodNullable<z.ZodString>;
                email: z.ZodNullable<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                name: string | null;
                id: string;
                email: string | null;
                phone: string | null;
            }, {
                name: string | null;
                id: string;
                email: string | null;
                phone: string | null;
            }>;
            hotel: z.ZodObject<{
                orgId: z.ZodString;
                name: z.ZodString;
                district: z.ZodNullable<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                district: string | null;
                name: string;
                orgId: string;
            }, {
                district: string | null;
                name: string;
                orgId: string;
            }>;
            proposedAt: z.ZodString;
            /** When the hotel accepted or declined, and what it said. */
            decidedAt: z.ZodNullable<z.ZodString>;
            decisionNote: z.ZodNullable<z.ZodString>;
            /** When it was withdrawn or ended, by which side, and why. */
            closedAt: z.ZodNullable<z.ZodString>;
            closedBy: z.ZodNullable<z.ZodEnum<["broker", "hotel"]>>;
            closeNote: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            status: "active" | "declined" | "withdrawn" | "proposed" | "ended";
            broker: {
                name: string | null;
                id: string;
                email: string | null;
                phone: string | null;
            };
            hotel: {
                district: string | null;
                name: string;
                orgId: string;
            };
            id: string;
            decidedAt: string | null;
            startsOn: string | null;
            decisionNote: string | null;
            note: string | null;
            closedAt: string | null;
            terms: {
                kind: "percent";
                percent: number;
            } | {
                kind: "bulk_fixed";
                amountRwf: number;
                minRooms: number;
            };
            endsOn: string | null;
            proposedAt: string;
            closedBy: "broker" | "hotel" | null;
            closeNote: string | null;
        }, {
            status: "active" | "declined" | "withdrawn" | "proposed" | "ended";
            broker: {
                name: string | null;
                id: string;
                email: string | null;
                phone: string | null;
            };
            hotel: {
                district: string | null;
                name: string;
                orgId: string;
            };
            id: string;
            decidedAt: string | null;
            startsOn: string | null;
            decisionNote: string | null;
            note: string | null;
            closedAt: string | null;
            terms: {
                kind: "percent";
                percent: number;
            } | {
                kind: "bulk_fixed";
                amountRwf: number;
                minRooms: number;
            };
            endsOn: string | null;
            proposedAt: string;
            closedBy: "broker" | "hotel" | null;
            closeNote: string | null;
        }>>;
    }, "strip", z.ZodTypeAny, {
        district: string | null;
        sector: string | null;
        name: string;
        orgId: string;
        roomTypes: number;
        kindLabel: string | null;
        stars: number | null;
        fromRwf: number | null;
        deal: {
            status: "active" | "declined" | "withdrawn" | "proposed" | "ended";
            broker: {
                name: string | null;
                id: string;
                email: string | null;
                phone: string | null;
            };
            hotel: {
                district: string | null;
                name: string;
                orgId: string;
            };
            id: string;
            decidedAt: string | null;
            startsOn: string | null;
            decisionNote: string | null;
            note: string | null;
            closedAt: string | null;
            terms: {
                kind: "percent";
                percent: number;
            } | {
                kind: "bulk_fixed";
                amountRwf: number;
                minRooms: number;
            };
            endsOn: string | null;
            proposedAt: string;
            closedBy: "broker" | "hotel" | null;
            closeNote: string | null;
        } | null;
    }, {
        district: string | null;
        sector: string | null;
        name: string;
        orgId: string;
        roomTypes: number;
        kindLabel: string | null;
        stars: number | null;
        fromRwf: number | null;
        deal: {
            status: "active" | "declined" | "withdrawn" | "proposed" | "ended";
            broker: {
                name: string | null;
                id: string;
                email: string | null;
                phone: string | null;
            };
            hotel: {
                district: string | null;
                name: string;
                orgId: string;
            };
            id: string;
            decidedAt: string | null;
            startsOn: string | null;
            decisionNote: string | null;
            note: string | null;
            closedAt: string | null;
            terms: {
                kind: "percent";
                percent: number;
            } | {
                kind: "bulk_fixed";
                amountRwf: number;
                minRooms: number;
            };
            endsOn: string | null;
            proposedAt: string;
            closedBy: "broker" | "hotel" | null;
            closeNote: string | null;
        } | null;
    }>, "many">;
    scope: z.ZodObject<{
        plan: z.ZodEnum<["district", "province", "country"]>;
        area: z.ZodString;
        districtId: z.ZodNullable<z.ZodNumber>;
        provinceId: z.ZodNullable<z.ZodNumber>;
        needsDistrict: z.ZodBoolean;
        upgrade: z.ZodNullable<z.ZodObject<{
            plan: z.ZodEnum<["district", "province", "country"]>;
            area: z.ZodString;
            priceRwf: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            priceRwf: number;
            area: string;
            plan: "country" | "province" | "district";
        }, {
            priceRwf: number;
            area: string;
            plan: "country" | "province" | "district";
        }>>;
    }, "strip", z.ZodTypeAny, {
        provinceId: number | null;
        districtId: number | null;
        area: string;
        plan: "country" | "province" | "district";
        needsDistrict: boolean;
        upgrade: {
            priceRwf: number;
            area: string;
            plan: "country" | "province" | "district";
        } | null;
    }, {
        provinceId: number | null;
        districtId: number | null;
        area: string;
        plan: "country" | "province" | "district";
        needsDistrict: boolean;
        upgrade: {
            priceRwf: number;
            area: string;
            plan: "country" | "province" | "district";
        } | null;
    }>;
}, "strip", z.ZodTypeAny, {
    scope: {
        provinceId: number | null;
        districtId: number | null;
        area: string;
        plan: "country" | "province" | "district";
        needsDistrict: boolean;
        upgrade: {
            priceRwf: number;
            area: string;
            plan: "country" | "province" | "district";
        } | null;
    };
    brokerStatus: "active" | "suspended";
    hotels: {
        district: string | null;
        sector: string | null;
        name: string;
        orgId: string;
        roomTypes: number;
        kindLabel: string | null;
        stars: number | null;
        fromRwf: number | null;
        deal: {
            status: "active" | "declined" | "withdrawn" | "proposed" | "ended";
            broker: {
                name: string | null;
                id: string;
                email: string | null;
                phone: string | null;
            };
            hotel: {
                district: string | null;
                name: string;
                orgId: string;
            };
            id: string;
            decidedAt: string | null;
            startsOn: string | null;
            decisionNote: string | null;
            note: string | null;
            closedAt: string | null;
            terms: {
                kind: "percent";
                percent: number;
            } | {
                kind: "bulk_fixed";
                amountRwf: number;
                minRooms: number;
            };
            endsOn: string | null;
            proposedAt: string;
            closedBy: "broker" | "hotel" | null;
            closeNote: string | null;
        } | null;
    }[];
}, {
    scope: {
        provinceId: number | null;
        districtId: number | null;
        area: string;
        plan: "country" | "province" | "district";
        needsDistrict: boolean;
        upgrade: {
            priceRwf: number;
            area: string;
            plan: "country" | "province" | "district";
        } | null;
    };
    brokerStatus: "active" | "suspended";
    hotels: {
        district: string | null;
        sector: string | null;
        name: string;
        orgId: string;
        roomTypes: number;
        kindLabel: string | null;
        stars: number | null;
        fromRwf: number | null;
        deal: {
            status: "active" | "declined" | "withdrawn" | "proposed" | "ended";
            broker: {
                name: string | null;
                id: string;
                email: string | null;
                phone: string | null;
            };
            hotel: {
                district: string | null;
                name: string;
                orgId: string;
            };
            id: string;
            decidedAt: string | null;
            startsOn: string | null;
            decisionNote: string | null;
            note: string | null;
            closedAt: string | null;
            terms: {
                kind: "percent";
                percent: number;
            } | {
                kind: "bulk_fixed";
                amountRwf: number;
                minRooms: number;
            };
            endsOn: string | null;
            proposedAt: string;
            closedBy: "broker" | "hotel" | null;
            closeNote: string | null;
        } | null;
    }[];
}>;
export type BrokerHotels = z.infer<typeof BrokerHotels>;
/** The terms in one line: "10% of each booking", "RWF 200,000 for a booking of 10 rooms or more". */
export declare function brokerDealTermsLine(terms: BrokerDealTerms): string;
/** How a commission divides: Injishi's 15%, rounded to the franc, and the broker's rest. */
export declare function brokerCommissionSplit(commissionRwf: number): {
    injishiRwf: number;
    brokerRwf: number;
};
//# sourceMappingURL=broker-deals.d.ts.map