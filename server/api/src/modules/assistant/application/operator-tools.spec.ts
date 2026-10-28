import { describe, expect, it } from 'vitest';

import { KIGALI, MUSANZE, scoped } from '../testing/fake-operator';
import { fakeReads } from '../testing/fake-listings';
import { ToolSet } from './assistant-tools';
import type { ToolCaller } from './tool-types';

const tools = new ToolSet(fakeReads);
const USER = 'u0000000-0000-4000-8000-000000000001';
const receptionist: ToolCaller = { userId: USER, workspace: scoped(['stay.checkin', 'reservation.assign']) };
const housekeeper: ToolCaller = { userId: USER, workspace: scoped(['housekeeping.set']) };
const owner: ToolCaller = { userId: USER, workspace: scoped(['listing.manage', 'stay.checkin']) };

async function body(name: string, input: unknown, caller: ToolCaller): Promise<{ isError: boolean; json: Record<string, unknown>; raw: string }> {
  const outcome = await tools.run(name, input, caller);
  return { isError: outcome.isError, json: JSON.parse(outcome.content), raw: outcome.content };
}

describe('operator tools (ADR-061 slice D)', () => {
  it('answers which rooms are held on a date, without guest names', async () => {
    const { json, raw } = await body('rooms_on_dates', { from: '2026-10-10' }, receptionist);
    const rooms = json.rooms as Array<{ room: string; heldForDates: boolean; occupiedNow: boolean }>;
    expect(rooms.map((r) => [r.room, r.heldForDates])).toEqual([
      ['204', true],
      ['205', false],
      ['K1', true],
    ]);
    expect(json).toMatchObject({ from: '2026-10-10', to: '2026-10-11' });
    expect(raw).not.toMatch(/Aline|Uwase|guestName/);
  });

  it('keeps to the branches the member covers', async () => {
    const musanzeOnly: ToolCaller = { ...receptionist, workspace: scoped(['stay.checkin'], [MUSANZE]) };
    const rooms = (await body('rooms_on_dates', { from: '2026-10-10' }, musanzeOnly)).json.rooms as Array<{ room: string }>;
    expect(rooms.map((r) => r.room)).toEqual(['204', '205']);
    const reservations = (await body('list_reservations', {}, musanzeOnly)).json.reservations as Array<{ reference: string }>;
    expect(reservations.map((r) => r.reference)).toEqual(['BK-1001', 'BK-1002']);
  });

  it('lists reservations by date and state, references only', async () => {
    const { json, raw } = await body('list_reservations', { from: '2026-10-10', to: '2026-10-11' }, receptionist);
    expect((json.reservations as Array<{ reference: string }>).map((r) => r.reference)).toEqual(['BK-1001', 'BK-2001']);
    expect(raw).not.toMatch(/Jean|Mugabo|guestName/);
    const pending = (await body('list_reservations', { state: 'pending_approval' }, receptionist)).json;
    expect((pending.reservations as Array<{ reference: string }>).map((r) => r.reference)).toEqual(['BK-1002']);
  });

  it('reports the publish blockers exactly as pressing Publish would', async () => {
    const { json } = await body('publish_blockers', {}, owner);
    expect(json.properties).toEqual([
      {
        propertyId: MUSANZE,
        property: 'Volcano View Lodge',
        listingStatus: 'draft',
        readyToPublish: false,
        blockers: [
          { code: 'no_priced_room_type', fix: 'At least one room type needs a price.' },
          { code: 'no_photo', fix: 'Add at least one photograph of the property.' },
        ],
      },
      { propertyId: KIGALI, property: 'Volcano View Kigali', listingStatus: 'published', readyToPublish: true, blockers: [] },
    ]);
  });

  it('refuses a caller who lacks every permission the route declares, and says which', async () => {
    expect(tools.offered(housekeeper).map((t) => t.name)).not.toEqual(expect.arrayContaining(['rooms_on_dates']));
    const refused = await body('list_reservations', {}, housekeeper);
    expect(refused.isError).toBe(true);
    expect(refused.json.error).toMatch(/cannot see this.*reservation\.approve/);
    expect((await body('publish_blockers', {}, receptionist)).json.error).toMatch(/listing\.manage/);
  });

  it('offers no operator tool until this session has passed the step up, and says so', async () => {
    const pendingStepUp: ToolCaller = { userId: USER, workspace: null, stepUpNeeded: true };
    const offered = tools.offered(pendingStepUp).map((t) => t.name);
    expect(offered).not.toContain('rooms_on_dates');
    expect(offered).not.toContain('list_reservations');
    expect((await body('rooms_on_dates', { from: '2026-10-10' }, pendingStepUp)).json.error).toMatch(/code emailed to you/);
    const noWorkspace = await body('rooms_on_dates', { from: '2026-10-10' }, { userId: USER });
    expect(noWorkspace.json.error).toMatch(/business workspace/);
  });

  it('refuses a range over 31 nights and an impossible date', async () => {
    expect((await body('rooms_on_dates', { from: '2026-10-01', to: '2026-12-01' }, receptionist)).json.error).toMatch(/31 nights/);
    expect((await body('rooms_on_dates', { from: '2026-02-30' }, receptionist)).json.error).toMatch(/real calendar dates/);
  });
});
