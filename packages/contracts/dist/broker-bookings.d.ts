import { z } from "zod";
import { type BrokerDealTerms } from "./broker-deals";
/**
 * A broker's bookings at a hotel (2026-11-02, phase 2): under a running deal,
 * a broker books one room or many at once for their clients, with a guest's
 * name on every room. The rooms are confirmed straight away when they are free,
 * because the hotel agreed to the deal.
 *
 * Two ways to pay:
 * - `at_hotel`: nothing is taken now. The guests pay at the desk, and the
 *   commission is taken off the hotel's next payout once they check out.
 * - `momo`: one Mobile Money payment for the whole group, held in escrow like
 *   a guest's own booking. The rooms are written only once it lands; if any of
 *   them sold out meanwhile, the whole payment is refunded and nothing is booked.
 *
 * Every room becomes its own booking (one room, one booking, as everywhere
 * else), and the group ties them together under one reference.
 */
export declare const BROKER_GROUP_MAX_ROOMS = 50;
export declare const BrokerBookingPayment: z.ZodEnum<["at_hotel", "momo"]>;
export type BrokerBookingPayment = z.infer<typeof BrokerBookingPayment>;
/**
 * - `awaiting_payment`: a MoMo prompt is out; nothing is booked yet;
 * - `booked`: every room is a confirmed booking;
 * - `failed`: the payment was refused or never answered, or the rooms sold out
 *   before it landed (refunded in full). Nothing is booked.
 */
export declare const BrokerGroupStatus: z.ZodEnum<["awaiting_payment", "booked", "failed"]>;
export type BrokerGroupStatus = z.infer<typeof BrokerGroupStatus>;
/** `GET /ops/broker/hotels/:orgId/rooms?checkIn&checkOut`: what can be booked, and at what rate. */
export declare const BrokerRoomsQuery: z.ZodObject<{
    checkIn: z.ZodString;
    checkOut: z.ZodString;
}, "strip", z.ZodTypeAny, {
    checkIn: string;
    checkOut: string;
}, {
    checkIn: string;
    checkOut: string;
}>;
export type BrokerRoomsQuery = z.infer<typeof BrokerRoomsQuery>;
export declare const BrokerRoomType: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    /** Most guests a room sleeps (infants not counted). */
    capacity: z.ZodNumber;
    maxAdults: z.ZodNullable<z.ZodNumber>;
    maxChildren: z.ZodNullable<z.ZodNumber>;
    /** `per_person`: the rate is per guest per night; `per_unit`: per room per night. */
    priceBasis: z.ZodNullable<z.ZodString>;
    nightlyRateRwf: z.ZodNumber;
    singleGuestPriceRwf: z.ZodNullable<z.ZodNumber>;
    minStay: z.ZodNullable<z.ZodNumber>;
    /** Rooms free on every night of the stay. */
    freeRooms: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    capacity: number;
    nightlyRateRwf: number;
    priceBasis: string | null;
    minStay: number | null;
    singleGuestPriceRwf: number | null;
    maxAdults: number | null;
    maxChildren: number | null;
    freeRooms: number;
}, {
    name: string;
    id: string;
    capacity: number;
    nightlyRateRwf: number;
    priceBasis: string | null;
    minStay: number | null;
    singleGuestPriceRwf: number | null;
    maxAdults: number | null;
    maxChildren: number | null;
    freeRooms: number;
}>;
export type BrokerRoomType = z.infer<typeof BrokerRoomType>;
export declare const BrokerRoomOffer: z.ZodObject<{
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
    deal: z.ZodObject<{
        id: z.ZodString;
        status: z.ZodEnum<["proposed", "active", "declined", "withdrawn", "ended"]>;
        terms: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
            kind: z.ZodLiteral<"percent">;
            percent: z.ZodEffects<z.ZodNumber, number, number>;
        }, "strip", z.ZodTypeAny, {
            kind: "percent";
            percent: number;
        }, {
            kind: "percent";
            percent: number;
        }>, z.ZodObject<{
            kind: z.ZodLiteral<"bulk_fixed">;
            amountRwf: z.ZodNumber;
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
        note: z.ZodNullable<z.ZodString>;
        broker: z.ZodObject<{
            id: z.ZodString;
            name: z.ZodNullable<z.ZodString>;
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
        decidedAt: z.ZodNullable<z.ZodString>;
        decisionNote: z.ZodNullable<z.ZodString>;
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
    checkIn: z.ZodString;
    checkOut: z.ZodString;
    nights: z.ZodNumber;
    roomTypes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        /** Most guests a room sleeps (infants not counted). */
        capacity: z.ZodNumber;
        maxAdults: z.ZodNullable<z.ZodNumber>;
        maxChildren: z.ZodNullable<z.ZodNumber>;
        /** `per_person`: the rate is per guest per night; `per_unit`: per room per night. */
        priceBasis: z.ZodNullable<z.ZodString>;
        nightlyRateRwf: z.ZodNumber;
        singleGuestPriceRwf: z.ZodNullable<z.ZodNumber>;
        minStay: z.ZodNullable<z.ZodNumber>;
        /** Rooms free on every night of the stay. */
        freeRooms: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        capacity: number;
        nightlyRateRwf: number;
        priceBasis: string | null;
        minStay: number | null;
        singleGuestPriceRwf: number | null;
        maxAdults: number | null;
        maxChildren: number | null;
        freeRooms: number;
    }, {
        name: string;
        id: string;
        capacity: number;
        nightlyRateRwf: number;
        priceBasis: string | null;
        minStay: number | null;
        singleGuestPriceRwf: number | null;
        maxAdults: number | null;
        maxChildren: number | null;
        freeRooms: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    hotel: {
        name: string;
        orgId: string;
    };
    nights: number;
    checkIn: string;
    checkOut: string;
    roomTypes: {
        name: string;
        id: string;
        capacity: number;
        nightlyRateRwf: number;
        priceBasis: string | null;
        minStay: number | null;
        singleGuestPriceRwf: number | null;
        maxAdults: number | null;
        maxChildren: number | null;
        freeRooms: number;
    }[];
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
    };
}, {
    hotel: {
        name: string;
        orgId: string;
    };
    nights: number;
    checkIn: string;
    checkOut: string;
    roomTypes: {
        name: string;
        id: string;
        capacity: number;
        nightlyRateRwf: number;
        priceBasis: string | null;
        minStay: number | null;
        singleGuestPriceRwf: number | null;
        maxAdults: number | null;
        maxChildren: number | null;
        freeRooms: number;
    }[];
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
    };
}>;
export type BrokerRoomOffer = z.infer<typeof BrokerRoomOffer>;
export declare const BrokerBookingRoom: z.ZodObject<{
    roomTypeId: z.ZodString;
    /** Who sleeps in this room: the desk checks them in by this name. */
    guestName: z.ZodString;
    guestPhone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    adults: z.ZodNumber;
    children: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    roomTypeId: string;
    guestName: string;
    adults: number;
    children: number;
    guestPhone?: string | null | undefined;
}, {
    roomTypeId: string;
    guestName: string;
    adults: number;
    children: number;
    guestPhone?: string | null | undefined;
}>;
export type BrokerBookingRoom = z.infer<typeof BrokerBookingRoom>;
/** `POST /ops/broker/hotels/:orgId/bookings`. */
export declare const CreateBrokerBookingRequest: z.ZodEffects<z.ZodObject<{
    checkIn: z.ZodString;
    checkOut: z.ZodString;
    rooms: z.ZodArray<z.ZodObject<{
        roomTypeId: z.ZodString;
        /** Who sleeps in this room: the desk checks them in by this name. */
        guestName: z.ZodString;
        guestPhone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        adults: z.ZodNumber;
        children: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        roomTypeId: string;
        guestName: string;
        adults: number;
        children: number;
        guestPhone?: string | null | undefined;
    }, {
        roomTypeId: string;
        guestName: string;
        adults: number;
        children: number;
        guestPhone?: string | null | undefined;
    }>, "many">;
    /** The number the hotel calls about the whole booking: usually the broker's own. */
    contactPhone: z.ZodString;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    payment: z.ZodDiscriminatedUnion<"method", [z.ZodObject<{
        method: z.ZodLiteral<"at_hotel">;
    }, "strip", z.ZodTypeAny, {
        method: "at_hotel";
    }, {
        method: "at_hotel";
    }>, z.ZodObject<{
        method: z.ZodLiteral<"momo">;
        instrument: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
            kind: z.ZodLiteral<"mobile_money">;
            network: z.ZodEnum<["mtn_momo", "airtel_money"]>;
            msisdn: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            network: "mtn_momo" | "airtel_money";
            kind: "mobile_money";
            msisdn: string;
        }, {
            network: "mtn_momo" | "airtel_money";
            kind: "mobile_money";
            msisdn: string;
        }>, z.ZodObject<{
            kind: z.ZodLiteral<"card">;
            token: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            kind: "card";
            token: string;
        }, {
            kind: "card";
            token: string;
        }>]>;
        /** One per press of Pay, reused on every retry of that press. */
        attemptToken: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        attemptToken: string;
        instrument: {
            network: "mtn_momo" | "airtel_money";
            kind: "mobile_money";
            msisdn: string;
        } | {
            kind: "card";
            token: string;
        };
        method: "momo";
    }, {
        attemptToken: string;
        instrument: {
            network: "mtn_momo" | "airtel_money";
            kind: "mobile_money";
            msisdn: string;
        } | {
            kind: "card";
            token: string;
        };
        method: "momo";
    }>]>;
}, "strip", z.ZodTypeAny, {
    checkIn: string;
    checkOut: string;
    payment: {
        method: "at_hotel";
    } | {
        attemptToken: string;
        instrument: {
            network: "mtn_momo" | "airtel_money";
            kind: "mobile_money";
            msisdn: string;
        } | {
            kind: "card";
            token: string;
        };
        method: "momo";
    };
    contactPhone: string;
    rooms: {
        roomTypeId: string;
        guestName: string;
        adults: number;
        children: number;
        guestPhone?: string | null | undefined;
    }[];
    note?: string | null | undefined;
}, {
    checkIn: string;
    checkOut: string;
    payment: {
        method: "at_hotel";
    } | {
        attemptToken: string;
        instrument: {
            network: "mtn_momo" | "airtel_money";
            kind: "mobile_money";
            msisdn: string;
        } | {
            kind: "card";
            token: string;
        };
        method: "momo";
    };
    contactPhone: string;
    rooms: {
        roomTypeId: string;
        guestName: string;
        adults: number;
        children: number;
        guestPhone?: string | null | undefined;
    }[];
    note?: string | null | undefined;
}>, {
    checkIn: string;
    checkOut: string;
    payment: {
        method: "at_hotel";
    } | {
        attemptToken: string;
        instrument: {
            network: "mtn_momo" | "airtel_money";
            kind: "mobile_money";
            msisdn: string;
        } | {
            kind: "card";
            token: string;
        };
        method: "momo";
    };
    contactPhone: string;
    rooms: {
        roomTypeId: string;
        guestName: string;
        adults: number;
        children: number;
        guestPhone?: string | null | undefined;
    }[];
    note?: string | null | undefined;
}, {
    checkIn: string;
    checkOut: string;
    payment: {
        method: "at_hotel";
    } | {
        attemptToken: string;
        instrument: {
            network: "mtn_momo" | "airtel_money";
            kind: "mobile_money";
            msisdn: string;
        } | {
            kind: "card";
            token: string;
        };
        method: "momo";
    };
    contactPhone: string;
    rooms: {
        roomTypeId: string;
        guestName: string;
        adults: number;
        children: number;
        guestPhone?: string | null | undefined;
    }[];
    note?: string | null | undefined;
}>;
export type CreateBrokerBookingRequest = z.infer<typeof CreateBrokerBookingRequest>;
/** What the deal earns on a group, as it stands when it is booked; paid out after the stays (phase 3). */
export declare const BrokerCommissionEstimate: z.ZodObject<{
    commissionRwf: z.ZodNumber;
    brokerRwf: z.ZodNumber;
    injishiRwf: z.ZodNumber;
    /** Why it is zero, when it is: a bulk deal needs more rooms than this booking has. */
    note: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    note: string | null;
    commissionRwf: number;
    brokerRwf: number;
    injishiRwf: number;
}, {
    note: string | null;
    commissionRwf: number;
    brokerRwf: number;
    injishiRwf: number;
}>;
export type BrokerCommissionEstimate = z.infer<typeof BrokerCommissionEstimate>;
export declare const BrokerGroupRoom: z.ZodObject<{
    roomTypeId: z.ZodString;
    roomTypeName: z.ZodString;
    guestName: z.ZodString;
    guestPhone: z.ZodNullable<z.ZodString>;
    adults: z.ZodNumber;
    children: z.ZodNumber;
    grossRwf: z.ZodNumber;
    /** The booking once written; null while the group waits for its payment or after it failed. */
    booking: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        reference: z.ZodString;
        status: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: string;
        id: string;
        reference: string;
    }, {
        status: string;
        id: string;
        reference: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    roomTypeId: string;
    grossRwf: number;
    booking: {
        status: string;
        id: string;
        reference: string;
    } | null;
    guestName: string;
    roomTypeName: string;
    adults: number;
    children: number;
    guestPhone: string | null;
}, {
    roomTypeId: string;
    grossRwf: number;
    booking: {
        status: string;
        id: string;
        reference: string;
    } | null;
    guestName: string;
    roomTypeName: string;
    adults: number;
    children: number;
    guestPhone: string | null;
}>;
export type BrokerGroupRoom = z.infer<typeof BrokerGroupRoom>;
export declare const BrokerBookingGroup: z.ZodObject<{
    id: z.ZodString;
    /** `BG-7Q2M-4XKD`, what the broker and the hotel say on the phone. */
    reference: z.ZodString;
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
    dealId: z.ZodString;
    checkIn: z.ZodString;
    checkOut: z.ZodString;
    nights: z.ZodNumber;
    payment: z.ZodEnum<["at_hotel", "momo"]>;
    status: z.ZodEnum<["awaiting_payment", "booked", "failed"]>;
    totalRwf: z.ZodNumber;
    commission: z.ZodObject<{
        commissionRwf: z.ZodNumber;
        brokerRwf: z.ZodNumber;
        injishiRwf: z.ZodNumber;
        /** Why it is zero, when it is: a bulk deal needs more rooms than this booking has. */
        note: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        note: string | null;
        commissionRwf: number;
        brokerRwf: number;
        injishiRwf: number;
    }, {
        note: string | null;
        commissionRwf: number;
        brokerRwf: number;
        injishiRwf: number;
    }>;
    contactPhone: z.ZodString;
    note: z.ZodNullable<z.ZodString>;
    rooms: z.ZodArray<z.ZodObject<{
        roomTypeId: z.ZodString;
        roomTypeName: z.ZodString;
        guestName: z.ZodString;
        guestPhone: z.ZodNullable<z.ZodString>;
        adults: z.ZodNumber;
        children: z.ZodNumber;
        grossRwf: z.ZodNumber;
        /** The booking once written; null while the group waits for its payment or after it failed. */
        booking: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            reference: z.ZodString;
            status: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            status: string;
            id: string;
            reference: string;
        }, {
            status: string;
            id: string;
            reference: string;
        }>>;
    }, "strip", z.ZodTypeAny, {
        roomTypeId: string;
        grossRwf: number;
        booking: {
            status: string;
            id: string;
            reference: string;
        } | null;
        guestName: string;
        roomTypeName: string;
        adults: number;
        children: number;
        guestPhone: string | null;
    }, {
        roomTypeId: string;
        grossRwf: number;
        booking: {
            status: string;
            id: string;
            reference: string;
        } | null;
        guestName: string;
        roomTypeName: string;
        adults: number;
        children: number;
        guestPhone: string | null;
    }>, "many">;
    failureReason: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    /** The MoMo prompt behind a `momo` group, while there is one to show. */
    attempt: z.ZodNullable<z.ZodObject<{
        attemptToken: z.ZodString;
        state: z.ZodEnum<["prompting", "confirmed", "refused", "expired"]>;
        payerMasked: z.ZodNullable<z.ZodString>;
        expiresAt: z.ZodString;
        failureReason: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        attemptToken: string;
        state: "confirmed" | "expired" | "prompting" | "refused";
        payerMasked: string | null;
        expiresAt: string;
        failureReason: string | null;
    }, {
        attemptToken: string;
        state: "confirmed" | "expired" | "prompting" | "refused";
        payerMasked: string | null;
        expiresAt: string;
        failureReason: string | null;
    }>>;
}, "strip", z.ZodTypeAny, {
    status: "awaiting_payment" | "failed" | "booked";
    hotel: {
        name: string;
        orgId: string;
    };
    id: string;
    nights: number;
    checkIn: string;
    checkOut: string;
    reference: string;
    failureReason: string | null;
    attempt: {
        attemptToken: string;
        state: "confirmed" | "expired" | "prompting" | "refused";
        payerMasked: string | null;
        expiresAt: string;
        failureReason: string | null;
    } | null;
    payment: "momo" | "at_hotel";
    note: string | null;
    createdAt: string;
    contactPhone: string;
    totalRwf: number;
    rooms: {
        roomTypeId: string;
        grossRwf: number;
        booking: {
            status: string;
            id: string;
            reference: string;
        } | null;
        guestName: string;
        roomTypeName: string;
        adults: number;
        children: number;
        guestPhone: string | null;
    }[];
    dealId: string;
    commission: {
        note: string | null;
        commissionRwf: number;
        brokerRwf: number;
        injishiRwf: number;
    };
}, {
    status: "awaiting_payment" | "failed" | "booked";
    hotel: {
        name: string;
        orgId: string;
    };
    id: string;
    nights: number;
    checkIn: string;
    checkOut: string;
    reference: string;
    failureReason: string | null;
    attempt: {
        attemptToken: string;
        state: "confirmed" | "expired" | "prompting" | "refused";
        payerMasked: string | null;
        expiresAt: string;
        failureReason: string | null;
    } | null;
    payment: "momo" | "at_hotel";
    note: string | null;
    createdAt: string;
    contactPhone: string;
    totalRwf: number;
    rooms: {
        roomTypeId: string;
        grossRwf: number;
        booking: {
            status: string;
            id: string;
            reference: string;
        } | null;
        guestName: string;
        roomTypeName: string;
        adults: number;
        children: number;
        guestPhone: string | null;
    }[];
    dealId: string;
    commission: {
        note: string | null;
        commissionRwf: number;
        brokerRwf: number;
        injishiRwf: number;
    };
}>;
export type BrokerBookingGroup = z.infer<typeof BrokerBookingGroup>;
export declare const BrokerBookingList: z.ZodObject<{
    groups: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        /** `BG-7Q2M-4XKD`, what the broker and the hotel say on the phone. */
        reference: z.ZodString;
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
        dealId: z.ZodString;
        checkIn: z.ZodString;
        checkOut: z.ZodString;
        nights: z.ZodNumber;
        payment: z.ZodEnum<["at_hotel", "momo"]>;
        status: z.ZodEnum<["awaiting_payment", "booked", "failed"]>;
        totalRwf: z.ZodNumber;
        commission: z.ZodObject<{
            commissionRwf: z.ZodNumber;
            brokerRwf: z.ZodNumber;
            injishiRwf: z.ZodNumber;
            /** Why it is zero, when it is: a bulk deal needs more rooms than this booking has. */
            note: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            note: string | null;
            commissionRwf: number;
            brokerRwf: number;
            injishiRwf: number;
        }, {
            note: string | null;
            commissionRwf: number;
            brokerRwf: number;
            injishiRwf: number;
        }>;
        contactPhone: z.ZodString;
        note: z.ZodNullable<z.ZodString>;
        rooms: z.ZodArray<z.ZodObject<{
            roomTypeId: z.ZodString;
            roomTypeName: z.ZodString;
            guestName: z.ZodString;
            guestPhone: z.ZodNullable<z.ZodString>;
            adults: z.ZodNumber;
            children: z.ZodNumber;
            grossRwf: z.ZodNumber;
            /** The booking once written; null while the group waits for its payment or after it failed. */
            booking: z.ZodNullable<z.ZodObject<{
                id: z.ZodString;
                reference: z.ZodString;
                status: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                status: string;
                id: string;
                reference: string;
            }, {
                status: string;
                id: string;
                reference: string;
            }>>;
        }, "strip", z.ZodTypeAny, {
            roomTypeId: string;
            grossRwf: number;
            booking: {
                status: string;
                id: string;
                reference: string;
            } | null;
            guestName: string;
            roomTypeName: string;
            adults: number;
            children: number;
            guestPhone: string | null;
        }, {
            roomTypeId: string;
            grossRwf: number;
            booking: {
                status: string;
                id: string;
                reference: string;
            } | null;
            guestName: string;
            roomTypeName: string;
            adults: number;
            children: number;
            guestPhone: string | null;
        }>, "many">;
        failureReason: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        /** The MoMo prompt behind a `momo` group, while there is one to show. */
        attempt: z.ZodNullable<z.ZodObject<{
            attemptToken: z.ZodString;
            state: z.ZodEnum<["prompting", "confirmed", "refused", "expired"]>;
            payerMasked: z.ZodNullable<z.ZodString>;
            expiresAt: z.ZodString;
            failureReason: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            attemptToken: string;
            state: "confirmed" | "expired" | "prompting" | "refused";
            payerMasked: string | null;
            expiresAt: string;
            failureReason: string | null;
        }, {
            attemptToken: string;
            state: "confirmed" | "expired" | "prompting" | "refused";
            payerMasked: string | null;
            expiresAt: string;
            failureReason: string | null;
        }>>;
    }, "strip", z.ZodTypeAny, {
        status: "awaiting_payment" | "failed" | "booked";
        hotel: {
            name: string;
            orgId: string;
        };
        id: string;
        nights: number;
        checkIn: string;
        checkOut: string;
        reference: string;
        failureReason: string | null;
        attempt: {
            attemptToken: string;
            state: "confirmed" | "expired" | "prompting" | "refused";
            payerMasked: string | null;
            expiresAt: string;
            failureReason: string | null;
        } | null;
        payment: "momo" | "at_hotel";
        note: string | null;
        createdAt: string;
        contactPhone: string;
        totalRwf: number;
        rooms: {
            roomTypeId: string;
            grossRwf: number;
            booking: {
                status: string;
                id: string;
                reference: string;
            } | null;
            guestName: string;
            roomTypeName: string;
            adults: number;
            children: number;
            guestPhone: string | null;
        }[];
        dealId: string;
        commission: {
            note: string | null;
            commissionRwf: number;
            brokerRwf: number;
            injishiRwf: number;
        };
    }, {
        status: "awaiting_payment" | "failed" | "booked";
        hotel: {
            name: string;
            orgId: string;
        };
        id: string;
        nights: number;
        checkIn: string;
        checkOut: string;
        reference: string;
        failureReason: string | null;
        attempt: {
            attemptToken: string;
            state: "confirmed" | "expired" | "prompting" | "refused";
            payerMasked: string | null;
            expiresAt: string;
            failureReason: string | null;
        } | null;
        payment: "momo" | "at_hotel";
        note: string | null;
        createdAt: string;
        contactPhone: string;
        totalRwf: number;
        rooms: {
            roomTypeId: string;
            grossRwf: number;
            booking: {
                status: string;
                id: string;
                reference: string;
            } | null;
            guestName: string;
            roomTypeName: string;
            adults: number;
            children: number;
            guestPhone: string | null;
        }[];
        dealId: string;
        commission: {
            note: string | null;
            commissionRwf: number;
            brokerRwf: number;
            injishiRwf: number;
        };
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    groups: {
        status: "awaiting_payment" | "failed" | "booked";
        hotel: {
            name: string;
            orgId: string;
        };
        id: string;
        nights: number;
        checkIn: string;
        checkOut: string;
        reference: string;
        failureReason: string | null;
        attempt: {
            attemptToken: string;
            state: "confirmed" | "expired" | "prompting" | "refused";
            payerMasked: string | null;
            expiresAt: string;
            failureReason: string | null;
        } | null;
        payment: "momo" | "at_hotel";
        note: string | null;
        createdAt: string;
        contactPhone: string;
        totalRwf: number;
        rooms: {
            roomTypeId: string;
            grossRwf: number;
            booking: {
                status: string;
                id: string;
                reference: string;
            } | null;
            guestName: string;
            roomTypeName: string;
            adults: number;
            children: number;
            guestPhone: string | null;
        }[];
        dealId: string;
        commission: {
            note: string | null;
            commissionRwf: number;
            brokerRwf: number;
            injishiRwf: number;
        };
    }[];
}, {
    groups: {
        status: "awaiting_payment" | "failed" | "booked";
        hotel: {
            name: string;
            orgId: string;
        };
        id: string;
        nights: number;
        checkIn: string;
        checkOut: string;
        reference: string;
        failureReason: string | null;
        attempt: {
            attemptToken: string;
            state: "confirmed" | "expired" | "prompting" | "refused";
            payerMasked: string | null;
            expiresAt: string;
            failureReason: string | null;
        } | null;
        payment: "momo" | "at_hotel";
        note: string | null;
        createdAt: string;
        contactPhone: string;
        totalRwf: number;
        rooms: {
            roomTypeId: string;
            grossRwf: number;
            booking: {
                status: string;
                id: string;
                reference: string;
            } | null;
            guestName: string;
            roomTypeName: string;
            adults: number;
            children: number;
            guestPhone: string | null;
        }[];
        dealId: string;
        commission: {
            note: string | null;
            commissionRwf: number;
            brokerRwf: number;
            injishiRwf: number;
        };
    }[];
}>;
export type BrokerBookingList = z.infer<typeof BrokerBookingList>;
/**
 * What a deal earns on a booking: a percent of what the guests pay for the rooms, or the fixed sum when
 * the booking has at least the deal's fewest rooms. Split 85 / 15 between the broker and Injishi.
 */
export declare function brokerCommissionFor(terms: BrokerDealTerms, totalRwf: number, rooms: number): BrokerCommissionEstimate;
//# sourceMappingURL=broker-bookings.d.ts.map