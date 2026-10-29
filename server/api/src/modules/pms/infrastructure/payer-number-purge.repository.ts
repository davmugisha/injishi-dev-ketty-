import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

/**
 * Blanks a payer's whole number once no refund can need it (073-gtbank-payments
 * AC-10).
 *
 * The full number is kept on a collection's bank row only so a refund can go
 * back to the wallet that paid. This lives in the booking module because the
 * rule reads booking facts: a booking's number is kept until its check out
 * plus the refund window, and never while a stay refund request is open.
 *
 * Two steps, both idempotent, so a missed night costs nothing:
 * 1. stamp `payer_purge_after` on every final collection that has none: the
 *    booking's check out (Kigali midnight) plus the window, else the moment the
 *    collection went final plus the window;
 * 2. blank the number on every collection past that moment, except one with a
 *    refund still moving, or one whose booking has an open stay refund request.
 *    Those are tried again the next night.
 *
 * The network is kept: it identifies nobody and reconciliation reads it.
 */
@Injectable()
export class PayerNumberPurgeRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async run(now: Date, refundWindowDays: number): Promise<{ stamped: number; purged: number }> {
    const window = sql`make_interval(days => ${refundWindowDays})`;

    const stamped = await this.db.execute(sql`
      UPDATE payment_transactions t
         SET payer_purge_after = COALESCE(
               (SELECT (b.check_out::timestamp AT TIME ZONE 'Africa/Kigali') + ${window}
                  FROM payment_attempts pa
                  JOIN bookings b ON b.id = pa.booking_id
                 WHERE pa.id = t.payment_attempt_id OR pa.idempotency_key = t.idempotency_key
                 LIMIT 1),
               t.final_at + ${window}),
             updated_at = ${now}
       WHERE t.direction = 'collection'
         AND t.payer_msisdn IS NOT NULL
         AND t.payer_purge_after IS NULL
         AND t.final_at IS NOT NULL
         AND t.status NOT IN ('sending', 'pending', 'unknown')
      RETURNING t.id`);

    const purged = await this.db.execute(sql`
      UPDATE payment_transactions t
         SET payer_msisdn = NULL,
             updated_at = ${now}
       WHERE t.direction = 'collection'
         AND t.payer_msisdn IS NOT NULL
         AND t.payer_purge_after IS NOT NULL
         AND t.payer_purge_after < ${now}
         AND t.status NOT IN ('sending', 'pending', 'unknown')
         AND NOT EXISTS (
               SELECT 1 FROM payment_transactions d
                WHERE d.original_transaction_id = t.id
                  AND d.written_off_at IS NULL
                  AND d.status IN ('queued', 'sending', 'pending', 'unknown'))
         AND NOT EXISTS (
               SELECT 1 FROM payment_attempts pa
                 JOIN stay_refund_requests r ON r.booking_id = pa.booking_id
                WHERE (pa.id = t.payment_attempt_id OR pa.idempotency_key = t.idempotency_key)
                  AND r.state = 'submitted')
      RETURNING t.id`);

    return { stamped: stamped.rows.length, purged: purged.rows.length };
  }
}
