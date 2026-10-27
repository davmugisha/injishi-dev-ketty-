import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';

import { bookings, escrows } from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';

/**
 * What a booking's money reads once the bank has answered for its refunds
 * (073-gtbank-payments AC-13, AC-18). Nothing here reads refunded before the
 * bank says so.
 */
@Injectable()
export class RefundLedgerRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * A refund of this booking was paid. The booking reads refunded only once
   * every refund it owes is settled: none still moving, and none failed or
   * reversed without a write-off or a successful resend. Then `refunded_full`
   * when what was paid back covers what was captured, else `refunded_partial`.
   * Null when the booking is not waiting on a refund, or still owes one.
   */
  async settleRefunded(bookingId: string): Promise<'refunded_full' | 'refunded_partial' | null> {
    return this.db.transaction(async (tx) => {
      const [booking] = await tx
        .select({ paymentStatus: bookings.paymentStatus })
        .from(bookings)
        .where(eq(bookings.id, bookingId))
        .for('update');
      if (booking?.paymentStatus !== 'refund_pending') return null;

      const result = await tx.execute<{ owing: number; paid: string | number; captured: string | number | null }>(sql`
        SELECT
          (SELECT count(*)::int FROM payment_transactions d
            WHERE d.booking_id = ${bookingId}
              AND d.direction = 'disbursement'
              AND d.operation IN ('refund', 'escrow_release_guest')
              AND d.written_off_at IS NULL
              AND (d.status IN ('queued', 'sending', 'pending', 'unknown')
                OR (d.status IN ('failed', 'rejected', 'reversed')
                    AND NOT EXISTS (
                      SELECT 1 FROM payment_transactions r
                       WHERE r.idempotency_key LIKE 'resend:%'
                         AND right(r.idempotency_key, length(d.idempotency_key) + 1) = ':' || d.idempotency_key
                         AND r.status = 'successful')))) AS owing,
          (SELECT coalesce(sum(d.amount_rwf), 0) FROM payment_transactions d
            WHERE d.booking_id = ${bookingId}
              AND d.direction = 'disbursement'
              AND d.operation IN ('refund', 'escrow_release_guest')
              AND d.status = 'successful') AS paid,
          (SELECT e.amount_rwf FROM escrows e
            WHERE e.booking_id = ${bookingId} AND e.source = 'booking' LIMIT 1) AS captured`);
      const facts = result.rows[0];
      if (!facts || Number(facts.owing) > 0) return null;

      const final =
        facts.captured !== null && Number(facts.paid) >= Number(facts.captured) ? 'refunded_full' : 'refunded_partial';
      await tx
        .update(bookings)
        .set({ paymentStatus: final, updatedAt: new Date() })
        .where(and(eq(bookings.id, bookingId), eq(bookings.paymentStatus, 'refund_pending')));
      await tx
        .update(escrows)
        .set({ status: final, updatedAt: new Date() })
        .where(
          and(eq(escrows.bookingId, bookingId), eq(escrows.source, 'booking'), eq(escrows.status, 'refund_pending')),
        );
      return final;
    });
  }

  /**
   * A refund the bank had paid came back (AC-18): the money is owed again, so
   * the booking returns to `refund_pending` until a resend is paid.
   */
  async reopenRefund(bookingId: string): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const moved = await tx
        .update(bookings)
        .set({ paymentStatus: 'refund_pending', updatedAt: new Date() })
        .where(
          and(eq(bookings.id, bookingId), inArray(bookings.paymentStatus, ['refunded_full', 'refunded_partial'])),
        )
        .returning({ id: bookings.id });
      if (moved.length === 0) return false;
      await tx
        .update(escrows)
        .set({ status: 'refund_pending', updatedAt: new Date() })
        .where(
          and(
            eq(escrows.bookingId, bookingId),
            eq(escrows.source, 'booking'),
            inArray(escrows.status, ['refunded_full', 'refunded_partial']),
          ),
        );
      return true;
    });
  }
}
