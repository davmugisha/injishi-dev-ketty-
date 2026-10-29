import { describe, expect, it } from 'vitest';

import { DOUBLE_ROOM, FakeProposals, FakeRoomTypes, fakeActionReads } from '../testing/fake-actions';
import { fakeReads } from '../testing/fake-listings';
import { KIGALI, scoped } from '../testing/fake-operator';
import { ToolSet } from './assistant-tools';
import type { ToolCaller } from './tool-types';

const USER = 'u0000000-0000-4000-8000-000000000001';

function setup(): { tools: ToolSet; proposals: FakeProposals; roomTypes: FakeRoomTypes } {
  const proposals = new FakeProposals();
  const roomTypes = new FakeRoomTypes();
  return { tools: new ToolSet({ ...fakeReads, ...fakeActionReads(proposals, roomTypes) }), proposals, roomTypes };
}

const owner: ToolCaller = {
  userId: USER,
  workspace: scoped(['listing.manage']),
  requestText: 'change the Double room price from 60,000 to 70,000',
};

describe('propose_room_price (ADR-061 slice E)', () => {
  it('prepares a proposal that changes nothing, recording current, proposed and the request', async () => {
    const { tools, proposals, roomTypes } = setup();
    const outcome = await tools.run('propose_room_price', { roomTypeName: 'Double room', newPriceRwf: 70000 }, owner);
    expect(outcome.isError).toBe(false);
    expect(JSON.parse(outcome.content)).toMatchObject({
      roomType: 'Double room',
      current: '60,000 RWF',
      proposed: '70,000 RWF',
      note: expect.stringMatching(/NOTHING HAS CHANGED/),
    });
    expect(outcome.proposalIds).toEqual([proposals.rows[0].id]);
    expect(proposals.rows[0]).toMatchObject({
      userId: USER,
      targetId: DOUBLE_ROOM,
      currentValue: 60000,
      proposedValue: 70000,
      state: 'proposed',
      requestText: owner.requestText,
    });
    expect(roomTypes.updates).toBe(0);
    expect(roomTypes.price).toBe(60000);
  });

  it('is not offered, and refuses, without listing.manage', async () => {
    const { tools, proposals } = setup();
    const receptionist: ToolCaller = { ...owner, workspace: scoped(['stay.checkin']) };
    expect(tools.offered(receptionist).map((t) => t.name)).not.toContain('propose_room_price');
    const refused = await tools.run('propose_room_price', { roomTypeName: 'Double room', newPriceRwf: 70000 }, receptionist);
    expect(refused.isError).toBe(true);
    expect(proposals.rows).toHaveLength(0);
  });

  it('refuses a price that is already set, and names the room types when the name is unknown', async () => {
    const { tools } = setup();
    const same = await tools.run('propose_room_price', { roomTypeName: 'Double room', newPriceRwf: 60000 }, owner);
    expect(JSON.parse(same.content).error).toMatch(/already costs 60,000 RWF/);
    const unknown = await tools.run('propose_room_price', { roomTypeName: 'Suite', newPriceRwf: 90000 }, owner);
    expect(JSON.parse(unknown.content).error).toMatch(/room types are: Double room/);
  });

  it('cannot reach a room type outside the branches the member covers', async () => {
    const { tools, proposals } = setup();
    const kigaliOnly: ToolCaller = { ...owner, workspace: scoped(['listing.manage'], [KIGALI]) };
    const outcome = await tools.run('propose_room_price', { roomTypeId: DOUBLE_ROOM, newPriceRwf: 70000 }, kigaliOnly);
    expect(outcome.isError).toBe(true);
    expect(proposals.rows).toHaveLength(0);
  });

  it('refuses a price that is not a positive whole number', async () => {
    const { tools } = setup();
    for (const newPriceRwf of [0, -5, 1.5, 200_000_000]) {
      expect((await tools.run('propose_room_price', { roomTypeName: 'Double room', newPriceRwf }, owner)).isError).toBe(true);
    }
  });
});
