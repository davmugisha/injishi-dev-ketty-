import { describe, expect, it } from 'vitest';

import { publishBlockersFor, type PublishFacts } from './publish-eligibility';

const READY: PublishFacts = {
  orgActive: true,
  sectorId: 10201,
  activeRoomTypeCount: 1,
  pricedRoomTypeCount: 1,
  photoCount: 1,
  isStay: true,
  hasCheckInTime: true,
  hasFrontDesk: true,
  languageCount: 2,
  roomTypesWithoutBeds: 0,
  roomTypesWithoutPhoto: 0,
};

describe('what a stay owes its guests before it publishes (0117)', () => {
  it('a stay that has said everything publishes', () => {
    expect(publishBlockersFor(READY)).toEqual([]);
  });

  it('a stay names its check-in, its front desk, a language and every room type’s beds', () => {
    expect(
      publishBlockersFor({
        ...READY,
        hasCheckInTime: false,
        hasFrontDesk: false,
        languageCount: 0,
        roomTypesWithoutBeds: 1,
      }),
    ).toEqual(['room_type_without_beds', 'missing_check_in', 'missing_front_desk', 'missing_language']);
  });

  it('every room type of a stay has a photograph of its own (0118)', () => {
    expect(publishBlockersFor({ ...READY, roomTypesWithoutPhoto: 2 })).toEqual(['room_type_without_photo']);
    expect(publishBlockersFor({ ...READY, isStay: false, roomTypesWithoutPhoto: 2 })).toEqual([]);
  });

  it('a venue is listed, not booked, and owes none of it', () => {
    expect(
      publishBlockersFor({
        ...READY,
        isStay: false,
        hasCheckInTime: false,
        hasFrontDesk: false,
        languageCount: 0,
        roomTypesWithoutBeds: 3,
      }),
    ).toEqual([]);
  });

  it('beds are not asked of a stay with no room type: adding one is the blocker', () => {
    expect(
      publishBlockersFor({ ...READY, activeRoomTypeCount: 0, pricedRoomTypeCount: 0, roomTypesWithoutBeds: 0 }),
    ).toEqual(['no_active_room_type']);
  });

  it('facts read by an older caller skip the new checks', () => {
    const old: PublishFacts = {
      orgActive: true,
      sectorId: 10201,
      activeRoomTypeCount: 1,
      pricedRoomTypeCount: 1,
      photoCount: 1,
    };
    expect(publishBlockersFor(old)).toEqual([]);
  });
});
