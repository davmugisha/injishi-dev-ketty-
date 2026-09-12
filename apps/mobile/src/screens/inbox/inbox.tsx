/**
 * Inbox — frame R13, shared by Guest and Tenant.
 *
 * One tab, two lists, one segmented control: **Messages | Notifications**.
 * The canvas draws both kinds of row in a single scroll; the split is this
 * session's prompt and it is the right call, because they answer different
 * questions and clear differently. A message has a person on the other end and
 * a reply is possible. A notification is the system telling you something
 * happened, and the only useful response is to go and look.
 *
 * ## The surface decides the content, never the layout
 *
 * Decision D3 puts Inbox in the Guest set and the Tenant set, and the shell
 * links it for Host too. Which threads and which events you see follows the
 * active surface: guest threads hang off bookings, tenant threads off leases.
 * Everything else — the segment, the row shape, the states, the badge — is one
 * screen, because a tenant reading a landlord's message and a guest reading a
 * property's are the same act.
 *
 * A surface with no Inbox fixtures (Host today) resolves to no threads and no
 * notifications, which renders as the empty state rather than as a crash. That
 * is deliberate: the tab is linked for Host in the frozen `_layout.tsx`, and a
 * screen that throws on a registered route is worse than one that says there is
 * nothing here yet.
 *
 * ## The four states, per segment
 *
 * Both reads return `useFixture`'s `{ status, data, error, retry }`, so none of
 * these is a branch bolted on at the end:
 *
 *   - **loading** is the cold-read skeleton `Screen.List` draws in the empty
 *     slot; warm reads skip it, exactly as a query cache does.
 *   - **empty is per segment**, and the two say different things. No
 *     conversations means messaging has not opened yet, which for a guest who
 *     has never booked is the whole tab permanently (F-S06 forbids contact
 *     before a booking) — so it carries a way out. No notifications means
 *     nothing has happened, which needs no escape hatch and gets none.
 *   - **error** is `ErrorState` with `retry` wired to the read.
 *   - **offline** is a state, not an error (frames.md): the note says the list
 *     is the last one that loaded and blocks nothing.
 *
 * ## One clock
 *
 * Every row prints a relative stamp, so `now` is read once here and passed
 * down. A row with its own timer would be one interval per row, and the whole
 * list would tick at slightly different moments.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Button,
  EmptyState,
  ErrorState,
  Icon,
  Screen,
  SegmentedTabs,
  Text,
  useOffline,
  WorkspaceChip,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useDomain } from '@/domain';
import { useT } from '@/i18n/i18n';
import { useThreads, type Thread } from '@/data/threads';
import { useMarkNotificationRead, useNotifications, type AppNotification } from '@/data/notifications';
import { inboxSurface, useInboxCounts } from '@/data/inbox-unread';
import { MINUTE_MS } from './relative-time';
import { ThreadRow } from './thread-row';
import { NotificationRow } from './notification-row';

type Segment = 'messages' | 'notifications';

/** A row of either list, so one `Screen.List` can draw both segments. */
type Row = { kind: 'thread'; thread: Thread } | { kind: 'notification'; item: AppNotification };

/**
 * The clock the rows share.
 *
 * A minute is the finest granularity any stamp on this screen has ("3m"), so
 * ticking faster would re-render the list for no visible change. `trip-clock.ts`
 * makes the same trade at a different rate, because a countdown to check-in
 * genuinely needs seconds and a thread list does not.
 */
function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), MINUTE_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export function Inbox() {
  const { c, space } = useTheme();
  const router = useRouter();
  const t = useT();
  const { surface, workspace } = useDomain();

  const [segment, setSegment] = useState<Segment>('messages');
  const now = useMinuteClock();

  // Host links this tab and has no fixtures behind it, so `inbox` is
  // `undefined` there and both reads resolve empty. It must NOT fall back to
  // another surface: a host reading the guest's own conversations would be a
  // far worse bug than an empty tab.
  const inbox = inboxSurface(surface);
  const threads = useThreads(inbox);
  const notifications = useNotifications(inbox);
  const markNotificationRead = useMarkNotificationRead();
  const counts = useInboxCounts(surface);

  const offline = useOffline();

  const messages = segment === 'messages';
  const read = messages ? threads : notifications;

  const rows = useMemo<Row[]>(() => {
    if (messages) {
      return (threads.data ?? []).map((thread) => ({ kind: 'thread' as const, thread }));
    }
    return (notifications.data ?? []).map((item) => ({ kind: 'notification' as const, item }));
  }, [messages, threads.data, notifications.data]);

  const openThread = useCallback(
    (thread: Thread) =>
      router.push({ pathname: '/thread/[threadId]', params: { threadId: thread.id } }),
    [router],
  );

  const openNotification = useCallback(
    (item: AppNotification) => {
      markNotificationRead(item.id);
      // A notification with nowhere to go still clears; the row is the record,
      // and a dead-end tap that also did nothing would be an orphaned control.
      if (item.href) router.push(item.href);
    },
    [markNotificationRead, router],
  );

  return (
    <Screen.List<Row>
      greeting={t(inbox === 'tenant' ? 'inbox.greetingTenant' : 'inbox.greetingGuest')}
      title={t('inbox.title')}
      action={
        <WorkspaceChip
          name={workspace.name}
          role={workspace.role}
          onPress={() => router.push('/switch')}
        />
      }
      header={
        <>
          {offline ? <OfflineNote /> : null}

          {/* The pair is what carries the "one of these two" meaning;
              `SegmentedTabs` reports each tab and cannot name the group. */}
          <View accessibilityRole="tablist" accessibilityLabel={t('inbox.segmentLabel')}>
            <SegmentedTabs
              items={[
                {
                  value: 'messages',
                  label: t('inbox.tabMessages'),
                  // The count is the UNREAD count, not the row count: a segment
                  // labelled with how many conversations exist tells a reader
                  // nothing they need, where "2" waiting does.
                  count: counts.messages || undefined,
                },
                {
                  value: 'notifications',
                  label: t('inbox.tabNotifications'),
                  count: counts.notifications || undefined,
                },
              ]}
              value={segment}
              onChange={(next) => setSegment(next as Segment)}
            />
          </View>
        </>
      }
      data={rows}
      keyExtractor={(row) => (row.kind === 'thread' ? row.thread.id : row.item.id)}
      renderItem={({ item }) =>
        item.kind === 'thread' ? (
          <ThreadRow thread={item.thread} now={now} onPress={() => openThread(item.thread)} />
        ) : (
          <NotificationRow
            notification={item.item}
            now={now}
            onPress={() => openNotification(item.item)}
          />
        )
      }
      loading={read.status === 'loading'}
      loadingLabel={t('state.loadingList', {
        label: t(messages ? 'messages.listLabel' : 'inbox.notificationsListLabel'),
      })}
      loadingRows={3}
      empty={emptySlot()}
    />
  );

  function emptySlot() {
    if (read.status === 'error') {
      return (
        <ErrorState
          title={t('state.errorTitle')}
          body={t('state.errorBody', {
            label: t(messages ? 'messages.listLabel' : 'inbox.notificationsListLabel'),
          })}
          detail={read.error?.message}
          onRetry={read.retry}
        />
      );
    }
    if (read.status === 'loading') return null;

    if (!messages) {
      // Nothing has happened yet, and no action makes an event arrive — which
      // Session 11's audit agreed with and still counted as a dead end. The
      // action an empty state owes is a way SOMEWHERE; here that is the other
      // half of this same screen, which is one tap away and may not be empty.
      return (
        <EmptyState
          icon="bell"
          title={t('inbox.emptyNotificationsTitle')}
          body={t('inbox.emptyNotificationsBody')}
          action={
            <Button variant="outline" size="sm" onPress={() => setSegment('messages')}>
              {t('state.emptyGoTo', { tab: t('inbox.tabMessages') })}
            </Button>
          }
        />
      );
    }

    // The two halves of "no conversations" are different facts. A guest has to
    // book before messaging opens (F-S06); a tenant's conversation arrives with
    // the lease. One message covering both would be the misleading zero
    // `ui-screens.md` §6 rules out.
    const tenant = inbox === 'tenant';
    return (
      <EmptyState
        icon="messageCircle"
        title={t(tenant ? 'inbox.emptyTenantTitle' : 'messages.emptyTitle')}
        body={t(tenant ? 'inbox.emptyTenantBody' : 'messages.emptyBody')}
        action={
          <Button
            variant="outline"
            size="md"
            onPress={() => router.push(tenant ? '/leases' : '/')}
          >
            {t(tenant ? 'inbox.emptyTenantAction' : 'messages.emptyAction')}
          </Button>
        }
      />
    );
  }

  function OfflineNote() {
    return (
      <View
        accessible
        accessibilityRole="summary"
        accessibilityLabel={t('state.offlineLastList')}
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: space[2],
          padding: space[3],
          borderRadius: 10,
          backgroundColor: c.warning100,
        }}
      >
        <Icon name="wifiOff" size={16} color={c.warning600} />
        <Text size="xs" color="textBody" style={{ flex: 1, lineHeight: 18 }}>
          {t('state.offlineLastList')}
        </Text>
      </View>
    );
  }
}
