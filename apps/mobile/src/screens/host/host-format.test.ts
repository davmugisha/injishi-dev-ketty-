/**
 * The grouping, the search and the countdowns.
 *
 * All pure, so they are asserted here rather than through a screen — and the
 * point of having them in one file is that Today and Bookings cannot disagree
 * about which bucket a booking is in. These tests are what hold that.
 */
import { todayIso } from '@/components';
import { addDays } from '@/data/trips';
import { en, rw } from '@/i18n/messages';
import type { Translate } from '@/i18n/i18n';
import { HOST_BOOKINGS, type HostBooking, type HostPayout } from './host-fixtures';
import {
  BOOKING_FILTERS,
  FILTER_EMPTY,
  FILTER_LABEL,
  GROUP_EMPTY,
  GROUP_LABEL,
  TODAY_GROUPS,
  badgeStateOf,
  bufferNote,
  expiryNote,
  filterBookings,
  filterCounts,
  groupForToday,
  isUrgent,
  matchesQuery,
  todayCount,
} from './host-format';

const TODAY = todayIso();

/**
 * A translator over the real English catalogue, so an assertion reads the
 * sentence a person would. Positional `{name}` substitution is `t`'s own shape.
 */
const t: Translate = ((key: keyof typeof en, params?: Record<string, string | number>) => {
  const raw = en[key] as string;
  return params
    ? Object.entries(params).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), raw)
    : raw;
}) as Translate;

const base = HOST_BOOKINGS[0];

describe('grouping for today', () => {
  const groups = groupForToday(HOST_BOOKINGS, TODAY);

  it('puts every fixture in exactly one bucket, or in none', () => {
    const all = TODAY_GROUPS.flatMap((g) => groups[g].map((b) => b.id));
    expect(new Set(all).size).toBe(all.length);
  });

  it('never lets a terminal booking onto today', () => {
    const shown = TODAY_GROUPS.flatMap((g) => groups[g]);
    expect(shown.some((b) => b.status === 'declined')).toBe(false);
    expect(shown.some((b) => b.checkedOutAt !== null)).toBe(false);
  });

  it('orders requests by how soon they expire, not by when they arrived', () => {
    const times = groups.awaiting.map((b) => b.approvalExpiresAt ?? 0);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('counts what it is showing', () => {
    expect(todayCount(groups)).toBe(TODAY_GROUPS.reduce((n, g) => n + groups[g].length, 0));
  });
});

describe('the Bookings filters', () => {
  it('shows everything under All', () => {
    expect(filterBookings(HOST_BOOKINGS, 'all', '', TODAY)).toHaveLength(HOST_BOOKINGS.length);
  });

  it('keeps a declined booking reachable, where the web desk drops it', () => {
    // Deliberate deviation, and the reason is in `host-fixtures.ts`: a decline
    // that erased its own evidence would make the path untestable by walking
    // the app, and reads as data loss rather than as a filter.
    const declined = filterBookings(HOST_BOOKINGS, 'declined', '', TODAY);
    expect(declined.length).toBeGreaterThan(0);
    expect(declined.every((b) => b.status === 'declined' || b.status === 'cancelled')).toBe(true);
  });

  it('puts what needs a decision at the top of All', () => {
    const rows = filterBookings(HOST_BOOKINGS, 'all', '', TODAY);
    expect(rows[0].status).toBe('pending_approval');
  });

  it('gives every chip a count that matches what it would show', () => {
    const counts = filterCounts(HOST_BOOKINGS, '', TODAY);
    for (const filter of BOOKING_FILTERS) {
      expect(counts[filter]).toBe(filterBookings(HOST_BOOKINGS, filter, '', TODAY).length);
    }
  });

  it('gives every chip a label and an empty line', () => {
    for (const filter of BOOKING_FILTERS) {
      expect(en[FILTER_LABEL[filter]]).toBeTruthy();
      expect(en[FILTER_EMPTY[filter]]).toBeTruthy();
    }
  });
});

describe('the search', () => {
  it('finds a guest by name, case insensitively', () => {
    expect(matchesQuery(base, base.guest.name.toLowerCase())).toBe(true);
  });

  it('finds a booking by the reference a guest reads out', () => {
    expect(matchesQuery(base, base.id)).toBe(true);
  });

  it('finds a stay by its room number', () => {
    const withRoom = HOST_BOOKINGS.find((b) => b.room)!;
    expect(matchesQuery(withRoom, withRoom.room!)).toBe(true);
  });

  it('matches everything on an empty query rather than nothing', () => {
    expect(matchesQuery(base, '   ')).toBe(true);
  });

  it('does not match a date, which would match a whole season', () => {
    expect(matchesQuery(base, base.checkInDay)).toBe(false);
  });
});

describe('the countdowns', () => {
  const now = Date.now();

  it('reads in minutes under an hour and in hours above it', () => {
    expect(expiryNote(now + 40 * 60_000, now, t)).toBe(
      en['host.expiresMinutes'].replace('{count}', '40'),
    );
    expect(expiryNote(now + 3 * 3_600_000, now, t)).toBe(
      en['host.expiresHours'].replace('{count}', '3'),
    );
    expect(expiryNote(now + 3_600_000, now, t)).toBe(en['host.expiresHour']);
  });

  it('says a request is over rather than counting into the negative', () => {
    expect(expiryNote(now - 1, now, t)).toBe(en['host.expired']);
  });

  it('says nothing at all when there is no countdown to run', () => {
    expect(expiryNote(null, now, t)).toBeNull();
  });

  it('calls the last hour urgent, and an expired request not', () => {
    expect(isUrgent(now + 30 * 60_000, now)).toBe(true);
    expect(isUrgent(now + 5 * 3_600_000, now)).toBe(false);
    // Over is not urgent: there is nothing left to hurry for.
    expect(isUrgent(now - 1, now)).toBe(false);
  });
});

describe('the payout buffer', () => {
  const now = Date.now();
  const payout = (over: Partial<HostPayout> = {}): HostPayout => ({
    id: 'PO-1',
    bookingId: 'BK-1',
    guest: 'Someone',
    amountRwf: 100000,
    status: 'scheduled',
    releasesAt: now + 5 * 3_600_000,
    destination: 'momo',
    ...over,
  });

  it('counts a scheduled payout down', () => {
    expect(bufferNote(payout(), now, t)).toBe(
      en['host.payoutReleasesHours'].replace('{count}', '5'),
    );
  });

  it('says a queued payout is waiting on the host, never that it failed', () => {
    // F-B12 is emphatic: a payout with no destination is never dropped.
    expect(bufferNote(payout({ status: 'queued' }), now, t)).toBe(en['host.payoutQueuedNote']);
  });

  it('says why a held payout is stopped', () => {
    expect(bufferNote(payout({ status: 'held' }), now, t)).toBe(en['host.payoutHeldNote']);
  });
});

describe('the badge', () => {
  const stay = (over: Partial<HostBooking>): HostBooking => ({ ...base, ...over });

  it('reuses the words the guest already sees, never a host synonym', () => {
    for (const booking of HOST_BOOKINGS) {
      const key = `status.booking.${badgeStateOf(booking, TODAY)}` as keyof typeof en;
      expect(en[key]).toBeTruthy();
      expect(rw[key]).toBeTruthy();
    }
  });

  it('reads arriving only on the day, and checked in once the stay is open', () => {
    const arriving = stay({
      status: 'confirmed',
      checkedInAt: null,
      checkedOutAt: null,
      checkInDay: TODAY,
    });
    expect(badgeStateOf(arriving, TODAY)).toBe('arriving');
    expect(badgeStateOf({ ...arriving, checkInDay: addDays(TODAY, 4) }, TODAY)).toBe('confirmed');
    expect(badgeStateOf({ ...arriving, checkedInAt: Date.now() }, TODAY)).toBe('checked_in');
    expect(badgeStateOf({ ...arriving, checkedOutAt: Date.now() }, TODAY)).toBe('completed');
  });
});

describe('the catalogue', () => {
  it('carries both languages for every group label and empty line', () => {
    for (const group of TODAY_GROUPS) {
      expect(en[GROUP_LABEL[group]]).toBeTruthy();
      expect(rw[GROUP_LABEL[group]]).toBeTruthy();
      expect(en[GROUP_EMPTY[group]]).toBeTruthy();
      expect(rw[GROUP_EMPTY[group]]).toBeTruthy();
    }
  });

  /**
   * Keys that ship English in Kinyarwanda on purpose (mobile audit 2026-10-05).
   *
   * v1 is English only. A key the honesty pass added, or whose English changed
   * meaning, takes `en[key]` as its `rw` value, the rule `common.ts` follows:
   * an old translation would still say the false thing, and a ` (RW)` suffix is
   * visible to a reader. Named here so the rule below stays sharp: any OTHER
   * long value that is simply the English still fails, and this list is the
   * Kinyarwanda pass's work list.
   */
  const ENGLISH_IN_V1 = new Set<string>([
    'host.offlineNote',
    'host.needsConnectionDecision',
    'host.needsConnectionCheckOut',
    'host.approveFailed',
    'host.declineFailed',
    'host.undoFailed',
    'host.escrowHeld',
    'host.invoiceNotIssued',
    'host.documentEnding',
    'host.eventCheckedOut',
    'host.folioBody',
    'host.photoBody',
    'host.checkOutBody',
    'host.checkOutBalance',
    'host.checkOutEarly',
    'host.checkOutConfirm',
    'host.checkedOutToast',
    'host.checkedOutNoRoom',
    'host.checkOutFailedTitle',
    'host.checkOutFailedBody',
    'host.mockAdapter',
    'host.mockAdapterNote',
    'host.checkInReadFailed',
    'host.roomsReadFailed',
    'host.roomsReadFailedBody',
  ]);

  it('leaves no host key untranslated by accident', () => {
    // A ` (RW)` suffix is the deliberate marker for a string this session had
    // no confident Kinyarwanda for. What must never happen is a value that is
    // simply the English, unmarked, which is a translation nobody can find.
    const keys = (Object.keys(en) as (keyof typeof en)[]).filter((k) =>
      String(k).startsWith('host.'),
    );
    expect(keys.length).toBeGreaterThan(100);
    for (const key of keys) {
      const same = rw[key] === en[key];
      // Identical is allowed only where the string is a proper noun, a format
      // placeholder or a number — never for a sentence — or where it is named
      // above as English until the Kinyarwanda pass.
      if (same && !ENGLISH_IN_V1.has(key)) {
        expect({ key, short: en[key].length < 40 }).toEqual({ key, short: true });
      }
    }
  });

  it('names only keys that exist and really are English, so the list cannot rot', () => {
    for (const key of ENGLISH_IN_V1) {
      expect({ key, english: rw[key as keyof typeof rw] === en[key as keyof typeof en] }).toEqual({
        key,
        english: true,
      });
    }
  });
});
