import type { DepositRefundStatus, DepositView, MoveOutNoticeView } from '@injishi/contracts';

import type { DepositRow, NoticeRow } from '../infrastructure/move-outs.repository';

/** A notice as both sides read it. */
export function presentNotice(n: NoticeRow): MoveOutNoticeView {
  return {
    id: n.id,
    givenBy: n.filedByRole,
    channel: n.channel,
    filedOn: n.filedOn,
    moveOutOn: n.moveOutOn,
    reasonCode: n.reasonCode,
    message: n.message,
    noticeDays: n.noticeDays,
    isShortNotice: n.isShortNotice,
    status: n.status,
    acknowledgedAt: n.acknowledgedAt?.toISOString() ?? null,
    withdrawnAt: n.withdrawnAt?.toISOString() ?? null,
    filedAt: n.filedAt.toISOString(),
  };
}

/** Where a refund through Injishi stands, from its payout. */
export function refundStatusOf(d: Pick<DepositRow, 'refundMethod' | 'payoutStatus' | 'refundPayoutId'>): DepositRefundStatus | null {
  if (d.refundMethod !== 'gateway' || !d.refundPayoutId || !d.payoutStatus) return null;
  if (d.payoutStatus === 'paid') return 'paid';
  if (d.payoutStatus === 'failed') return 'failed';
  return 'waiting';
}

/** A deposit as both sides read it. A refund that failed shows its reason and no settlement yet. */
export function presentDeposit(d: DepositRow): DepositView {
  return {
    id: d.id,
    leaseId: d.leaseId,
    agreedRwf: d.agreedRwf,
    paidRwf: d.paidRwf,
    status: d.status,
    keptRwf: d.keptRwf,
    refundedRwf: d.refundedRwf,
    deductions: (Array.isArray(d.deductions) ? d.deductions : []) as DepositView['deductions'],
    refundMethod: d.refundMethod,
    refundStatus: refundStatusOf(d),
    refundDestination: d.payoutDestination,
    refundFailureReason: d.payoutStatus === 'failed' ? d.payoutFailureReason : null,
    refundReference: d.refundReference,
    settledAt: d.settledAt?.toISOString() ?? null,
    tenantDisputedAt: d.tenantDisputedAt?.toISOString() ?? null,
    disputeNote: d.disputeNote,
  };
}
