import { Inject, Injectable } from '@nestjs/common';
import type { LeasePaymentStatus, LeaseStatus } from '@injishi/contracts';
import { and, asc, desc, eq, inArray, sql, type AnyColumn, type SQL } from 'drizzle-orm';

import {
  leaseCharges,
  leasePayments,
  leases,
  properties,
  propertyBlocks,
  rentalUnits,
  tenants,
} from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { ChargeRow } from './lease-charges.repository';
import type { PaymentRow } from './lease-payments.repository';
import type { DbOrTx } from './rentals-writers';

/** The buildings a read is limited to: null for every building of the workspace. */
export type BuildingIds = readonly string[] | null;

/** A lease on the roll, with the names it is shown with. */
export interface RollLease {
  id: string;
  reference: string;
  status: LeaseStatus;
  startDate: string;
  endDate: string;
  billingStartsOn: string;
  monthlyRentRwf: number;
  rentDueDay: number;
  graceDays: number;
  tenant: { id: string; fullName: string; email: string | null; phone: string | null };
  unit: { id: string; label: string; blockCode: string | null; propertyName: string };
  propertyId: string;
}

/** `<column> in (...)` for a limited branch scope; nothing for every building; never true for none. */
function within(column: SQL | AnyColumn, buildings: BuildingIds): SQL | undefined {
  if (buildings === null) return undefined;
  if (buildings.length === 0) return sql`false`;
  return sql`${column} in (${sql.join(
    buildings.map((id) => sql`${id}::uuid`),
    sql`, `,
  )})`;
}

/**
 * The reads of the Rent area (blueprint 3.5 "Rent"; WP 1.6a): the roll's
 * leases, charges by lease or month, payments by lease or month, and the
 * month's figures. Every figure is worked out from the rows.
 */
@Injectable()
export class RentRollRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** The leases the roll lists: active and ending, plus any lease with a charge in the month. */
  async rollLeases(workspaceId: string, buildings: BuildingIds, month: string, db: DbOrTx = this.db): Promise<RollLease[]> {
    const rows = await db
      .select({
        id: leases.id,
        reference: leases.reference,
        status: leases.status,
        startDate: leases.startDate,
        endDate: leases.endDate,
        billingStartsOn: leases.billingStartsOn,
        monthlyRentRwf: leases.monthlyRentRwf,
        rentDueDay: leases.rentDueDay,
        graceDays: leases.graceDays,
        propertyId: leases.propertyId,
        tenantId: tenants.id,
        tenantName: tenants.fullName,
        tenantEmail: tenants.email,
        tenantPhone: tenants.phone,
        unitId: rentalUnits.id,
        unitLabel: rentalUnits.label,
        blockCode: propertyBlocks.code,
        propertyName: properties.name,
      })
      .from(leases)
      .innerJoin(tenants, eq(tenants.id, leases.tenantId))
      .innerJoin(rentalUnits, eq(rentalUnits.id, leases.unitId))
      .innerJoin(properties, eq(properties.id, leases.propertyId))
      .leftJoin(propertyBlocks, eq(propertyBlocks.id, rentalUnits.blockId))
      .where(
        and(
          eq(leases.workspaceId, workspaceId),
          within(leases.propertyId, buildings),
          sql`(${leases.status} in ('active', 'ending')
            or exists (select 1 from lease_charges c where c.lease_id = ${leases.id} and c.kind = 'rent' and to_char(c.period_start, 'YYYY-MM') = ${month}))`,
        ),
      )
      .orderBy(asc(properties.name), asc(rentalUnits.label), asc(leases.startDate));
    return rows.map((r) => ({
      id: r.id,
      reference: r.reference,
      status: r.status,
      startDate: r.startDate,
      endDate: r.endDate,
      billingStartsOn: r.billingStartsOn,
      monthlyRentRwf: r.monthlyRentRwf,
      rentDueDay: r.rentDueDay,
      graceDays: r.graceDays,
      propertyId: r.propertyId,
      tenant: { id: r.tenantId, fullName: r.tenantName, email: r.tenantEmail, phone: r.tenantPhone },
      unit: { id: r.unitId, label: r.unitLabel, blockCode: r.blockCode, propertyName: r.propertyName },
    }));
  }

  /** The rent charges of `leaseIds` whose period starts in `month`. */
  async monthCharges(leaseIds: readonly string[], month: string, db: DbOrTx = this.db): Promise<ChargeRow[]> {
    if (leaseIds.length === 0) return [];
    return db
      .select()
      .from(leaseCharges)
      .where(and(inArray(leaseCharges.leaseId, [...leaseIds]), eq(leaseCharges.kind, 'rent'), sql`to_char(${leaseCharges.periodStart}, 'YYYY-MM') = ${month}`));
  }

  /** The last succeeded payment on each of `leaseIds`. */
  async lastPayments(leaseIds: readonly string[], db: DbOrTx = this.db): Promise<Map<string, PaymentRow>> {
    if (leaseIds.length === 0) return new Map();
    const rows = await db
      .select()
      .from(leasePayments)
      .where(and(inArray(leasePayments.leaseId, [...leaseIds]), eq(leasePayments.status, 'succeeded')))
      .orderBy(desc(leasePayments.succeededAt), desc(leasePayments.createdAt));
    const out = new Map<string, PaymentRow>();
    for (const r of rows) if (!out.has(r.leaseId)) out.set(r.leaseId, r);
    return out;
  }

  /** Charges of the workspace by lease, or by the month they fall due, with the lease's grace days. */
  async charges(
    input: { workspaceId: string; buildings: BuildingIds; leaseId: string | null; month: string | null },
    db: DbOrTx = this.db,
  ): Promise<(ChargeRow & { graceDays: number; leaseReference: string })[]> {
    const rows = await db
      .select({ charge: leaseCharges, graceDays: leases.graceDays, leaseReference: leases.reference })
      .from(leaseCharges)
      .innerJoin(leases, eq(leases.id, leaseCharges.leaseId))
      .where(
        and(
          eq(leases.workspaceId, input.workspaceId),
          within(leases.propertyId, input.buildings),
          input.leaseId ? eq(leaseCharges.leaseId, input.leaseId) : undefined,
          input.month ? sql`to_char(${leaseCharges.dueOn}, 'YYYY-MM') = ${input.month}` : undefined,
        ),
      )
      .orderBy(asc(leaseCharges.dueOn), asc(leaseCharges.createdAt))
      .limit(1000);
    return rows.map((r) => ({ ...r.charge, graceDays: r.graceDays, leaseReference: r.leaseReference }));
  }

  /** Payments of the workspace by lease, or by the Kigali month the money arrived (or was asked for). */
  async payments(
    input: { workspaceId: string; buildings: BuildingIds; leaseId: string | null; month: string | null; status: LeasePaymentStatus | null },
    db: DbOrTx = this.db,
  ): Promise<PaymentRow[]> {
    return db
      .select()
      .from(leasePayments)
      .where(
        and(
          eq(leasePayments.workspaceId, input.workspaceId),
          within(leasePayments.propertyId, input.buildings),
          input.leaseId ? eq(leasePayments.leaseId, input.leaseId) : undefined,
          input.month
            ? sql`to_char(coalesce(${leasePayments.receivedOn}, (${leasePayments.succeededAt} at time zone 'Africa/Kigali')::date, (${leasePayments.createdAt} at time zone 'Africa/Kigali')::date), 'YYYY-MM') = ${input.month}`
            : undefined,
          input.status ? eq(leasePayments.status, input.status) : undefined,
        ),
      )
      .orderBy(desc(leasePayments.createdAt), desc(leasePayments.id))
      .limit(500);
  }

  /** The names a payment is shown with, for several leases at once. */
  async leaseNames(leaseIds: readonly string[], db: DbOrTx = this.db): Promise<Map<string, { reference: string; tenantId: string; tenantName: string; unitId: string; unitLabel: string; propertyName: string }>> {
    if (leaseIds.length === 0) return new Map();
    const rows = await db
      .select({
        id: leases.id,
        reference: leases.reference,
        tenantId: tenants.id,
        tenantName: tenants.fullName,
        unitId: rentalUnits.id,
        unitLabel: rentalUnits.label,
        propertyName: properties.name,
      })
      .from(leases)
      .innerJoin(tenants, eq(tenants.id, leases.tenantId))
      .innerJoin(rentalUnits, eq(rentalUnits.id, leases.unitId))
      .innerJoin(properties, eq(properties.id, leases.propertyId))
      .where(inArray(leases.id, [...leaseIds]));
    return new Map(rows.map((r) => [r.id, r]));
  }

  /** The month's figures beyond expected and collected (which the overview repository already works out). */
  async monthFigures(
    workspaceId: string,
    buildings: BuildingIds,
    month: string,
    today: string,
  ): Promise<{
    outstandingRwf: number;
    overdueRwf: number;
    overdueCharges: number;
    depositsCollectedRwf: number;
    pendingRwf: number;
    paidOutRwf: number;
    heldRwf: number;
    creditHeldRwf: number;
  }> {
    const scope = buildings === null ? sql`` : buildings.length === 0 ? sql`and false` : sql`and l.property_id in (${sql.join(buildings.map((id) => sql`${id}::uuid`), sql`, `)})`;
    const { rows } = await this.db.execute<{
      outstanding: string | number;
      overdue: string | number;
      overdue_charges: number;
      deposits: string | number;
      pending: string | number;
      paid_out: string | number;
      held: string | number;
      credit: string | number;
    }>(sql`
      with scoped as (select l.id, l.property_id, l.grace_days from leases l where l.workspace_id = ${workspaceId} ${scope})
      select
        coalesce((select sum(c.amount_rwf - c.paid_rwf) from lease_charges c join scoped l on l.id = c.lease_id
                   where c.kind = 'rent' and c.status = 'open' and to_char(c.due_on, 'YYYY-MM') = ${month}), 0)::bigint as outstanding,
        coalesce((select sum(c.amount_rwf - c.paid_rwf) from lease_charges c join scoped l on l.id = c.lease_id
                   where c.kind = 'rent' and c.status = 'open' and c.due_on + l.grace_days < ${today}::date), 0)::bigint as overdue,
        (select count(*) from lease_charges c join scoped l on l.id = c.lease_id
                   where c.kind = 'rent' and c.status = 'open' and c.due_on + l.grace_days < ${today}::date)::int as overdue_charges,
        coalesce((select sum(a.amount_rwf) from lease_payment_allocations a
                   join lease_payments p on p.id = a.payment_id join lease_charges c on c.id = a.charge_id join scoped l on l.id = p.lease_id
                   where p.status = 'succeeded' and a.released_at is null and c.kind = 'deposit'
                     and to_char(coalesce(p.received_on, (p.succeeded_at at time zone 'Africa/Kigali')::date), 'YYYY-MM') = ${month}), 0)::bigint as deposits,
        coalesce((select sum(p.amount_rwf) from lease_payments p join scoped l on l.id = p.lease_id where p.status = 'pending'), 0)::bigint as pending,
        coalesce((select sum(po.amount_rwf) from payouts po join lease_payments p on p.payout_id = po.id join scoped l on l.id = p.lease_id
                   where po.status = 'paid' and to_char(po.settled_at at time zone 'Africa/Kigali', 'YYYY-MM') = ${month}), 0)::bigint as paid_out,
        coalesce((select sum(po.amount_rwf) from payouts po join lease_payments p on p.payout_id = po.id join scoped l on l.id = p.lease_id
                   where po.status = 'held'), 0)::bigint as held,
        coalesce((select sum(p.amount_rwf - coalesce((select sum(a.amount_rwf) from lease_payment_allocations a where a.payment_id = p.id and a.released_at is null), 0))
                   from lease_payments p join scoped l on l.id = p.lease_id where p.status = 'succeeded'), 0)::bigint as credit
    `);
    const r = rows[0];
    return {
      outstandingRwf: Number(r?.outstanding ?? 0),
      overdueRwf: Number(r?.overdue ?? 0),
      overdueCharges: Number(r?.overdue_charges ?? 0),
      depositsCollectedRwf: Number(r?.deposits ?? 0),
      pendingRwf: Number(r?.pending ?? 0),
      paidOutRwf: Number(r?.paid_out ?? 0),
      heldRwf: Number(r?.held ?? 0),
      creditHeldRwf: Number(r?.credit ?? 0),
    };
  }
}
