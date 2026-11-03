import { z } from "zod";
/**
 * The desk changes a confirmed reservation (2026-10-30, the owner's decisions): its dates, its room type,
 * its number of guests. Never the guest's own details.
 *
 * A change reprices the stay. When it costs more the desk chooses each time: `bill` puts the difference on
 * the guest's bill, settled at the desk; `momo` asks the guest to pay it now by MoMo, and the change
 * applies once they have. When it costs less, the difference stays on the bill as credit, used against
 * extras, and what is left of it is refunded at check out.
 */
/** What the desk wants the reservation to become. Every field is the new value, changed or not. */
export declare const ReservationChangeAsk: z.ZodObject<{
    checkIn: z.ZodString;
    checkOut: z.ZodString;
    roomTypeId: z.ZodString;
    adults: z.ZodNumber;
    children: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    roomTypeId: string;
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
}, {
    roomTypeId: string;
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
}>;
export type ReservationChangeAsk = z.infer<typeof ReservationChangeAsk>;
/** How a difference is settled: nothing owed, on the bill, by MoMo now, or credit on the bill. */
export declare const ChangeSettlement: z.ZodEnum<["none", "bill", "momo", "credit"]>;
export type ChangeSettlement = z.infer<typeof ChangeSettlement>;
/** `POST /ops/reservations/:id/change/quote`: what a change would cost, before anything moves. */
export declare const ReservationChangeQuote: z.ZodObject<{
    nights: z.ZodNumber;
    fromNightlyRwf: z.ZodNumber;
    toNightlyRwf: z.ZodNumber;
    /** What the guest has paid for the room so far. */
    paidRoomRwf: z.ZodNumber;
    /** What the room costs after the change. */
    newRoomRwf: z.ZodNumber;
    /** More owed when positive, credit when negative. */
    differenceRwf: z.ZodNumber;
    /** The settlements the desk may choose from: `bill` and `momo` when it costs more. */
    settlements: z.ZodArray<z.ZodEnum<["none", "bill", "momo", "credit"]>, "many">;
    /** Whether the new room type has a free unit every night of the new dates (this booking left out). */
    available: z.ZodBoolean;
    /** Why the change cannot be made, in the desk's words. Empty when it can. */
    problems: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    nights: number;
    available: boolean;
    fromNightlyRwf: number;
    toNightlyRwf: number;
    paidRoomRwf: number;
    newRoomRwf: number;
    differenceRwf: number;
    settlements: ("none" | "credit" | "bill" | "momo")[];
    problems: string[];
}, {
    nights: number;
    available: boolean;
    fromNightlyRwf: number;
    toNightlyRwf: number;
    paidRoomRwf: number;
    newRoomRwf: number;
    differenceRwf: number;
    settlements: ("none" | "credit" | "bill" | "momo")[];
    problems: string[];
}>;
export type ReservationChangeQuote = z.infer<typeof ReservationChangeQuote>;
/** `POST /ops/reservations/:id/change`: the change, and how the desk settles a higher price. */
export declare const ReservationChangeRequest: z.ZodObject<{
    checkIn: z.ZodString;
    checkOut: z.ZodString;
    roomTypeId: z.ZodString;
    adults: z.ZodNumber;
    children: z.ZodNumber;
} & {
    /** Required when the change costs more; ignored otherwise. */
    settlement: z.ZodOptional<z.ZodEnum<["bill", "momo"]>>;
    /** The guest's MoMo number, for `momo`. */
    instrument: z.ZodOptional<z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
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
    }>]>>;
    /** One per press of "Ask the guest to pay", so a retried press is the same request. */
    attemptToken: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    roomTypeId: string;
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
    attemptToken?: string | undefined;
    instrument?: {
        network: "mtn_momo" | "airtel_money";
        kind: "mobile_money";
        msisdn: string;
    } | {
        kind: "card";
        token: string;
    } | undefined;
    settlement?: "bill" | "momo" | undefined;
}, {
    roomTypeId: string;
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
    attemptToken?: string | undefined;
    instrument?: {
        network: "mtn_momo" | "airtel_money";
        kind: "mobile_money";
        msisdn: string;
    } | {
        kind: "card";
        token: string;
    } | undefined;
    settlement?: "bill" | "momo" | undefined;
}>;
export type ReservationChangeRequest = z.infer<typeof ReservationChangeRequest>;
/** The change as the desk sees it after the press. */
export declare const ReservationChangeResult: z.ZodObject<{
    changeId: z.ZodString;
    /** `applied`, or `awaiting_payment` while the guest is asked by MoMo; `abandoned` if that failed. */
    status: z.ZodEnum<["applied", "awaiting_payment", "abandoned"]>;
    settlement: z.ZodEnum<["none", "bill", "momo", "credit"]>;
    differenceRwf: z.ZodNumber;
    /** The MoMo request, for `momo`: poll it until it is answered. */
    attempt: z.ZodNullable<z.ZodObject<{
        attemptToken: z.ZodString;
        state: z.ZodEnum<["prompting", "confirmed", "refused", "expired"]>;
        network: z.ZodNullable<z.ZodEnum<["mtn_momo", "airtel_money"]>>;
        payerMasked: z.ZodNullable<z.ZodString>;
        amountRwf: z.ZodNullable<z.ZodNumber>;
        expiresAt: z.ZodString;
        failureReason: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        network: "mtn_momo" | "airtel_money" | null;
        attemptToken: string;
        state: "confirmed" | "expired" | "prompting" | "refused";
        payerMasked: string | null;
        amountRwf: number | null;
        expiresAt: string;
        failureReason: string | null;
    }, {
        network: "mtn_momo" | "airtel_money" | null;
        attemptToken: string;
        state: "confirmed" | "expired" | "prompting" | "refused";
        payerMasked: string | null;
        amountRwf: number | null;
        expiresAt: string;
        failureReason: string | null;
    }>>;
}, "strip", z.ZodTypeAny, {
    status: "awaiting_payment" | "applied" | "abandoned";
    attempt: {
        network: "mtn_momo" | "airtel_money" | null;
        attemptToken: string;
        state: "confirmed" | "expired" | "prompting" | "refused";
        payerMasked: string | null;
        amountRwf: number | null;
        expiresAt: string;
        failureReason: string | null;
    } | null;
    settlement: "none" | "credit" | "bill" | "momo";
    differenceRwf: number;
    changeId: string;
}, {
    status: "awaiting_payment" | "applied" | "abandoned";
    attempt: {
        network: "mtn_momo" | "airtel_money" | null;
        attemptToken: string;
        state: "confirmed" | "expired" | "prompting" | "refused";
        payerMasked: string | null;
        amountRwf: number | null;
        expiresAt: string;
        failureReason: string | null;
    } | null;
    settlement: "none" | "credit" | "bill" | "momo";
    differenceRwf: number;
    changeId: string;
}>;
export type ReservationChangeResult = z.infer<typeof ReservationChangeResult>;
/** `GET /ops/reservations/:id/change`: the stay as it stands, and the room types it may move to. */
export declare const ReservationChangeForm: z.ZodObject<{
    reference: z.ZodString;
    current: z.ZodObject<{
        checkIn: z.ZodString;
        checkOut: z.ZodString;
        roomTypeId: z.ZodString;
        adults: z.ZodNumber;
        children: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        roomTypeId: string;
        checkIn: string;
        checkOut: string;
        adults: number;
        children: number;
    }, {
        roomTypeId: string;
        checkIn: string;
        checkOut: string;
        adults: number;
        children: number;
    }>;
    roomTypes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        /** Guests it sleeps; adults and children within it. */
        capacity: z.ZodNumber;
        maxAdults: z.ZodNullable<z.ZodNumber>;
        maxChildren: z.ZodNullable<z.ZodNumber>;
        /** Its price for the room (per room) or per guest, a night. */
        nightlyRateRwf: z.ZodNullable<z.ZodNumber>;
        priceBasis: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        capacity: number;
        nightlyRateRwf: number | null;
        priceBasis: string | null;
        maxAdults: number | null;
        maxChildren: number | null;
    }, {
        name: string;
        id: string;
        capacity: number;
        nightlyRateRwf: number | null;
        priceBasis: string | null;
        maxAdults: number | null;
        maxChildren: number | null;
    }>, "many">;
    /** Why it cannot change at all (checked in, a request, no payment held). Empty when it can. */
    problems: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    reference: string;
    current: {
        roomTypeId: string;
        checkIn: string;
        checkOut: string;
        adults: number;
        children: number;
    };
    roomTypes: {
        name: string;
        id: string;
        capacity: number;
        nightlyRateRwf: number | null;
        priceBasis: string | null;
        maxAdults: number | null;
        maxChildren: number | null;
    }[];
    problems: string[];
}, {
    reference: string;
    current: {
        roomTypeId: string;
        checkIn: string;
        checkOut: string;
        adults: number;
        children: number;
    };
    roomTypes: {
        name: string;
        id: string;
        capacity: number;
        nightlyRateRwf: number | null;
        priceBasis: string | null;
        maxAdults: number | null;
        maxChildren: number | null;
    }[];
    problems: string[];
}>;
export type ReservationChangeForm = z.infer<typeof ReservationChangeForm>;
//# sourceMappingURL=booking-change.d.ts.map