import type { GuestTripRow } from '../infrastructure/guest-trips.repository';
import { GuestTripsRepository } from '../infrastructure/guest-trips.repository';
import { GuestTripsService, tripStage } from './guest-trips.service';

/**
 * Unit scope: the derivation, and the scoping promise.
 *
 * The SQL join and the `where guest_user_id = …` are the repository's and need a
 * DB-backed test (no test-DB harness yet), so what is proved here is everything
 * the service decides on top of a row: which stage a stay is in, that a locked
 * price is passed through untouched, and that the service asks the repository
 * for the SESSION's user rather than for anything a caller supplied.
 */
describe('GuestTripsService', () => {
  const GUEST_ID = '22222222-2222-2222-2222-222222222222';
  const TODAY = '2026-09-12';

  const row = (over: Partial<GuestTripRow> = {}): GuestTripRow => ({
    id: '11111111-1111-1111-1111-111111111111',
    reference: 'BK-TRIP01',
    status: 'confirmed',
    paymentStatus: 'captured',
    checkIn: '2026-10-01',
    checkOut: '2026-10-04',
    guests: 2,
    grossRwf: 94_500,
    nonRefundable: false,
    cancellationTier: 'flexible',
    createdAt: new Date('2026-09-11T08:30:00.000Z'),
    propertyName: 'Lavender Hill Suites',
    propertySlug: 'lavender-hill-suites',
    districtName: 'Gasabo',
    timezone: 'Africa/Kigali',
    roomTypeName: 'Deluxe double',
    ...over,
  });

  describe('tripStage', () => {
    it('reads a future stay as upcoming and a finished one as past', () => {
      expect(tripStage({ status: 'confirmed', checkIn: '2026-10-01', checkOut: '2026-10-04' }, TODAY)).toBe('upcoming');
      expect(tripStage({ status: 'confirmed', checkIn: '2026-08-01', checkOut: '2026-08-04' }, TODAY)).toBe('past');
    });

    it('counts check-in day and check-out day as in progress', () => {
      // A guest arriving today is in their stay; one leaving this morning has
      // not finished it. Both used to be edge cases a client guessed at.
      expect(tripStage({ status: 'confirmed', checkIn: TODAY, checkOut: '2026-09-15' }, TODAY)).toBe('in_progress');
      expect(tripStage({ status: 'confirmed', checkIn: '2026-09-09', checkOut: TODAY }, TODAY)).toBe('in_progress');
    });

    /** The rule this function exists for. */
    it('never calls a cancelled or declined stay upcoming, whatever its dates say', () => {
      expect(tripStage({ status: 'cancelled', checkIn: '2026-10-01', checkOut: '2026-10-04' }, TODAY)).toBe('cancelled');
      expect(tripStage({ status: 'declined', checkIn: '2026-10-01', checkOut: '2026-10-04' }, TODAY)).toBe('cancelled');
    });

    it('files a no-show under its dates, not under cancelled', () => {
      // It happened: the room was held and the money moved. A guest disputing
      // one looks for it where the stay was, not among stays that never ran.
      expect(tripStage({ status: 'no_show', checkIn: '2026-08-01', checkOut: '2026-08-04' }, TODAY)).toBe('past');
    });

    it('keeps a pending request on the calendar while it waits', () => {
      expect(tripStage({ status: 'pending_approval', checkIn: '2026-10-01', checkOut: '2026-10-04' }, TODAY)).toBe('upcoming');
    });
  });

  describe('forGuest', () => {
    function harness(rows: GuestTripRow[]): {
      service: GuestTripsService;
      findForGuest: jest.Mock;
    } {
      const findForGuest = jest.fn().mockResolvedValue(rows);
      const repo = { findForGuest } as unknown as GuestTripsRepository;
      return { service: new GuestTripsService(repo), findForGuest };
    }

    it('asks only for the caller and passes the locked money through untouched', async () => {
      const { service, findForGuest } = harness([row()]);

      const { trips } = await service.forGuest(GUEST_ID);

      expect(findForGuest).toHaveBeenCalledWith(GUEST_ID);
      expect(trips).toHaveLength(1);
      // Locked at sale (D8): read, never recomputed.
      expect(trips[0]).toMatchObject({
        reference: 'BK-TRIP01',
        grossRwf: 94_500,
        cancellationTier: 'flexible',
        nonRefundable: false,
        nights: 3,
        guests: 2,
        propertyName: 'Lavender Hill Suites',
        districtName: 'Gasabo',
        roomTypeName: 'Deluxe double',
      });
      expect(trips[0]?.bookedAt).toBe('2026-09-11T08:30:00.000Z');
    });

    it('carries a property with no district or slug rather than dropping the stay', async () => {
      // A property mid-registration may have neither. The stay is still a stay,
      // and a trip card that renders text instead of a link is the right answer.
      const { service } = harness([row({ districtName: null, propertySlug: null })]);

      const { trips } = await service.forGuest(GUEST_ID);

      expect(trips[0]).toMatchObject({ districtName: null, propertySlug: null });
    });

    it('returns an empty list for a guest who has booked nothing', async () => {
      const { service } = harness([]);
      await expect(service.forGuest(GUEST_ID)).resolves.toEqual({ trips: [] });
    });
  });
});
