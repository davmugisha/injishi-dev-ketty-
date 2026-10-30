import type { OrgRegistrationStatus } from '@injishi/contracts';

/**
 * The registration state machine (D20, D23) — the single source of truth for
 * which move is legal, and the only file that knows the shape of the pipeline.
 *
 * Kept pure and dependency-free on purpose. Every transition in this product is
 * a government decision or a payment, so the rule that governs them has to be
 * readable and testable without a database, a queue, or a Nest container.
 *
 * The pipeline:
 *
 *   pending_payment --(fee settles)--> submitted --(RRA ok)--> tin_verified
 *     --(field verifier)--> field_verified --(approver)--> approved
 *   tin_verified --(PSF District Manager reviews, one step)--> approved
 *     --(automatic; OBO waits for the owner's claim)--> active
 *     --(admin)--> suspended --> active
 *
 *   any stage --(reject)--> rejected --(correct & resubmit)--> submitted
 *
 * The PSF path (an `enterprise`) has no officer gate on Injishi's side: once
 * its fee settles and its TIN, when it gave one, is confirmed, it is
 * registered, so it moves `submitted --(registered)--> active` in one step. PSF
 * decides its membership afterwards, in its own queue.
 *
 * Note the resubmit target: `submitted`, never `pending_payment`. The fee is
 * charged once per org ever and is non-refundable (D23), so correcting a
 * rejected registration must not present a second bill.
 */

/** What caused a transition. The pipeline branches on the actor, not the state. */
export type RegistrationEvent =
  | 'fee_settled'
  | 'tin_verified'
  | 'field_verified'
  | 'approved'
  | 'reviewed'
  | 'activated'
  | 'enterprise_registered'
  | 'rejected'
  | 'resubmitted'
  | 'suspended'
  | 'reinstated';

const TRANSITIONS: Readonly<
  Record<RegistrationEvent, { from: OrgRegistrationStatus[]; to: OrgRegistrationStatus }>
> = {
  fee_settled: { from: ['pending_payment'], to: 'submitted' },
  tin_verified: { from: ['submitted'], to: 'tin_verified' },
  field_verified: { from: ['tin_verified'], to: 'field_verified' },
  approved: { from: ['field_verified'], to: 'approved' },
  // A PSF District Manager's one-step review (0119): documents checked and
  // the business approved by one decision, with no separate approver.
  reviewed: { from: ['tin_verified'], to: 'approved' },
  activated: { from: ['approved'], to: 'active' },
  enterprise_registered: { from: ['submitted'], to: 'active' },
  // Rejection is reachable from every reviewable stage, and from nowhere else:
  // an org that has not paid has not been reviewed, so it cannot be rejected.
  rejected: {
    from: ['submitted', 'tin_verified', 'field_verified'],
    to: 'rejected',
  },
  resubmitted: { from: ['rejected'], to: 'submitted' },
  suspended: { from: ['active'], to: 'suspended' },
  reinstated: { from: ['suspended'], to: 'active' },
};

/** Is this move legal from where the org actually is? */
export function canTransition(
  from: OrgRegistrationStatus,
  event: RegistrationEvent,
): boolean {
  return TRANSITIONS[event].from.includes(from);
}

/** Where this move lands, or null when it is not legal from here. */
export function nextStatus(
  from: OrgRegistrationStatus,
  event: RegistrationEvent,
): OrgRegistrationStatus | null {
  const t = TRANSITIONS[event];
  return t.from.includes(from) ? t.to : null;
}

/**
 * May this org operate? The one predicate the permission model asks.
 *
 * Only `active`. Deliberately not "approved or better": approval is a
 * government decision, activation is the product state, and on the OBO path an
 * approved org waits payout-locked until its owner claims it.
 */
export function canActivate(status: OrgRegistrationStatus): boolean {
  return status === 'active';
}

/** Is money owed before anything else happens? (D23) */
export function awaitsRegistrationFee(status: OrgRegistrationStatus): boolean {
  return status === 'pending_payment';
}

/**
 * Is the org waiting on a person rather than on itself?
 *
 * Used to tell "we are working on it" from "you need to do something", which is
 * the difference between a legible pipeline and a spinner (F-S03 §6).
 */
export function awaitsGovernment(status: OrgRegistrationStatus): boolean {
  return (
    status === 'submitted' ||
    status === 'tin_verified' ||
    status === 'field_verified'
  );
}

/**
 * Which oversight function owns the next decision, when a government officer
 * owns it at all. The approval pipeline branches on this, which is why
 * `oversight_role` is an enum and the government BODY is a catalog (D19).
 */
export function pendingOversightRole(
  status: OrgRegistrationStatus,
): 'business_field_verifier' | 'business_approver' | null {
  if (status === 'tin_verified') return 'business_field_verifier';
  if (status === 'field_verified') return 'business_approver';
  return null;
}
