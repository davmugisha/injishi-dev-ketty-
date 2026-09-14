/**
 * The Property detail fixtures, and the invariants that keep them honest.
 *
 * These are not shape assertions. Every one of them is a way the page could
 * lie to a guest that nobody would notice by looking at it:
 *
 *   - a stay Explore lists with no detail behind it is a tile that dead-ends;
 *   - a "from" price on a tile that no Room type actually charges is a price
 *     the guest arrives expecting and does not find;
 *   - a party stepper capped above the largest room is a search that returns a
 *     property nothing in it can sleep;
 *   - an "Instant book" filter that opens a property whose cheapest room asks
 *     for approval is the filter lying, not the page.
 *
 * The coverage assertions are the second half. The page has branches for five
 * cancellation tiers, two booking modes, a sold-out room and a room that
 * refuses the non-refundable rate; each one is only real if a fixture reaches
 * it, and a branch nobody can walk to is a branch that rots.
 */
import { STAYS } from './stays';
import {
  AMENITIES,
  ROOM_TYPES,
  STAY_DETAILS,
  amenity,
  fromRate,
  fullyBooked,
  getRoomType,
  getStayDetail,
  houseRuleLines,
  initialRoom,
  type AmenityId,
} from './property-detail';

/** The lowest rate a Room type charges, available or not. */
function lowestRate(rooms: readonly { summary: { nightlyRateRwf: number | null } }[]): number {
  return Math.min(...rooms.map((r) => r.summary.nightlyRateRwf ?? Infinity));
}

describe('every stay has a property detail behind it', () => {
  it('covers the whole catalogue, so no tile on Explore dead-ends', () => {
    const missing = STAYS.filter((stay) => !getStayDetail(stay.id)).map((stay) => stay.id);
    expect(missing).toEqual([]);
  });

  it('gives every property at least one Room type', () => {
    for (const detail of STAY_DETAILS) {
      expect(detail.rooms.length).toBeGreaterThan(0);
    }
  });

  it('keeps every Room type id unique across the app', () => {
    // The booking stepper resolves a room from the route param alone, so two
    // rooms sharing an id would send a guest to the wrong property's price.
    const ids = ROOM_TYPES.map((room) => room.summary.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('resolves a Room type by its id, and nothing by a bad one', () => {
    expect(getRoomType('kivu-lake-suite')?.stayId).toBe('kivu-sunbird-suite');
    expect(getRoomType('no-such-room')).toBeUndefined();
  });
});

describe('the fixtures agree with what Explore promised', () => {
  it.each(STAY_DETAILS.map((d) => [d.property.name, d] as const))(
    '%s charges the price its tile advertises',
    (_name, detail) => {
      expect(lowestRate(detail.rooms)).toBe(detail.stay.price);
    },
  );

  it.each(STAY_DETAILS.map((d) => [d.property.name, d] as const))(
    '%s sleeps as many as the party stepper allows',
    (_name, detail) => {
      const largest = Math.max(...detail.rooms.map((r) => r.summary.capacity ?? 0));
      expect(largest).toBe(detail.stay.maxGuests);
    },
  );

  it.each(STAY_DETAILS.map((d) => [d.property.name, d] as const))(
    '%s books the way its facet says the cheapest room books',
    (_name, detail) => {
      // `Stay.bookingMode` is Explore's filter; the Room type's is the
      // contract's. They are two fields for one fact and this is where they
      // are held together.
      const cheapest = [...detail.rooms].sort(
        (a, b) => (a.summary.nightlyRateRwf ?? 0) - (b.summary.nightlyRateRwf ?? 0),
      )[0];
      expect(cheapest.summary.bookingMode).toBe(detail.stay.bookingMode);
    },
  );

  it('takes the name, the photographs and the district from the stay itself', () => {
    for (const detail of STAY_DETAILS) {
      expect(detail.property.name).toBe(detail.stay.title);
      expect(detail.property.districtName).toBe(detail.stay.location);
      expect(detail.property.latitude).toBe(detail.stay.coords.lat);
      expect(detail.property.photos[0]).toBe(detail.stay.photos.cover);
    }
  });
});

describe('the contract fields carry contract values', () => {
  it('marks every Room type as hospitality inventory', () => {
    for (const room of ROOM_TYPES) expect(room.summary.domain).toBe('hospitality');
  });

  it('sets an approval policy only on a request-to-book room', () => {
    // F-B03: `approvalPolicy` is a sub-field of `request_to_book`, never a mode
    // of its own. An instant-book room carrying one would be a contract value
    // that means nothing.
    for (const room of ROOM_TYPES) {
      if (room.summary.bookingMode === 'instant_book') {
        expect(room.summary.approvalPolicy).toBeNull();
      } else {
        expect(room.summary.approvalPolicy).not.toBeNull();
      }
    }
  });

  it('never offers more rooms for the dates than the Room type has units', () => {
    for (const room of ROOM_TYPES) {
      expect(room.remaining).toBeLessThanOrEqual(room.summary.roomCount);
    }
  });
});

describe('the page branches are all reachable by walking the app', () => {
  it('reaches both booking modes', () => {
    const modes = new Set(ROOM_TYPES.map((room) => room.summary.bookingMode));
    expect([...modes].sort()).toEqual(['instant_book', 'request_to_book']);
  });

  it('reaches all five cancellation tiers F-B11 names', () => {
    const tiers = new Set(ROOM_TYPES.map((room) => room.summary.cancellationTier));
    expect([...tiers].sort()).toEqual([
      'firm',
      'flexible',
      'limited',
      'moderate',
      'strict_extended_stay',
    ]);
  });

  it('reaches a sold-out Room type on a property that is otherwise open', () => {
    const soldOut = STAY_DETAILS.filter(
      (detail) => detail.stay.active && detail.rooms.some((room) => room.remaining === 0),
    );
    expect(soldOut.length).toBeGreaterThan(0);
    // And that property still has something bookable, or it would be testing
    // the fully-booked branch instead of this one.
    expect(soldOut.some((detail) => !fullyBooked(detail))).toBe(true);
  });

  it('reaches a Room type that refuses the non-refundable rate, and one you can select', () => {
    const refuses = ROOM_TYPES.filter((room) => !room.summary.nonrefundableEligible);
    expect(refuses.length).toBeGreaterThan(0);
    expect(refuses.some((room) => room.remaining > 0)).toBe(true);
  });

  it('reaches a property where nothing is left', () => {
    expect(STAY_DETAILS.some(fullyBooked)).toBe(true);
  });

  it('reaches a property whose exact address is withheld', () => {
    expect(STAY_DETAILS.some((detail) => detail.property.locationPrivacy)).toBe(true);
    expect(STAY_DETAILS.some((detail) => !detail.property.locationPrivacy)).toBe(true);
  });

  it('reaches both a self check-in and a staffed property', () => {
    expect(STAY_DETAILS.some((detail) => detail.selfCheckIn)).toBe(true);
    expect(STAY_DETAILS.some((detail) => !detail.selfCheckIn)).toBe(true);
  });
});

describe('house rules', () => {
  it('splits the contract’s single string into the lines the page draws', () => {
    for (const detail of STAY_DETAILS) {
      const lines = houseRuleLines(detail.property);
      expect(lines.length).toBeGreaterThanOrEqual(3);
      expect(lines.every((line) => line.length > 0)).toBe(true);
    }
  });

  it('returns nothing rather than a blank bullet when a property has none', () => {
    expect(houseRuleLines({ ...STAY_DETAILS[0].property, houseRules: null })).toEqual([]);
    expect(houseRuleLines({ ...STAY_DETAILS[0].property, houseRules: '\n  \n' })).toEqual([]);
  });
});

describe('the room the page opens on', () => {
  it('chooses for the guest when there is only one thing to book', () => {
    const whole = STAY_DETAILS.find((detail) => detail.rooms.length === 1);
    expect(whole).toBeDefined();
    expect(initialRoom(whole!)?.summary.id).toBe(whole!.rooms[0].summary.id);
  });

  it('leaves the choice open when there is a choice to make', () => {
    const several = STAY_DETAILS.find((detail) => detail.rooms.length > 1);
    expect(initialRoom(several!)).toBeUndefined();
  });

  it('does not pre-select a single room that is gone', () => {
    const detail = STAY_DETAILS[0];
    const only = { ...detail, rooms: [{ ...detail.rooms[0], remaining: 0 }] };
    expect(initialRoom(only)).toBeUndefined();
  });
});

describe('the from price', () => {
  it('is the cheapest room still open, not the cheapest room', () => {
    const detail = STAY_DETAILS[0];
    const cheapestGone = {
      ...detail,
      rooms: detail.rooms.map((room, i) => (i === 0 ? { ...room, remaining: 0 } : room)),
    };
    const stillOpen = cheapestGone.rooms.filter((room) => room.remaining > 0);
    expect(fromRate(cheapestGone)).toBe(lowestRate(stillOpen));
  });

  it('is undefined when nothing is left, rather than a price nobody can pay', () => {
    const detail = STAY_DETAILS.find(fullyBooked);
    expect(fromRate(detail!)).toBeUndefined();
  });
});

describe('amenities', () => {
  it('names a real amenity on every property', () => {
    for (const detail of STAY_DETAILS) {
      expect(detail.amenities.length).toBeGreaterThan(0);
      for (const id of detail.amenities) expect(AMENITIES[id]).toBeDefined();
    }
  });

  it('widens an entry with no icon rather than failing to read one', () => {
    const withoutIcon = (Object.keys(AMENITIES) as AmenityId[]).find(
      (id) => !('icon' in AMENITIES[id]),
    );
    expect(withoutIcon).toBeDefined();
    expect(amenity(withoutIcon!).icon).toBeUndefined();
    expect(amenity('wifi').icon).toBe('wifi');
  });

  it('gives at least one property more amenities than the preview shows', () => {
    // Otherwise "Show all" never renders and the sheet behind it is unreachable.
    expect(STAY_DETAILS.some((detail) => detail.amenities.length > 5)).toBe(true);
  });
});
