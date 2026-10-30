import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';

import { leasePayments, leases, payoutAccounts, payouts, tenants, workspaces } from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { DbOrTx, Tx } from './rentals-writers';

export type PayoutRow = typeof payouts.$inferSelect;
export type PayoutAccountRow = typeof payoutAccounts.$inferSelect;

/** A payout with the payment it carries, for the landlord's list. */
export interface PayoutListRow {
  payout: PayoutRow;
  accountKind: PayoutAccountRow['kind'] | null;
  payment: { id: string; leaseId: string; leaseReference: string; tenantName: string; receiptNumber: string | null } | null;
}

/** What the payouts pass sends: a landlord's rent, and a host's booking once the guest checks out (0116). */
const SENT_BY_PASS = ['rent', 'booking'] as const;

/**
 * Payouts of rent to the landlord (blueprint 1.4; WP 1.6b): one per gateway
 * payment, keyed `<workspace>:payout:<payment>`, queued to the primary payout
 * account or held until there is one. A host's booking payout (0116) is sent
 * by the same pass; it has no lease, so its business is its workspace's.
 */

@Injectable()
export class PayoutsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async find(id: string, db: DbOrTx = this.db): Promise<PayoutRow | null> {
    const [row] = await db.select().from(payouts).where(eq(payouts.id, id)).limit(1);
    return row ?? null;
  }

  async lock(tx: Tx, id: string): Promise<PayoutRow | null> {
    const [row] = await tx.select().from(payouts).where(eq(payouts.id, id)).for('update').limit(1);
    return row ?? null;
  }

  /** The org's active primary payout account, or null. */
  async primaryAccount(orgId: string, db: DbOrTx = this.db): Promise<PayoutAccountRow | null> {
    const [row] = await db
      .select()
      .from(payoutAccounts)
      .where(and(eq(payoutAccounts.orgId, orgId), eq(payoutAccounts.status, 'active'), eq(payoutAccounts.isPrimary, true)))
      .limit(1);
    return row ?? null;
  }

  async account(id: string, db: DbOrTx = this.db): Promise<PayoutAccountRow | null> {
    const [row] = await db.select().from(payoutAccounts).where(eq(payoutAccounts.id, id)).limit(1);
    return row ?? null;
  }

  /** Create a payout, or answer the one already keyed the same. */
  async insert(tx: DbOrTx, values: typeof payouts.$inferInsert & { idempotencyKey: string }): Promise<PayoutRow> {
    const [row] = await tx.insert(payouts).values(values).onConflictDoNothing({ target: payouts.idempotencyKey }).returning();
    if (row) return row;
    const [existing] = await tx.select().from(payouts).where(eq(payouts.idempotencyKey, values.idempotencyKey)).limit(1);
    if (!existing) throw new Error('payout insert returned nothing');
    return existing;
  }

  async update(tx: DbOrTx, id: string, values: Partial<typeof payouts.$inferInsert>): Promise<void> {
    await tx
      .update(payouts)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(payouts.id, id));
  }

  /** Held payouts, oldest first, with the org they belong to (the payment's lease, else the workspace's). */
  async held(limit = 200, db: DbOrTx = this.db): Promise<(PayoutRow & { orgId: string })[]> {
    const rows = await db
      .select({ payout: payouts, orgId: sql<string | null>`coalesce(${leases.orgId}, ${workspaces.orgId})` })
      .from(payouts)
      .leftJoin(leasePayments, eq(leasePayments.payoutId, payouts.id))
      .leftJoin(leases, eq(leases.id, leasePayments.leaseId))
      .innerJoin(workspaces, eq(workspaces.id, payouts.workspaceId))
      .where(and(eq(payouts.status, 'held'), inArray(payouts.source, SENT_BY_PASS)))
      .orderBy(asc(payouts.createdAt))
      .limit(limit);
    return rows.flatMap((r) => (r.orgId ? [{ ...r.payout, orgId: r.orgId }] : []));
  }

  /** Queued payouts of rent not touched since `before`: ones whose job was lost. */
  async queuedBefore(before: Date, limit = 200, db: DbOrTx = this.db): Promise<PayoutRow[]> {
    return db
      .select()
      .from(payouts)
      .where(and(eq(payouts.status, 'queued'), inArray(payouts.source, SENT_BY_PASS), lt(payouts.updatedAt, before)))
      .orderBy(asc(payouts.createdAt))
      .limit(limit);
  }

  /** The org of a payout: through its payment's lease, else (a host's booking payout) its workspace's. */
  async orgOf(payoutId: string, db: DbOrTx = this.db): Promise<string | null> {
    const [row] = await db
      .select({ orgId: sql<string | null>`coalesce(${leases.orgId}, ${workspaces.orgId})` })
      .from(payouts)
      .leftJoin(leasePayments, eq(leasePayments.payoutId, payouts.id))
      .leftJoin(leases, eq(leases.id, leasePayments.leaseId))
      .innerJoin(workspaces, eq(workspaces.id, payouts.workspaceId))
      .where(eq(payouts.id, payoutId))
      .limit(1);
    return row?.orgId ?? null;
  }

  /** One payout with the payment it carries. */
  async listRow(id: string, db: DbOrTx = this.db): Promise<PayoutListRow | null> {
    const [row] = await this.listQuery(db).where(eq(payouts.id, id)).limit(1);
    return row ? this.toListRow(row) : null;
  }

  // The joined select the list reads start from; its type is drizzle's to infer.
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  private listQuery(db: DbOrTx) {
    return db
      .select({
        payout: payouts,
        accountKind: payoutAccounts.kind,
        paymentId: leasePayments.id,
        leaseId: leases.id,
        leaseReference: leases.reference,
        tenantName: tenants.fullName,
        receiptNumber: leasePayments.receiptNumber,
      })
      .from(payouts)
      .leftJoin(payoutAccounts, eq(payoutAccounts.id, payouts.payoutAccountId))
      .leftJoin(leasePayments, eq(leasePayments.payoutId, payouts.id))
      .leftJoin(leases, eq(leases.id, leasePayments.leaseId))
      .leftJoin(tenants, eq(tenants.id, leases.tenantId));
  }

  private toListRow(r: {
    payout: PayoutRow;
    accountKind: PayoutAccountRow['kind'] | null;
    paymentId: string | null;
    leaseId: string | null;
    leaseReference: string | null;
    tenantName: string | null;
    receiptNumber: string | null;
  }): PayoutListRow {
    return {
      payout: r.payout,
      accountKind: r.accountKind,
      payment: r.paymentId && r.leaseId ? { id: r.paymentId, leaseId: r.leaseId, leaseReference: r.leaseReference ?? '', tenantName: r.tenantName ?? '', receiptNumber: r.receiptNumber } : null,
    };
  }

  /** The workspace's payouts, newest first, by the month they were made and by status. */
  async list(
    input: {
      workspaceId: string;
      month: string | null;
      status: PayoutRow['status'] | null;
      propertyIds: readonly string[] | null;
      /** Rent for a landlord, bookings for a host (0116). */
      source?: 'rent' | 'booking';
    },
    db: DbOrTx = this.db,
  ): Promise<PayoutListRow[]> {
    const rows = await this.listQuery(db)
      .where(
        and(
          eq(payouts.workspaceId, input.workspaceId),
          eq(payouts.source, input.source ?? 'rent'),
          input.month ? sql`to_char(${payouts.createdAt} at time zone 'Africa/Kigali', 'YYYY-MM') = ${input.month}` : undefined,
          input.status ? eq(payouts.status, input.status) : undefined,
          input.propertyIds === null
            ? undefined
            : input.propertyIds.length > 0
              ? or(isNull(leases.id), inArray(leases.propertyId, [...input.propertyIds]))
              : sql`false`,
        ),
      )
      .orderBy(desc(payouts.createdAt), desc(payouts.id))
      .limit(500);
    return rows.map((r) => this.toListRow(r));
  }
}
