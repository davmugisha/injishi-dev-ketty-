import {
  PAYOUT_STATUS_LABEL,
  chargeWords,
  daysOverdue,
  isChargeOverdue,
  kigaliDateOf,
  paymentStatusWords,
  type LeaseChargeView,
  type LeasePaymentView,
  type LeaseReminderView,
  type PaymentAllocationView,
  type PayoutView,
  type TenantPaymentView,
} from '@injishi/contracts';

import { destinationOf } from '../domain/payout-accounts';
import type { ChargeRow } from '../infrastructure/lease-charges.repository';
import type { PaymentRecord } from '../infrastructure/lease-payments.repository';
import type { PayoutAccountRow } from '../infrastructure/payout-accounts.repository';
import type { PayoutListRow, PayoutRow } from '../infrastructure/payouts.repository';
import type { LeaseRemindersRepository } from '../infrastructure/lease-reminders.repository';

/** The wire shapes of the rent rows (WP 1.6): one place, so every route answers alike. */

export function presentCharge(c: ChargeRow, graceDays: number, today: string): LeaseChargeView {
  const outstandingRwf = c.status === 'open' ? Math.max(0, c.amountRwf - c.paidRwf) : 0;
  return {
    id: c.id,
    leaseId: c.leaseId,
    kind: c.kind,
    label: chargeWords(c),
    periodStart: c.periodStart,
    periodEnd: c.periodEnd,
    dueOn: c.dueOn,
    amountRwf: c.amountRwf,
    paidRwf: c.paidRwf,
    outstandingRwf,
    status: c.status,
    overdue: isChargeOverdue(c, graceDays, today),
    daysOverdue: daysOverdue(c, graceDays, today),
    waivedReason: c.waivedReason,
    paidAt: c.paidAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
  };
}

export function presentAllocation(a: { amountRwf: number; charge: ChargeRow }): PaymentAllocationView {
  return { chargeId: a.charge.id, kind: a.charge.kind, label: chargeWords(a.charge), periodStart: a.charge.periodStart, dueOn: a.charge.dueOn, amountRwf: a.amountRwf };
}

/** The day the money arrived in Kigali: received on, else the day it succeeded. */
export function paidOnOf(p: { receivedOn: string | null; succeededAt: Date | null }): string | null {
  return p.receivedOn ?? (p.succeededAt ? kigaliDateOf(p.succeededAt) : null);
}

/** What a payment did not give to charges: the tenant's credit. Only a succeeded payment holds credit. */
export function creditOf(record: PaymentRecord): number {
  if (record.payment.status !== 'succeeded') return 0;
  return Math.max(0, record.payment.amountRwf - record.allocations.reduce((s, a) => s + a.amountRwf, 0));
}

/** The payout's destination in masked words, when it has an account. */
export function payoutDestination(p: Pick<PayoutRow, 'destinationMasked'>): string | null {
  return p.destinationMasked;
}

export function presentPayment(
  record: PaymentRecord,
  names: { leaseReference: string; tenantId: string; tenantName: string; unitId: string; unitLabel: string; propertyName: string },
): LeasePaymentView {
  const { payment } = record;
  const allocatedRwf = record.allocations.reduce((s, a) => s + a.amountRwf, 0);
  return {
    id: payment.id,
    leaseId: payment.leaseId,
    leaseReference: names.leaseReference,
    tenant: { id: names.tenantId, fullName: names.tenantName },
    unit: { id: names.unitId, label: names.unitLabel, propertyName: names.propertyName },
    channel: payment.channel,
    method: payment.method,
    amountRwf: payment.amountRwf,
    allocatedRwf,
    creditRwf: creditOf(record),
    status: payment.status,
    statusWords: paymentStatusWords(payment.status, { channel: payment.channel, failureReason: payment.failureReason }),
    paidOn: paidOnOf(payment),
    succeededAt: payment.succeededAt?.toISOString() ?? null,
    reference: payment.reference,
    payerMasked: payment.payerMasked,
    receiptNumber: payment.receiptNumber,
    hasSlip: payment.receiptObjectId !== null && payment.channel === 'recorded',
    note: null,
    recordedBy: record.recordedByName,
    reversedAt: payment.reversedAt?.toISOString() ?? null,
    reverseReason: payment.reverseReason,
    failureReason: payment.failureReason,
    expiresAt: payment.expiresAt?.toISOString() ?? null,
    allocations: record.allocations.map(presentAllocation),
    payout: record.payout
      ? {
          id: record.payout.id,
          status: record.payout.status,
          destination: payoutDestination(record.payout),
          settledAt: record.payout.settledAt?.toISOString() ?? null,
          failureReason: record.payout.failureReason,
        }
      : null,
    createdAt: payment.createdAt.toISOString(),
  };
}

export function presentTenantPayment(record: PaymentRecord): TenantPaymentView {
  const { payment } = record;
  return {
    id: payment.id,
    leaseId: payment.leaseId,
    channel: payment.channel,
    method: payment.method,
    amountRwf: payment.amountRwf,
    status: payment.status,
    statusWords: paymentStatusWords(payment.status, { channel: payment.channel, failureReason: payment.failureReason }),
    payerMasked: payment.payerMasked,
    reference: payment.reference,
    receiptNumber: payment.receiptNumber,
    receiptReady: payment.status === 'succeeded' && payment.receiptNumber !== null,
    failureReason: payment.failureReason,
    allocations: record.allocations.map(presentAllocation),
    creditRwf: creditOf(record),
    paidOn: paidOnOf(payment),
    expiresAt: payment.expiresAt?.toISOString() ?? null,
    succeededAt: payment.succeededAt?.toISOString() ?? null,
    createdAt: payment.createdAt.toISOString(),
  };
}

export function presentPayout(row: PayoutListRow): PayoutView {
  const p = row.payout;
  return {
    id: p.id,
    status: p.status,
    statusLabel: PAYOUT_STATUS_LABEL[p.status],
    amountRwf: p.amountRwf ?? 0,
    destination: p.destinationMasked,
    accountKind: row.accountKind,
    payeeName: p.payeeName,
    payment: row.payment,
    failureReason: p.failureReason,
    createdAt: p.createdAt.toISOString(),
    settledAt: p.settledAt?.toISOString() ?? null,
  };
}

export function presentReminder(r: Awaited<ReturnType<LeaseRemindersRepository['list']>>[number]): LeaseReminderView {
  return {
    id: r.id,
    leaseId: r.leaseId,
    leaseReference: r.leaseReference,
    tenantName: r.tenantName,
    chargeId: r.chargeId,
    chargeLabel: r.chargeKind && r.chargeDueOn ? chargeWords({ kind: r.chargeKind, periodStart: r.chargePeriodStart, dueOn: r.chargeDueOn }) : null,
    kind: r.kind,
    stage: r.stage,
    channel: r.channel,
    note: r.note,
    sentBy: r.sentByName,
    sentAt: r.sentAt.toISOString(),
  };
}

/** The masked line a payout is shown with, from its account. */
export function destinationWordsOf(account: PayoutAccountRow): string {
  return destinationOf(account);
}
