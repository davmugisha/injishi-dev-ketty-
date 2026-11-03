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
  /** A night's price: for the room (`per_unit`, hotels since 0119) or for each guest (`per_person`). */
  basePriceRwf: z.number().int().min(0),
  /** `per_unit` or `per_person`. Optional, so an older API's answer still parses. */
  priceBasis: z.string().nullish(),
  /** What one guest pays a night for a room priced per room; null when one guest pays the room price. */
  singleGuestPriceRwf: z.number().int().positive().nullish(),
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
  /** One guest's price a night, for a room priced per room; null clears it. */
  singleGuestPriceRwf: z.number().int().positive().max(100_000_000).nullable().optional(),
  minStay: z.number().int().positive().max(365).nullable().optional(),
  maxStay: z.number().int().positive().max(365).nullable().optional(),
  weeklyDiscountPct: z.number().min(0).max(90).nullable().optional(),
  monthlyDiscountPct: z.number().min(0).max(90).nullable().optional(),
});
export type RatesTermsUpdate = z.infer<typeof RatesTermsUpdate>;

/** A run of days with its own price, closing or shortest stay, from today on (`GET /ops/rates/special-dates`). */
export const RatesSpecialRange = z.object({
  roomTypeId: Uuid,
  roomTypeName: z.string(),
  /** The first and the last day of the run. */
  from: CalendarDay,
  to: CalendarDay,
  /** The run's own price a night; null keeps the room type's price. */
  priceRwf: z.number().int().positive().nullable(),
  closed: z.boolean(),
  minNights: z.number().int().positive().nullable(),
});
export type RatesSpecialRange = z.infer<typeof RatesSpecialRange>;

export const RatesSpecialDates = z.object({
  today: CalendarDay,
  ranges: z.array(RatesSpecialRange),
});
export type RatesSpecialDates = z.infer<typeof RatesSpecialDates>;

/** Days in a row with the same settings make one run; `days` sorted by room type, then day. */
export function specialRanges(
  days: readonly {
    roomTypeId: string;
    roomTypeName: string;
    day: string;
    priceRwf: number | null;
    closed: boolean;
    minNights: number | null;
  }[],
): RatesSpecialRange[] {
  const next = (day: string) => {
    const d = new Date(`${day}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  };
  const out: RatesSpecialRange[] = [];
  for (const d of days) {
    const last = out[out.length - 1];
    if (
      last &&
      last.roomTypeId === d.roomTypeId &&
      next(last.to) === d.day &&
      last.priceRwf === d.priceRwf &&
      last.closed === d.closed &&
      last.minNights === d.minNights
    ) {
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
