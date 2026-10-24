import type { LeaseStatus } from '@injishi/contracts';

/**
 * What the landlord does next on a lease, in words, for the list and the
 * record (blueprint 3.5: one main action per stage). Null when nothing waits
 * on them.
 */
export function leaseNextAction(status: LeaseStatus, opts: { invitationAccepted?: boolean } = {}): string | null {
  switch (status) {
    case 'draft':
      return 'Review and sign';
    case 'pending_signature':
      return opts.invitationAccepted === false ? 'Waiting for the tenant to accept the invitation' : 'Waiting for the tenant to sign';
    case 'signed':
      return 'Start the tenancy';
    case 'ending':
      return 'Record the move out';
    default:
      return null;
  }
}

/** The next free lease reference after `taken`: L-0001, L-0002, ... */
export function nextLeaseReference(taken: readonly string[]): string {
  let highest = 0;
  for (const ref of taken) {
    const m = /^L-(\d+)$/.exec(ref.trim());
    if (m) highest = Math.max(highest, Number(m[1]));
  }
  return `L-${String(highest + 1).padStart(4, '0')}`;
}
