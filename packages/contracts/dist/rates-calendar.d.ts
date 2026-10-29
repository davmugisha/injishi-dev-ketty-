import { z } from "zod";
export declare const RatesDay: z.ZodObject<{
    day: z.ZodEffects<z.ZodString, string, string>;
    /** What one night costs that day: its own price when set, else the room type's. */
    priceRwf: z.ZodNumber;
    /** The day carries its own price. */
    custom: z.ZodBoolean;
    closed: z.ZodBoolean;
    /** The shortest stay arriving that day, when the day asks for one. */
    minNights: z.ZodNullable<z.ZodNumber>;
    /** Rooms of this type booked or in house that night. */
    sold: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    custom: boolean;
    closed: boolean;
    priceRwf: number;
    day: string;
    minNights: number | null;
    sold: number;
}, {
    custom: boolean;
    closed: boolean;
    priceRwf: number;
    day: string;
    minNights: number | null;
    sold: number;
}>;
export type RatesDay = z.infer<typeof RatesDay>;
export declare const RatesRoomType: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    propertyName: z.ZodString;
    rooms: z.ZodNumber;
    basePriceRwf: z.ZodNumber;
    minStay: z.ZodNullable<z.ZodNumber>;
    maxStay: z.ZodNullable<z.ZodNumber>;
    weeklyDiscountPct: z.ZodNullable<z.ZodNumber>;
    monthlyDiscountPct: z.ZodNullable<z.ZodNumber>;
    days: z.ZodArray<z.ZodObject<{
        day: z.ZodEffects<z.ZodString, string, string>;
        /** What one night costs that day: its own price when set, else the room type's. */
        priceRwf: z.ZodNumber;
        /** The day carries its own price. */
        custom: z.ZodBoolean;
        closed: z.ZodBoolean;
        /** The shortest stay arriving that day, when the day asks for one. */
        minNights: z.ZodNullable<z.ZodNumber>;
        /** Rooms of this type booked or in house that night. */
        sold: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        custom: boolean;
        closed: boolean;
        priceRwf: number;
        day: string;
        minNights: number | null;
        sold: number;
    }, {
        custom: boolean;
        closed: boolean;
        priceRwf: number;
        day: string;
        minNights: number | null;
        sold: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    minStay: number | null;
    propertyName: string;
    rooms: number;
    days: {
        custom: boolean;
        closed: boolean;
        priceRwf: number;
        day: string;
        minNights: number | null;
        sold: number;
    }[];
    basePriceRwf: number;
    maxStay: number | null;
    weeklyDiscountPct: number | null;
    monthlyDiscountPct: number | null;
}, {
    name: string;
    id: string;
    minStay: number | null;
    propertyName: string;
    rooms: number;
    days: {
        custom: boolean;
        closed: boolean;
        priceRwf: number;
        day: string;
        minNights: number | null;
        sold: number;
    }[];
    basePriceRwf: number;
    maxStay: number | null;
    weeklyDiscountPct: number | null;
    monthlyDiscountPct: number | null;
}>;
export type RatesRoomType = z.infer<typeof RatesRoomType>;
export declare const RatesCalendar: z.ZodObject<{
    from: z.ZodEffects<z.ZodString, string, string>;
    to: z.ZodEffects<z.ZodString, string, string>;
    today: z.ZodEffects<z.ZodString, string, string>;
    roomTypes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        propertyName: z.ZodString;
        rooms: z.ZodNumber;
        basePriceRwf: z.ZodNumber;
        minStay: z.ZodNullable<z.ZodNumber>;
        maxStay: z.ZodNullable<z.ZodNumber>;
        weeklyDiscountPct: z.ZodNullable<z.ZodNumber>;
        monthlyDiscountPct: z.ZodNullable<z.ZodNumber>;
        days: z.ZodArray<z.ZodObject<{
            day: z.ZodEffects<z.ZodString, string, string>;
            /** What one night costs that day: its own price when set, else the room type's. */
            priceRwf: z.ZodNumber;
            /** The day carries its own price. */
            custom: z.ZodBoolean;
            closed: z.ZodBoolean;
            /** The shortest stay arriving that day, when the day asks for one. */
            minNights: z.ZodNullable<z.ZodNumber>;
            /** Rooms of this type booked or in house that night. */
            sold: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            custom: boolean;
            closed: boolean;
            priceRwf: number;
            day: string;
            minNights: number | null;
            sold: number;
        }, {
            custom: boolean;
            closed: boolean;
            priceRwf: number;
            day: string;
            minNights: number | null;
            sold: number;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        minStay: number | null;
        propertyName: string;
        rooms: number;
        days: {
            custom: boolean;
            closed: boolean;
            priceRwf: number;
            day: string;
            minNights: number | null;
            sold: number;
        }[];
        basePriceRwf: number;
        maxStay: number | null;
        weeklyDiscountPct: number | null;
        monthlyDiscountPct: number | null;
    }, {
        name: string;
        id: string;
        minStay: number | null;
        propertyName: string;
        rooms: number;
        days: {
            custom: boolean;
            closed: boolean;
            priceRwf: number;
            day: string;
            minNights: number | null;
            sold: number;
        }[];
        basePriceRwf: number;
        maxStay: number | null;
        weeklyDiscountPct: number | null;
        monthlyDiscountPct: number | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    from: string;
    roomTypes: {
        name: string;
        id: string;
        minStay: number | null;
        propertyName: string;
        rooms: number;
        days: {
            custom: boolean;
            closed: boolean;
            priceRwf: number;
            day: string;
            minNights: number | null;
            sold: number;
        }[];
        basePriceRwf: number;
        maxStay: number | null;
        weeklyDiscountPct: number | null;
        monthlyDiscountPct: number | null;
    }[];
    to: string;
    today: string;
}, {
    from: string;
    roomTypes: {
        name: string;
        id: string;
        minStay: number | null;
        propertyName: string;
        rooms: number;
        days: {
            custom: boolean;
            closed: boolean;
            priceRwf: number;
            day: string;
            minNights: number | null;
            sold: number;
        }[];
        basePriceRwf: number;
        maxStay: number | null;
        weeklyDiscountPct: number | null;
        monthlyDiscountPct: number | null;
    }[];
    to: string;
    today: string;
}>;
export type RatesCalendar = z.infer<typeof RatesCalendar>;
export declare const RATES_CALENDAR_MAX_DAYS = 62;
/** `PUT /ops/rates/days`: set, or clear, the price, the closing and the shortest stay of a run of days. */
export declare const RatesDaysUpdate: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    roomTypeId: z.ZodString;
    from: z.ZodEffects<z.ZodString, string, string>;
    to: z.ZodEffects<z.ZodString, string, string>;
    /** A price for each night; null clears it back to the room type's price; absent leaves it. */
    priceRwf: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    closed: z.ZodOptional<z.ZodBoolean>;
    minNights: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    roomTypeId: string;
    from: string;
    to: string;
    closed?: boolean | undefined;
    priceRwf?: number | null | undefined;
    minNights?: number | null | undefined;
}, {
    roomTypeId: string;
    from: string;
    to: string;
    closed?: boolean | undefined;
    priceRwf?: number | null | undefined;
    minNights?: number | null | undefined;
}>, {
    roomTypeId: string;
    from: string;
    to: string;
    closed?: boolean | undefined;
    priceRwf?: number | null | undefined;
    minNights?: number | null | undefined;
}, {
    roomTypeId: string;
    from: string;
    to: string;
    closed?: boolean | undefined;
    priceRwf?: number | null | undefined;
    minNights?: number | null | undefined;
}>, {
    roomTypeId: string;
    from: string;
    to: string;
    closed?: boolean | undefined;
    priceRwf?: number | null | undefined;
    minNights?: number | null | undefined;
}, {
    roomTypeId: string;
    from: string;
    to: string;
    closed?: boolean | undefined;
    priceRwf?: number | null | undefined;
    minNights?: number | null | undefined;
}>;
export type RatesDaysUpdate = z.infer<typeof RatesDaysUpdate>;
/** `PUT /ops/rates/terms`: a room type's own price, its stay bounds and its long stay discounts. */
export declare const RatesTermsUpdate: z.ZodObject<{
    roomTypeId: z.ZodString;
    basePriceRwf: z.ZodOptional<z.ZodNumber>;
    minStay: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    maxStay: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    weeklyDiscountPct: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    monthlyDiscountPct: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    roomTypeId: string;
    minStay?: number | null | undefined;
    basePriceRwf?: number | undefined;
    maxStay?: number | null | undefined;
    weeklyDiscountPct?: number | null | undefined;
    monthlyDiscountPct?: number | null | undefined;
}, {
    roomTypeId: string;
    minStay?: number | null | undefined;
    basePriceRwf?: number | undefined;
    maxStay?: number | null | undefined;
    weeklyDiscountPct?: number | null | undefined;
    monthlyDiscountPct?: number | null | undefined;
}>;
export type RatesTermsUpdate = z.infer<typeof RatesTermsUpdate>;
//# sourceMappingURL=rates-calendar.d.ts.map