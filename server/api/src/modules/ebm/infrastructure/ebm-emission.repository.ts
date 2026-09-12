import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, lte, sql } from 'drizzle-orm';

import { bookings, ebmInvoices } from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

export type EbmEmissionRow = typeof ebmInvoices.$inferSelect;

/**
 * What an emission row's `payload` holds once it has been sent (ADR-041).
 *
 * `request` is exactly what was sent and `response` exactly what came back —
 * the only local record of what the Authority certified. `totals` are the
 * figures this platform priced BEFORE sending, which the receipt must agree
 * with. `readError` is set when the sale was certified but its answer could not
 * be printed (a device field missing): the row is emitted — the sale IS
 * declared — and the receipt refuses with this reason until someone looks.
 */
export interface EmissionPayload {
  request: unknown;
  totals: { totalRwf: number; totalTaxRwf: number; itemsNumber: number };
  response?: Record<string, unknown>;
  readError?: string;
}

/**
 * `ebm_invoices` as the emission worker drives it.
 *
 * THE STATE MACHINE (architecture-schema.md §8.4, extended by ADR-041):
 *
 *   held    + next_attempt_at = T   → due at T
 *   held    + next_attempt_at NULL  → waiting on the business's setup; re-armed
 *                                     when the connection becomes usable
 *   failed  + next_attempt_at = T   → the sale certainly did not certify; retry at T
 *   failed  + next_attempt_at NULL  → nobody knows whether it certified, or the
 *                                     provider refused it outright; a PERSON acts
 *   emitted                         → certified; names the provider's invoice
 *
 * `claim()` moves a due row to `failed + NULL` BEFORE the provider is called.
 * That is not pessimism, it is the honest state of a row mid-call: until the
 * answer arrives nobody knows whether the sale certified, and if this process
 * dies before it does, the row stays exactly where it should — waiting for a
 * person, never re-sent by the next sweep.
 */
@Injectable()
export class EbmEmissionRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * A sale that must be certified, written once per booking. The key makes a
   * second call — a retried request, a second approval click — a no-op.
   */
  async insertHeld(input: {
    bookingId: string;
    orgId: string;
    tin: string | null;
    idempotencyKey: string;
    dueAt: Date;
  }): Promise<{ id: string; created: boolean }> {
    const [created] = await this.db
      .insert(ebmInvoices)
      .values({
        source: 'booking',
        bookingId: input.bookingId,
        orgId: input.orgId,
        tin: input.tin,
        tinType: 'host',
        status: 'held',
        adapterMode: 'live',
        idempotencyKey: input.idempotencyKey,
        nextAttemptAt: input.dueAt,
      })
      .onConflictDoNothing({ target: ebmInvoices.idempotencyKey })
      .returning({ id: ebmInvoices.id });
    if (created) return { id: created.id, created: true };

    const [existing] = await this.db
      .select({ id: ebmInvoices.id })
      .from(ebmInvoices)
      .where(eq(ebmInvoices.idempotencyKey, input.idempotencyKey))
      .limit(1);
    if (!existing) {
      throw new Error(
        `ebm_invoices refused ${input.idempotencyKey} and holds no row for it`,
      );
    }
    return { id: existing.id, created: false };
  }

  async findById(id: string): Promise<EbmEmissionRow | null> {
    const [row] = await this.db
      .select()
      .from(ebmInvoices)
      .where(eq(ebmInvoices.id, id))
      .limit(1);
    return row ?? null;
  }

  /** Everything due, oldest first. The drain's read. */
  async findDue(now: Date, limit = 50): Promise<Array<{ id: string; attempts: number }>> {
    return this.db
      .select({ id: ebmInvoices.id, attempts: ebmInvoices.attempts })
      .from(ebmInvoices)
      .where(
        and(
          inArray(ebmInvoices.status, ['held', 'failed']),
          lte(ebmInvoices.nextAttemptAt, now),
        ),
      )
      .orderBy(asc(ebmInvoices.nextAttemptAt))
      .limit(limit);
  }

  /**
   * Take a due row for one attempt, or null if it is not due any more (another
   * worker took it, it emitted, or a person parked it). The UPDATE is the lock.
   */
  async claim(id: string, now: Date): Promise<EbmEmissionRow | null> {
    const [row] = await this.db
      .update(ebmInvoices)
      .set({
        status: 'failed',
        nextAttemptAt: null,
        attempts: sql`${ebmInvoices.attempts} + 1`,
        lastError: `certification in progress since ${now.toISOString()}; if this persists the outcome is unknown — check the provider before retrying`,
        updatedAt: now,
      })
      .where(
        and(
          eq(ebmInvoices.id, id),
          inArray(ebmInvoices.status, ['held', 'failed']),
          lte(ebmInvoices.nextAttemptAt, now),
        ),
      )
      .returning();
    return row ?? null;
  }

  /**
   * Give a CLAIMED row back as waiting on the business's setup. Only the worker
   * that claimed it calls this, and only before anything was sent — which is why
   * the attempt is handed back: no request left, so none was made. Re-armed by
   * the connection (`EbmConnectionRepository.rearmHeld`).
   *
   * It must never be called on an unclaimed row. A row another worker has
   * claimed is mid-call, and turning it into `held` would make it re-armable —
   * the path to sending one sale twice.
   */
  async releaseToHeld(id: string, reason: string): Promise<void> {
    await this.db
      .update(ebmInvoices)
      .set({
        status: 'held',
        nextAttemptAt: null,
        attempts: sql`greatest(${ebmInvoices.attempts} - 1, 0)`,
        lastError: reason.slice(0, 500),
        updatedAt: new Date(),
      })
      .where(and(eq(ebmInvoices.id, id), eq(ebmInvoices.status, 'failed')));
  }

  async markEmitted(
    id: string,
    input: {
      externalInvoiceId: number;
      payload: EmissionPayload;
      emittedAt: Date;
      /** Set when the sale certified but cannot be printed as it stands. */
      problem: string | null;
    },
  ): Promise<void> {
    await this.db
      .update(ebmInvoices)
      .set({
        status: 'emitted',
        externalInvoiceId: input.externalInvoiceId,
        payload: input.payload,
        emittedAt: input.emittedAt,
        nextAttemptAt: null,
        lastError: input.problem?.slice(0, 500) ?? null,
        updatedAt: input.emittedAt,
      })
      .where(eq(ebmInvoices.id, id));
  }

  /**
   * Not emitted. `retryAt` null parks it for a person; a date puts it back on
   * the sweep. The payload is kept, so what was sent is on the row either way.
   */
  async markFailed(
    id: string,
    input: { reason: string; retryAt: Date | null; payload?: EmissionPayload },
  ): Promise<void> {
    await this.db
      .update(ebmInvoices)
      .set({
        status: 'failed',
        nextAttemptAt: input.retryAt,
        lastError: input.reason.slice(0, 500),
        // Absent means "nothing new was built", not "erase what was sent".
        ...(input.payload ? { payload: input.payload } : {}),
        updatedAt: new Date(),
      })
      .where(eq(ebmInvoices.id, id));
  }

  /**
   * Confirmed sales since `since` that have no emission row — the reconcile
   * sweep's read, and the guarantee behind "never silently skipped" (F-B13).
   *
   * The request path writes the row as a booking confirms, but outside the
   * booking's own transaction; a crash between the two, or a Redis blip, must
   * not be the difference between a sale declared and a sale forgotten. This
   * finds the gap from the table the sale itself lives in.
   *
   * `no_show` is included: a forfeited payment is money the seller kept, which
   * is a sale. `declined` and `cancelled` are not — nothing was sold, or it was
   * undone before it was ever declared.
   */
  async confirmedSalesWithoutEmission(
    since: Date,
    limit = 100,
  ): Promise<Array<{ bookingId: string }>> {
    const rows = await this.db.execute<{ booking_id: string }>(sql`
      SELECT b.id AS booking_id
      FROM bookings b
      WHERE b.status IN ('confirmed', 'no_show')
        AND b.payment_status IN ('captured', 'forfeited', 'paid_out')
        AND b.confirmed_at >= ${since}
        AND NOT EXISTS (
          SELECT 1 FROM ebm_invoices e
          WHERE e.booking_id = b.id AND e.source = 'booking'
        )
      ORDER BY b.confirmed_at
      LIMIT ${limit}
    `);
    return rows.rows.map((row) => ({ bookingId: row.booking_id }));
  }

  /** The certification for a booking, as the receipt reads it. */
  async findForBookingReference(
    reference: string,
  ): Promise<EbmEmissionRow | null> {
    const [row] = await this.db
      .select({ emission: ebmInvoices })
      .from(ebmInvoices)
      .innerJoin(bookings, eq(bookings.id, ebmInvoices.bookingId))
      .where(
        and(eq(bookings.reference, reference), eq(ebmInvoices.source, 'booking')),
      )
      .limit(1);
    return row?.emission ?? null;
  }
}
