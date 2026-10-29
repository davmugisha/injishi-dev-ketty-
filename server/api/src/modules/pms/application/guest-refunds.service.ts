import type {
  GuestRefund,
  GuestRefundList,
  GuestRefundStatus,
  MobileMoneyNetwork,
  RefundPayeeRequest,
} from '@injishi/contracts';
import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { maskDestination } from '../../payments/domain/payment-port';
import { PayeeIdentityRepository } from '../../payments/infrastructure/payee-identity.repository';
import { PaymentTransactionsRepository } from '../../payments/infrastructure/payment-transactions.repository';
import {
  GuestRefundsRepository,
  type GuestRefundRow,
} from '../infrastructure/guest-refunds.repository';

/**
 * The internal status in the four words a payer reads (073-gtbank-payments
 * AC-12a). Exported for the spec: this table IS the rule.
 */
export function guestRefundStatus(row: Pick<GuestRefundRow, 'status' | 'queueReason'>): GuestRefundStatus {
  if (row.status === 'successful') return 'paid';
  if (row.status === 'queued' && row.queueReason === 'payee_details_missing') return 'needs_details';
  if (row.status === 'queued' && row.queueReason === 'over_limit') return 'delayed';
  if (row.status === 'failed' || row.status === 'rejected' || row.status === 'reversed') return 'delayed';
  return 'processing';
}

const NETWORKS: ReadonlySet<string> = new Set(['mtn_momo', 'airtel_money']);

/**
 * "Where is my money?" — a payer's own refunds (`/api/v1/me/refunds`).
 *
 * Ownership is the guard, as on every guest route: the session's user id
 * scopes the query, and a refund that is not theirs is a 404, never a 403, so
 * a probe cannot learn that an id exists.
 */
@Injectable()
export class GuestRefundsService {
  private readonly log = new Logger(GuestRefundsService.name);

  constructor(
    private readonly refunds: GuestRefundsRepository,
    private readonly payees: PayeeIdentityRepository,
    private readonly transactions: PaymentTransactionsRepository,
  ) {}

  async list(userId: string): Promise<GuestRefundList> {
    const [rows, hasVerifiedIdentity] = await Promise.all([
      this.refunds.listForPayer(userId),
      this.payees.hasVerifiedIdentity(userId),
    ]);
    return { refunds: rows.map(present), hasVerifiedIdentity };
  }

  /**
   * The payer supplies the name and ID the bank needs (AC-12). Refused with
   * 409 when the account holds a verified identity (this never overrides one)
   * or the refund is not waiting on them. Nothing here echoes the number.
   */
  async supplyPayee(userId: string, transactionId: string, body: RefundPayeeRequest): Promise<GuestRefund> {
    const [row] = await this.refunds.listForPayer(userId, transactionId);
    if (!row) throw new NotFoundException('Refund not found.');
    if (await this.payees.hasVerifiedIdentity(userId)) {
      throw new ConflictException(
        'Your account already holds a verified identity, and refunds use it. Nothing needs adding here.',
      );
    }
    const supplied = await this.transactions.supplyPayee(row.id, {
      payeeFullName: body.fullName,
      payeeIdType: body.idType,
      payeeIdNumber: body.idNumber,
    });
    if (!supplied) {
      throw new ConflictException('This refund is not waiting for your details. Refresh to see where it stands.');
    }
    this.log.log(`Refund ${row.reference}: the payer supplied the payee details; it goes out on the next dispatch.`);
    const [after] = await this.refunds.listForPayer(userId, transactionId);
    return present(after ?? { ...row, queueReason: 'awaiting_dispatch' });
  }
}

function present(row: GuestRefundRow): GuestRefund {
  return {
    id: row.id,
    reference: row.reference,
    amountRwf: row.amountRwf,
    status: guestRefundStatus(row),
    paidFor:
      row.purpose === 'registration_fee' ? 'registration_fee' : row.purpose === 'service_order' ? 'order' : row.purpose ? 'stay' : null,
    bookingReference: row.bookingReference,
    propertyName: row.propertyName,
    // Nine national digits are stored; a person reads the number they dial.
    paidTo: maskDestination(row.payeeAccount.length === 9 ? `0${row.payeeAccount}` : row.payeeAccount),
    network: row.payeeNetwork && NETWORKS.has(row.payeeNetwork) ? (row.payeeNetwork as MobileMoneyNetwork) : null,
    createdAt: row.createdAt.toISOString(),
    paidAt: row.status === 'successful' && row.finalAt ? row.finalAt.toISOString() : null,
  };
}
