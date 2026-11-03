"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RatesSpecialDates = exports.RatesSpecialRange = exports.RatesTermsUpdate = exports.RatesDaysUpdate = exports.RATES_CALENDAR_MAX_DAYS = exports.RatesCalendar = exports.RatesRoomType = exports.RatesDay = void 0;
exports.specialRanges = specialRanges;
const zod_1 = require("zod");
const primitives_1 = require("./primitives");
const dates_1 = require("./rentals/dates");
// ===========================================================================
// Prices and availability, by the day (2026-10-29)
// ===========================================================================
//
// `GET /api/v1/ops/rates/calendar?from=&to=` (at most 62 days) and the two writes under it. A day price
// or a closed day is a `date_overrides` row on the room type's default rate plan, the rows the quote and
// the booking already price and refuse by (`stayNightlyRate`). Under `listing.manage`.
exports.RatesDay = zod_1.z.object({
    day: dates_1.CalendarDay,
    /** What one night costs that day: its own price when set, else the room type's. */
    priceRwf: zod_1.z.number().int().min(0),
    /** The day carries its own price. */
    custom: zod_1.z.boolean(),
    closed: zod_1.z.boolean(),
    /** The shortest stay arriving that day, when the day asks for one. */
    minNights: zod_1.z.number().int().positive().nullable(),
    /** Rooms of this type booked or in house that night. */
    sold: zod_1.z.number().int().min(0),
});
exports.RatesRoomType = zod_1.z.object({
    id: primitives_1.Uuid,
    name: zod_1.z.string(),
    propertyName: zod_1.z.string(),
    rooms: zod_1.z.number().int().min(0),
    /** A night's price: for the room (`per_unit`, hotels since 0119) or for each guest (`per_person`). */
    basePriceRwf: zod_1.z.number().int().min(0),
    /** `per_unit` or `per_person`. Optional, so an older API's answer still parses. */
    priceBasis: zod_1.z.string().nullish(),
    /** What one guest pays a night for a room priced per room; null when one guest pays the room price. */
    singleGuestPriceRwf: zod_1.z.number().int().positive().nullish(),
    minStay: zod_1.z.number().int().positive().nullable(),
    maxStay: zod_1.z.number().int().positive().nullable(),
    weeklyDiscountPct: zod_1.z.number().min(0).max(90).nullable(),
    monthlyDiscountPct: zod_1.z.number().min(0).max(90).nullable(),
    days: zod_1.z.array(exports.RatesDay),
});
exports.RatesCalendar = zod_1.z.object({
    from: dates_1.CalendarDay,
    to: dates_1.CalendarDay,
    today: dates_1.CalendarDay,
    roomTypes: zod_1.z.array(exports.RatesRoomType),
});
exports.RATES_CALENDAR_MAX_DAYS = 62;
/** `PUT /ops/rates/days`: set, or clear, the price, the closing and the shortest stay of a run of days. */
exports.RatesDaysUpdate = zod_1.z
    .object({
    roomTypeId: primitives_1.Uuid,
    from: dates_1.CalendarDay,
    to: dates_1.CalendarDay,
    /** A price for each night; null clears it back to the room type's price; absent leaves it. */
    priceRwf: zod_1.z.number().int().positive().max(100000000).nullable().optional(),
    closed: zod_1.z.boolean().optional(),
    minNights: zod_1.z.number().int().positive().max(365).nullable().optional(),
})
    .refine((v) => v.from <= v.to, { message: "The last day comes after the first.", path: ["to"] })
    .refine((v) => v.priceRwf !== undefined || v.closed !== undefined || v.minNights !== undefined, {
    message: "Change the price, the closing or the shortest stay.",
    path: ["priceRwf"],
});
/** `PUT /ops/rates/terms`: a room type's own price, its stay bounds and its long stay discounts. */
exports.RatesTermsUpdate = zod_1.z.object({
    roomTypeId: primitives_1.Uuid,
    basePriceRwf: zod_1.z.number().int().positive().max(100000000).optional(),
    /** One guest's price a night, for a room priced per room; null clears it. */
    singleGuestPriceRwf: zod_1.z.number().int().positive().max(100000000).nullable().optional(),
    minStay: zod_1.z.number().int().positive().max(365).nullable().optional(),
    maxStay: zod_1.z.number().int().positive().max(365).nullable().optional(),
    weeklyDiscountPct: zod_1.z.number().min(0).max(90).nullable().optional(),
    monthlyDiscountPct: zod_1.z.number().min(0).max(90).nullable().optional(),
});
/** A run of days with its own price, closing or shortest stay, from today on (`GET /ops/rates/special-dates`). */
exports.RatesSpecialRange = zod_1.z.object({
    roomTypeId: primitives_1.Uuid,
    roomTypeName: zod_1.z.string(),
    /** The first and the last day of the run. */
    from: dates_1.CalendarDay,
    to: dates_1.CalendarDay,
    /** The run's own price a night; null keeps the room type's price. */
    priceRwf: zod_1.z.number().int().positive().nullable(),
    closed: zod_1.z.boolean(),
    minNights: zod_1.z.number().int().positive().nullable(),
});
exports.RatesSpecialDates = zod_1.z.object({
    today: dates_1.CalendarDay,
    ranges: zod_1.z.array(exports.RatesSpecialRange),
});
/** Days in a row with the same settings make one run; `days` sorted by room type, then day. */
function specialRanges(days) {
    const next = (day) => {
        const d = new Date(`${day}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() + 1);
        return d.toISOString().slice(0, 10);
    };
    const out = [];
    for (const d of days) {
        const last = out[out.length - 1];
        if (last &&
            last.roomTypeId === d.roomTypeId &&
            next(last.to) === d.day &&
            last.priceRwf === d.priceRwf &&
            last.closed === d.closed &&
            last.minNights === d.minNights) {
            last.to = d.day;
            continue;
        }
        out.push({
            roomTypeId: d.roomTypeId,
            roomTypeName: d.roomTypeName,
            from: d.day,
            to: d.day,
            priceRwf: d.priceRwf,
            closed: d.closed,
            minNights: d.minNights,
        });
    }
    return out;
}
//# sourceMappingURL=rates-calendar.js.map