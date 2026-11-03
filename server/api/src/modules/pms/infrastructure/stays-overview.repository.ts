import { Inject, Injectable } from '@nestjs/common';
import { sql, type SQL } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';

/** The properties a read covers: the branch scope's concrete list (never empty for a member). */
export type PropertyIds = readonly string[];

export interface StayBusinessFacts {
  orgName: string;
  kind: string;
  rooms: number;
  roomTypes: number;
  properties: number;
  propertyName: string | null;
}

export interface StayCountFacts {
  arrivalsToday: number;
  departuresToday: number;
  inHouse: number;
  requestsWaiting: number;
}

export interface StayActivityRow {
  id: string;
  source: 'booking' | 'walk_in';
  reference: string | null;
  guestName: string | null;
  roomTypeName: string;
  roomLabel: string | null;
  checkIn: string;
  checkOut: string;
  bookingStatus: string | null;
  stayLifecycle: string | null;
  channel: string | null;
  nightlyRwf: number;
  totalRwf: number;
}

/**
 * The short-stay home's reads (2026-10-29). Every one is narrowed to the properties the branch scope
 * covers and reads Kigali days. Bookings and walk ins are read together because the home counts nights
 * and the calendar shows arrivals, and a walk in has no booking.
 */
@Injectable()
export class StaysOverviewRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async business(workspaceId: string, properties: PropertyIds): Promise<StayBusinessFacts | null> {
    const { rows } = await this.db.execute<{
      org_name: string;
      kind: string;
      rooms: number;
      room_types: number;
      properties: number;
      property_name: string | null;
    }>(sql`
      select o.legal_name as org_name, o.business_kind::text as kind,
             (select count(*)::int from rooms r join room_types rt on rt.id = r.room_type_id
               where r.workspace_id = ${workspaceId} and rt.status = 'active' and r.status <> 'out_of_service'
                 ${inProperties(sql`r.property_id`, properties)}) as rooms,
             (select count(*)::int from room_types rt
               where rt.workspace_id = ${workspaceId} and rt.status = 'active'
                 ${inProperties(sql`rt.property_id`, properties)}) as room_types,
             (select count(*)::int from properties p
               where p.workspace_id = ${workspaceId} and p.archived_at is null
                 ${inProperties(sql`p.id`, properties)}) as properties,
             (select min(p.name) from properties p
               where p.workspace_id = ${workspaceId} and p.archived_at is null
                 ${inProperties(sql`p.id`, properties)}) as property_name
        from workspaces w
        join orgs o on o.id = w.org_id
       where w.id = ${workspaceId}
    `);
    const r = rows[0];
    if (!r) return null;
    return {
      orgName: r.org_name,
      kind: r.kind,
      rooms: Number(r.rooms),
      roomTypes: Number(r.room_types),
      properties: Number(r.properties),
      propertyName: Number(r.properties) === 1 ? r.property_name : null,
    };
  }

  async counts(workspaceId: string, properties: PropertyIds, today: string): Promise<StayCountFacts> {
    const { rows } = await this.db.execute<{
      arrivals: number;
      departures: number;
      in_house: number;
      requests: number;
    }>(sql`
      with b as (
        select b.id, b.status, b.check_in, b.check_out
          from bookings b join room_types rt on rt.id = b.room_type_id
         where b.workspace_id = ${workspaceId} ${inProperties(sql`rt.property_id`, properties)}
      ), s as (
        select gs.id, gs.booking_id, gs.lifecycle,
               (coalesce(gs.planned_exit_at, gs.entry_at + interval '1 day') at time zone 'Africa/Kigali')::date as leaves
          from guest_stays gs join rooms r on r.id = gs.room_id
         where gs.workspace_id = ${workspaceId} ${inProperties(sql`r.property_id`, properties)}
      )
      select
        (select count(*)::int from b where b.status = 'confirmed' and b.check_in = ${today}::date
            and not exists (select 1 from s where s.booking_id = b.id)) as arrivals,
        (select count(*)::int from s where s.lifecycle = 'open' and s.leaves <= ${today}::date) as departures,
        (select count(*)::int from s where s.lifecycle = 'open') as in_house,
        (select count(*)::int from b where b.status = 'pending_approval') as requests
    `);
    const r = rows[0];
    return {
      arrivalsToday: Number(r?.arrivals ?? 0),
      departuresToday: Number(r?.departures ?? 0),
      inHouse: Number(r?.in_house ?? 0),
      requestsWaiting: Number(r?.requests ?? 0),
    };
  }

  /** Bookings and walk ins with a night between `from` and `to`, oldest first. At most 3,000. */
  async stays(workspaceId: string, properties: PropertyIds, from: string, to: string): Promise<StayActivityRow[]> {
    const { rows } = await this.db.execute<{
      id: string;
      source: 'booking' | 'walk_in';
      reference: string | null;
      guest_name: string | null;
      room_type_name: string;
      room_label: string | null;
      check_in: string;
      check_out: string;
      booking_status: string | null;
      stay_lifecycle: string | null;
      channel: string | null;
      nightly: string | number;
      total: string | number;
    }>(sql`
      select * from (
        select b.id, 'booking' as source, b.reference,
               coalesce(gs.guest_name, u.name, u.email) as guest_name,
               rt.name as room_type_name, r.label as room_label,
               to_char(b.check_in, 'YYYY-MM-DD') as check_in, to_char(b.check_out, 'YYYY-MM-DD') as check_out,
               b.status::text as booking_status, gs.lifecycle::text as stay_lifecycle, b.channel::text as channel,
               b.locked_nightly_rate_rwf as nightly, b.gross_rwf as total
          from bookings b
          join room_types rt on rt.id = b.room_type_id
          left join users u on u.id = b.guest_user_id
          left join lateral (
            select g.guest_name, g.lifecycle, g.room_id from guest_stays g
             where g.booking_id = b.id order by g.entry_at desc limit 1
          ) gs on true
          left join rooms r on r.id = gs.room_id
         where b.workspace_id = ${workspaceId}
           and b.check_in <= ${to}::date and b.check_out > ${from}::date
           ${inProperties(sql`rt.property_id`, properties)}
        union all
        select gs.id, 'walk_in' as source, gs.reference, gs.guest_name,
               rt.name, r.label,
               to_char((gs.entry_at at time zone 'Africa/Kigali')::date, 'YYYY-MM-DD'),
               to_char(greatest(
                 (coalesce(gs.actual_exit_at, gs.planned_exit_at, now() + interval '1 day') at time zone 'Africa/Kigali')::date,
                 (gs.entry_at at time zone 'Africa/Kigali')::date + 1), 'YYYY-MM-DD'),
               null, gs.lifecycle::text, 'walk_in',
               coalesce(gs.price_rwf, 0), coalesce(gs.price_rwf, 0)
          from guest_stays gs
          join rooms r on r.id = gs.room_id
          join room_types rt on rt.id = r.room_type_id
         where gs.workspace_id = ${workspaceId}
           and gs.booking_id is null
           and (gs.entry_at at time zone 'Africa/Kigali')::date <= ${to}::date
           and (coalesce(gs.actual_exit_at, gs.planned_exit_at, now() + interval '1 day') at time zone 'Africa/Kigali')::date >= ${from}::date
           ${inProperties(sql`r.property_id`, properties)}
      ) x
      order by x.check_in, x.id
      limit 3000
    `);
    return rows.map((r) => ({
      id: r.id,
      source: r.source,
      reference: r.reference,
      guestName: r.guest_name,
      roomTypeName: r.room_type_name,
      roomLabel: r.room_label,
      checkIn: r.check_in,
      checkOut: r.check_out,
      bookingStatus: r.booking_status,
      stayLifecycle: r.stay_lifecycle,
      channel: r.channel,
      nightlyRwf: Number(r.nightly),
      totalRwf: Number(r.total),
    }));
  }

  /** Payments less refunds on guests' bills, per business day, from `from` to `to`. */
  async payments(workspaceId: string, properties: PropertyIds, from: string, to: string): Promise<{ day: string; amountRwf: number }[]> {
    const { rows } = await this.db.execute<{ day: string; amount: string | number }>(sql`
      select to_char(fc.business_date, 'YYYY-MM-DD') as day,
             sum(case when fc.charge_type = 'payment' then abs(fc.amount_rwf) else -abs(fc.amount_rwf) end)::bigint as amount
        from folio_charges fc
        join folios f on f.id = fc.folio_id
       where f.workspace_id = ${workspaceId}
         and fc.charge_type in ('payment', 'refund')
         and fc.business_date between ${from}::date and ${to}::date
         ${inProperties(sql`f.property_id`, properties)}
       group by 1
       order by 1
    `);
    return rows.map((r) => ({ day: r.day, amountRwf: Number(r.amount) }));
  }
}

/** `and <column> in (...)` for the scope's properties; never true for none. */
function inProperties(column: SQL, properties: PropertyIds): SQL {
  if (properties.length === 0) return sql`and false`;
  return sql`and ${column} in (${sql.join(
    properties.map((p) => sql`${p}::uuid`),
    sql`, `,
  )})`;
}
