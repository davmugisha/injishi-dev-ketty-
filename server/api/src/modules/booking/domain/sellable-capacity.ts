/**
 * How many units of one room type can still be sold on each night (platform
 * audit step 3).
 *
 * ## What this replaced
 *
 * Online availability counted bookings and payment holds against
 * `room_types.room_count`, and nothing else. That number included rooms the
 * maintenance team had taken out of service, knew nothing of a walk in the
 * front desk had put in a room with no booking behind it, and was read before
 * the transaction that locked the room type. So the website could sell a room
 * with a guest already asleep in it.
 *
 * ## The rule, exactly
 *
 * For each night `n` (a stay occupies `check_in <= n < check_out`):
 *
 * 1. **Closed.** If the room type's DEFAULT rate plan carries a `date_overrides`
 *    row for `n` with `blocked` (stop sell), capacity is 0. The online path
 *    sells the room type on its default plan's terms (it reads the deprecated
 *    `room_types` columns the default plan mirrors, F-L03), so that is the
 *    product whose stop sell applies. `date_overrides` has no allotment column,
 *    so there is no allotment to honour; CTA, CTD and length of stay rules are
 *    restrictions on a stay, not capacity, and are not read here.
 * 2. **No rooms.** If the room type has no `rooms` rows at all, capacity is the
 *    declared `room_types.room_count`. Room types created before setup wrote
 *    rooms (and any seed that declares a count without doors) must stay
 *    sellable; with no rooms there is nothing out of service and no room a
 *    walk in could be standing in, so the declared count is all there is.
 * 3. **Rooms.** Otherwise the declared count is ignored (`rooms` is the single
 *    inventory truth, architecture-schema §5.4). Capacity is the rooms whose
 *    `status` is `available` (`maintenance` and `out_of_service` are not sold),
 *    minus the open walk ins (open stays with no booking) in an available room
 *    of this type that occupy `n`. A walk in occupies every night from its
 *    entry date up to, not including, its planned exit date; one with no
 *    planned exit is open ended and occupies every night from its entry. One
 *    still open past its planned exit is still in the room, so it occupies at
 *    least tonight. A walk in in a room that is out of service is not
 *    subtracted twice. A stay WITH a booking is already counted through that
 *    booking.
 *
 * Free units are `capacity - held`, never below zero, where held is the
 * holding bookings plus live payment holds on `n`. A stay is sold out when ANY
 * of its nights has no free unit.
 *
 * Pure, so the rule is tested without a database; `SellableCapacityQuery`
 * gathers the facts, under the caller's lock when there is one.
 */

/** What the database says about the room type, independent of any night. */
export interface RoomTypeFacts {
  /** `room_types.room_count`, the declared count. */
  declaredCount: number;
  /** Every `rooms` row of the type, whatever its status. */
  roomRows: number;
  /** `rooms` rows whose status is `available`. */
  availableRooms: number;
  /** The property's local calendar date now, `yyyy-mm-dd`. */
  today: string;
}

/** One open walk in, as local calendar dates. */
export interface WalkIn {
  entryDate: string;
  /** Null for an open ended stay. */
  plannedExitDate: string | null;
}

export interface NightInput {
  night: string;
  /** Holding bookings plus live payment holds on this night. */
  held: number;
}

export interface NightCapacity {
  night: string;
  capacity: number;
  held: number;
  freeUnits: number;
}

/** The night after `isoDate`, as `yyyy-mm-dd`. */
export function nextNight(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Does this walk in occupy the room on `night`? */
export function walkInOccupies(stay: WalkIn, night: string, today: string): boolean {
  if (stay.entryDate > night) return false;
  if (stay.plannedExitDate === null) return true;
  // Still open past the planned exit: the guest is in the room tonight.
  const tomorrow = nextNight(today);
  const exit = stay.plannedExitDate > tomorrow ? stay.plannedExitDate : tomorrow;
  return night < exit;
}

/** Capacity and free units for each night, by the rule above. */
export function nightlyCapacity(input: {
  facts: RoomTypeFacts;
  walkIns: readonly WalkIn[];
  /** Nights the default rate plan is stopped on. */
  closedNights: ReadonlySet<string>;
  nights: readonly NightInput[];
}): NightCapacity[] {
  const { facts, walkIns, closedNights } = input;
  return input.nights.map(({ night, held }) => {
    let capacity: number;
    if (closedNights.has(night)) {
      capacity = 0;
    } else if (facts.roomRows === 0) {
      capacity = Math.max(0, facts.declaredCount);
    } else {
      const occupied = walkIns.filter((s) => walkInOccupies(s, night, facts.today)).length;
      capacity = Math.max(0, facts.availableRooms - occupied);
    }
    return { night, capacity, held, freeUnits: Math.max(0, capacity - held) };
  });
}

/** Is every night of the stay still sellable? An empty answer is not. */
export function hasFreeUnitEveryNight(nights: readonly NightCapacity[]): boolean {
  return nights.length > 0 && nights.every((n) => n.freeUnits > 0);
}
