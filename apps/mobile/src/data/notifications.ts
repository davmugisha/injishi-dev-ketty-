/**
 * System events — the Notifications half of the Inbox (frame R13, F-S07).
 *
 * A notification is not a message and the two must not share a list. A message
 * has a person on the other end and a reply is possible; a notification is the
 * system telling you something happened, and the only useful response is to go
 * and look at the thing. Frame R13 draws them in one scroll, but the tab is
 * segmented and the prompt for this session splits them, which is the right
 * call: they answer different questions and they clear differently.
 *
 * **No endpoint owns this yet.** F-S07 is `[planned]`; it names an event
 * catalogue (Booking, Stay, Review, Payment, Messaging, Onboarding, Lease) and
 * a category-by-channel preference matrix, and nothing in `injishi.context` has
 * shaped the row. So this fixture is shaped off F-S07's catalogue and off the
 * three rows frame R13 actually draws, and it is the one part of this session
 * whose swap will need more than a hook change — the report says so rather than
 * pretending otherwise.
 *
 * **Transactional events are non-disableable** per F-S07, which is why there is
 * no mute affordance here: a rent receipt and a booking confirmation are records
 * the reader is entitled to, not marketing.
 *
 * Read state is local and per notification, the same store `./threads.ts` uses
 * for `thread_reads`. Opening the Notifications segment does NOT mark them all
 * read: a list that clears itself the moment you glance at it is a list that
 * loses the one row you meant to come back to.
 */
import { useCallback, useMemo } from 'react';
import { useFixture, type FixtureResult } from './use-fixture';
import { useFixtureMutation, useFixtureValue } from './use-fixture-mutation';
import type { IconName } from '@/components';
import type { MessageKey } from '@/i18n/messages';
import type { InboxSurface } from './threads';

/* ------------------------------------------------------------- the shape --- */

/**
 * F-S07's event catalogue, narrowed to the events this prototype can raise.
 *
 * The type drives the glyph and the tint, and it is an enum rather than an icon
 * name on the row for the reason `StatusBadge` is: a fixture that carries its
 * own icon is a fixture that can draw a wrench beside a rent receipt.
 */
/** The tabs a system event can send a reader to. Both sets, one union. */
export type NotificationTarget = '/trips' | '/rent' | '/leases' | '/saved' | '/';

export type NotificationType =
  | 'booking_confirmed'
  | 'booking_request'
  | 'stay_reminder'
  | 'review_invite'
  | 'rent_receipt'
  | 'rent_due'
  | 'ticket_progress'
  | 'lease_signature';

export interface AppNotification {
  id: string;
  type: NotificationType;
  /** The bold line. Frame R13: "Maintenance", "Rent receipt". */
  title: string;
  /** The one-line body under it. */
  body: string;
  createdAt: number;
  /** Which tab set raises it. Guest and Tenant see different events. */
  surface: InboxSurface;
  /**
   * Which tab the row opens, or `undefined` for an event with nothing to open.
   *
   * A tab name rather than a free `href`, so a notification cannot point at a
   * route that does not exist and cannot be pushed without a cast. F-S07's
   * catalogue is wider than this and will need real deep links; when it does,
   * this becomes a typed route and the screen's `push` is the only thing that
   * changes.
   */
  href?: NotificationTarget;
  /** Seeded read state. The store overrides it once the reader taps. */
  readAt?: number;
}

/**
 * Glyph and tint per type, in one table.
 *
 * The tint is a palette KEY, resolved by the row through `useTheme()`. The
 * canvas rule is that status is colour plus label plus a glyph where it
 * matters, so no type is distinguished by colour alone: every row carries the
 * type's own word as its title.
 */
export const NOTIFICATION_STYLE: Record<
  NotificationType,
  { icon: IconName; tone: 'brand' | 'success' | 'warning' | 'neutral'; label: MessageKey }
> = {
  booking_confirmed: { icon: 'checkCircle', tone: 'success', label: 'inbox.type.bookingConfirmed' },
  booking_request: { icon: 'clock', tone: 'warning', label: 'inbox.type.bookingRequest' },
  stay_reminder: { icon: 'calendar', tone: 'brand', label: 'inbox.type.stayReminder' },
  review_invite: { icon: 'star', tone: 'brand', label: 'inbox.type.reviewInvite' },
  rent_receipt: { icon: 'receipt', tone: 'success', label: 'inbox.type.rentReceipt' },
  rent_due: { icon: 'wallet', tone: 'warning', label: 'inbox.type.rentDue' },
  ticket_progress: { icon: 'wrench', tone: 'brand', label: 'inbox.type.ticketProgress' },
  lease_signature: { icon: 'fileText', tone: 'warning', label: 'inbox.type.leaseSignature' },
};

/* ------------------------------------------------------------- the seeds --- */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

interface NotificationSeed extends Omit<AppNotification, 'createdAt' | 'readAt'> {
  agoMs: number;
  /** Seeded as already read. Unset means it still carries the unread mark. */
  read?: boolean;
}

/**
 * The seeds, newest first within each surface.
 *
 * The tenant row at the top is frame R13's own, in its words: the maintenance
 * ticket in progress. The rest fill the two lists out to a length where the
 * segment reads as a real surface rather than as a demo of one row.
 *
 * **No seed claims money moved** (mobile audit 2026-10-05, IN-02). There were
 * three receipts here, "July rent received", "June rent received" and "RWF
 * 464,850 charged to MTN MoMo", and every real guest and tenant read them as
 * their own: a payment nobody made, confirmed by the app. They are gone, and so
 * is "Review your stay", which invited a review the app has hidden. Nothing on
 * the server raises a notification yet (F-S07 is planned), so what is left is
 * still a fixture; whether the segment shows anything at all before then is
 * the owner's call, and the report says so.
 */
const SEEDS: NotificationSeed[] = [
  /* ---- Tenant, frame R13 ------------------------------------------------- */
  {
    id: 'n-tenant-ticket',
    type: 'ticket_progress',
    title: 'Maintenance',
    body: 'Your socket repair ticket is in progress.',
    agoMs: 26 * HOUR,
    surface: 'tenant',
    href: '/leases',
  },
  {
    id: 'n-tenant-signature',
    type: 'lease_signature',
    title: 'Signature needed',
    body: 'Kimironko Flat 3 is waiting for your signature.',
    agoMs: 2 * DAY,
    surface: 'tenant',
    href: '/leases',
  },
  {
    id: 'n-tenant-due',
    type: 'rent_due',
    title: 'Rent due soon',
    body: 'August rent is due on the 1st — RWF 310,000.',
    agoMs: 3 * DAY,
    surface: 'tenant',
    href: '/rent',
    read: true,
  },

  /* ---- Guest ------------------------------------------------------------- */
  {
    id: 'n-guest-checkin',
    type: 'stay_reminder',
    title: 'Check-in is open',
    body: 'Lake Kivu Suite — self check-in is open until 22:00.',
    agoMs: 4 * HOUR,
    surface: 'guest',
    href: '/trips',
  },
  {
    id: 'n-guest-confirmed',
    type: 'booking_confirmed',
    title: 'Booking confirmed',
    body: 'Akagera Tented Camp, two nights from Friday. Reference INJ-4703-AK.',
    agoMs: 30 * HOUR,
    surface: 'guest',
    href: '/trips',
  },
  {
    id: 'n-guest-request',
    type: 'booking_request',
    title: 'Waiting on the host',
    body: 'Musanze Volcano Cabin has your request. Most hosts answer within a day.',
    agoMs: 20 * HOUR,
    surface: 'guest',
    href: '/trips',
    read: true,
  },
];

/* -------------------------------------------------------- the derivation --- */

export const NOTIFICATIONS_KEY = 'inbox.notifications.read';

/** Notification id to the instant it was read. Absent means unread. */
export type NotificationReads = Record<string, number>;

function buildAll(now: number = Date.now()): AppNotification[] {
  return SEEDS.map(({ agoMs, read, ...rest }) => ({
    ...rest,
    createdAt: now - agoMs,
    readAt: read ? now - agoMs + MINUTE : undefined,
  })).sort((a, b) => b.createdAt - a.createdAt);
}

export const NOTIFICATIONS: AppNotification[] = buildAll();

/** The read marks a fresh install starts with, from the seeds' own `read`. */
export const SEEDED_NOTIFICATION_READS: NotificationReads = Object.fromEntries(
  NOTIFICATIONS.flatMap((n) => (n.readAt === undefined ? [] : [[n.id, n.readAt]])),
);

export function isUnread(n: AppNotification, reads: NotificationReads): boolean {
  return reads[n.id] === undefined;
}

/* -------------------------------------------------------------- the hooks -- */

/** The notification list for one surface, newest first, with live read state. */
export function useNotifications(
  surface: InboxSurface | undefined,
): FixtureResult<AppNotification[]> {
  const reads = useFixtureValue<NotificationReads>(
    NOTIFICATIONS_KEY,
    () => SEEDED_NOTIFICATION_READS,
  );
  // `undefined` is a surface with an Inbox tab and no fixtures behind it. It
  // reads empty rather than borrowing another surface's events.
  const base = useFixture<AppNotification[]>(`inbox.notifications.${surface ?? 'none'}`, () =>
    surface ? NOTIFICATIONS.filter((n) => n.surface === surface) : [],
  );

  const data = useMemo(
    () => base.data?.map((n) => ({ ...n, readAt: reads[n.id] })),
    [base.data, reads],
  );

  return { status: base.status, error: base.error, retry: base.retry, data };
}

/** Mark one notification read. Tapping the row is the only thing that does it. */
export function useMarkNotificationRead(): (id: string) => void {
  const { mutate } = useFixtureMutation<NotificationReads, string>(
    NOTIFICATIONS_KEY,
    (current, id) => ({ ...current, [id]: Date.now() }),
    () => SEEDED_NOTIFICATION_READS,
  );

  return useCallback(
    (id: string) => {
      void mutate(id);
    },
    [mutate],
  );
}
