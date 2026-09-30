import type { AssistantProposal, OperatorRoomType } from '@injishi/contracts';
import {
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { ProposalRepository, type ProposalRow } from '../infrastructure/proposal.repository';
import { presentProposal } from './proposal-view';

/** The one write a proposal executes: the Inventory screen's own path. */
export interface ActionExecutor {
  readRoomType(ws: ScopedWorkspace, propertyId: string, roomTypeId: string): Promise<OperatorRoomType | null>;
  setRoomTypePrice(ws: ScopedWorkspace, roomTypeId: string, priceRwf: number): Promise<OperatorRoomType>;
}

export const ACTION_EXECUTOR = Symbol('ACTION_EXECUTOR');

/**
 * Approving or rejecting a prepared change (ADR-061 D-k). Only ever reached
 * by the PERSON's request to the approve or reject route, never by the model.
 *
 * Approve, in order:
 * 1. The proposal must be this person's, in this workspace. Otherwise 404:
 *    a probe learns nothing about anyone else's proposals.
 * 2. The same idempotency key again returns the first outcome: a retried
 *    press never acts twice.
 * 3. `claim` moves it from proposed to approved in one conditional update,
 *    so of two racing presses exactly one proceeds. An expired or closed
 *    proposal is refused (409).
 * 4. An `approved` audit row is written BEFORE anything changes, so a crash
 *    mid way still leaves a trace of the decision.
 * 5. The live value is read again; if it no longer matches what the card
 *    showed, nothing is changed (409 stale).
 * 6. The change runs through `RoomTypesService.update`, the Inventory
 *    screen's own path, which writes both price columns.
 * 7. The value is read back; the proposal ends `executed` or `failed`, with an
 *    audit row either way.
 */
@Injectable()
export class ActionApprovalService {
  /** Wall clock; a field so a test can move time. */
  clock: () => number = Date.now;

  constructor(
    @Inject(ProposalRepository) private readonly proposals: ProposalRepository,
    @Inject(ACTION_EXECUTOR) private readonly executor: ActionExecutor,
  ) {}

  async approve(
    ws: ScopedWorkspace,
    userId: string,
    proposalId: string,
    idempotencyKey: string,
  ): Promise<AssistantProposal> {
    const now = new Date(this.clock());
    const found = await this.mine(ws, userId, proposalId);

    const replay = await this.proposals.findByKey(userId, idempotencyKey);
    if (replay) {
      if (replay.id !== proposalId) {
        throw new ConflictException({
          code: 'proposal_closed',
          message: 'That approval key was already used for a different change.',
        });
      }
      return presentProposal(replay, now);
    }

    if (found.state !== 'proposed') throw closed(found);
    if (found.expiresAt <= now) {
      await this.proposals.close(found.id, 'expired', now);
      throw expired();
    }

    const claimed = await this.proposals.claim(found.id, idempotencyKey, now);
    if (!claimed) {
      const again = await this.proposals.findForUser(found.id, userId);
      if (again && again.idempotencyKey === idempotencyKey) return presentProposal(again, now);
      throw again && again.state === 'proposed' ? expired() : closed(again ?? found);
    }

    await this.proposals.audit({ actorUserId: userId, propertyId: claimed.propertyId, eventType: 'assistant.action.approved', proposal: claimed });

    let live: OperatorRoomType | null;
    try {
      live = await this.executor.readRoomType(ws, claimed.propertyId, claimed.targetId);
    } catch (error) {
      return this.fail(claimed, userId, messageOf(error), error);
    }
    if (!live || live.status !== 'active') {
      return this.fail(claimed, userId, 'That room type is no longer available to change.', null, 'proposal_stale');
    }
    if (live.basePriceRwf !== claimed.currentValue) {
      return this.fail(
        claimed,
        userId,
        'The price changed after this was prepared, so nothing was changed. Ask again to prepare it from the current price.',
        null,
        'proposal_stale',
      );
    }

    let after: OperatorRoomType;
    try {
      after = await this.executor.setRoomTypePrice(ws, claimed.targetId, claimed.proposedValue);
    } catch (error) {
      return this.fail(claimed, userId, messageOf(error), error);
    }
    if (after.basePriceRwf !== claimed.proposedValue) {
      return this.fail(claimed, userId, 'The change did not take effect. Check the Inventory screen.', null);
    }

    const executed = await this.proposals.finish(claimed.id, 'executed', null);
    await this.proposals.audit({ actorUserId: userId, propertyId: claimed.propertyId, eventType: 'assistant.action.executed', proposal: executed });
    return presentProposal(executed, new Date(this.clock()));
  }

  async reject(ws: ScopedWorkspace, userId: string, proposalId: string): Promise<AssistantProposal> {
    const found = await this.mine(ws, userId, proposalId);
    const now = new Date(this.clock());
    if (found.state !== 'proposed') throw closed(found);
    const rejected = await this.proposals.close(found.id, 'rejected', now);
    if (!rejected) throw closed(found);
    return presentProposal(rejected, now);
  }

  private async mine(ws: ScopedWorkspace, userId: string, proposalId: string): Promise<ProposalRow> {
    const found = await this.proposals.findForUser(proposalId, userId);
    if (!found || found.workspaceId !== ws.workspaceId) {
      throw new NotFoundException('No such proposal.');
    }
    return found;
  }

  /**
   * End the proposal as failed with an audit row, then refuse. A stale value
   * is a 409 the card explains; a refusal from the service keeps its status;
   * anything else is rethrown after it is recorded.
   */
  private async fail(
    claimed: ProposalRow,
    userId: string,
    message: string,
    cause: unknown,
    code: 'proposal_stale' | null = null,
  ): Promise<never> {
    const failed = await this.proposals.finish(claimed.id, 'failed', message);
    await this.proposals.audit({
      actorUserId: userId,
      propertyId: claimed.propertyId,
      eventType: 'assistant.action.failed',
      proposal: failed,
      detail: message,
    });
    if (code) throw new ConflictException({ code, message });
    if (cause instanceof HttpException) throw cause;
    if (cause) throw cause;
    throw new ConflictException({ code: 'proposal_closed', message });
  }
}

function closed(row: ProposalRow): ConflictException {
  const words: Record<string, string> = {
    approved: 'This change is already being made.',
    executed: 'This change was already made.',
    failed: 'This change could not be made and is closed. Ask again to prepare it.',
    rejected: 'This change was rejected.',
    expired: 'This change expired. Ask again to prepare it.',
  };
  return new ConflictException({ code: 'proposal_closed', message: words[row.state] ?? 'This change is closed.' });
}

function expired(): ConflictException {
  return new ConflictException({ code: 'proposal_expired', message: 'This change expired. Ask again to prepare it.' });
}

function messageOf(error: unknown): string {
  return error instanceof HttpException ? error.message : 'The change could not be made.';
}
