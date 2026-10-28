import { describe, expect, it } from 'vitest';

import { RETENTION_BATCH, type StaleApprovalOutcome, type StaleApprovalRow } from '../infrastructure/retention-queries';
import type { RetentionRepository } from '../infrastructure/retention.repository';
import { AssistantRetentionService } from './retention.service';

interface FakeRetention {
  calls: string[];
  closed: { id: string; outcome: StaleApprovalOutcome }[];
  repo: Pick<RetentionRepository, keyof RetentionRepository>;
}

/**
 * The retention sweep's order and bookkeeping (ADR-061 D-d, slice H). The SQL
 * itself runs against a real Postgres in the slice H oracle
 * (`.unlazy/support-assistant/checks/leaf-1.9-retention.mjs`); this pins what
 * the service decides around it.
 */
function fakeRepo(options: { stale?: StaleApprovalRow[]; batches?: number[]; alreadyClosed?: string[] } = {}): FakeRetention {
  const calls: string[] = [];
  const closed: { id: string; outcome: StaleApprovalOutcome }[] = [];
  const batches = [...(options.batches ?? [0])];
  return {
    calls,
    closed,
    repo: {
      expireStaleProposals: async () => {
        calls.push('expire');
        return 2;
      },
      staleApprovals: async () => {
        calls.push('stale');
        return options.stale ?? [];
      },
      closeStaleApproval: async (id: string, outcome: StaleApprovalOutcome) => {
        calls.push(`close:${id}`);
        if (options.alreadyClosed?.includes(id)) return false;
        closed.push({ id, outcome });
        return true;
      },
      deleteOrphanProposals: async () => {
        calls.push('orphans');
        return 4;
      },
      clearUsagePeople: async () => {
        calls.push('usage');
        return 6;
      },
      deleteExpiredConversations: async () => {
        calls.push('delete');
        const conversations = batches.shift() ?? 0;
        return { conversations, proposals: conversations > 0 ? 1 : 0 };
      },
    },
  };
}

describe('AssistantRetentionService (ADR-061 D-d)', () => {
  it('expires proposals, then closes interrupted approvals, then deletes conversations, then orphaned proposals', async () => {
    const { repo, calls } = fakeRepo({ stale: [{ id: 'p1', proposed_value: 70000, live_price: '70000' }], batches: [3] });
    const outcome = await new AssistantRetentionService(repo).sweep(new Date('2026-09-30T12:00:00Z'));
    expect(calls).toEqual(['expire', 'stale', 'close:p1', 'delete', 'orphans', 'usage']);
    expect(outcome).toEqual({ expiredProposals: 2, closedApprovals: 1, deletedConversations: 3, deletedProposals: 5, anonymisedUsage: 6 });
  });

  it('closes an interrupted approval from the live price: made when it moved, failed with words when not', async () => {
    const { repo, closed } = fakeRepo({
      stale: [
        { id: 'moved', proposed_value: 70000, live_price: '70000' },
        { id: 'still', proposed_value: 70000, live_price: '60000' },
        { id: 'gone', proposed_value: 70000, live_price: null },
      ],
    });
    await new AssistantRetentionService(repo).sweep();
    expect(closed.map((c) => [c.id, c.outcome.state])).toEqual([
      ['moved', 'executed'],
      ['still', 'failed'],
      ['gone', 'failed'],
    ]);
    expect(closed[0].outcome.error).toBeNull();
    expect(closed[1].outcome.error).toMatch(/Check the Inventory screen/);
    for (const c of closed) expect(c.outcome.detail.length).toBeGreaterThan(20);
  });

  it('counts only the approvals this run closed, so a rerun or a second worker reports nothing twice', async () => {
    const { repo } = fakeRepo({
      stale: [
        { id: 'a', proposed_value: 1, live_price: 1 },
        { id: 'b', proposed_value: 1, live_price: 1 },
      ],
      alreadyClosed: ['b'],
    });
    expect((await new AssistantRetentionService(repo).sweep()).closedApprovals).toBe(1);
  });

  it('keeps deleting while batches come back full, and stops at the first short one', async () => {
    const { repo, calls } = fakeRepo({ batches: [RETENTION_BATCH, RETENTION_BATCH, 7] });
    const outcome = await new AssistantRetentionService(repo).sweep();
    expect(calls.filter((c) => c === 'delete')).toHaveLength(3);
    expect(outcome.deletedConversations).toBe(RETENTION_BATCH * 2 + 7);
  });

  it('never loops without end on a backlog', async () => {
    const { repo, calls } = fakeRepo({ batches: Array.from({ length: 100 }, () => RETENTION_BATCH) });
    await new AssistantRetentionService(repo).sweep();
    expect(calls.filter((c) => c === 'delete')).toHaveLength(20);
  });
});
