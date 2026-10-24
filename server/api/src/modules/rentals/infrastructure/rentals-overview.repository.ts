import { Inject, Injectable } from '@nestjs/common';
import { sql, type SQL } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';

/** The buildings a read is limited to: null for every building of the workspace. */
export type BuildingIds = readonly string[] | null;

export interface UnitCounts {
  units: number;
  occupied: number;
  reserved: number;
  vacant: number;
  offMarket: number;
}

export interface OverdueFacts {
  charges: number;
  leases: number;
  amountRwf: number;
}

export interface MonthAmount {
  month: string;
  amountRwf: number;
}

/**
 * The landlord home's reads (blueprint 3.5, "Overview"): counts over units,
 * leases, notices and filings, and rent expected and collected by Kigali
 * month. Every figure is worked out from the rows, never stored:
 *
 *   occupied   a lease on the unit is active or ending
 *   reserved   none is, but one is signed or out for signing
 *   overdue    an open rent charge past its due day plus the lease's grace days
 *   expected   rent charges due in a month, not waived
 *   collected  live allocations to rent charges of payments that succeeded,
 *              counted on the day the money arrived (`received_on` for a
 *              recorded payment, else `succeeded_at` in Kigali)
 */
@Injectable()
export class RentalsOverviewRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async unitCounts(workspaceId: string, buildings: BuildingIds): Promise<UnitCounts> {
    const { rows } = await this.db.execute<{
      units: number;
      occupied: number;
      reserved: number;
      vacant: number;
      off_market: number;
    }>(sql`
      with u as (
        select u.state,
               exists (select 1 from leases l where l.unit_id = u.id and l.status in ('active', 'ending')) as occupied,
               exists (select 1 from leases l where l.unit_id = u.id and l.status in ('pending_signature', 'signed')) as reserved
          from rental_units u
         where u.workspace_id = ${workspaceId} and u.state <> 'retired' ${within(sql`u.property_id`, buildings)}
      )
      select count(*)::int as units,
             count(*) filter (where occupied)::int as occupied,
             count(*) filter (where not occupied and reserved)::int as reserved,
             count(*) filter (where not occupied and not reserved and state = 'active')::int as vacant,
             count(*) filter (where not occupied and state = 'off_market')::int as off_market
        from u
    `);
    const row = rows[0];
    return {
      units: Number(row?.units ?? 0),
      occupied: Number(row?.occupied ?? 0),
      reserved: Number(row?.reserved ?? 0),
      vacant: Number(row?.vacant ?? 0),
      offMarket: Number(row?.off_market ?? 0),
    };
  }

  async buildingCount(workspaceId: string, buildings: BuildingIds): Promise<number> {
    const { rows } = await this.db.execute<{ n: number }>(sql`
      select count(*)::int as n from properties p
       where p.workspace_id = ${workspaceId} and p.archived_at is null ${within(sql`p.id`, buildings)}
    `);
    return Number(rows[0]?.n ?? 0);
  }

  /** People with a tenancy running (active or ending). */
  async liveTenants(workspaceId: string, buildings: BuildingIds): Promise<number> {
    const { rows } = await this.db.execute<{ n: number }>(sql`
      select count(distinct l.tenant_id)::int as n from leases l
       where l.workspace_id = ${workspaceId} and l.status in ('active', 'ending') ${within(sql`l.property_id`, buildings)}
    `);
    return Number(rows[0]?.n ?? 0);
  }

  /** How many leases each status holds. */
  async leaseStatusCounts(workspaceId: string, buildings: BuildingIds): Promise<Record<string, number>> {
    const { rows } = await this.db.execute<{ status: string; n: number }>(sql`
      select l.status::text as status, count(*)::int as n from leases l
       where l.workspace_id = ${workspaceId} ${within(sql`l.property_id`, buildings)}
       group by l.status
    `);
    return Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]));
  }

  async overdue(workspaceId: string, buildings: BuildingIds, today: string): Promise<OverdueFacts> {
    const { rows } = await this.db.execute<{ charges: number; leases: number; amount: string | number }>(sql`
      select count(*)::int as charges,
             count(distinct c.lease_id)::int as leases,
             coalesce(sum(c.amount_rwf - c.paid_rwf), 0)::bigint as amount
        from lease_charges c
        join leases l on l.id = c.lease_id
       where l.workspace_id = ${workspaceId}
         and c.kind = 'rent' and c.status = 'open'
         and c.due_on + l.grace_days < ${today}::date
         ${within(sql`l.property_id`, buildings)}
    `);
    const row = rows[0];
    return { charges: Number(row?.charges ?? 0), leases: Number(row?.leases ?? 0), amountRwf: Number(row?.amount ?? 0) };
  }

  /** Rent charges due in each month from `from` to `to` (days), not waived. */
  async expectedByMonth(workspaceId: string, buildings: BuildingIds, from: string, to: string): Promise<MonthAmount[]> {
    const { rows } = await this.db.execute<{ month: string; amount: string | number }>(sql`
      select to_char(c.due_on, 'YYYY-MM') as month, sum(c.amount_rwf)::bigint as amount
        from lease_charges c
        join leases l on l.id = c.lease_id
       where l.workspace_id = ${workspaceId}
         and c.kind = 'rent' and c.status <> 'waived'
         and c.due_on between ${from}::date and ${to}::date
         ${within(sql`l.property_id`, buildings)}
       group by 1
    `);
    return rows.map((r) => ({ month: r.month, amountRwf: Number(r.amount) }));
  }

  /** Rent paid in each month from `from` to `to` (days), by the day the money arrived in Kigali. */
  async collectedByMonth(workspaceId: string, buildings: BuildingIds, from: string, to: string): Promise<MonthAmount[]> {
    const { rows } = await this.db.execute<{ month: string; amount: string | number }>(sql`
      with paid as (
        select a.amount_rwf,
               coalesce(p.received_on, (p.succeeded_at at time zone 'Africa/Kigali')::date) as paid_on
          from lease_payment_allocations a
          join lease_payments p on p.id = a.payment_id
          join lease_charges c on c.id = a.charge_id
         where p.workspace_id = ${workspaceId}
           and p.status = 'succeeded'
           and a.released_at is null
           and c.kind = 'rent'
           ${within(sql`p.property_id`, buildings)}
      )
      select to_char(paid_on, 'YYYY-MM') as month, sum(amount_rwf)::bigint as amount
        from paid
       where paid_on between ${from}::date and ${to}::date
       group by 1
    `);
    return rows.map((r) => ({ month: r.month, amountRwf: Number(r.amount) }));
  }

  /** Move out notices nobody acknowledged yet. */
  async noticesToAcknowledge(workspaceId: string, buildings: BuildingIds): Promise<number> {
    const { rows } = await this.db.execute<{ n: number }>(sql`
      select count(*)::int as n
        from move_out_notices n
        join leases l on l.id = n.lease_id
       where l.workspace_id = ${workspaceId} and n.status = 'submitted' ${within(sql`l.property_id`, buildings)}
    `);
    return Number(rows[0]?.n ?? 0);
  }

  /** RRA lease filings not marked filed, and how many of them are past their due day. */
  async filingsDue(workspaceId: string, buildings: BuildingIds, today: string): Promise<{ due: number; late: number }> {
    const { rows } = await this.db.execute<{ due: number; late: number }>(sql`
      select count(*)::int as due,
             count(*) filter (where f.due_on < ${today}::date)::int as late
        from lease_filings f
        join leases l on l.id = f.lease_id
       where l.workspace_id = ${workspaceId} and f.status = 'pending' ${within(sql`l.property_id`, buildings)}
    `);
    return { due: Number(rows[0]?.due ?? 0), late: Number(rows[0]?.late ?? 0) };
  }
}

/** `and <column> in (...)` for a limited branch scope; nothing for every building; never true for none. */
function within(column: SQL, buildings: BuildingIds): SQL {
  if (buildings === null) return sql``;
  if (buildings.length === 0) return sql`and false`;
  return sql`and ${column} in (${sql.join(
    buildings.map((id) => sql`${id}::uuid`),
    sql`, `,
  )})`;
}
