import { BUSINESS_WORKSPACE, GUEST_A, GUEST_B, fakeReads } from '../testing/fake-listings';
import { ToolSet } from './assistant-tools';

const tools = new ToolSet(fakeReads);
const guestA = { userId: GUEST_A };
const anonymous = { userId: null };

describe('account tools (ADR-061 slice C)', () => {
  it('are not offered to an anonymous caller, and refuse one that names them', async () => {
    const offered = tools.offered(anonymous).map((t) => t.name);
    expect(offered).not.toContain('my_trips');
    expect(offered).not.toContain('my_access');
    expect(tools.offered(guestA).map((t) => t.name)).toEqual(expect.arrayContaining(['my_trips', 'my_access']));
    const refused = await tools.run('my_trips', {}, anonymous);
    expect(refused.isError).toBe(true);
    expect(refused.content).not.toMatch(/BK-/);
  });

  it('returns only the fields the allowlist names, upcoming first', async () => {
    const outcome = await tools.run('my_trips', {}, guestA);
    const body = JSON.parse(outcome.content);
    expect(body.trips.map((t: { reference: string }) => t.reference)).toEqual(['BK-NEXT02', 'BK-PAST01']);
    expect(Object.keys(body.trips[0]).sort()).toEqual(
      ['cancellationTier', 'checkIn', 'checkOut', 'district', 'guests', 'href', 'nights', 'property', 'reference', 'roomType', 'stage', 'totalRwf'].sort(),
    );
    expect(outcome.content).not.toMatch(/paymentStatus|captured|bookedAt|timezone/);
    expect(outcome.sources.every((s) => s.kind === 'record' && s.href === '/trips')).toBe(true);
  });

  it("never reaches another person's trips, whatever the input says", async () => {
    const outcome = await tools.run('my_trips', {}, guestA);
    expect(outcome.content).not.toMatch(/BK-OTHER3|City Hill Hotel/);
    // There is no parameter that could name another user: extra keys are refused.
    const smuggled = await tools.run('my_trips', { userId: GUEST_B }, guestA);
    expect(smuggled.isError).toBe(true);
  });

  it('filters by stage and says so plainly when nothing matches', async () => {
    const cancelled = JSON.parse((await tools.run('my_trips', { stage: 'cancelled' }, guestA)).content);
    expect(cancelled).toMatchObject({ trips: [], note: expect.stringMatching(/do not guess/) });
  });

  it('lists business access with the permissions held, and leaves out personal workspaces', async () => {
    const body = JSON.parse((await tools.run('my_access', {}, guestA)).content);
    expect(body.businesses).toEqual([
      {
        workspaceId: BUSINESS_WORKSPACE,
        business: 'Volcano View Lodge Ltd',
        domain: 'hospitality',
        role: 'receptionist',
        registrationStage: 'active',
        permissions: ['reservation.assign', 'stay.checkin'],
      },
    ]);
    const none = JSON.parse((await tools.run('my_access', {}, { userId: GUEST_B })).content);
    expect(none).toMatchObject({ businesses: [], note: expect.stringMatching(/no business/) });
  });
});
