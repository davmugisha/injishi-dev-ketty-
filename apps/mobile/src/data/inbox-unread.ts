/**
 * The Inbox badge — one number, read by the tab bar.
 *
 * ADR-032's AC-16 says opening a thread clears both the row's dot and the tab
 * badge without a manual refresh, which is only possible if the tab bar and the
 * Inbox screen read the same store rather than each counting for themselves.
 * This is that store, and it is deliberately the smallest thing that can be:
 * two fixture reads and a sum, with no state of its own.
 *
 * **`undefined`, never `0`.** React Navigation draws `tabBarBadge` for any
 * defined value, so a `0` renders as a pill with a zero in it — a permanent
 * mark on the tab saying nothing is waiting, which is the misleading zero
 * `ui-screens.md` §6 rules out and which every native app avoids. The hook
 * returns `undefined` when the count is zero so the badge is absent, and the
 * call site cannot get it wrong by forgetting the check.
 *
 * **Messages and notifications both count.** The badge is on the Inbox tab, not
 * on one of its segments, so it answers "is there anything in here for me"; a
 * badge that counted only threads would sit at zero while an unread rent
 * receipt waited one tap away. Each segment carries its own count on the
 * segmented control, which is where the split becomes visible.
 *
 * A surface with no Inbox — landlord, broker, work — never calls this, because
 * the tab is unlinked for those sets. Host links the tab and has no fixtures
 * behind it yet, so it correctly reads zero and draws nothing.
 *
 * ## No badge until the Inbox reads the API
 *
 * **`badge` is always `undefined` for now** (mobile audit 2026-10-05, IN-03).
 * Every thread and notification behind these counts is a fixture, so the tab
 * bar told every real guest "6 unread" and every tenant "3" about messages and
 * receipts nobody sent them, and the number came back after every restart
 * because the read marks are never saved. A badge is the one Inbox signal that
 * follows the person to every other tab, so it is the one that must not count
 * what they never received. The two segment counts stay: they sit beside the
 * rows they count, inside the screen. The badge returns with the real read in
 * the next phase (ADR-038, feature 7): the sum of `unreadCount` over
 * `GET /me/threads`, invalidated by `POST /me/threads/:id/read`, with the
 * notification half once those exist on the server (IN-02).
 */
import { useFixtureValue } from './use-fixture-mutation';
import {
  READS_KEY,
  SEEDED_READS,
  THREADS,
  THREADS_KEY,
  messagesOf,
  unreadIn,
  type InboxSurface,
  type SentMessages,
  type ThreadReads,
} from './threads';
import {
  NOTIFICATIONS,
  NOTIFICATIONS_KEY,
  SEEDED_NOTIFICATION_READS,
  isUnread,
  type NotificationReads,
} from './notifications';
import type { Surface } from './rentals';

/** Which surfaces have an Inbox with a person and fixtures behind it. */
export function inboxSurface(surface: Surface): InboxSurface | undefined {
  return surface === 'guest' || surface === 'tenant' ? surface : undefined;
}

export interface InboxCounts {
  /** Unread threads, for the Messages segment inside the Inbox. */
  messages: number;
  /** Unread notifications, for the Notifications segment inside the Inbox. */
  notifications: number;
  /**
   * What the tab bar renders: `undefined` draws nothing. Always `undefined`
   * until the Inbox reads the API; see the header (IN-03).
   */
  badge: number | undefined;
}

/**
 * The counts for a surface. Safe to call for any surface: one without an Inbox
 * reads zero rather than throwing, so the tab layout needs no branch.
 */
export function useInboxCounts(surface: Surface): InboxCounts {
  const reads = useFixtureValue<ThreadReads>(READS_KEY, () => SEEDED_READS);
  const sent = useFixtureValue<SentMessages>(THREADS_KEY, () => ({}));
  const notificationReads = useFixtureValue<NotificationReads>(
    NOTIFICATIONS_KEY,
    () => SEEDED_NOTIFICATION_READS,
  );

  const inbox = inboxSurface(surface);

  const messages = inbox
    ? THREADS.filter((t) => t.surface === inbox).reduce(
        (total, thread) => total + unreadIn(thread, messagesOf(thread.id, sent), reads),
        0,
      )
    : 0;

  const notifications = inbox
    ? NOTIFICATIONS.filter((n) => n.surface === inbox && isUnread(n, notificationReads)).length
    : 0;

  // Not `messages + notifications`: those count fixtures this person never
  // received. No badge until the counts come from the server (IN-03).
  return { messages, notifications, badge: undefined };
}
