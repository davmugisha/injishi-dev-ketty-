import { ConflictException, NotFoundException } from '@nestjs/common';

import { FakeProposals, FakeRoomTypes, fakeActionReads } from '../testing/fake-actions';
import { fakeReads } from '../testing/fake-listings';
import { MUSANZE, scoped } from '../testing/fake-operator';
import { ActionApprovalService } from './action-approval.service';
import { ToolSet } from './assistant-tools';

const USER = 'u0000000-0000-4000-8000-000000000001';
const OTHER = 'u0000000-0000-4000-8000-000000000002';
const KEY = '5f0c7b1e-8a2d-4c3e-9f10-0123456789ab';
const KEY_2 = '6a1d8c2f-9b3e-4d4f-8a21-1234567890bc';
const NOW = Date.parse('2026-09-30T10:00:00Z');
const owner = scoped(['listing.manage']);

async function setup(): Promise<{ approvals: ActionApprovalService; proposals: FakeProposals; roomTypes: FakeRoomTypes; id: string }> {
  const proposals = new FakeProposals();
  const roomTypes = new FakeRoomTypes();
  const tools = new ToolSet({ ...fakeReads, ...fakeActionReads(proposals, roomTypes) });
  // The tool's clock is the real one; move the approval clock relative to the proposal's own expiry.
  const outcome = await tools.run(
    'propose_room_price',
    { roomTypeName: 'Double room', newPriceRwf: 70000 },
    { userId: USER, catalogueOpen: true, workspace: owner, requestText: 'change the Double room price to 70,000' },
  );
  const id = (outcome.proposalIds as string[])[0];
  proposals.rows[0].expiresAt = new Date(NOW + 15 * 60 * 1000);
  const approvals = new ActionApprovalService(proposals.asRepository(), roomTypes);
  approvals.clock = () => NOW;
  return { approvals, proposals, roomTypes, id };
}

describe('ActionApprovalService (ADR-061 D-k)', () => {
  it('executes an approved change once, through the screen path, and audits approval and execution', async () => {
    const { approvals, proposals, roomTypes, id } = await setup();
    const result = await approvals.approve(owner, USER, id, KEY);
    expect(result).toMatchObject({ state: 'executed', current: '60,000 RWF', proposed: '70,000 RWF', error: null });
    expect(roomTypes.price).toBe(70000);
    expect(roomTypes.updates).toBe(1);
    expect(proposals.audits.map((a) => a.eventType)).toEqual(['assistant.action.approved', 'assistant.action.executed']);
    expect(proposals.audits[1]).toMatchObject({ actorUserId: USER, propertyId: MUSANZE, from: 60000, to: 70000, reason: 'change the Double room price to 70,000' });
  });

  it('acts once under one idempotency key, however many times the same approval arrives', async () => {
    const { approvals, proposals, roomTypes, id } = await setup();
    await approvals.approve(owner, USER, id, KEY);
    const again = await approvals.approve(owner, USER, id, KEY);
    expect(again.state).toBe('executed');
    expect(roomTypes.updates).toBe(1);
    expect(proposals.audits.filter((a) => a.eventType === 'assistant.action.executed')).toHaveLength(1);
    // A different key on the same, already executed, proposal is refused, not re-run.
    await expect(approvals.approve(owner, USER, id, KEY_2)).rejects.toBeInstanceOf(ConflictException);
    expect(roomTypes.updates).toBe(1);
  });

  it('refuses a stale current value and changes nothing', async () => {
    const { approvals, proposals, roomTypes, id } = await setup();
    roomTypes.price = 65000; // changed by hand on the Inventory screen after the card was drawn
    await expect(approvals.approve(owner, USER, id, KEY)).rejects.toMatchObject({ response: { code: 'proposal_stale' } });
    expect(roomTypes.updates).toBe(0);
    expect(roomTypes.price).toBe(65000);
    expect(proposals.rows[0].state).toBe('failed');
    expect(proposals.audits.map((a) => a.eventType)).toEqual(['assistant.action.approved', 'assistant.action.failed']);
  });

  it('refuses an expired proposal', async () => {
    const { approvals, roomTypes, id, proposals } = await setup();
    approvals.clock = () => NOW + 16 * 60 * 1000;
    await expect(approvals.approve(owner, USER, id, KEY)).rejects.toMatchObject({ response: { code: 'proposal_expired' } });
    expect(roomTypes.updates).toBe(0);
    expect(proposals.rows[0].state).toBe('expired');
  });

  it("answers another user's proposal, or one from another workspace, as not found", async () => {
    const { approvals, roomTypes, id } = await setup();
    await expect(approvals.approve(owner, OTHER, id, KEY)).rejects.toBeInstanceOf(NotFoundException);
    const elsewhere = { ...owner, workspaceId: '99999999-9999-4999-8999-999999999999' } as typeof owner;
    await expect(approvals.approve(elsewhere, USER, id, KEY)).rejects.toBeInstanceOf(NotFoundException);
    expect(roomTypes.updates).toBe(0);
  });

  it('rejects without running anything, and refuses approval afterwards', async () => {
    const { approvals, roomTypes, id } = await setup();
    expect(await approvals.reject(owner, USER, id)).toMatchObject({ state: 'rejected' });
    await expect(approvals.approve(owner, USER, id, KEY)).rejects.toMatchObject({ response: { code: 'proposal_closed' } });
    expect(roomTypes.updates).toBe(0);
  });

  it('records a failed execution and passes the refusal on', async () => {
    const { approvals, proposals, roomTypes, id } = await setup();
    roomTypes.setRoomTypePrice = () => Promise.reject(new ConflictException('At least one room type needs a price.'));
    await expect(approvals.approve(owner, USER, id, KEY)).rejects.toBeInstanceOf(ConflictException);
    expect(proposals.rows[0]).toMatchObject({ state: 'failed', error: 'At least one room type needs a price.' });
    expect(proposals.audits.at(-1)?.eventType).toBe('assistant.action.failed');
  });
});
