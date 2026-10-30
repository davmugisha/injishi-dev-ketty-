import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  addDays,
  kigaliToday,
  RATES_CALENDAR_MAX_DAYS,
  type RatesCalendar,
  type RatesDaysUpdate,
  type RatesSpecialDates,
  type RatesTermsUpdate,
  specialRanges,
} from '@injishi/contracts';

import type { ScopedWorkspace } from '../../../../shared/auth/branch-scope';
import { RatesCalendarRepository, type RatesRoomTypeRow } from '../infrastructure/rates-calendar.repository';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const span = (from: string, to: string): number => (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;

/**
 * Prices and availability by the day (2026-10-29): what each night costs, which nights are closed, the
 * shortest stay a day asks for, and how many rooms are taken, per room type. Writing a run of days sets
 * the `date_overrides` the quote and the booking price by, so a price set here is the price a guest pays.
 */
@Injectable()
export class RatesCalendarService {
  constructor(private readonly rates: RatesCalendarRepository) {}

  async calendar(ws: ScopedWorkspace, query: { from?: string; to?: string }, now: Date = new Date()): Promise<RatesCalendar> {
    const today = kigaliToday(now);
    const from = query.from ?? today;
    const to = query.to ?? addDays(from, 27);
    if (!DAY.test(from) || !DAY.test(to) || from > to) throw new BadRequestException('from and to must be days, from first.');
    if (span(from, to) >= RATES_CALENDAR_MAX_DAYS) {
      throw new BadRequestException(`Ask for at most ${RATES_CALENDAR_MAX_DAYS} days at a time.`);
    }
    const types = await this.rates.roomTypes(ws.workspaceId, ws.branchScope.propertyIds);
    const ids = types.map((t) => t.id);
    const [overrides, sold] = await Promise.all([this.rates.overrides(ids, from, to), this.rates.sold(ids, from, to)]);
    const over = new Map(overrides.map((o) => [`${o.roomTypeId}:${o.day}`, o]));
    const taken = new Map(sold.map((s) => [`${s.roomTypeId}:${s.day}`, s.sold]));
    const days: string[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
    return {
      from,
      to,
      today,
      roomTypes: types.map((t) => ({
        id: t.id,
        name: t.name,
        propertyName: t.propertyName,
        rooms: t.rooms,
        basePriceRwf: t.basePriceRwf,
        priceBasis: t.priceBasis,
        singleGuestPriceRwf: t.singleGuestPriceRwf,
        minStay: t.minStay,
        maxStay: t.maxStay,
        weeklyDiscountPct: t.weeklyDiscountPct,
        monthlyDiscountPct: t.monthlyDiscountPct,
        days: days.map((day) => {
          const o = over.get(`${t.id}:${day}`);
          return {
            day,
            priceRwf: o?.rateRwf ?? t.basePriceRwf,
            custom: o?.rateRwf != null,
            closed: o?.blocked ?? false,
            minNights: o?.minNights ?? null,
            sold: taken.get(`${t.id}:${day}`) ?? 0,
          };
        }),
      })),
    };
  }

  /** Every run of days from today on with its own price, closing or shortest stay. */
  async specialDates(ws: ScopedWorkspace, now: Date = new Date()): Promise<RatesSpecialDates> {
    const today = kigaliToday(now);
    const types = await this.rates.roomTypes(ws.workspaceId, ws.branchScope.propertyIds);
    const names = new Map(types.map((t) => [t.id, t.name]));
    const days = await this.rates.specialDays(
      types.map((t) => t.id),
      today,
    );
    const ranges = specialRanges(
      days.map((d) => ({
        roomTypeId: d.roomTypeId,
        roomTypeName: names.get(d.roomTypeId) ?? '',
        day: d.day,
        priceRwf: d.rateRwf,
        closed: d.blocked,
        minNights: d.minNights,
      })),
    ).sort((a, b) => a.from.localeCompare(b.from) || a.roomTypeName.localeCompare(b.roomTypeName));
    return { today, ranges };
  }

  async writeDays(ws: ScopedWorkspace, body: RatesDaysUpdate): Promise<RatesCalendar> {
    const type = await this.ownRoomType(ws, body.roomTypeId);
    if (span(body.from, body.to) > 366) throw new BadRequestException('Change at most a year of days at a time.');
    if (body.from < kigaliToday()) throw new BadRequestException('Days in the past cannot change.');
    if (!type.ratePlanId) throw new BadRequestException(`${type.name} has no rate yet. Give it a price first.`);
    await this.rates.writeDays({ ...body, roomTypeId: type.id, ratePlanId: type.ratePlanId });
    return this.calendar(ws, { from: body.from, to: addDays(body.from, Math.min(27, span(body.from, body.to))) });
  }

  async writeTerms(ws: ScopedWorkspace, body: RatesTermsUpdate): Promise<RatesCalendar> {
    const type = await this.ownRoomType(ws, body.roomTypeId);
    const min = body.minStay === undefined ? type.minStay : body.minStay;
    const max = body.maxStay === undefined ? type.maxStay : body.maxStay;
    if (min && max && min > max) throw new BadRequestException('The shortest stay is longer than the longest.');
    if (body.singleGuestPriceRwf != null) {
      if (type.priceBasis !== 'per_unit') {
        throw new BadRequestException(`${type.name} is priced per guest, so it has no one guest price.`);
      }
      const base = body.basePriceRwf ?? type.basePriceRwf;
      if (body.singleGuestPriceRwf >= base) {
        throw new BadRequestException('One guest pays less than the room price. Lower it, or leave it empty.');
      }
    }
    await this.rates.writeTerms({ ratePlanId: type.ratePlanId, ...body });
    return this.calendar(ws, {});
  }

  private async ownRoomType(ws: ScopedWorkspace, roomTypeId: string): Promise<RatesRoomTypeRow> {
    const types = await this.rates.roomTypes(ws.workspaceId, ws.branchScope.propertyIds);
    const type = types.find((t) => t.id === roomTypeId);
    if (!type) throw new NotFoundException('That room type was not found.');
    return type;
  }
}
