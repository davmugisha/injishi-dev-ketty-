import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';

import { leaseCharges, leaseDeposits } from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { DbOrTx } from './rentals-writers';

export type ChargeRow = typeof leaseCharges.$inferSelect;

/** A charge raised by this call (a repeat that found it already there answers null). */
export interface RaisedCharge {
  id: string;
  kind: 'rent' | 'deposit';
  periodStart: string | null;
  periodEnd: string | null;
  dueOn: string;
  amountRwf: number;
}

/**
 * Raising what a lease asks the tenant to pay (WP 1.5b): the deposit when the
 * tenant signs, the rent due soon when the tenancy starts, and voiding an
 * unpaid deposit when a lease that never started is cancelled.
 *
 * Every raise is safe to repeat: the unique indexes (one deposit charge per
 * lease, one rent charge per lease and period start) turn a second raise into
 * nothing, which is what lets the RentCycle job (WP 1.6a) and a landlord's
 * Start both raise without coordinating.
 */
@Injectable()
export class LeaseChargesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * The deposit charge and the deposit record that follows it. Answers the
   * charge when this call raised it, null when it was already there.
   */
  async raiseDeposit(
    tx: DbOrTx,
    input: { leaseId: string; workspaceId: string; dueOn: string; amountRwf: number },
  ): Promise<RaisedCharge | null> {
    const [charge] = await tx
      .insert(leaseCharges)
      .values({ leaseId: input.leaseId, kind: 'deposit', dueOn: input.dueOn, amountRwf: input.amountRwf })
      .onConflictDoNothing()
      .returning({ id: leaseCharges.id });
    if (!charge) return null;
    await tx
      .insert(leaseDeposits)
      .values({
        workspaceId: input.workspaceId,
        leaseId: input.leaseId,
        agreedRwf: input.amountRwf,
        chargeId: charge.id,
        status: 'awaiting',
      })
      .onConflictDoNothing();
    return { id: charge.id, kind: 'deposit', periodStart: null, periodEnd: null, dueOn: input.dueOn, amountRwf: input.amountRwf };
  }

  /** The period starts of the rent charges already raised on a lease. */
  async rentPeriodsRaised(leaseId: string, db: DbOrTx = this.db): Promise<string[]> {
    const rows = await db
      .select({ periodStart: leaseCharges.periodStart })
      .from(leaseCharges)
      .where(and(eq(leaseCharges.leaseId, leaseId), eq(leaseCharges.kind, 'rent')));
    return rows.map((r) => r.periodStart).filter((p): p is string => p !== null);
  }

  /** One month's rent. Null when that period was already charged. */
  async raiseRent(
    tx: DbOrTx,
    input: { leaseId: string; periodStart: string; periodEnd: string; dueOn: string; amountRwf: number },
  ): Promise<RaisedCharge | null> {
    const [row] = await tx
      .insert(leaseCharges)
      .values({
        leaseId: input.leaseId,
        kind: 'rent',
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        dueOn: input.dueOn,
        amountRwf: input.amountRwf,
      })
      .onConflictDoNothing()
      .returning({ id: leaseCharges.id });
    if (!row) return null;
    return { id: row.id, kind: 'rent', ...input };
  }

  /** What is still open on a lease, oldest due first. */
  async openCharges(leaseId: string, db: DbOrTx = this.db): Promise<ChargeRow[]> {
    return db
      .select()
      .from(leaseCharges)
      .where(and(eq(leaseCharges.leaseId, leaseId), eq(leaseCharges.status, 'open')))
      .orderBy(asc(leaseCharges.dueOn), asc(leaseCharges.createdAt));
  }

  /**
   * Void the deposit of a lease cancelled before it started, when nothing was
   * paid on it: the charge is waived with the reason, and the deposit record
   * is settled at nothing kept and nothing to return. A deposit with money on
   * it is left for the deposit settlement (WP 1.7). Answers what it did.
   */
  async voidUnpaidDeposit(
    tx: DbOrTx,
    leaseId: string,
    userId: string,
    reason: string,
  ): Promise<'voided' | 'paid_kept' | 'none'> {
    const [charge] = await tx
      .select()
      .from(leaseCharges)
      .where(and(eq(leaseCharges.leaseId, leaseId), eq(leaseCharges.kind, 'deposit')))
      .for('update')
      .limit(1);
    if (!charge || charge.status !== 'open') return 'none';
    if (charge.paidRwf > 0) return 'paid_kept';
    const now = new Date();
    await tx
      .update(leaseCharges)
      .set({ status: 'waived', waivedReason: reason, updatedAt: now })
      .where(eq(leaseCharges.id, charge.id));
    await tx
      .update(leaseDeposits)
      .set({
        status: 'settled',
        keptRwf: 0,
        refundedRwf: 0,
        refundMethod: 'none',
        settledAt: now,
        settledByUserId: userId,
        updatedAt: now,
      })
      .where(and(eq(leaseDeposits.chargeId, charge.id), sql`${leaseDeposits.status} <> 'settled'`));
    return 'voided';
  }
}
