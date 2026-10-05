import type { AssistantProposal } from '@injishi/contracts';

import type { ProposalRow } from '../infrastructure/proposal.repository';
import { formatRwf } from './action-tools';

/**
 * A stored proposal as the approval card shows it (ADR-061 D-k). A proposal
 * still `proposed` after its deadline reads as `expired`, so a card left open
 * never offers an Approve that the route would refuse.
 */
export function presentProposal(row: ProposalRow, now: Date): AssistantProposal {
  const expired = row.state === 'proposed' && row.expiresAt <= now;
  return {
    id: row.id,
    kind: row.kind,
    title: `${row.targetLabel}: price per night`,
    current: row.currentValue === null ? 'no price' : formatRwf(row.currentValue),
    proposed: formatRwf(row.proposedValue),
    state: expired ? 'expired' : row.state,
    expiresAt: row.expiresAt.toISOString(),
    error: row.error,
  };
}
