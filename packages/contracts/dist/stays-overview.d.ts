import { z } from "zod";
import { BusinessKind } from "./business-kind";
/**
 * How a stay business is run, which decides what the app offers it. A place of up to
 * `COMPACT_MAX_ROOMS` rooms is run by its owner and perhaps one helper: one short menu, no departments,
 * no outlets, no revenue desk. A larger one has a team and the full hotel tools. A small lodge and a
 * small hotel are alike; a large guest house is run like a lodge. Rooms, not the business kind, decide.
 */
export declare const StaySize: z.ZodEnum<["compact", "full"]>;
export type StaySize = z.infer<typeof StaySize>;
export declare const COMPACT_MAX_ROOMS = 12;
export declare function staySize(rooms: number): StaySize;
/** The words a stay business's screens use for what it lets: rooms, apartments, cottages, tents. */
export declare function stayUnitWords(kind: BusinessKind): {
    one: string;
    many: string;
};
/** Long stays are let by the week and the month as well as the night. */
export declare function letsLongStays(kind: BusinessKind): boolean;
export declare const StaysSummary: z.ZodObject<{
    today: z.ZodEffects<z.ZodString, string, string>;
    business: z.ZodObject<{
        orgName: z.ZodString;
        kind: z.ZodEnum<["hotel", "motel", "tented_camp", "guest_house", "apartment", "lodge", "villa", "other", "bar_restaurant", "coffee_shop", "residence", "broker"]>;
        size: z.ZodEnum<["compact", "full"]>;
        /** Bookable rooms (or apartments, tents) across the covered branches. */
        rooms: z.ZodNumber;
        roomTypes: z.ZodNumber;
        properties: z.ZodNumber;
        /** The one branch when there is one, for the header. */
        propertyName: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind: "residence" | "broker" | "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "bar_restaurant" | "coffee_shop";
        orgName: string;
        propertyName: string | null;
        roomTypes: number;
        rooms: number;
        size: "full" | "compact";
        properties: number;
    }, {
        kind: "residence" | "broker" | "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "bar_restaurant" | "coffee_shop";
        orgName: string;
        propertyName: string | null;
        roomTypes: number;
        rooms: number;
        size: "full" | "compact";
        properties: number;
    }>;
    counts: z.ZodObject<{
        arrivalsToday: z.ZodNumber;
        departuresToday: z.ZodNumber;
        inHouse: z.ZodNumber;
        /** Booking requests waiting for the business to accept or decline. */
        requestsWaiting: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        inHouse: number;
        arrivalsToday: number;
        departuresToday: number;
        requestsWaiting: number;
    }, {
        inHouse: number;
        arrivalsToday: number;
        departuresToday: number;
        requestsWaiting: number;
    }>;
}, "strip", z.ZodTypeAny, {
    business: {
        kind: "residence" | "broker" | "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "bar_restaurant" | "coffee_shop";
        orgName: string;
        propertyName: string | null;
        roomTypes: number;
        rooms: number;
        size: "full" | "compact";
        properties: number;
    };
    today: string;
    counts: {
        inHouse: number;
        arrivalsToday: number;
        departuresToday: number;
        requestsWaiting: number;
    };
}, {
    business: {
        kind: "residence" | "broker" | "other" | "hotel" | "motel" | "tented_camp" | "guest_house" | "apartment" | "lodge" | "villa" | "bar_restaurant" | "coffee_shop";
        orgName: string;
        propertyName: string | null;
        roomTypes: number;
        rooms: number;
        size: "full" | "compact";
        properties: number;
    };
    today: string;
    counts: {
        inHouse: number;
        arrivalsToday: number;
        departuresToday: number;
        requestsWaiting: number;
    };
}>;
export type StaysSummary = z.infer<typeof StaysSummary>;
/** Where a stay stands, as the home and the calendar word it. */
export declare const StayActivityStatus: z.ZodEnum<["requested", "confirmed", "in_house", "checked_out", "cancelled", "no_show"]>;
export type StayActivityStatus = z.infer<typeof StayActivityStatus>;
export declare const StayActivityItem: z.ZodObject<{
    id: z.ZodString;
    /** A booking (with or without its stay yet), or a walk in, which has no booking. */
    source: z.ZodEnum<["booking", "walk_in"]>;
    reference: z.ZodNullable<z.ZodString>;
    guestName: z.ZodString;
    roomTypeName: z.ZodString;
    roomLabel: z.ZodNullable<z.ZodString>;
    /** The first night. */
    checkIn: z.ZodEffects<z.ZodString, string, string>;
    /** The morning they leave; for an open-ended walk in, today's tomorrow. */
    checkOut: z.ZodEffects<z.ZodString, string, string>;
    status: z.ZodEnum<["requested", "confirmed", "in_house", "checked_out", "cancelled", "no_show"]>;
    channel: z.ZodNullable<z.ZodString>;
    nightlyRwf: z.ZodNumber;
    totalRwf: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    status: "confirmed" | "cancelled" | "no_show" | "checked_out" | "requested" | "in_house";
    id: string;
    checkIn: string;
    checkOut: string;
    reference: string | null;
    source: "booking" | "walk_in";
    guestName: string;
    roomTypeName: string;
    totalRwf: number;
    roomLabel: string | null;
    channel: string | null;
    nightlyRwf: number;
}, {
    status: "confirmed" | "cancelled" | "no_show" | "checked_out" | "requested" | "in_house";
    id: string;
    checkIn: string;
    checkOut: string;
    reference: string | null;
    source: "booking" | "walk_in";
    guestName: string;
    roomTypeName: string;
    totalRwf: number;
    roomLabel: string | null;
    channel: string | null;
    nightlyRwf: number;
}>;
export type StayActivityItem = z.infer<typeof StayActivityItem>;
export declare const StaysActivity: z.ZodObject<{
    from: z.ZodEffects<z.ZodString, string, string>;
    to: z.ZodEffects<z.ZodString, string, string>;
    today: z.ZodEffects<z.ZodString, string, string>;
    rooms: z.ZodNumber;
    stays: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        /** A booking (with or without its stay yet), or a walk in, which has no booking. */
        source: z.ZodEnum<["booking", "walk_in"]>;
        reference: z.ZodNullable<z.ZodString>;
        guestName: z.ZodString;
        roomTypeName: z.ZodString;
        roomLabel: z.ZodNullable<z.ZodString>;
        /** The first night. */
        checkIn: z.ZodEffects<z.ZodString, string, string>;
        /** The morning they leave; for an open-ended walk in, today's tomorrow. */
        checkOut: z.ZodEffects<z.ZodString, string, string>;
        status: z.ZodEnum<["requested", "confirmed", "in_house", "checked_out", "cancelled", "no_show"]>;
        channel: z.ZodNullable<z.ZodString>;
        nightlyRwf: z.ZodNumber;
        totalRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        status: "confirmed" | "cancelled" | "no_show" | "checked_out" | "requested" | "in_house";
        id: string;
        checkIn: string;
        checkOut: string;
        reference: string | null;
        source: "booking" | "walk_in";
        guestName: string;
        roomTypeName: string;
        totalRwf: number;
        roomLabel: string | null;
        channel: string | null;
        nightlyRwf: number;
    }, {
        status: "confirmed" | "cancelled" | "no_show" | "checked_out" | "requested" | "in_house";
        id: string;
        checkIn: string;
        checkOut: string;
        reference: string | null;
        source: "booking" | "walk_in";
        guestName: string;
        roomTypeName: string;
        totalRwf: number;
        roomLabel: string | null;
        channel: string | null;
        nightlyRwf: number;
    }>, "many">;
    /** Money received on guests' bills, summed per business day (payments less refunds). */
    payments: z.ZodArray<z.ZodObject<{
        day: z.ZodEffects<z.ZodString, string, string>;
        amountRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        amountRwf: number;
        day: string;
    }, {
        amountRwf: number;
        day: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    payments: {
        amountRwf: number;
        day: string;
    }[];
    from: string;
    to: string;
    rooms: number;
    stays: {
        status: "confirmed" | "cancelled" | "no_show" | "checked_out" | "requested" | "in_house";
        id: string;
        checkIn: string;
        checkOut: string;
        reference: string | null;
        source: "booking" | "walk_in";
        guestName: string;
        roomTypeName: string;
        totalRwf: number;
        roomLabel: string | null;
        channel: string | null;
        nightlyRwf: number;
    }[];
    today: string;
}, {
    payments: {
        amountRwf: number;
        day: string;
    }[];
    from: string;
    to: string;
    rooms: number;
    stays: {
        status: "confirmed" | "cancelled" | "no_show" | "checked_out" | "requested" | "in_house";
        id: string;
        checkIn: string;
        checkOut: string;
        reference: string | null;
        source: "booking" | "walk_in";
        guestName: string;
        roomTypeName: string;
        totalRwf: number;
        roomLabel: string | null;
        channel: string | null;
        nightlyRwf: number;
    }[];
    today: string;
}>;
export type StaysActivity = z.infer<typeof StaysActivity>;
/** Nights sold on each day of a period: a stay counts on every night from its check in to the night before it leaves. */
export declare function nightsSold(stays: readonly StayActivityItem[], days: readonly string[]): number[];
//# sourceMappingURL=stays-overview.d.ts.map