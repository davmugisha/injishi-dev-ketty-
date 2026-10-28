import { describe, expect, it } from 'vitest';

import {
  GUESTHOUSE_ID,
  KIGALI_ID,
  LODGE_ID,
  LODGE_ROOM,
  fakeReads,
} from '../testing/fake-listings';
import { ToolSet } from './assistant-tools';
import { MAX_AVAILABILITY_NIGHTS } from './listing-tools';

const open = { userId: null };
const tools = new ToolSet(fakeReads);

async function json(name: string, input: unknown, caller = open): Promise<{ isError: boolean; body: Record<string, unknown>; sources: unknown[] }> {
  const outcome = await tools.run(name, input, caller);
  return { isError: outcome.isError, body: JSON.parse(outcome.content), sources: outcome.sources };
}

describe('listing tools (ADR-061 slice B)', () => {
  it('finds only the Musanze properties for "hotels in Musanze", cheapest rate included', async () => {
    const { body, sources } = await json('search_listings', { query: 'hotels in Musanze' });
    const ids = (body.results as Array<{ propertyId: string }>).map((r) => r.propertyId).sort();
    expect(ids).toEqual([LODGE_ID, GUESTHOUSE_ID].sort());
    expect(body.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Twin Lakes Guesthouse', fromNightlyRateRwf: 45000, href: '/property/twin-lakes-guesthouse' }),
      ]),
    );
    expect(sources).toHaveLength(2);
  });

  it('filters by guests and nightly budget', async () => {
    const { body } = await json('search_listings', { query: 'Musanze', guests: 3, maxNightlyRwf: 150000 });
    expect((body.results as Array<{ propertyId: string }>).map((r) => r.propertyId)).toEqual([LODGE_ID]);
    const cheap = await json('search_listings', { maxNightlyRwf: 50000 });
    expect((cheap.body.results as Array<{ propertyId: string }>).map((r) => r.propertyId)).toEqual([GUESTHOUSE_ID]);
  });

  it('says nothing matches rather than suggesting properties from memory', async () => {
    const { body, sources } = await json('search_listings', { query: 'Rubavu' });
    expect(body).toMatchObject({ results: [], note: expect.stringMatching(/from memory/) });
    expect(sources).toEqual([]);
  });

  it('describes one property without coordinates, and redacts a phone number in host text', async () => {
    const outcome = await tools.run('get_listing', { propertyId: KIGALI_ID }, open);
    const body = JSON.parse(outcome.content);
    expect(body).toMatchObject({
      name: 'City Hill Hotel',
      district: 'Gasabo',
      facilities: ['Wi-Fi'],
      roomTypes: [expect.objectContaining({ name: 'Double room', baseNightlyRateRwf: 80000 })],
    });
    expect(outcome.content).not.toMatch(/latitude|longitude|-1\.5|29\.6/);
    expect(outcome.content).not.toMatch(/0788123456/);
    expect(outcome.sources).toEqual([expect.objectContaining({ kind: 'listing', id: KIGALI_ID })]);
  });

  it('answers an unpublished property as an error the model can explain', async () => {
    const { isError, body } = await json('get_listing', { propertyId: '44444444-4444-4444-8444-444444444444' });
    expect(isError).toBe(true);
    expect(body.error).toMatch(/not published/);
  });

  it('reports free units night by night and names the sold out night', async () => {
    const { body } = await json('check_availability', { roomTypeId: LODGE_ROOM, checkIn: '2026-10-10', checkOut: '2026-10-13' });
    expect(body).toMatchObject({
      nights: [
        { night: '2026-10-10', freeUnits: 2 },
        { night: '2026-10-11', freeUnits: 0 },
        { night: '2026-10-12', freeUnits: 2 },
      ],
      soldOutNights: ['2026-10-11'],
      availableForWholeStay: false,
    });
  });

  it(`refuses a range longer than ${MAX_AVAILABILITY_NIGHTS} nights, and a backwards one`, async () => {
    expect(MAX_AVAILABILITY_NIGHTS).toBe(30);
    const long = await json('check_availability', { roomTypeId: LODGE_ROOM, checkIn: '2026-10-01', checkOut: '2026-11-15' });
    expect(long).toMatchObject({ isError: true, body: { error: expect.stringMatching(/30 nights/) } });
    const back = await json('check_availability', { roomTypeId: LODGE_ROOM, checkIn: '2026-10-05', checkOut: '2026-10-01' });
    expect(back).toMatchObject({ isError: true, body: { error: expect.stringMatching(/after checkIn/) } });
    const unreal = await json('check_availability', { roomTypeId: LODGE_ROOM, checkIn: '2026-02-30', checkOut: '2026-03-02' });
    expect(unreal).toMatchObject({ isError: true, body: { error: expect.stringMatching(/real calendar dates/) } });
  });

  it('offers every listing tool to a caller with no session', () => {
    const listing = ['search_listings', 'get_listing', 'check_availability'];
    expect(tools.offered(open).map((t) => t.name).filter((n) => listing.includes(n))).toEqual(listing);
  });

  it('gives every listing tool a strict schema', () => {
    for (const spec of tools.offered(open)) {
      expect(spec.inputSchema.additionalProperties).toBe(false);
      expect(Array.isArray(spec.inputSchema.required)).toBe(true);
    }
  });
});
