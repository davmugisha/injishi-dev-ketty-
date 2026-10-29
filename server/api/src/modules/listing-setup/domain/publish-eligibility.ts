import { type PublishBlocker } from '@injishi/contracts';

/**
 * May this property go on the marketplace? (ADR-053, AC-I4)
 *
 * Approval first, then three conditions fixed by the record and not negotiable here: an address, one
 * priced thing to sell, and one photograph. A pure function over facts the
 * repository has already read, so the same answer can be computed before the
 * transaction (to refuse early) and again INSIDE the row lock (so two presses
 * cannot both pass).
 *
 * ## What this deliberately does NOT check
 *
 * **`org_not_active`** IS checked, and first. A business in review (fee paid,
 * documents being read) now holds `listing.manage` so it can build its listing
 * while it waits (`canSetUpDuringReview`), which means `WorkspaceGuard` no
 * longer closes this surface on its own. Publishing is the one step that still
 * waits for approval, so the gate that says so lives here, beside the other
 * conditions, and is re-read inside the row lock like them.
 *
 * **`no_sellable_room`.** Condition 2 is a priced, active ROOM TYPE, which is
 * what the record fixed. Individual `rooms` rows are a later screen, and
 * refusing to publish until they are itemised would hold back every business
 * that sells "a double room" without numbering them.
 *
 * **`missing_name`.** `properties.name` is `NOT NULL` and validated at create, so
 * there is no path that reaches publish without one.
 */
export interface PublishFacts {
  /** `orgs.registration_status = 'active'` for the property's business. */
  orgActive: boolean;
  /** `properties.sector_id`. District is derived from it, and scope matches on that. */
  sectorId: number | null;
  /** Active room types on the property, whatever their price. */
  activeRoomTypeCount: number;
  /** Active room types whose DEFAULT rate plan carries a price. */
  pricedRoomTypeCount: number;
  /** Rows in `property_photos`. */
  photoCount: number;
  /**
   * 0117: what a stay tells guests before they can book it, as Booking.com and Expedia refuse to open a
   * hotel without. A venue (a bar, a coffee shop) is listed, not booked, and owes none of it. Optional, so
   * facts read by an older caller only skip these checks.
   */
  isStay?: boolean;
  hasCheckInTime?: boolean;
  hasFrontDesk?: boolean;
  languageCount?: number;
  /** Active room types with no beds or no adult limit. */
  roomTypesWithoutBeds?: number;
}

/**
 * Every condition that fails, in the order an operator would fix them.
 *
 * Every one rather than the first, so a property missing two things says so once
 * instead of sending the operator round the loop twice. The caller refuses with
 * the first, and the screen can show the rest.
 */
export function publishBlockersFor(facts: PublishFacts): PublishBlocker[] {
  const blockers: PublishBlocker[] = [];
  if (!facts.orgActive) blockers.push('org_not_active');
  if (facts.sectorId === null) blockers.push('missing_sector');
  if (facts.activeRoomTypeCount === 0) {
    blockers.push('no_active_room_type');
  } else if (facts.pricedRoomTypeCount === 0) {
    // Only when there IS a room type. Saying "add a room type" and "price a room
    // type" together reads as two faults when it is one missing thing.
    blockers.push('no_priced_room_type');
  }
  if (facts.isStay) {
    if (facts.activeRoomTypeCount > 0 && (facts.roomTypesWithoutBeds ?? 0) > 0) blockers.push('room_type_without_beds');
    if (facts.hasCheckInTime === false) blockers.push('missing_check_in');
    if (facts.hasFrontDesk === false) blockers.push('missing_front_desk');
    if (facts.languageCount === 0) blockers.push('missing_language');
  }
  if (facts.photoCount === 0) blockers.push('no_photo');
  return blockers;
}
