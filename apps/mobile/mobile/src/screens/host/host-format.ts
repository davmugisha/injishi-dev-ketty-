/**
 * Everything the Host desk decides that does not need a screen.
 *
 * Pure functions, taking `t` only where they produce a sentence, so the
 * grouping, the search and the countdown are all testable without mounting a
 * navigator — and so Today and Bookings cannot disagree about which bucket a
 * booking is in, because there is one function that says.
 */
import type { MessageKey, Translate } from '@/i18n/i18n';
import { formatDay } from '@/data/search';
import type { HostBooking, HostPayout, HostRowState } from './host-fixtures';
import { isUpcoming, rowStateOf } from './host-store';

/* --------------------------------------------------------------- the groups */

/**
 * Today's four sections, in the order a desk works them: decide first, then
 * the door, then the people leaving, then the people staying.
 *
 * `past` is not on Today at all — a desk that lists yesterday's checkouts under
 * this morning's arrivals is a desk you have to scroll past to work.
 */
export const TODAY_GROUPS = ['awaiting', 'arriving', 'departing', 'in_house'] as const;
export type TodayGroup = (typeof TODAY_GROUPS)[number];

export const GROUP_LABEL: Record<TodayGroup, MessageKey> = {
  awaiting: 'host.groupRequests',
  arriving: 'host.groupArriving',
  departing: 'host.groupDeparting',
  in_house: 'host.groupInHouse',
};

/**
 * The empty line for each section, and each one says what WOULD put a row
 * there. An empty state with a reason is the rule the quality bar sets; on a
 * desk it is also the difference between "nothing to do" and "nothing loaded".
 */
export const GROUP_EMPTY: Record<TodayGroup, MessageKey> = {
  awaiting: 'host.emptyRequests',
  arriving: 'host.emptyArriving',
  departing: 'host.emptyDeparting',
  in_house: 'host.emptyInHouse',
};

export type TodayGroups = Record<TodayGroup, HostBooking[]>;

/** Every booking sorted into today's four buckets, in one pass. */
export function groupForToday(rows: readonly HostBooking[], today: string): TodayGroups {
  const groups: TodayGroups = { awaiting: [], arriving: [], departing: [], in_house: [] };
  for (const booking of rows) {
    const state = rowStateOf(booking, today);
    if (state !== 'past') groups[state].push(booking);
  }
  // A request closest to expiring is the one that needs a decision first; every
  // other bucket reads best in arrival order.
  groups.awaiting.sort((a, b) => (a.approvalExpiresAt ?? 0) - (b.approvalExpiresAt ?? 0));
  groups.arriving.sort((a, b) => (a.arrivalTime ?? '').localeCompare(b.arrivalTime ?? ''));
  groups.departing.sort((a, b) => (a.room ?? '').localeCompare(b.room ?? ''));
  groups.in_house.sort((a, b) => (a.room ?? '').localeCompare(b.room ?? ''));
  return groups;
}

/** How many rows Today is carrying, which is what the header counts. */
export function todayCount(groups: TodayGroups): number {
  return TODAY_GROUPS.reduce((n, key) => n + groups[key].length, 0);
}

/* -------------------------------------------------------------- the filters */

/**
 * The Bookings tab's chips. `all` first because a desk looking something up
 * does not know which bucket it is in — which is also why this tab has a search
 * field and Today does not.
 */
export const BOOKING_FILTERS = [
  'all',
  'pending',
  'upcoming',
  'in_house',
  'checked_out',
  'declined',
] as const;
export type BookingFilter = (typeof BOOKING_FILTERS)[number];

export const FILTER_LABEL: Record<BookingFilter, MessageKey> = {
  all: 'host.filterAll',
  pending: 'host.filterPending',
  upcoming: 'host.filterUpcoming',
  in_house: 'host.filterInHouse',
  checked_out: 'host.filterCheckedOut',
  declined: 'host.filterDeclined',
};

/** Why THIS chip came back empty. The reason is the chip, so it can name it. */
export const FILTER_EMPTY: Record<BookingFilter, MessageKey> = {
  all: 'host.emptyAll',
  pending: 'host.emptyRequests',
  upcoming: 'host.emptyUpcoming',
  in_house: 'host.emptyInHouse',
  checked_out: 'host.emptyCheckedOut',
  declined: 'host.emptyDeclined',
};

export function matchesFilter(
  booking: HostBooking,
  filter: BookingFilter,
  today: string,
): boolean {
  const state = rowStateOf(booking, today);
  switch (filter) {
    case 'all':
      return true;
    case 'pending':
      return state === 'awaiting';
    case 'upcoming':
      return state === 'arriving' || isUpcoming(booking, today);
    case 'in_house':
      return state === 'in_house' || state === 'departing';
    case 'checked_out':
      return booking.checkedOutAt !== null;
    case 'declined':
      return booking.status === 'declined' || booking.status === 'cancelled';
  }
}

/**
 * What the search field looks at: the guest, the reference and the room.
 *
 * Those three and nothing else, because they are what a person at a desk has
 * to hand — a name said out loud, a code read off a phone, or a room number.
 * Searching the dates would match everything in a season.
 */
export function matchesQuery(booking: HostBooking, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return `${booking.guest.name} ${booking.id} ${booking.room ?? ''} ${booking.roomType}`
    .toLowerCase()
    .includes(needle);
}

/** Filter, then order: something to decide first, then soonest arrival. */
export function filterBookings(
  rows: readonly HostBooking[],
  filter: BookingFilter,
  query: string,
  today: string,
): HostBooking[] {
  const kept = rows.filter((b) => matchesFilter(b, filter, today) && matchesQuery(b, query));
  const rank: Record<HostRowState, number> = {
    awaiting: 0,
    arriving: 1,
    departing: 2,
    in_house: 3,
    past: 4,
  };
  return [...kept].sort(
    (a, b) =>
      rank[rowStateOf(a, today)] - rank[rowStateOf(b, today)] ||
      a.checkInDay.localeCompare(b.checkInDay),
  );
}

/** How many rows each chip would show, for the counts on the chips themselves. */
export function filterCounts(
  rows: readonly HostBooking[],
  query: string,
  today: string,
): Record<BookingFilter, number> {
  const counts = {} as Record<BookingFilter, number>;
  for (const filter of BOOKING_FILTERS) {
    counts[filter] = rows.filter(
      (b) => matchesFilter(b, filter, today) && matchesQuery(b, query),
    ).length;
  }
  return counts;
}

/* --------------------------------------------------------------- the badges */

/**
 * The `StatusBadge` state for a booking, in the `booking` domain.
 *
 * Deliberately reuses the six words `status.booking.*` already carries rather
 * than minting host-side synonyms: a booking that reads "Confirmed" to the
 * guest must not read "Reserved" to the host, and one catalogue entry per state
 * is what makes that impossible.
 */
export function badgeStateOf(booking: HostBooking, today: string): string {
  if (booking.status === 'pending_approval') return 'pending_approval';
  if (booking.status === 'declined') return 'declined';
  if (booking.status === 'cancelled') return 'cancelled';
  if (booking.status === 'no_show') return 'no_show';
  if (booking.checkedOutAt !== null) return 'completed';
  if (booking.checkedInAt !== null) return 'checked_in';
  return booking.checkInDay === today ? 'arriving' : 'confirmed';
}

/* ------------------------------------------------------------ the countdowns */

/**
 * How long a request has left, as the sentence a desk reads.
 *
 * Minutes under an hour, hours above it, and no seconds at any point: a
 * countdown that ticks every second on a list of ten rows is ten re-renders a
 * second for information nobody acts on that fast.
 */
export function expiryNote(expiresAt: number | null, now: number, t: Translate): string | null {
  if (expiresAt === null) return null;
  const left = expiresAt - now;
  if (left <= 0) return t('host.expired');
  const minutes = Math.round(left / 60_000);
  if (minutes < 60) return t('host.expiresMinutes', { count: minutes });
  const hours = Math.round(minutes / 60);
  return hours === 1 ? t('host.expiresHour') : t('host.expiresHours', { count: hours });
}

/** True while a request is close enough that the row should say so loudly. */
export const URGENT_MS = 60 * 60 * 1000;

export function isUrgent(expiresAt: number | null, now: number): boolean {
  return expiresAt !== null && expiresAt - now > 0 && expiresAt - now <= URGENT_MS;
}

/** What the payout row says about its dispute buffer. */
export function bufferNote(payout: HostPayout, now: number, t: Translate): string {
  if (payout.status === 'paid') return t('host.payoutPaid');
  if (payout.status === 'held') return t('host.payoutHeldNote');
  if (payout.status === 'queued') return t('host.payoutQueuedNote');
  const left = payout.releasesAt - now;
  if (left <= 0) return t('host.payoutReleasing');
  const hours = Math.ceil(left / 3_600_000);
  return hours <= 1
    ? t('host.payoutReleasesHour')
    : t('host.payoutReleasesHours', { count: hours });
}

export const PAYOUT_STATUS_LABEL: Record<HostPayout['status'], MessageKey> = {
  scheduled: 'host.payoutScheduled',
  queued: 'host.payoutQueued',
  paid: 'host.payoutPaidLabel',
  held: 'host.payoutHeld',
};

/* ----------------------------------------------------------------- the lines */

/** `4 Sep → 7 Sep`, the range in the reader's own month names. */
export function stayRange(booking: HostBooking, t: Translate): string {
  return `${formatDay(booking.checkInDay, t)} → ${formatDay(booking.checkOutDay, t)}`;
}

/** `3 nights`, or `1 night`. */
export function nightsLabel(nights: number, t: Translate): string {
  return nights === 1 ? t('calendar.oneNight') : t('calendar.nights', { count: nights });
}

/** `2 guests`, or `1 guest`. */
export function guestsLabel(guests: number, t: Translate): string {
  return guests === 1 ? t('host.oneGuest') : t('host.guestCount', { count: guests });
}

/** `Room 312 · Garden Suite`, or the sentence for a booking with no room yet. */
export function roomLine(booking: HostBooking, t: Translate): string {
  return booking.room
    ? t('host.roomAnd', { room: booking.room, type: booking.roomType })
    : t('host.noRoomYet');
}

/**
 * One sentence a screen reader hears for a whole row.
 *
 * A row is a `Pressable`, and a `Pressable` collapses its children into one
 * label — so everything the eye reads off the row has to be in here or it is
 * information only sighted users get.
 */
export function rowSpokenLabel(booking: HostBooking, today: string, t: Translate): string {
  return t('host.a11yRow', {
    guest: booking.guest.name,
    room: roomLine(booking, t),
    stay: `${stayRange(booking, t)}, ${nightsLabel(booking.nights, t)}`,
    status: t(`status.booking.${badgeStateOf(booking, today)}` as MessageKey),
  });
}
