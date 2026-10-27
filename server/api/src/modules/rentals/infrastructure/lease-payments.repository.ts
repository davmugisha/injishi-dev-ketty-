import { Inject, Injectable } from '@nestjs/common';
import {
  allocatePayment,
  applyCredit,
  chargeStatusAfter,
  nextReceiptNumber,
  type Allocation,
  type AllocatableCharge,
  type PaymentCredit,
} from '@injishi/contracts';
import { and, asc, desc, eq, inArray, isNull, lt, sql } from 'drizzle-orm';

import {
  leaseCharges,
  leaseDeposits,
  leasePaymentAllocations,
  leasePayments,
  payoutAccounts,
  payouts,
  users,
} from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { ChargeRow } from './lease-charges.repository';
import type { DbOrTx, Tx } from './rentals-writers';

export type PaymentRow = typeof leasePayments.$inferSelect;
export type AllocationRow = typeof leasePaymentAllocations.$inferSelect;
export type PayoutRow = typeof payouts.$inferSelect;

/** A payment with what hangs off it: its live allocations, the payout it went on with, who recorded it. */
export interface PaymentRecord {
  payment: PaymentRow;
  allocations: (AllocationRow & { charge: ChargeRow })[];
  payout: (PayoutRow & { account: Pick<typeof payoutAccounts.$inferSelect, 'kind'> | null }) | null;
  recordedByName: string | null;
}

/** What one allocation pass did to the charges, so the caller can write events and the deposit. */
export interface AllocationOutcome {
  allocations: Allocation[];
  allocatedRwf: number;
  creditRwf: number;
  /** Charges that became fully paid in this pass. */
  paidChargeIds: string[];
  /** The deposit charge became paid: the deposit is now held. */
  depositPaid: boolean;
}

function allocatable(c: ChargeRow): AllocatableCharge {
  return { id: c.id, dueOn: c.dueOn, amountRwf: c.amountRwf, paidRwf: c.paidRwf, status: c.status, periodStart: c.periodStart, kind: c.kind };
}

/**
 * Payments on a lease and what they pay (blueprint 1.2, 1.4; WP 1.6): the
 * rows, the allocations written with the matching `paid_rwf` in one
 * transaction under a lock on the charges, a tenant's credit, receipt numbers,
 * and the reads the rent screens and the settlement job make.
 */
@Injectable()
export class LeasePaymentsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // --- Reads -------------------------------------------------------------------------

  async find(id: string, db: DbOrTx = this.db): Promise<PaymentRow | null> {
    const [row] = await db.select().from(leasePayments).where(eq(leasePayments.id, id)).limit(1);
    return row ?? null;
  }

  async findByKey(idempotencyKey: string, db: DbOrTx = this.db): Promise<PaymentRow | null> {
    const [row] = await db.select().from(leasePayments).where(eq(leasePayments.idempotencyKey, idempotencyKey)).limit(1);
    return row ?? null;
  }

  async findByAdapterRef(adapterRef: string, db: DbOrTx = this.db): Promise<PaymentRow | null> {
    const [row] = await db.select().from(leasePayments).where(eq(leasePayments.adapterRef, adapterRef)).limit(1);
    return row ?? null;
  }

  /** The payment row alone, locked for the rest of the transaction. */
  async lock(tx: Tx, id: string): Promise<PaymentRow | null> {
    const [row] = await tx.select().from(leasePayments).where(eq(leasePayments.id, id)).for('update').limit(1);
    return row ?? null;
  }

  /** The whole record of one payment: allocations with their charges, the payout, the recorder. */
  async record(id: string, db: DbOrTx = this.db): Promise<PaymentRecord | null> {
    const payment = await this.find(id, db);
    if (!payment) return null;
    const [records] = await this.records([payment], db);
    return records ?? null;
  }

  /** The records of several payments, in the order given. */
  async records(rows: readonly PaymentRow[], db: DbOrTx = this.db): Promise<PaymentRecord[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const allocations = await db
      .select({ allocation: leasePaymentAllocations, charge: leaseCharges })
      .from(leasePaymentAllocations)
      .innerJoin(leaseCharges, eq(leaseCharges.id, leasePaymentAllocations.chargeId))
      .where(and(inArray(leasePaymentAllocations.paymentId, ids), isNull(leasePaymentAllocations.releasedAt)))
      .orderBy(asc(leaseCharges.dueOn), asc(leaseCharges.createdAt));
    const payoutIds = rows.map((r) => r.payoutId).filter((p): p is string => p !== null);
    const payoutRows =
      payoutIds.length > 0
        ? await db
            .select({ payout: payouts, accountKind: payoutAccounts.kind })
            .from(payouts)
            .leftJoin(payoutAccounts, eq(payoutAccounts.id, payouts.payoutAccountId))
            .where(inArray(payouts.id, payoutIds))
        : [];
    const recorderIds = [...new Set(rows.map((r) => r.recordedByUserId).filter((u): u is string => u !== null))];
    const recorders = recorderIds.length > 0 ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, recorderIds)) : [];
    const byName = new Map(recorders.map((r) => [r.id, r.name]));
    return rows.map((payment) => {
      const payout = payment.payoutId ? (payoutRows.find((p) => p.payout.id === payment.payoutId) ?? null) : null;
      return {
        payment,
        allocations: allocations.filter((a) => a.allocation.paymentId === payment.id).map((a) => ({ ...a.allocation, charge: a.charge })),
        payout: payout ? { ...payout.payout, account: payout.accountKind ? { kind: payout.accountKind } : null } : null,
        recordedByName: payment.recordedByUserId ? (byName.get(payment.recordedByUserId) ?? null) : null,
      };
    });
  }

  /** A lease's payments, newest first. */
  async forLease(leaseId: string, db: DbOrTx = this.db): Promise<PaymentRow[]> {
    return db.select().from(leasePayments).where(eq(leasePayments.leaseId, leaseId)).orderBy(desc(leasePayments.createdAt), desc(leasePayments.id));
  }

  /** The gateway payment of a lease still waiting on a phone, if any. */
  async pendingForLease(leaseId: string, db: DbOrTx = this.db): Promise<PaymentRow | null> {
    const [row] = await db
      .select()
      .from(leasePayments)
      .where(and(eq(leasePayments.leaseId, leaseId), eq(leasePayments.status, 'pending')))
      .orderBy(desc(leasePayments.createdAt))
      .limit(1);
    return row ?? null;
  }

  /** Every gateway payment still pending, oldest first: the settlement sweep's list. */
  async pending(limit = 200, db: DbOrTx = this.db): Promise<PaymentRow[]> {
    return db
      .select()
      .from(leasePayments)
      .where(and(eq(leasePayments.status, 'pending'), eq(leasePayments.channel, 'gateway')))
      .orderBy(asc(leasePayments.createdAt))
      .limit(limit);
  }

  /** Pending payments whose prompt window closed before `now`. */
  async expiredBefore(now: Date, db: DbOrTx = this.db): Promise<PaymentRow[]> {
    return db
      .select()
      .from(leasePayments)
      .where(and(eq(leasePayments.status, 'pending'), lt(leasePayments.expiresAt, now)))
      .orderBy(asc(leasePayments.createdAt));
  }

  // --- Charges, locked -------------------------------------------------------------------

  /** A lease's charges, locked for the rest of the transaction, oldest due first. */
  async lockCharges(tx: Tx, leaseId: string): Promise<ChargeRow[]> {
    return tx
      .select()
      .from(leaseCharges)
      .where(eq(leaseCharges.leaseId, leaseId))
      .orderBy(asc(leaseCharges.dueOn), asc(leaseCharges.createdAt))
      .for('update');
  }

  /**
   * The credit a lease's tenant holds: every succeeded payment's amount less
   * its live allocations, oldest payment first. Worked out from the rows,
   * never stored, so a reversal or a release never leaves a stale figure.
   */
  async credits(leaseId: string, db: DbOrTx = this.db): Promise<PaymentCredit[]> {
    const rows = await db
      .select({
        paymentId: leasePayments.id,
        amountRwf: leasePayments.amountRwf,
        // Written out: drizzle renders a column of the selected table unqualified in a select list,
        // and `a.payment_id = "id"` would compare the allocation to its own id.
        allocated: sql<string>`coalesce((select sum(a.amount_rwf) from lease_payment_allocations a where a.payment_id = lease_payments.id and a.released_at is null), 0)`,
      })
      .from(leasePayments)
      .where(and(eq(leasePayments.leaseId, leaseId), eq(leasePayments.status, 'succeeded')))
      .orderBy(asc(leasePayments.succeededAt), asc(leasePayments.createdAt));
    return rows.map((r) => ({ paymentId: r.paymentId, amountRwf: r.amountRwf - Number(r.allocated) })).filter((c) => c.amountRwf > 0);
  }

  /**
   * Spread one payment over the lease's charges, in the caller's transaction
   * with the charges locked: oldest due first, or exactly the charges named.
   * Writes the allocations and the matching `paid_rwf`, marks a deposit held
   * when its charge is now paid, and answers what it did.
   */
  async allocate(
    tx: Tx,
    input: { paymentId: string; leaseId: string; amountRwf: number; chargeIds?: readonly string[] | null; paidAt: Date },
  ): Promise<AllocationOutcome> {
    const charges = await this.lockCharges(tx, input.leaseId);
    const result = allocatePayment(input.amountRwf, charges.map(allocatable), input.chargeIds ? { chargeIds: input.chargeIds } : {});
    const applied = await this.writeAllocations(tx, charges, result.allocations.map((a) => ({ ...a, paymentId: input.paymentId })), input.paidAt);
    return { ...result, ...applied };
  }

  /**
   * Use the tenant's credit on charges just raised (the rent cycle): the
   * oldest credit first, onto the oldest charge first. Charges are expected
   * locked by the caller (it holds the lease row); they are locked again here.
   */
  async applyCredit(tx: Tx, input: { leaseId: string; chargeIds: readonly string[]; paidAt: Date }): Promise<AllocationOutcome> {
    if (input.chargeIds.length === 0) return { allocations: [], allocatedRwf: 0, creditRwf: 0, paidChargeIds: [], depositPaid: false };
    const credits = await this.credits(input.leaseId, tx);
    if (credits.length === 0) return { allocations: [], allocatedRwf: 0, creditRwf: 0, paidChargeIds: [], depositPaid: false };
    const charges = await this.lockCharges(tx, input.leaseId);
    const chosen = charges.filter((c) => input.chargeIds.includes(c.id) && c.status === 'open' && c.paidRwf < c.amountRwf);
    if (chosen.length === 0) return { allocations: [], allocatedRwf: 0, creditRwf: 0, paidChargeIds: [], depositPaid: false };
    const { allocations, remaining } = applyCredit(credits, chosen.map(allocatable));
    const applied = await this.writeAllocations(tx, charges, allocations, input.paidAt);
    return {
      allocations: allocations.map((a) => ({ chargeId: a.chargeId, amountRwf: a.amountRwf })),
      allocatedRwf: allocations.reduce((s, a) => s + a.amountRwf, 0),
      creditRwf: remaining.reduce((s, c) => s + c.amountRwf, 0),
      ...applied,
    };
  }

  private async writeAllocations(
    tx: Tx,
    charges: readonly ChargeRow[],
    allocations: readonly { paymentId: string; chargeId: string; amountRwf: number }[],
    paidAt: Date,
  ): Promise<{ paidChargeIds: string[]; depositPaid: boolean }> {
    const paidChargeIds: string[] = [];
    let depositPaid = false;
    const byCharge = new Map<string, number>();
    for (const a of allocations) byCharge.set(a.chargeId, (byCharge.get(a.chargeId) ?? 0) + a.amountRwf);
    if (allocations.length > 0) {
      await tx.insert(leasePaymentAllocations).values(allocations.map((a) => ({ paymentId: a.paymentId, chargeId: a.chargeId, amountRwf: a.amountRwf })));
    }
    for (const [chargeId, extra] of byCharge) {
      const charge = charges.find((c) => c.id === chargeId);
      if (!charge) throw new Error(`charge ${chargeId} is not on this lease`);
      const paidRwf = charge.paidRwf + extra;
      const status = chargeStatusAfter({ amountRwf: charge.amountRwf, status: charge.status }, paidRwf);
      await tx
        .update(leaseCharges)
        .set({ paidRwf, status, paidAt: status === 'paid' ? paidAt : null, updatedAt: paidAt })
        .where(eq(leaseCharges.id, chargeId));
      if (status === 'paid') {
        paidChargeIds.push(chargeId);
        if (charge.kind === 'deposit') {
          depositPaid = true;
          await tx
            .update(leaseDeposits)
            .set({ status: 'held', updatedAt: paidAt })
            .where(and(eq(leaseDeposits.chargeId, chargeId), eq(leaseDeposits.status, 'awaiting')));
        }
      }
    }
    return { paidChargeIds, depositPaid };
  }

  /**
   * Release a payment's live allocations (a reversal): each charge gives the
   * money back, reopens, and a deposit no longer paid goes back to awaiting.
   * Answers the charges touched and what was released.
   */
  async release(tx: Tx, paymentId: string, leaseId: string, at: Date): Promise<{ releasedRwf: number; chargeIds: string[] }> {
    const charges = await this.lockCharges(tx, leaseId);
    const live = await tx
      .select()
      .from(leasePaymentAllocations)
      .where(and(eq(leasePaymentAllocations.paymentId, paymentId), isNull(leasePaymentAllocations.releasedAt)));
    let releasedRwf = 0;
    const chargeIds: string[] = [];
    for (const a of live) {
      const charge = charges.find((c) => c.id === a.chargeId);
      if (!charge) continue;
      const paidRwf = Math.max(0, charge.paidRwf - a.amountRwf);
      const status = charge.status === 'waived' ? 'waived' : 'open';
      await tx.update(leaseCharges).set({ paidRwf, status, paidAt: null, updatedAt: at }).where(eq(leaseCharges.id, charge.id));
      if (charge.kind === 'deposit') {
        await tx.update(leaseDeposits).set({ status: 'awaiting', updatedAt: at }).where(and(eq(leaseDeposits.chargeId, charge.id), eq(leaseDeposits.status, 'held')));
      }
      releasedRwf += a.amountRwf;
      chargeIds.push(charge.id);
    }
    if (live.length > 0) {
      await tx
        .update(leasePaymentAllocations)
        .set({ releasedAt: at })
        .where(and(eq(leasePaymentAllocations.paymentId, paymentId), isNull(leasePaymentAllocations.releasedAt)));
    }
    return { releasedRwf, chargeIds };
  }

  // --- Writes --------------------------------------------------------------------------------

  async insert(tx: DbOrTx, values: typeof leasePayments.$inferInsert): Promise<PaymentRow> {
    const [row] = await tx.insert(leasePayments).values(values).returning();
    if (!row) throw new Error('payment insert returned nothing');
    return row;
  }

  async update(tx: DbOrTx, id: string, values: Partial<typeof leasePayments.$inferInsert>): Promise<void> {
    await tx
      .update(leasePayments)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(leasePayments.id, id));
  }

  /**
   * The next receipt number of a business for `year`, under an advisory lock
   * on the business so two receipts never share one. Called inside the
   * transaction that writes the payment.
   */
  async nextReceiptNumber(tx: Tx, workspaceId: string, year: number): Promise<string> {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`rent-receipt:${workspaceId}`}))`);
    const rows = await tx
      .select({ n: leasePayments.receiptNumber })
      .from(leasePayments)
      .where(and(eq(leasePayments.workspaceId, workspaceId), sql`${leasePayments.receiptNumber} like ${`R-${year}-%`}`));
    return nextReceiptNumber(
      year,
      rows.map((r) => r.n).filter((n): n is string => n !== null),
    );
  }

  /** Waive an open charge: forgiven, with the reason. Answers the charge as it was, or null when not open. */
  async waive(tx: Tx, chargeId: string, reason: string, at: Date): Promise<ChargeRow | null> {
    const [charge] = await tx.select().from(leaseCharges).where(eq(leaseCharges.id, chargeId)).for('update').limit(1);
    if (!charge || charge.status !== 'open') return charge ?? null;
    await tx.update(leaseCharges).set({ status: 'waived', waivedReason: reason, updatedAt: at }).where(eq(leaseCharges.id, chargeId));
    return charge;
  }

  async charge(chargeId: string, db: DbOrTx = this.db): Promise<ChargeRow | null> {
    const [row] = await db.select().from(leaseCharges).where(eq(leaseCharges.id, chargeId)).limit(1);
    return row ?? null;
  }

  async charges(ids: readonly string[], db: DbOrTx = this.db): Promise<ChargeRow[]> {
    if (ids.length === 0) return [];
    return db.select().from(leaseCharges).where(inArray(leaseCharges.id, [...ids]));
  }

  /** A lease's charges, oldest due first, every status. */
  async chargesOf(leaseId: string, db: DbOrTx = this.db): Promise<ChargeRow[]> {
    return db.select().from(leaseCharges).where(eq(leaseCharges.leaseId, leaseId)).orderBy(asc(leaseCharges.dueOn), asc(leaseCharges.createdAt));
  }
}
