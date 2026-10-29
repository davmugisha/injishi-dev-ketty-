import { z } from "zod";
import { Uuid } from "./primitives";
import { CalendarDay } from "./rentals/dates";

// ===========================================================================
// Prices and availability, by the day (2026-10-29)
// ===========================================================================
//
// `GET /api/v1/ops/rates/calendar?from=&to=` (at most 62 days) and the two writes under it. A day price
// or a closed day is a `date_overrides` row on the room type's default rate plan, the rows the quote and
// the booking already price and refuse by (`stayNightlyRate`). Under `listing.manage`.

export const RatesDay = z.object({
  day: CalendarDay,
  /** What one night costs that day: its own price when set, else the room type's. */
  priceRwf: z.number().int().min(0),
  /** The day carries its own price. */
  custom: z.boolean(),
  closed: z.boolean(),
  /** The shortest stay arriving that day, when the day asks for one. */
  minNights: z.number().int().positive().nullable(),
  /** Rooms of this type booked or in house that night. */
  sold: z.number().int().min(0),
});
export type RatesDay = z.infer<typeof RatesDay>;

export const RatesRoomType = z.object({
  id: Uuid,
  name: z.string(),
  propertyName: z.string(),
  rooms: z.number().int().min(0),
  basePriceRwf: z.number().int().min(0),
  minStay: z.number().int().positive().nullable(),
  maxStay: z.number().int().positive().nullable(),
  weeklyDiscountPct: z.number().min(0).max(90).nullable(),
  monthlyDiscountPct: z.number().min(0).max(90).nullable(),
  days: z.array(RatesDay),
});
export type RatesRoomType = z.infer<typeof RatesRoomType>;

export const RatesCalendar = z.object({
  from: CalendarDay,
  to: CalendarDay,
  today: CalendarDay,
  roomTypes: z.array(RatesRoomType),
});
export type RatesCalendar = z.infer<typeof RatesCalendar>;

export const RATES_CALENDAR_MAX_DAYS = 62;

/** `PUT /ops/rates/days`: set, or clear, the price, the closing and the shortest stay of a run of days. */
export const RatesDaysUpdate = z
  .object({
    roomTypeId: Uuid,
    from: CalendarDay,
    to: CalendarDay,
    /** A price for each night; null clears it back to the room type's price; absent leaves it. */
    priceRwf: z.number().int().positive().max(100_000_000).nullable().optional(),
    closed: z.boolean().optional(),
    minNights: z.number().int().positive().max(365).nullable().optional(),
  })
  .refine((v) => v.from <= v.to, { message: "The last day comes after the first.", path: ["to"] })
  .refine((v) => v.priceRwf !== undefined || v.closed !== undefined || v.minNights !== undefined, {
    message: "Change the price, the closing or the shortest stay.",
    path: ["priceRwf"],
  });
export type RatesDaysUpdate = z.infer<typeof RatesDaysUpdate>;

/** `PUT /ops/rates/terms`: a room type's own price, its stay bounds and its long stay discounts. */
export const RatesTermsUpdate = z.object({
  roomTypeId: Uuid,
  basePriceRwf: z.number().int().positive().max(100_000_000).optional(),
  minStay: z.number().int().positive().max(365).nullable().optional(),
  maxStay: z.number().int().positive().max(365).nullable().optional(),
  weeklyDiscountPct: z.number().min(0).max(90).nullable().optional(),
  monthlyDiscountPct: z.number().min(0).max(90).nullable().optional(),
});
export type RatesTermsUpdate = z.infer<typeof RatesTermsUpdate>;
