import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import {
  bookings,
  departments,
  districts,
  ebmInvoices,
  folioCharges,
  folios,
  guestStays,
  housekeepingTasks,
  leases,
  orgs,
  paymentAttempts,
  properties,
  leaseCharges,
  rooms,
  roomTypes,
  serviceOrders,
  workspaces,
} from '../../../database/drizzle/schema';
import { inBranchScope, type BranchScope } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';

/** One branch of a workspace, as the owner's reads name it. */
export interface OwnerBranchRow {
  propertyId: string;
  name: string;
  branchCode: string | null;
  rraBranchId: string | null;
  district: string | null;
  roomCount: number;
  availableRooms: number;
  roomsOutOfOrder: number;
  blockedTasks: number;
}

/** Rooms held and the rates locked on them, per branch and night. */
export interface NightRow {
  propertyId: string;
  night: string;
  soldRooms: number;
  roomRevenueRwf: number;
}

/**
 * The charge types that are revenue, as `revenue.repository.ts` names them: a
 * line of one of these always carries a revenue centre, and a void posts the
 * same type with the amount negated, so a plain sum is the takings net of
 * every correction.
 */
const REVENUE_CHARGE_TYPES = sql`('room', 'service_order', 'pos')`;

/**
 * The only place that touches the database for the owner's figures
 * (`/ops/dashboard/owner`, `/ops/revenue/daily`, `/ops/reports/performance`).
 *
 * Every query is scoped by the workspace the guard proved and the branches the
 * caller covers, never by an id the request names: an owner limited to nothing
 * sees everything, and a manager limited to one lodge sees that lodge.
 *
 * Kigali has no daylight saving, so a night is a calendar day in
 * `Africa/Kigali` and an instant is placed on its day with `at time zone`.
 */
@Injectable()
export class OwnerDashboardRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** The org behind a business workspace: its legal name and TIN. */
  async orgOf(workspaceId: string): Promise<{ legalName: string; tin: string | null } | null> {
    const { rows } = await this.db.execute<{ legal_name: string; tin: string | null }>(sql`
      select o.legal_name, o.tin
        from ${workspaces} w join ${orgs} o on o.id = w.org_id
       where w.id = ${workspaceId}
    `);
    const row = rows[0];
    return row ? { legalName: row.legal_name, tin: row.tin } : null;
  }

  /** Every live branch the caller covers, with its room counts and open exceptions. */
  async branches(workspaceId: string, scope: BranchScope): Promise<OwnerBranchRow[]> {
    const { rows } = await this.db.execute<{
      property_id: string;
      name: string;
      branch_code: string | null;
      rra_branch_id: string | null;
      district: string | null;
      room_count: number;
      available_rooms: number;
      rooms_out_of_order: number;
      blocked_tasks: number;
    }>(sql`
      select p.id as property_id, p.name, p.branch_code, p.rra_branch_id, d.name as district,
             (select count(*) from ${rooms} r where r.property_id = p.id)::int as room_count,
             (select count(*) from ${rooms} r
               where r.property_id = p.id and r.status = 'available')::int as available_rooms,
             (select count(*) from ${rooms} r
               where r.property_id = p.id and r.status <> 'available')::int as rooms_out_of_order,
             (select count(*) from ${housekeepingTasks} t
               where t.property_id = p.id and t.status = 'blocked')::int as blocked_tasks
        from ${properties} p
        left join ${districts} d on d.id = p.district_id
       where p.workspace_id = ${workspaceId}
         and p.archived_at is null
         and ${inBranchScope(sql`p.id`, scope)}
       order by p.is_head_office desc, p.name
    `);
    return rows.map((r) => ({
      propertyId: r.property_id,
      name: r.name,
      branchCode: r.branch_code,
      rraBranchId: r.rra_branch_id,
      district: r.district,
      roomCount: r.room_count,
      availableRooms: r.available_rooms,
      roomsOutOfOrder: r.rooms_out_of_order,
      blockedTasks: r.blocked_tasks,
    }));
  }

  /**
   * Rooms held per branch and night over `[from, to)`: a confirmed booking
   * holds one room for every night from check in up to its check out, and an
   * open walk in stay (no booking) holds its room from the day it arrived until
   * it leaves. The revenue is the nightly rate locked on the booking, tax
   * exclusive; a walk in's price sits on its bill, not here.
   */
  async nights(workspaceId: string, scope: BranchScope, from: string, to: string): Promise<NightRow[]> {
    const { rows } = await this.db.execute<{
      property_id: string;
      night: string;
      sold_rooms: number;
      room_revenue_rwf: string;
    }>(sql`
      with nights as (
        select generate_series(${from}::date, ${to}::date - 1, interval '1 day')::date as night
      ),
      held as (
        select rt.property_id, n.night, b.locked_nightly_rate_rwf as rate
          from ${bookings} b
          join ${roomTypes} rt on rt.id = b.room_type_id
          join nights n on b.check_in <= n.night and b.check_out > n.night
         where b.workspace_id = ${workspaceId}
           and b.status = 'confirmed'
           and rt.domain = 'hospitality'
        union all
        select r.property_id, n.night, 0 as rate
          from ${guestStays} gs
          join ${rooms} r on r.id = gs.room_id
          join nights n
            on (gs.entry_at at time zone 'Africa/Kigali')::date <= n.night
           and coalesce(
                 (coalesce(gs.actual_exit_at, gs.planned_exit_at) at time zone 'Africa/Kigali')::date,
                 n.night + 1
               ) > n.night
         where gs.workspace_id = ${workspaceId}
           and gs.booking_id is null
      )
      select h.property_id, to_char(h.night, 'YYYY-MM-DD') as night,
             count(*)::int as sold_rooms, coalesce(sum(h.rate), 0)::bigint as room_revenue_rwf
        from held h
       where ${inBranchScope(sql`h.property_id`, scope)}
       group by h.property_id, h.night
    `);
    return rows.map((r) => ({
      propertyId: r.property_id,
      night: r.night,
      soldRooms: r.sold_rooms,
      roomRevenueRwf: Number(r.room_revenue_rwf),
    }));
  }

  /** Posted room charges per branch over `[from, to)` by business date, net of voids. */
  async postedRoomRevenue(
    workspaceId: string,
    scope: BranchScope,
    from: string,
    to: string,
  ): Promise<Map<string, number>> {
    const { rows } = await this.db.execute<{ property_id: string; total: string }>(sql`
      select f.property_id, coalesce(sum(c.amount_rwf), 0)::bigint as total
        from ${folioCharges} c
        join ${folios} f on f.id = c.folio_id
       where c.workspace_id = ${workspaceId}
         and c.charge_type = 'room'
         and coalesce(c.business_date, (c.posted_at at time zone 'Africa/Kigali')::date) >= ${from}::date
         and coalesce(c.business_date, (c.posted_at at time zone 'Africa/Kigali')::date) < ${to}::date
         and ${inBranchScope(sql`f.property_id`, scope)}
       group by f.property_id
    `);
    return new Map(rows.map((r) => [r.property_id, Number(r.total)]));
  }

  /**
   * Takings per earned day and USALI category over `[from, to)`, net of voids:
   * a charge belongs to its business date when it has one, else the Kigali day
   * it was posted (the rule `revenue.repository.ts` keeps for the month).
   */
  async revenueByDay(
    workspaceId: string,
    scope: BranchScope,
    from: string,
    to: string,
  ): Promise<{ day: string; category: string; total: number }[]> {
    const { rows } = await this.db.execute<{ day: string; category: string; total: string }>(sql`
      select to_char(coalesce(c.business_date, (c.posted_at at time zone 'Africa/Kigali')::date), 'YYYY-MM-DD') as day,
             d.department_category as category,
             coalesce(sum(c.amount_rwf), 0)::bigint as total
        from ${folioCharges} c
        join ${folios} f on f.id = c.folio_id
        join ${departments} d on d.id = c.department_id
       where c.workspace_id = ${workspaceId}
         and c.charge_type in ${REVENUE_CHARGE_TYPES}
         and coalesce(c.business_date, (c.posted_at at time zone 'Africa/Kigali')::date) >= ${from}::date
         and coalesce(c.business_date, (c.posted_at at time zone 'Africa/Kigali')::date) < ${to}::date
         and ${inBranchScope(sql`f.property_id`, scope)}
       group by 1, 2
    `);
    return rows.map((r) => ({ day: r.day, category: r.category, total: Number(r.total) }));
  }

  /**
   * Money the provider confirmed on `day`, and prompts still waiting on a handset. An attempt reaches its
   * branch through what it pays for: a booking's room type, or a service order's property.
   */
  async payments(
    workspaceId: string,
    scope: BranchScope,
    day: string,
    now: Date,
  ): Promise<{ confirmedRwf: number; confirmedCount: number; promptingRwf: number; promptingCount: number }> {
    const { rows } = await this.db.execute<{
      confirmed_rwf: string;
      confirmed_count: number;
      prompting_rwf: string;
      prompting_count: number;
    }>(sql`
      select
        coalesce(sum(a.amount_rwf) filter (
          where a.state = 'confirmed'
            and (a.settled_at at time zone 'Africa/Kigali')::date = ${day}::date), 0)::bigint as confirmed_rwf,
        (count(*) filter (
          where a.state = 'confirmed'
            and (a.settled_at at time zone 'Africa/Kigali')::date = ${day}::date))::int as confirmed_count,
        coalesce(sum(a.amount_rwf) filter (
          where a.state = 'prompting' and a.expires_at > ${now}), 0)::bigint as prompting_rwf,
        (count(*) filter (where a.state = 'prompting' and a.expires_at > ${now}))::int as prompting_count
      from ${paymentAttempts} a
      left join ${bookings} b on b.id = a.booking_id
      -- A booking prompt names its room type before the booking row exists.
      left join ${roomTypes} rt on rt.id = coalesce(b.room_type_id, a.room_type_id)
      left join ${serviceOrders} so on so.id = a.service_order_id
      where a.workspace_id = ${workspaceId}
        and ${inBranchScope(sql`coalesce(rt.property_id, so.property_id)`, scope)}
    `);
    const r = rows[0];
    return {
      confirmedRwf: Number(r?.confirmed_rwf ?? 0),
      confirmedCount: r?.confirmed_count ?? 0,
      promptingRwf: Number(r?.prompting_rwf ?? 0),
      promptingCount: r?.prompting_count ?? 0,
    };
  }

  /** What open bills of the covered branches still owe. */
  async openBalances(
    workspaceId: string,
    scope: BranchScope,
  ): Promise<{ balanceRwf: number; owing: number }> {
    const { rows } = await this.db.execute<{ balance: string; owing: number }>(sql`
      select coalesce(sum(f.balance_rwf) filter (where f.balance_rwf > 0), 0)::bigint as balance,
             (count(*) filter (where f.balance_rwf > 0))::int as owing
        from ${folios} f
       where f.workspace_id = ${workspaceId}
         and f.status in ('open', 'disputed')
         and ${inBranchScope(sql`f.property_id`, scope)}
    `);
    return { balanceRwf: Number(rows[0]?.balance ?? 0), owing: rows[0]?.owing ?? 0 };
  }

  /**
   * Fiscal receipts of the org still held or failed two hours after they were
   * raised, per RRA branch id (a receipt carries the branch it was signed
   * under, which is how a branch's own counter is kept).
   */
  async fiscalPendingByBranch(workspaceId: string, now: Date): Promise<Map<string, number>> {
    const { rows } = await this.db.execute<{ rra_branch_id: string; pending: number }>(sql`
      select e.rra_branch_id, count(*)::int as pending
        from ${ebmInvoices} e
        join ${workspaces} w on w.org_id = e.org_id
       where w.id = ${workspaceId}
         and e.status in ('held', 'failed')
         and e.created_at < ${now}::timestamptz - interval '2 hours'
       group by e.rra_branch_id
    `);
    return new Map(rows.map((r) => [r.rra_branch_id, r.pending]));
  }

  /** Residence branches: units under an active lease, and leases with rent overdue on `day`. */
  async leasesByBranch(
    workspaceId: string,
    day: string,
  ): Promise<Map<string, { leased: number; arrears: number }>> {
    const { rows } = await this.db.execute<{ property_id: string; leased: number; arrears: number }>(sql`
      select l.property_id,
             (count(distinct l.unit_id) filter (where l.status in ('active', 'ending')))::int as leased,
             (count(distinct l.id) filter (
               where l.status in ('active', 'ending')
                 and exists (
                   -- Overdue is worked out, never stored: open past its due day plus the lease's grace days.
                   select 1 from ${leaseCharges} rc
                    where rc.lease_id = l.id
                      and rc.status = 'open'
                      and rc.due_on + l.grace_days < ${day}::date
                 )))::int as arrears
        from ${leases} l
       where l.workspace_id = ${workspaceId}
       group by l.property_id
    `);
    return new Map(rows.map((r) => [r.property_id, { leased: r.leased, arrears: r.arrears }]));
  }
}
