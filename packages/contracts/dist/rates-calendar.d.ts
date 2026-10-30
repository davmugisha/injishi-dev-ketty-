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
    /** A night's price: for the room (`per_unit`, hotels since 0119) or for each guest (`per_person`). */
    basePriceRwf: z.ZodNumber;
    /** `per_unit` or `per_person`. Optional, so an older API's answer still parses. */
    priceBasis: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    /** What one guest pays a night for a room priced per room; null when one guest pays the room price. */
    singleGuestPriceRwf: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
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
    priceBasis?: string | null | undefined;
    singleGuestPriceRwf?: number | null | undefined;
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
    priceBasis?: string | null | undefined;
    singleGuestPriceRwf?: number | null | undefined;
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
        /** A night's price: for the room (`per_unit`, hotels since 0119) or for each guest (`per_person`). */
        basePriceRwf: z.ZodNumber;
        /** `per_unit` or `per_person`. Optional, so an older API's answer still parses. */
        priceBasis: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        /** What one guest pays a night for a room priced per room; null when one guest pays the room price. */
        singleGuestPriceRwf: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
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
        priceBasis?: string | null | undefined;
        singleGuestPriceRwf?: number | null | undefined;
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
        priceBasis?: string | null | undefined;
        singleGuestPriceRwf?: number | null | undefined;
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
        priceBasis?: string | null | undefined;
        singleGuestPriceRwf?: number | null | undefined;
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
        priceBasis?: string | null | undefined;
        singleGuestPriceRwf?: number | null | undefined;
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
    /** One guest's price a night, for a room priced per room; null clears it. */
    singleGuestPriceRwf: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    minStay: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    maxStay: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    weeklyDiscountPct: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    monthlyDiscountPct: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    roomTypeId: string;
    minStay?: number | null | undefined;
    singleGuestPriceRwf?: number | null | undefined;
    basePriceRwf?: number | undefined;
    maxStay?: number | null | undefined;
    weeklyDiscountPct?: number | null | undefined;
    monthlyDiscountPct?: number | null | undefined;
}, {
    roomTypeId: string;
    minStay?: number | null | undefined;
    singleGuestPriceRwf?: number | null | undefined;
    basePriceRwf?: number | undefined;
    maxStay?: number | null | undefined;
    weeklyDiscountPct?: number | null | undefined;
    monthlyDiscountPct?: number | null | undefined;
}>;
export type RatesTermsUpdate = z.infer<typeof RatesTermsUpdate>;
/** A run of days with its own price, closing or shortest stay, from today on (`GET /ops/rates/special-dates`). */
export declare const RatesSpecialRange: z.ZodObject<{
    roomTypeId: z.ZodString;
    roomTypeName: z.ZodString;
    /** The first and the last day of the run. */
    from: z.ZodEffects<z.ZodString, string, string>;
    to: z.ZodEffects<z.ZodString, string, string>;
    /** The run's own price a night; null keeps the room type's price. */
    priceRwf: z.ZodNullable<z.ZodNumber>;
    closed: z.ZodBoolean;
    minNights: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    roomTypeId: string;
    closed: boolean;
    priceRwf: number | null;
    from: string;
    to: string;
    roomTypeName: string;
    minNights: number | null;
}, {
    roomTypeId: string;
    closed: boolean;
    priceRwf: number | null;
    from: string;
    to: string;
    roomTypeName: string;
    minNights: number | null;
}>;
export type RatesSpecialRange = z.infer<typeof RatesSpecialRange>;
export declare const RatesSpecialDates: z.ZodObject<{
    today: z.ZodEffects<z.ZodString, string, string>;
    ranges: z.ZodArray<z.ZodObject<{
        roomTypeId: z.ZodString;
        roomTypeName: z.ZodString;
        /** The first and the last day of the run. */
        from: z.ZodEffects<z.ZodString, string, string>;
        to: z.ZodEffects<z.ZodString, string, string>;
        /** The run's own price a night; null keeps the room type's price. */
        priceRwf: z.ZodNullable<z.ZodNumber>;
        closed: z.ZodBoolean;
        minNights: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        roomTypeId: string;
        closed: boolean;
        priceRwf: number | null;
        from: string;
        to: string;
        roomTypeName: string;
        minNights: number | null;
    }, {
        roomTypeId: string;
        closed: boolean;
        priceRwf: number | null;
        from: string;
        to: string;
        roomTypeName: string;
        minNights: number | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    today: string;
    ranges: {
        roomTypeId: string;
        closed: boolean;
        priceRwf: number | null;
        from: string;
        to: string;
        roomTypeName: string;
        minNights: number | null;
    }[];
}, {
    today: string;
    ranges: {
        roomTypeId: string;
        closed: boolean;
        priceRwf: number | null;
        from: string;
        to: string;
        roomTypeName: string;
        minNights: number | null;
    }[];
}>;
export type RatesSpecialDates = z.infer<typeof RatesSpecialDates>;
/** Days in a row with the same settings make one run; `days` sorted by room type, then day. */
export declare function specialRanges(days: readonly {
    roomTypeId: string;
    roomTypeName: string;
    day: string;
    priceRwf: number | null;
    closed: boolean;
    minNights: number | null;
}[]): RatesSpecialRange[];
//# sourceMappingURL=rates-calendar.d.ts.map