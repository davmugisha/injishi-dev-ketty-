import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

/** One refund as its own payer reads it, before the words are chosen. */
export interface GuestRefundRow {
  id: string;
  reference: string;
  amountRwf: number;
  status: string;
  queueReason: string | null;
  writtenOff: boolean;
  payeeAccount: string;
  payeeNetwork: string | null;
  purpose: string | null;
  bookingReference: string | null;
  propertyName: string | null;
  createdAt: Date;
  finalAt: Date | null;
}

/**
 * A payer's own refunds (073-gtbank-payments AC-12, AC-12a).
 *
 * SCOPED BY THE PAYER IN THE QUERY ITSELF, the rule `GuestTripsRepository`
 * keeps: a refund is the payer's when the collection it pays back was waited
 * on by an attempt of theirs. There is no path here that returns, or touches,
 * a row that belongs to somebody else, because the caller cannot name one; an
 * id that is not theirs reads as nothing, and the route answers 404.
 *
 * A failed refund that a person has since sent again is left out: the resend
 * (`resend:<n>:<key>`) is the same refund, and it carries the current state.
 */
@Injectable()
export class GuestRefundsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async listForPayer(userId: string, transactionId?: string): Promise<GuestRefundRow[]> {
    const result = await this.db.execute<{
      id: string;
      reference: string;
      amount_rwf: string | number;
      status: string;
      queue_reason: string | null;
      written_off: boolean;
      payee_account: string;
      payee_network: string | null;
      purpose: string | null;
      booking_reference: string | null;
      property_name: string | null;
      created_at: Date | string;
      final_at: Date | string | null;
    }>(sql`
      SELECT d.id, d.reference, d.amount_rwf, d.status, d.queue_reason,
             (d.written_off_at IS NOT NULL) AS written_off,
             d.payee_account, d.payee_network_or_bank AS payee_network,
             a.purpose::text AS purpose, b.reference AS booking_reference, p.name AS property_name,
             d.created_at, d.final_at
        FROM payment_transactions d
        JOIN payment_transactions c ON c.id = d.original_transaction_id
        JOIN payment_attempts a ON a.idempotency_key = c.idempotency_key
        LEFT JOIN bookings b ON b.id = d.booking_id
        LEFT JOIN room_types rt ON rt.id = b.room_type_id
        LEFT JOIN properties p ON p.id = rt.property_id
       WHERE a.guest_user_id = ${userId}
         AND d.direction = 'disbursement'
         AND d.operation IN ('refund', 'escrow_release_guest')
         ${transactionId ? sql`AND d.id = ${transactionId}` : sql``}
         AND NOT EXISTS (
           SELECT 1 FROM payment_transactions r
            WHERE r.idempotency_key LIKE 'resend:%'
              AND right(r.idempotency_key, length(d.idempotency_key) + 1) = ':' || d.idempotency_key)
       ORDER BY d.created_at DESC
       LIMIT 200`);
    return result.rows.map((r) => ({
      id: r.id,
      reference: r.reference,
      amountRwf: Number(r.amount_rwf),
      status: r.status,
      queueReason: r.queue_reason,
      writtenOff: r.written_off,
      payeeAccount: r.payee_account,
      payeeNetwork: r.payee_network,
      purpose: r.purpose,
      bookingReference: r.booking_reference,
      propertyName: r.property_name,
      createdAt: new Date(r.created_at),
      finalAt: r.final_at ? new Date(r.final_at) : null,
    }));
  }
}
