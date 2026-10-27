import type { BrokerFeeKind, BrokerFeeTerms } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { DbOrTx } from './rentals-writers';

/** The broker on one lease, with the fee it records and the rating from one side. */
export interface LeaseBrokerRow {
  leaseId: string;
  leaseStatus: string;
  brokerId: string;
  name: string | null;
  phone: string | null;
  placementId: string | null;
  feeKind: BrokerFeeKind | null;
  feePercent: number | null;
  feeRwf: number | null;
  feeStatus: 'pending' | 'disbursed' | null;
  disbursedAt: Date | null;
  stars: number | null;
  comment: string | null;
  ratedAt: Date | null;
}

export interface PlacementRow {
  id: string;
  brokerId: string;
  unitId: string | null;
  workspaceId: string | null;
  status: 'initiated' | 'converted' | 'abandoned' | 'unavailable';
  leaseId: string | null;
  feeKind: BrokerFeeKind | null;
  feePercent: number | null;
  feeRwf: number | null;
}

/** One placement a broker started on a landlord's unit, with the lease it became. */
export interface LandlordPlacementRow extends PlacementRow {
  brokerName: string | null;
  brokerPhone: string | null;
  ratingAverage: number | null;
  ratingCount: number;
  unitLabel: string | null;
  propertyName: string | null;
  tenantName: string | null;
  note: string | null;
  initiatedAt: Date;
  leaseReference: string | null;
  leaseTenantName: string | null;
  leaseStatus: string | null;
  leaseStartDate: string | null;
  leaseRentRwf: number | null;
  feeRecordKind: BrokerFeeKind | null;
  feeRecordPercent: number | null;
  feeRecordRwf: number | null;
  feeStatus: 'pending' | 'disbursed' | null;
  disbursedAt: Date | null;
  stars: number | null;
  comment: string | null;
  ratedAt: Date | null;
}

export interface BrokerPickRow {
  id: string;
  name: string | null;
  phone: string | null;
  ratingAverage: number | null;
  ratingCount: number;
}

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

/**
 * The broker on a lease (2026-10-25): which broker brought the tenant, the
 * placement it came from, the fee agreed (a RECORD; the money moves outside
 * Injishi), and each side's rating of the broker. Raw SQL because every read
 * is a few left joins over the broker tables.
 */
@Injectable()
export class LeaseBrokersRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** The broker on this lease, with the rating the landlord or the tenant gave. */
  async forLease(leaseId: string, role: 'landlord' | 'tenant', db: DbOrTx = this.db): Promise<LeaseBrokerRow | null> {
    const result = await db.execute<Record<string, unknown>>(sql`
      select le.id as lease_id, le.status::text as lease_status, b.id as broker_id, b.name, b.phone,
             le.placement_id, pf.fee_kind::text as fee_kind, pf.percent as fee_percent, pf.amount_rwf as fee_rwf,
             pf.status::text as fee_status, pf.disbursed_at,
             br.stars, br.comment, br.updated_at as rated_at
        from leases le
        join brokers b on b.id = le.broker_id
        left join placement_fees pf on pf.lease_id = le.id and pf.broker_id = b.id
        left join broker_ratings br on br.lease_id = le.id and br.rater_role = ${role}
       where le.id = ${leaseId}
    `);
    const r = result.rows[0];
    if (!r) return null;
    return {
      leaseId: r.lease_id as string,
      leaseStatus: r.lease_status as string,
      brokerId: r.broker_id as string,
      name: (r.name as string | null) ?? null,
      phone: (r.phone as string | null) ?? null,
      placementId: (r.placement_id as string | null) ?? null,
      feeKind: (r.fee_kind as BrokerFeeKind | null) ?? null,
      feePercent: num(r.fee_percent),
      feeRwf: num(r.fee_rwf),
      feeStatus: (r.fee_status as 'pending' | 'disbursed' | null) ?? null,
      disbursedAt: r.disbursed_at ? new Date(r.disbursed_at as string) : null,
      stars: num(r.stars),
      comment: (r.comment as string | null) ?? null,
      ratedAt: r.rated_at ? new Date(r.rated_at as string) : null,
    };
  }

  async activeBroker(brokerId: string, db: DbOrTx = this.db): Promise<boolean> {
    const result = await db.execute(sql`select 1 from brokers where id = ${brokerId} and status = 'active'`);
    return result.rows.length > 0;
  }

  async placement(placementId: string, db: DbOrTx = this.db): Promise<PlacementRow | null> {
    const result = await db.execute<Record<string, unknown>>(sql`
      select id, broker_id, unit_id, workspace_id, status::text as status, lease_id,
             fee_kind::text as fee_kind, fee_percent, fee_rwf
        from tenant_placements where id = ${placementId}
    `);
    return result.rows[0] ? placementOf(result.rows[0]) : null;
  }

  /** The broker's open placement on this unit, if they started one. */
  async openPlacement(brokerId: string, unitId: string, db: DbOrTx = this.db): Promise<PlacementRow | null> {
    const result = await db.execute<Record<string, unknown>>(sql`
      select id, broker_id, unit_id, workspace_id, status::text as status, lease_id,
             fee_kind::text as fee_kind, fee_percent, fee_rwf
        from tenant_placements
       where broker_id = ${brokerId} and unit_id = ${unitId} and status = 'initiated'
       order by initiated_at desc limit 1
    `);
    return result.rows[0] ? placementOf(result.rows[0]) : null;
  }

  /** The placement became this lease. */
  async convert(tx: DbOrTx, placementId: string, leaseId: string): Promise<void> {
    await tx.execute(sql`
      update tenant_placements set status = 'converted', lease_id = ${leaseId}, updated_at = now()
       where id = ${placementId}
    `);
  }

  /** The broker was taken off the lease: its placement is open again. */
  async release(tx: DbOrTx, leaseId: string): Promise<void> {
    await tx.execute(sql`
      update tenant_placements set status = 'initiated', lease_id = null, updated_at = now()
       where lease_id = ${leaseId} and status = 'converted'
    `);
  }

  /** Write what was agreed. A fee already marked paid keeps its terms. */
  async upsertFee(
    tx: DbOrTx,
    input: { leaseId: string; brokerId: string; workspaceId: string; terms: BrokerFeeTerms; amountRwf: number },
  ): Promise<void> {
    const percent = input.terms.kind === 'percent' ? input.terms.percent : null;
    await tx.execute(sql`
      insert into placement_fees (lease_id, broker_id, workspace_id, amount_rwf, fee_kind, percent, status)
      values (${input.leaseId}, ${input.brokerId}, ${input.workspaceId}, ${input.amountRwf}, ${input.terms.kind}, ${percent}, 'pending')
      on conflict (lease_id) do update
         set broker_id = excluded.broker_id, amount_rwf = excluded.amount_rwf,
             fee_kind = excluded.fee_kind, percent = excluded.percent, updated_at = now()
       where placement_fees.status = 'pending'
    `);
  }

  /** The fee as it stands on a lease, for a rent change to recompute a percent. */
  async fee(leaseId: string, db: DbOrTx = this.db): Promise<{ kind: BrokerFeeKind | null; percent: number | null; amountRwf: number | null; status: 'pending' | 'disbursed' } | null> {
    const result = await db.execute<Record<string, unknown>>(sql`
      select fee_kind::text as kind, percent, amount_rwf, status::text as status from placement_fees where lease_id = ${leaseId}
    `);
    const r = result.rows[0];
    return r
      ? { kind: (r.kind as BrokerFeeKind | null) ?? null, percent: num(r.percent), amountRwf: num(r.amount_rwf), status: r.status as 'pending' | 'disbursed' }
      : null;
  }

  /** The broker came off the lease before the fee was paid: the record goes with them. */
  async removeFee(tx: DbOrTx, leaseId: string): Promise<boolean> {
    const result = await tx.execute(sql`delete from placement_fees where lease_id = ${leaseId} and status = 'pending' returning id`);
    return result.rows.length > 0;
  }

  /** The landlord marks the fee paid, or owed again. False when the lease records no fee. */
  async setPaid(tx: DbOrTx, leaseId: string, paid: boolean, userId: string): Promise<boolean> {
    const result = paid
      ? await tx.execute(sql`
          update placement_fees set status = 'disbursed', disbursed_at = coalesce(disbursed_at, now()),
                 disbursed_by_user_id = ${userId}, updated_at = now()
           where lease_id = ${leaseId} returning id`)
      : await tx.execute(sql`
          update placement_fees set status = 'pending', disbursed_at = null, disbursed_by_user_id = null, updated_at = now()
           where lease_id = ${leaseId} returning id`);
    return result.rows.length > 0;
  }

  /** One rating per lease and side; rating again replaces it. */
  async rate(
    tx: DbOrTx,
    input: { brokerId: string; leaseId: string; userId: string; role: 'landlord' | 'tenant'; stars: number; comment: string | null },
  ): Promise<void> {
    await tx.execute(sql`
      insert into broker_ratings (broker_id, lease_id, rater_user_id, rater_role, stars, comment)
      values (${input.brokerId}, ${input.leaseId}, ${input.userId}, ${input.role}, ${input.stars}, ${input.comment})
      on conflict (lease_id, rater_role) do update
         set stars = excluded.stars, comment = excluded.comment, rater_user_id = excluded.rater_user_id, updated_at = now()
    `);
  }

  /** Every placement on this landlord's units, newest first, with the lease and fee it became. */
  async placements(workspaceId: string): Promise<LandlordPlacementRow[]> {
    const result = await this.db.execute<Record<string, unknown>>(sql`
      select tp.id, tp.broker_id, tp.unit_id, tp.workspace_id, tp.status::text as status, tp.lease_id,
             tp.fee_kind::text as fee_kind, tp.fee_percent, tp.fee_rwf, tp.tenant_name, tp.note, tp.initiated_at,
             b.name as broker_name, b.phone as broker_phone,
             (select round(avg(r.stars)::numeric, 1) from broker_ratings r where r.broker_id = b.id) as rating_average,
             (select count(*)::int from broker_ratings r where r.broker_id = b.id) as rating_count,
             u.label as unit_label, p.name as property_name,
             le.reference as lease_reference, t.full_name as lease_tenant_name, le.status::text as lease_status,
             le.start_date::text as lease_start_date, le.monthly_rent_rwf as lease_rent_rwf,
             pf.fee_kind::text as fee_record_kind, pf.percent as fee_record_percent, pf.amount_rwf as fee_record_rwf,
             pf.status::text as fee_status, pf.disbursed_at,
             br.stars, br.comment, br.updated_at as rated_at
        from tenant_placements tp
        join brokers b on b.id = tp.broker_id
        left join rental_units u on u.id = tp.unit_id
        left join properties p on p.id = u.property_id
        left join leases le on le.id = tp.lease_id
        left join tenants t on t.id = le.tenant_id
        left join placement_fees pf on pf.lease_id = le.id
        left join broker_ratings br on br.lease_id = le.id and br.rater_role = 'landlord'
       where tp.workspace_id = ${workspaceId}
       order by tp.initiated_at desc, tp.id
       limit 500
    `);
    return result.rows.map((r) => ({
      ...placementOf(r),
      brokerName: (r.broker_name as string | null) ?? null,
      brokerPhone: (r.broker_phone as string | null) ?? null,
      ratingAverage: num(r.rating_average),
      ratingCount: Number(r.rating_count ?? 0),
      unitLabel: (r.unit_label as string | null) ?? null,
      propertyName: (r.property_name as string | null) ?? null,
      tenantName: (r.tenant_name as string | null) ?? null,
      note: (r.note as string | null) ?? null,
      initiatedAt: new Date(r.initiated_at as string),
      leaseReference: (r.lease_reference as string | null) ?? null,
      leaseTenantName: (r.lease_tenant_name as string | null) ?? null,
      leaseStatus: (r.lease_status as string | null) ?? null,
      leaseStartDate: (r.lease_start_date as string | null) ?? null,
      leaseRentRwf: num(r.lease_rent_rwf),
      feeRecordKind: (r.fee_record_kind as BrokerFeeKind | null) ?? null,
      feeRecordPercent: num(r.fee_record_percent),
      feeRecordRwf: num(r.fee_record_rwf),
      feeStatus: (r.fee_status as 'pending' | 'disbursed' | null) ?? null,
      disbursedAt: r.disbursed_at ? new Date(r.disbursed_at as string) : null,
      stars: num(r.stars),
      comment: (r.comment as string | null) ?? null,
      ratedAt: r.rated_at ? new Date(r.rated_at as string) : null,
    }));
  }

  /** Fees owed and paid over every lease of this landlord that names a broker. */
  async feeTotals(workspaceId: string): Promise<{ owedRwf: number; paidRwf: number }> {
    const result = await this.db.execute<{ owed: string | null; paid: string | null }>(sql`
      select coalesce(sum(pf.amount_rwf) filter (where pf.status = 'pending' and le.status <> 'cancelled'), 0)::text as owed,
             coalesce(sum(pf.amount_rwf) filter (where pf.status = 'disbursed'), 0)::text as paid
        from placement_fees pf
        join leases le on le.id = pf.lease_id
       where le.workspace_id = ${workspaceId}
    `);
    return { owedRwf: Number(result.rows[0]?.owed ?? 0), paidRwf: Number(result.rows[0]?.paid ?? 0) };
  }

  /**
   * Active brokers a landlord can name on a lease: the ones with a placement on
   * this landlord's units first, then the rest by name; filtered by name or phone.
   */
  async pick(workspaceId: string, q: string | null): Promise<BrokerPickRow[]> {
    const like = q ? `%${q}%` : null;
    const result = await this.db.execute<Record<string, unknown>>(sql`
      select b.id, b.name, b.phone,
             (select round(avg(r.stars)::numeric, 1) from broker_ratings r where r.broker_id = b.id) as rating_average,
             (select count(*)::int from broker_ratings r where r.broker_id = b.id) as rating_count,
             exists (select 1 from tenant_placements tp where tp.broker_id = b.id and tp.workspace_id = ${workspaceId} and tp.status = 'initiated') as has_open
        from brokers b
       where b.status = 'active'
         and (${like}::text is null or b.name ilike ${like} or b.phone ilike ${like})
       order by has_open desc, b.name nulls last
       limit 30
    `);
    return result.rows.map((r) => ({
      id: r.id as string,
      name: (r.name as string | null) ?? null,
      phone: (r.phone as string | null) ?? null,
      ratingAverage: num(r.rating_average),
      ratingCount: Number(r.rating_count ?? 0),
    }));
  }

  /** The open placements of these brokers on this landlord's units. */
  async openPlacementsOf(workspaceId: string, brokerIds: readonly string[]): Promise<{ id: string; brokerId: string; unitId: string | null; unitLabel: string | null; tenantName: string | null }[]> {
    if (brokerIds.length === 0) return [];
    const result = await this.db.execute<Record<string, unknown>>(sql`
      select tp.id, tp.broker_id, tp.unit_id, u.label as unit_label, tp.tenant_name
        from tenant_placements tp
        left join rental_units u on u.id = tp.unit_id
       where tp.workspace_id = ${workspaceId} and tp.status = 'initiated'
         and tp.broker_id in (${sql.join(brokerIds.map((id) => sql`${id}`), sql`, `)})
       order by tp.initiated_at desc
    `);
    return result.rows.map((r) => ({
      id: r.id as string,
      brokerId: r.broker_id as string,
      unitId: (r.unit_id as string | null) ?? null,
      unitLabel: (r.unit_label as string | null) ?? null,
      tenantName: (r.tenant_name as string | null) ?? null,
    }));
  }
}

function placementOf(r: Record<string, unknown>): PlacementRow {
  return {
    id: r.id as string,
    brokerId: r.broker_id as string,
    unitId: (r.unit_id as string | null) ?? null,
    workspaceId: (r.workspace_id as string | null) ?? null,
    status: r.status as PlacementRow['status'],
    leaseId: (r.lease_id as string | null) ?? null,
    feeKind: (r.fee_kind as BrokerFeeKind | null) ?? null,
    feePercent: num(r.fee_percent),
    feeRwf: num(r.fee_rwf),
  };
}
