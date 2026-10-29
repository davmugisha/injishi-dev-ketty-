"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RatesTermsUpdate = exports.RatesDaysUpdate = exports.RATES_CALENDAR_MAX_DAYS = exports.RatesCalendar = exports.RatesRoomType = exports.RatesDay = void 0;
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
    basePriceRwf: zod_1.z.number().int().min(0),
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
    minStay: zod_1.z.number().int().positive().max(365).nullable().optional(),
    maxStay: zod_1.z.number().int().positive().max(365).nullable().optional(),
    weeklyDiscountPct: zod_1.z.number().min(0).max(90).nullable().optional(),
    monthlyDiscountPct: zod_1.z.number().min(0).max(90).nullable().optional(),
});
//# sourceMappingURL=rates-calendar.js.map