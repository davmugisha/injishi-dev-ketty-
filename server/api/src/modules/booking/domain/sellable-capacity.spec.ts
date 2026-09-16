import {
  hasFreeUnitEveryNight,
  nightlyCapacity,
  walkInOccupies,
  type NightInput,
  type RoomTypeFacts,
  type WalkIn,
} from './sellable-capacity';

const TODAY = '2026-09-15';

function facts(overrides: Partial<RoomTypeFacts> = {}): RoomTypeFacts {
  return { declaredCount: 4, roomRows: 4, availableRooms: 4, today: TODAY, ...overrides };
}

function nights(...list: [string, number][]): NightInput[] {
  return list.map(([night, held]) => ({ night, held }));
}

describe('nightlyCapacity (platform audit step 3)', () => {
  it('sells every available room when nothing else is in the way', () => {
    const [n] = nightlyCapacity({
      facts: facts(),
      walkIns: [],
      closedNights: new Set(),
      nights: nights(['2026-09-20', 1]),
    });
    expect(n).toEqual({ night: '2026-09-20', capacity: 4, held: 1, freeUnits: 3 });
  });

  describe('out of service rooms', () => {
    it('does not sell a room in maintenance or out of service', () => {
      // Four doors, one out of service and one in maintenance: two to sell.
      const [n] = nightlyCapacity({
        facts: facts({ availableRooms: 2 }),
        walkIns: [],
        closedNights: new Set(),
        nights: nights(['2026-09-20', 1]),
      });
      expect(n.capacity).toBe(2);
      expect(n.freeUnits).toBe(1);
    });

    it('ignores the declared room_count once rooms exist, even when it is higher', () => {
      const [n] = nightlyCapacity({
        facts: facts({ declaredCount: 10, roomRows: 3, availableRooms: 3 }),
        walkIns: [],
        closedNights: new Set(),
        nights: nights(['2026-09-20', 3]),
      });
      expect(n.freeUnits).toBe(0);
    });

    it('sells nothing when every room is out of service', () => {
      const result = nightlyCapacity({
        facts: facts({ availableRooms: 0 }),
        walkIns: [],
        closedNights: new Set(),
        nights: nights(['2026-09-20', 0]),
      });
      expect(hasFreeUnitEveryNight(result)).toBe(false);
    });
  });

  describe('walk ins', () => {
    const bounded: WalkIn = { entryDate: '2026-09-14', plannedExitDate: '2026-09-17' };

    it('takes a room on each night from entry up to, not including, the planned exit', () => {
      const result = nightlyCapacity({
        facts: facts({ availableRooms: 1 }),
        walkIns: [bounded],
        closedNights: new Set(),
        nights: nights(['2026-09-15', 0], ['2026-09-16', 0], ['2026-09-17', 0]),
      });
      expect(result.map((n) => n.freeUnits)).toEqual([0, 0, 1]);
    });

    it('holds an open ended walk in in the room on every night from its entry', () => {
      const openEnded: WalkIn = { entryDate: '2026-09-10', plannedExitDate: null };
      const result = nightlyCapacity({
        facts: facts({ availableRooms: 2 }),
        walkIns: [openEnded],
        closedNights: new Set(),
        nights: nights(['2026-09-15', 1], ['2027-01-01', 1]),
      });
      expect(result.map((n) => n.freeUnits)).toEqual([0, 0]);
    });

    it('keeps a walk in who overstayed their planned exit in the room tonight', () => {
      const overstayed: WalkIn = { entryDate: '2026-09-12', plannedExitDate: '2026-09-14' };
      expect(walkInOccupies(overstayed, TODAY, TODAY)).toBe(true);
      expect(walkInOccupies(overstayed, '2026-09-16', TODAY)).toBe(false);
    });

    it('does not count a walk in against nights before it arrived', () => {
      const later: WalkIn = { entryDate: '2026-09-20', plannedExitDate: null };
      expect(walkInOccupies(later, '2026-09-19', TODAY)).toBe(false);
      expect(walkInOccupies(later, '2026-09-20', TODAY)).toBe(true);
    });

    it('subtracts walk ins and bookings together', () => {
      const [n] = nightlyCapacity({
        facts: facts({ availableRooms: 3 }),
        walkIns: [bounded, { entryDate: '2026-09-15', plannedExitDate: null }],
        closedNights: new Set(),
        nights: nights(['2026-09-15', 1]),
      });
      expect(n).toEqual({ night: '2026-09-15', capacity: 1, held: 1, freeUnits: 0 });
    });
  });

  describe('a room type with no rooms rows', () => {
    it('sells the declared room_count, so seeded or older inventory stays sellable', () => {
      const [n] = nightlyCapacity({
        facts: facts({ declaredCount: 6, roomRows: 0, availableRooms: 0 }),
        walkIns: [],
        closedNights: new Set(),
        nights: nights(['2026-09-20', 2]),
      });
      expect(n).toEqual({ night: '2026-09-20', capacity: 6, held: 2, freeUnits: 4 });
    });

    it('is still sold out once the declared count is held', () => {
      const result = nightlyCapacity({
        facts: facts({ declaredCount: 1, roomRows: 0, availableRooms: 0 }),
        walkIns: [],
        closedNights: new Set(),
        nights: nights(['2026-09-20', 1]),
      });
      expect(hasFreeUnitEveryNight(result)).toBe(false);
    });
  });

  describe('date overrides', () => {
    it('sells nothing on a night the default rate plan is stopped on', () => {
      const result = nightlyCapacity({
        facts: facts(),
        walkIns: [],
        closedNights: new Set(['2026-09-21']),
        nights: nights(['2026-09-20', 0], ['2026-09-21', 0], ['2026-09-22', 0]),
      });
      expect(result.map((n) => n.freeUnits)).toEqual([4, 0, 4]);
      expect(hasFreeUnitEveryNight(result)).toBe(false);
    });

    it('closes a night even for a room type with no rooms rows', () => {
      const [n] = nightlyCapacity({
        facts: facts({ declaredCount: 3, roomRows: 0, availableRooms: 0 }),
        walkIns: [],
        closedNights: new Set(['2026-09-20']),
        nights: nights(['2026-09-20', 0]),
      });
      expect(n.capacity).toBe(0);
    });
  });

  describe('a stay', () => {
    it('is sellable only when every night has a free unit', () => {
      const result = nightlyCapacity({
        facts: facts({ availableRooms: 2 }),
        walkIns: [],
        closedNights: new Set(),
        nights: nights(['2026-09-20', 1], ['2026-09-21', 2]),
      });
      expect(hasFreeUnitEveryNight(result)).toBe(false);
    });

    it('is sellable on a pooled type when no single night is full', () => {
      // Two rooms; one booking on the first night, another on the second.
      const result = nightlyCapacity({
        facts: facts({ availableRooms: 2 }),
        walkIns: [],
        closedNights: new Set(),
        nights: nights(['2026-09-20', 1], ['2026-09-21', 1]),
      });
      expect(hasFreeUnitEveryNight(result)).toBe(true);
    });

    it('never reads free units below zero when more is held than can be sold', () => {
      const [n] = nightlyCapacity({
        facts: facts({ availableRooms: 1 }),
        walkIns: [],
        closedNights: new Set(),
        nights: nights(['2026-09-20', 3]),
      });
      expect(n.freeUnits).toBe(0);
    });

    it('answers no nights (a missing room type) as not sellable', () => {
      expect(hasFreeUnitEveryNight([])).toBe(false);
    });
  });
});
