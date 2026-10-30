import type { OperatorRoomType } from '@injishi/contracts';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import type { ActionExecutor } from '../application/action-approval.service';
import type { ActionReads } from '../application/action-tools';
import type { NewProposal, ProposalRepository, ProposalRow } from '../infrastructure/proposal.repository';
import { MUSANZE } from './fake-operator';

/**
 * Proposals, room types and audit rows in memory, with the repository's
 * contract (the conditional claim included), for tests only.
 */
export const DOUBLE_ROOM = '90000000-0000-4000-8000-0000000000aa';

export class FakeProposals {
  rows: ProposalRow[] = [];
  audits: Array<{ eventType: string; actorUserId: string; propertyId: string; from: unknown; to: unknown; reason: string }> = [];
  private next = 0;

  asRepository(): ProposalRepository {
    return this as unknown as ProposalRepository;
  }

  create(v: NewProposal): Promise<ProposalRow> {
    const row: ProposalRow = { ...v, id: `a1000000-0000-4000-8000-${String(++this.next).padStart(12, '0')}`, state: 'proposed', idempotencyKey: null, error: null };
    this.rows.push(row);
    return Promise.resolve({ ...row });
  }
  findForUser(id: string, userId: string): Promise<ProposalRow | null> {
    const row = this.rows.find((r) => r.id === id && r.userId === userId);
    return Promise.resolve(row ? { ...row } : null);
  }
  findByKey(userId: string, key: string): Promise<ProposalRow | null> {
    const row = this.rows.find((r) => r.userId === userId && r.idempotencyKey === key);
    return Promise.resolve(row ? { ...row } : null);
  }
  listByIds(ids: string[]): Promise<ProposalRow[]> {
    return Promise.resolve(this.rows.filter((r) => ids.includes(r.id)).map((r) => ({ ...r })));
  }
  claim(id: string, key: string, now: Date): Promise<ProposalRow | null> {
    const row = this.rows.find((r) => r.id === id && r.state === 'proposed' && r.expiresAt > now);
    if (!row) return Promise.resolve(null);
    row.state = 'approved';
    row.idempotencyKey = key;
    return Promise.resolve({ ...row });
  }
  close(id: string, state: 'rejected' | 'expired'): Promise<ProposalRow | null> {
    const row = this.rows.find((r) => r.id === id && r.state === 'proposed');
    if (!row) return Promise.resolve(null);
    row.state = state;
    return Promise.resolve({ ...row });
  }
  finish(id: string, state: 'executed' | 'failed', error: string | null): Promise<ProposalRow> {
    const row = this.rows.find((r) => r.id === id) as ProposalRow;
    row.state = state;
    row.error = error;
    return Promise.resolve({ ...row });
  }
  audit(e: { actorUserId: string; propertyId: string; eventType: string; proposal: ProposalRow }): Promise<void> {
    this.audits.push({
      eventType: e.eventType,
      actorUserId: e.actorUserId,
      propertyId: e.propertyId,
      from: e.proposal.currentValue,
      to: e.proposal.proposedValue,
      reason: e.proposal.requestText,
    });
    return Promise.resolve();
  }
}

/** One Musanze room type at 60,000 RWF, with the screen's update path. */
export class FakeRoomTypes implements ActionExecutor {
  price: number | null = 60000;
  updates = 0;
  covered = (ws: ScopedWorkspace): boolean => ws.branchScope.propertyIds.includes(MUSANZE);

  list(ws: ScopedWorkspace): OperatorRoomType[] {
    if (!this.covered(ws)) return [];
    return [
      {
        id: DOUBLE_ROOM,
        propertyId: MUSANZE,
        name: 'Double room',
        domain: 'hospitality',
        status: 'active',
        maxGuests: 2,
        basePriceRwf: this.price,
        bookingMode: 'instant_book',
        cancellationTier: 'flexible',
        priceBasis: 'per_person',
        roomCount: 3,
        sellableRoomCount: 3,
        defaultRatePlanId: null,
      },
    ];
  }
  readRoomType(ws: ScopedWorkspace, _propertyId: string, roomTypeId: string): Promise<OperatorRoomType | null> {
    return Promise.resolve(this.list(ws).find((r) => r.id === roomTypeId) ?? null);
  }
  setRoomTypePrice(ws: ScopedWorkspace, _roomTypeId: string, priceRwf: number): Promise<OperatorRoomType> {
    this.updates++;
    this.price = priceRwf;
    return Promise.resolve(this.list(ws)[0]);
  }
}

export function fakeActionReads(proposals: FakeProposals, roomTypes: FakeRoomTypes): ActionReads {
  return {
    roomTypes: (ws) => Promise.resolve(roomTypes.list(ws)),
    createProposal: (p) => proposals.create(p),
  };
}

/** A shared pair for specs that only need the tools to exist. */
export const defaultProposals = new FakeProposals();
export const defaultRoomTypes = new FakeRoomTypes();
