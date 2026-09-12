/**
 * The booking draft — the two choices the Property detail page makes that a
 * sheet has to be able to change and the booking stepper has to be able to read.
 *
 * The page holds the selected Room type and the non-refundable switch. Neither
 * can live in the screen's own `useState`, because both are edited from a
 * `formSheet` mounted on a DIFFERENT route (`listing/[id]/policy`), and a
 * route boundary is exactly what component state does not cross.
 *
 * **It writes through `writeFixture` rather than `useFixtureMutation`, on
 * purpose.** That hook simulates 300ms so a screen that forgot to disable a
 * button while saving is visibly wrong here rather than on the day the network
 * lands — the right trade for a write that will become an HTTP call. This is
 * not one of those. Choosing a room and flipping a switch are local UI state
 * that the server never sees; the booking request carries them as arguments
 * when the guest presses the CTA. Simulating latency on them would be modelling
 * a call that does not exist, and it would put a third-of-a-second lag between
 * a tap and a highlighted card.
 *
 * The dates and the party are NOT here. They belong to the guest's search
 * (`SEARCH_KEY` in `./search`), which Explore, the search sheet and this page
 * all read, so a property page opens on the dates the guest already searched
 * with rather than asking a second time.
 */
import { useCallback } from 'react';
import { readFixture, useFixtureValue, writeFixture } from './use-fixture-mutation';

export interface BookingDraft {
  /** The Room type the guest picked, or null while nothing is picked. */
  roomTypeId: string | null;
  /** F-B05 Path A: about 10% off, and nothing back if you cancel. */
  nonRefundable: boolean;
}

export const EMPTY_DRAFT: BookingDraft = { roomTypeId: null, nonRefundable: false };

/** One draft per property, so backing out of one and into another keeps both. */
export function draftKey(stayId: string): string {
  return `listing.draft:${stayId}`;
}

export function readDraft(stayId: string): BookingDraft {
  return readFixture<BookingDraft>(draftKey(stayId), EMPTY_DRAFT);
}

export interface DraftHandle {
  draft: BookingDraft;
  selectRoom: (roomTypeId: string | null) => void;
  setNonRefundable: (on: boolean) => void;
}

export function useBookingDraft(stayId: string): DraftHandle {
  const key = draftKey(stayId);
  const draft = useFixtureValue<BookingDraft>(key, () => EMPTY_DRAFT);

  const selectRoom = useCallback(
    (roomTypeId: string | null) => {
      const current = readFixture<BookingDraft>(key, EMPTY_DRAFT);
      if (current.roomTypeId === roomTypeId) return;
      // Changing the room drops the non-refundable choice. That rate is a
      // property of the ROOM — `nonrefundableEligible` sits on
      // `RoomTypeSummary` — so carrying the switch across a change of room
      // could leave it on for a room that does not sell one.
      writeFixture<BookingDraft>(key, { roomTypeId, nonRefundable: false });
    },
    [key],
  );

  const setNonRefundable = useCallback(
    (on: boolean) => {
      const current = readFixture<BookingDraft>(key, EMPTY_DRAFT);
      writeFixture<BookingDraft>(key, { ...current, nonRefundable: on });
    },
    [key],
  );

  return { draft, selectRoom, setNonRefundable };
}
