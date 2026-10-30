import { Inject, Injectable } from '@nestjs/common';
import { sql, type SQL } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../../shared/database/database.module';

export interface RatesRoomTypeRow {
  id: string;
  name: string;
  propertyName: string;
  ratePlanId: string | null;
  rooms: number;
  basePriceRwf: number;
  minStay: number | null;
  maxStay: number | null;
  weeklyDiscountPct: number | null;
  monthlyDiscountPct: number | null;
}

export interface RatesOverrideRow {
  roomTypeId: string;
  day: string;
  rateRwf: number | null;
  blocked: boolean;
  minNights: number | null;
}

/**
 * Prices and availability by the day (2026-10-29). A day's price or closing is a `date_overrides` row on
 * the room type's default rate plan; what is sold is read from bookings and open walk ins. Narrowed to the
 * properties the branch scope covers.
 */
@Injectable()
export class RatesCalendarRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async roomTypes(workspaceId: string, properties: readonly string[]): Promise<RatesRoomTypeRow[]> {
    const { rows } = await this.db.execute<{
      id: string;
      name: string;
      property_name: string;
      rate_plan_id: string | null;
      rooms: number;
      base: string | number | null;
      min_stay: number | null;
      max_stay: number | null;
      weekly: string | null;
      monthly: string | null;
    }>(sql`
      select rt.id, rt.name, p.name as property_name, rp.id as rate_plan_id,
             (select count(*)::int from rooms r where r.room_type_id = rt.id and r.status <> 'out_of_service') as rooms,
             coalesce(rp.base_price_rwf, rt.base_price_rwf) as base,
             coalesce(rp.min_stay, rt.min_stay) as min_stay, coalesce(rp.max_stay, rt.max_stay) as max_stay,
             coalesce(rp.weekly_discount_pct, rt.weekly_discount_pct) as weekly,
             coalesce(rp.monthly_discount_pct, rt.monthly_discount_pct) as monthly
        from room_types rt
        join properties p on p.id = rt.property_id
        left join lateral (
          select * from rate_plans x where x.room_type_id = rt.id and x.status = 'active'
           order by x.is_default desc, x.created_at asc limit 1
        ) rp on true
       where rt.workspace_id = ${workspaceId} and rt.status = 'active' and rt.domain = 'hospitality'
         ${inProperties(sql`rt.property_id`, properties)}
       order by p.name, rt.name`);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      propertyName: r.property_name,
      ratePlanId: r.rate_plan_id,
      rooms: Number(r.rooms),
      basePriceRwf: Number(r.base ?? 0),
      minStay: r.min_stay,
      maxStay: r.max_stay,
      weeklyDiscountPct: r.weekly == null ? null : Number(r.weekly),
      monthlyDiscountPct: r.monthly == null ? null : Number(r.monthly),
    }));
  }

  async overrides(roomTypeIds: readonly string[], from: string, to: string): Promise<RatesOverrideRow[]> {
    if (roomTypeIds.length === 0) return [];
    const { rows } = await this.db.execute<{
      room_type_id: string;
      day: string;
      rate: string | null;
      blocked: boolean;
      min_nights: number | null;
    }>(sql`
      select d.room_type_id, to_char(d.day, 'YYYY-MM-DD') as day, d.custom_nightly_rate_rwf as rate, d.blocked, d.min_nights
        from date_overrides d
        join lateral (
          select x.id from rate_plans x where x.room_type_id = d.room_type_id and x.status = 'active'
           order by x.is_default desc, x.created_at asc limit 1
        ) rp on rp.id = d.rate_plan_id
       where d.room_type_id in (${sql.join(
         roomTypeIds.map((id) => sql`${id}::uuid`),
         sql`, `,
       )})
         and d.day between ${from}::date and ${to}::date`);
    return rows.map((r) => ({
      roomTypeId: r.room_type_id,
      day: r.day,
      rateRwf: r.rate == null ? null : Number(r.rate),
      blocked: r.blocked,
      minNights: r.min_nights,
    }));
  }

  /** Rooms of each type taken on each night: confirmed and requested bookings, and open walk ins. */
  async sold(roomTypeIds: readonly string[], from: string, to: string): Promise<{ roomTypeId: string; day: string; sold: number }[]> {
    if (roomTypeIds.length === 0) return [];
    const ids = sql.join(
      roomTypeIds.map((id) => sql`${id}::uuid`),
      sql`, `,
    );
    const { rows } = await this.db.execute<{ room_type_id: string; day: string; sold: number }>(sql`
      with days as (select generate_series(${from}::date, ${to}::date, interval '1 day')::date as day),
      taken as (
        select b.room_type_id, b.check_in as starts, b.check_out as ends
          from bookings b
         where b.room_type_id in (${ids}) and b.status in ('confirmed', 'pending_approval')
           and b.check_in <= ${to}::date and b.check_out > ${from}::date
        union all
        select r.room_type_id, (gs.entry_at at time zone 'Africa/Kigali')::date,
               greatest((coalesce(gs.planned_exit_at, now() + interval '1 day') at time zone 'Africa/Kigali')::date,
                        (gs.entry_at at time zone 'Africa/Kigali')::date + 1)
          from guest_stays gs join rooms r on r.id = gs.room_id
         where gs.booking_id is null and gs.lifecycle = 'open' and r.room_type_id in (${ids})
      )
      select t.room_type_id, to_char(d.day, 'YYYY-MM-DD') as day, count(*)::int as sold
        from days d join taken t on t.starts <= d.day and d.day < t.ends
       group by 1, 2`);
    return rows.map((r) => ({ roomTypeId: r.room_type_id, day: r.day, sold: Number(r.sold) }));
  }

  /** Set or clear the price, the closing and the shortest stay of every day from `from` to `to`. */
  async writeDays(input: {
    roomTypeId: string;
    ratePlanId: string;
    from: string;
    to: string;
    priceRwf?: number | null;
    closed?: boolean;
    minNights?: number | null;
  }): Promise<void> {
    const setRate = input.priceRwf !== undefined;
    const setClosed = input.closed !== undefined;
    const setMin = input.minNights !== undefined;
    await this.db.execute(sql`
      insert into date_overrides (room_type_id, rate_plan_id, day, custom_nightly_rate_rwf, blocked, min_nights)
      select ${input.roomTypeId}::uuid, ${input.ratePlanId}::uuid, d::date,
             ${setRate ? (input.priceRwf ?? null) : null}::bigint,
             ${setClosed ? Boolean(input.closed) : false},
             ${setMin ? (input.minNights ?? null) : null}::int
        from generate_series(${input.from}::date, ${input.to}::date, interval '1 day') d
      on conflict (room_type_id, rate_plan_id, day) do update set
        custom_nightly_rate_rwf = ${setRate ? sql`excluded.custom_nightly_rate_rwf` : sql`date_overrides.custom_nightly_rate_rwf`},
        blocked = ${setClosed ? sql`excluded.blocked` : sql`date_overrides.blocked`},
        min_nights = ${setMin ? sql`excluded.min_nights` : sql`date_overrides.min_nights`}`);
    // A day left with nothing of its own is no override at all.
    await this.db.execute(sql`
      delete from date_overrides
       where room_type_id = ${input.roomTypeId} and rate_plan_id = ${input.ratePlanId}
         and day between ${input.from}::date and ${input.to}::date
         and custom_nightly_rate_rwf is null and not blocked and min_nights is null
         and max_nights is null and min_stay_arrival is null and max_stay_arrival is null
         and not closed_on_arrival and not closed_on_departure and host_private_note is null`);
  }

  async writeTerms(input: {
    roomTypeId: string;
    ratePlanId: string | null;
    basePriceRwf?: number;
    minStay?: number | null;
    maxStay?: number | null;
    weeklyDiscountPct?: number | null;
    monthlyDiscountPct?: number | null;
  }): Promise<void> {
    const sets = (kind: 'rt' | 'rp'): SQL[] => {
      const out: SQL[] = [];
      if (input.basePriceRwf !== undefined) out.push(sql`base_price_rwf = ${input.basePriceRwf}`);
      if (input.minStay !== undefined) out.push(sql`min_stay = ${input.minStay}`);
      if (input.maxStay !== undefined) out.push(sql`max_stay = ${input.maxStay}`);
      if (input.weeklyDiscountPct !== undefined) out.push(sql`weekly_discount_pct = ${input.weeklyDiscountPct}`);
      if (input.monthlyDiscountPct !== undefined) out.push(sql`monthly_discount_pct = ${input.monthlyDiscountPct}`);
      out.push(kind === 'rt' ? sql`updated_at = now()` : sql`updated_at = now()`);
      return out;
    };
    await this.db.transaction(async (tx) => {
      await tx.execute(sql`update room_types set ${sql.join(sets('rt'), sql`, `)} where id = ${input.roomTypeId}`);
      if (input.ratePlanId) {
        await tx.execute(sql`update rate_plans set ${sql.join(sets('rp'), sql`, `)} where id = ${input.ratePlanId}`);
      }
    });
  }
}

function inProperties(column: SQL, properties: readonly string[]): SQL {
  if (properties.length === 0) return sql`and false`;
  return sql`and ${column} in (${sql.join(
    properties.map((p) => sql`${p}::uuid`),
    sql`, `,
  )})`;
}
