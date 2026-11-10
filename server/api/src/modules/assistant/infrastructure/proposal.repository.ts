import type { AssistantProposalState } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, inArray } from 'drizzle-orm';

import { AuditWriter } from '../../../shared/audit/audit-writer';
import { assistantActionProposals } from '../../../database/drizzle/assistant';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

export interface ProposalRow {
  id: string;
  userId: string;
  workspaceId: string;
  kind: 'room_type.price';
  targetId: string;
  targetLabel: string;
  propertyId: string;
  currentValue: number | null;
  proposedValue: number;
  requestText: string;
  state: AssistantProposalState;
  idempotencyKey: string | null;
  error: string | null;
  expiresAt: Date;
}

export interface NewProposal {
  userId: string;
  workspaceId: string;
  kind: 'room_type.price';
  targetId: string;
  targetLabel: string;
  propertyId: string;
  currentValue: number | null;
  proposedValue: number;
  requestText: string;
  expiresAt: Date;
}

const columns = {
  id: assistantActionProposals.id,
  userId: assistantActionProposals.userId,
  workspaceId: assistantActionProposals.workspaceId,
  kind: assistantActionProposals.kind,
  targetId: assistantActionProposals.targetId,
  targetLabel: assistantActionProposals.targetLabel,
  propertyId: assistantActionProposals.propertyId,
  currentValue: assistantActionProposals.currentValue,
  proposedValue: assistantActionProposals.proposedValue,
  requestText: assistantActionProposals.requestText,
  state: assistantActionProposals.state,
  idempotencyKey: assistantActionProposals.idempotencyKey,
  error: assistantActionProposals.error,
  expiresAt: assistantActionProposals.expiresAt,
};

/**
 * Persistence for assistant action proposals and their audit rows
 * (ADR-061 D-k, migration 0054_support_assistant).
 *
 * `claim` is the one door from `proposed` to `approved`: a conditional update
 * that also records the idempotency key, so two presses of Approve race on one
 * row and exactly one wins.
 */
@Injectable()
export class ProposalRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async create(values: NewProposal): Promise<ProposalRow> {
    const [row] = await this.db.insert(assistantActionProposals).values(values).returning(columns);
    return toRow(row);
  }

  async findForUser(id: string, userId: string): Promise<ProposalRow | null> {
    const [row] = await this.db
      .select(columns)
      .from(assistantActionProposals)
      .where(and(eq(assistantActionProposals.id, id), eq(assistantActionProposals.userId, userId)))
      .limit(1);
    return row ? toRow(row) : null;
  }

  async findByKey(userId: string, key: string): Promise<ProposalRow | null> {
    const [row] = await this.db
      .select(columns)
      .from(assistantActionProposals)
      .where(and(eq(assistantActionProposals.userId, userId), eq(assistantActionProposals.idempotencyKey, key)))
      .limit(1);
    return row ? toRow(row) : null;
  }

  async listByIds(ids: string[]): Promise<ProposalRow[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.select(columns).from(assistantActionProposals).where(inArray(assistantActionProposals.id, ids));
    return rows.map(toRow);
  }

  /** proposed -> approved, once, and only before it expires. */
  async claim(id: string, key: string, now: Date): Promise<ProposalRow | null> {
    const [row] = await this.db
      .update(assistantActionProposals)
      .set({ state: 'approved', idempotencyKey: key, decidedAt: now })
      .where(
        and(
          eq(assistantActionProposals.id, id),
          eq(assistantActionProposals.state, 'proposed'),
          gt(assistantActionProposals.expiresAt, now),
        ),
      )
      .returning(columns);
    return row ? toRow(row) : null;
  }

  /** Close a proposal that is still open: rejected by the person, or expired. */
  async close(id: string, state: 'rejected' | 'expired', now: Date): Promise<ProposalRow | null> {
    const [row] = await this.db
      .update(assistantActionProposals)
      .set({ state, decidedAt: now })
      .where(and(eq(assistantActionProposals.id, id), eq(assistantActionProposals.state, 'proposed')))
      .returning(columns);
    return row ? toRow(row) : null;
  }

  async finish(id: string, state: 'executed' | 'failed', error: string | null): Promise<ProposalRow> {
    const [row] = await this.db
      .update(assistantActionProposals)
      .set({ state, error })
      .where(eq(assistantActionProposals.id, id))
      .returning(columns);
    return toRow(row);
  }

  /** One `audit_events` row for an assisted action (ADR-061 C10). */
  async audit(event: {
    actorUserId: string;
    propertyId: string;
    eventType: 'assistant.action.approved' | 'assistant.action.executed' | 'assistant.action.failed';
    proposal: ProposalRow;
    detail?: string;
  }): Promise<void> {
    const p = event.proposal;
    await AuditWriter.write(this.db, {
      actorUserId: event.actorUserId,
      subjectType: 'property',
      subjectId: event.propertyId,
      eventType: event.eventType,
      payloadDiff: {
        [`roomType:${p.targetId}.basePriceRwf`]: { from: p.currentValue, to: p.proposedValue },
        proposalId: p.id,
        ...(event.detail ? { detail: event.detail } : {}),
      } as never,
      reason: `Support assistant proposal, approved by the person: ${p.requestText}`.slice(0, 2000),
    });
  }
}

function toRow(row: Record<string, unknown>): ProposalRow {
  return {
    ...(row as unknown as ProposalRow),
    currentValue: row.currentValue === null ? null : Number(row.currentValue),
    proposedValue: Number(row.proposedValue),
  };
}
