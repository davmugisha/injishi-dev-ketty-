import { Inject, Injectable } from '@nestjs/common';

import { RetentionRepository } from '../infrastructure/retention.repository';
import { RETENTION_BATCH, staleApprovalOutcome } from '../infrastructure/retention-queries';

export interface RetentionOutcome {
  expiredProposals: number;
  closedApprovals: number;
  deletedConversations: number;
  deletedProposals: number;
}

/** Enough full batches to clear a backlog in one run without running forever. */
const MAX_BATCHES = 20;

/**
 * The retention sweep (ADR-061 D-d, slice H), in the order that keeps every
 * record honest:
 *
 * 1. An undecided proposal past its 15 minutes is stored as `expired`.
 * 2. An approval interrupted between its claim and its finish is closed from
 *    the LIVE price, with an audit row, never left `approved` forever.
 * 3. Expired conversations are deleted with the proposals their answers
 *    prepared; messages and feedback go by cascade, a ticket keeps its context.
 * 4. A closed proposal no stored message refers to (a turn that failed after
 *    preparing it) is deleted once it is a day old.
 *
 * Every step is a guarded statement, so a rerun, or two workers, change
 * nothing twice. Reads by the assistant already treat an expired conversation
 * as absent, so the promise held before this job existed; this makes the rows
 * actually go.
 */
@Injectable()
export class AssistantRetentionService {
  constructor(@Inject(RetentionRepository) private readonly repo: Pick<RetentionRepository, keyof RetentionRepository>) {}

  async sweep(now = new Date()): Promise<RetentionOutcome> {
    const expiredProposals = await this.repo.expireStaleProposals(now);

    let closedApprovals = 0;
    for (const row of await this.repo.staleApprovals(now)) {
      if (await this.repo.closeStaleApproval(row.id, staleApprovalOutcome(row))) closedApprovals += 1;
    }

    let deletedConversations = 0;
    let deletedProposals = 0;
    for (let batch = 0; batch < MAX_BATCHES; batch++) {
      const deleted = await this.repo.deleteExpiredConversations(now);
      deletedConversations += deleted.conversations;
      deletedProposals += deleted.proposals;
      if (deleted.conversations < RETENTION_BATCH) break;
    }
    deletedProposals += await this.repo.deleteOrphanProposals(now);

    return { expiredProposals, closedApprovals, deletedConversations, deletedProposals };
  }
}
