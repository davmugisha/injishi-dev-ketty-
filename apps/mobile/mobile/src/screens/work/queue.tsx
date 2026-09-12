/**
 * The Queue — frames W1 (live), W2 (offline) and W8 (Kinyarwanda).
 *
 * One screen with two shapes, and which one you get is the connection:
 *
 *   - **Online** it groups by floor, because that is how an attendant walks the
 *     building, and collects what they have finished under "Finished this
 *     shift".
 *   - **Offline** it groups by SYNC STATE — "Done — waiting to sync" above
 *     "Still to do" — because with no signal the interesting question stops
 *     being which floor and becomes what the desk does not know yet. That is
 *     frame W2's own grouping, and it is the whole reason offline is drawn as a
 *     state rather than as a banner over the normal screen.
 *
 * **Nothing here blocks on the network.** A room marked clean in a dead
 * corridor is clean on this phone the moment it is tapped, is listed as waiting
 * to sync, and replays in order with its idempotency key when signal returns
 * (F-P10 §6). The tick is the attendant's; the clock is the network's.
 *
 * The live arrival is the one thing on the surface that has to feel real-time:
 * room 208's checkout lands a few seconds after mount, once per session, drawn
 * as an arrival rather than as a refresh. F-P04's success criterion is "on the
 * queue within one second of checkout", and this is that criterion made
 * visible.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  Screen,
  SectionLabel,
  Text,
  WorkspaceChip,
} from '@/components';
import { useToast } from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { useDomain } from '@/domain';
import {
  STICKY_ACTION_CLEARANCE,
  WorkFilterTabs,
  WorkOfflineBar,
  WorkPageHead,
  WorkStickyAction,
  WorkSyncLine,
} from './work-chrome';
import { ArrivalBanner, InspectionCallout, QueueRow } from './queue-row';
import {
  ARRIVAL_DELAY_MS,
  ARRIVAL_TASK,
  WORK_PROFILE,
  type WorkTask,
} from './work-fixtures';
import {
  arrivalHasFired,
  useConnection,
  useWorkActions,
  useWorkInspections,
  useWorkTasks,
} from './work-store';
import {
  bufferLabel,
  changeLabel,
  finishedTasks,
  floorTabs,
  flushPhrase,
  liveTasks,
  nextPending,
  onFloor,
  queueEmptyReason,
  replayOrder,
  syncLine,
  type FloorFilter,
} from './work-format';

/**
 * The list is one flat array rather than nested sections, so it stays
 * virtualized: `Screen.List` is a FlashList, and a screen that grouped by
 * rendering an array of arrays would render every group at once.
 */
type QueueItem =
  | { kind: 'section'; key: string; label: string }
  | { kind: 'task'; key: string; task: WorkTask; queued: boolean }
  | { kind: 'caughtUp'; key: string }
  /** Clearance for the sticky primary, which the scaffold cannot know about. */
  | { kind: 'spacer'; key: string };

export function WorkQueue() {
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const { workspace } = useDomain();

  const [filter, setFilter] = useState<FloorFilter>('all');
  const tasks = useWorkTasks();
  const inspections = useWorkInspections();
  const connection = useConnection();
  const actions = useWorkActions();

  const rows = tasks.rows;
  const live = liveTasks(rows);
  const finished = finishedTasks(rows);
  const visible = onFloor(live, filter);
  const pending = nextPending(rows);
  const queuedRooms = useMemo(
    () => new Set(connection.buffer.map((change) => change.room)),
    [connection.buffer],
  );

  /* ---- the desk's checkout, landing live ------------------------------- */

  // Held on refs so the timer is armed once and never restarted by a re-render:
  // `actions` is a new object whenever a mutation changes status, and an effect
  // that depended on it would push the arrival further away on every write.
  const arrive = useRef(actions.arrive);
  arrive.current = actions.arrive;
  const announce = useRef(toast.show);
  announce.current = toast.show;

  useEffect(() => {
    if (arrivalHasFired()) return undefined;
    const timer = setTimeout(() => {
      void arrive.current().then(() => {
        announce.current(t('work.queue.arrivalToast', { room: ARRIVAL_TASK.id }), 'success');
      });
    }, ARRIVAL_DELAY_MS);
    return () => clearTimeout(timer);
    // Deliberately empty: this effect arms a one-shot timer, and every value
    // it needs at fire time is read off a ref above rather than captured.
  }, []);

  const arrival = rows.find((task) => task.id === ARRIVAL_TASK.id && task.isNew);

  /* ---- what a row does ------------------------------------------------- */

  const openTask = useCallback(
    (task: WorkTask) => {
      if (task.isNew) void actions.markSeen(task.id);
      router.push({ pathname: '/task/[taskId]', params: { taskId: task.id } });
    },
    [actions, router],
  );

  const startTask = useCallback(
    (task: WorkTask) => {
      void actions.start(task).then(() => {
        toast.show(t('work.task.startedToast', { room: task.id }), 'success');
      });
    },
    [actions, t, toast],
  );

  /**
   * Swipe-left goes to the fault form rather than blocking on its own.
   *
   * F-P04 §9 is explicit that a blocked task links to a maintenance ticket, and
   * FL45 path B is the only route into `blocked`. A block with no ticket behind
   * it is a room nobody is coming to fix, so the gesture opens frame W6 with
   * the room already chosen and the block lands when the fault is filed — which
   * is what W6's own consequence line promises.
   */
  const blockTask = useCallback(
    (task: WorkTask) => {
      router.push({ pathname: '/report-fault', params: { room: task.id } });
    },
    [router],
  );

  const takeNext = useCallback(() => {
    if (!pending) {
      toast.show(t('work.queue.caughtUpToast'), 'neutral');
      return;
    }
    void actions.start(pending).then(() => {
      router.push({ pathname: '/task/[taskId]', params: { taskId: pending.id } });
    });
  }, [actions, pending, router, t, toast]);

  const reconnect = useCallback(() => {
    void connection.flush().then((count) => {
      const phrase = flushPhrase(count);
      toast.show(t(phrase.key, phrase.values), 'success');
    });
  }, [connection, t, toast]);

  /* ---- the list -------------------------------------------------------- */

  const items = useMemo<QueueItem[]>(() => {
    if (tasks.status === 'error') return [];
    const out: QueueItem[] = [];

    if (!connection.online) {
      // Frame W2's grouping: what the desk does not know yet, then what is left.
      const queued = finished.filter((task) => queuedRooms.has(task.id));
      if (queued.length > 0) {
        out.push({ kind: 'section', key: 'queued', label: t('work.queue.sectionQueued') });
        for (const task of queued) {
          out.push({ kind: 'task', key: `q-${task.id}`, task, queued: true });
        }
      }
      out.push({ kind: 'section', key: 'todo', label: t('work.queue.sectionTodo') });
      if (visible.length === 0) out.push({ kind: 'caughtUp', key: 'caught-up' });
      for (const task of visible) {
        out.push({ kind: 'task', key: `t-${task.id}`, task, queued: false });
      }
      const synced = finished.filter((task) => !queuedRooms.has(task.id));
      if (synced.length > 0) {
        out.push({ kind: 'section', key: 'done', label: t('work.queue.sectionDone') });
        for (const task of synced) {
          out.push({ kind: 'task', key: `d-${task.id}`, task, queued: false });
        }
      }
    } else {
      const floors = [...new Set(visible.map((task) => task.floor))].sort((a, b) => a - b);
      for (const floor of floors) {
        out.push({
          kind: 'section',
          key: `floor-${floor}`,
          label: t('work.queue.sectionFloor', { floor }),
        });
        for (const task of visible.filter((task) => task.floor === floor)) {
          out.push({ kind: 'task', key: `t-${task.id}`, task, queued: false });
        }
      }
      if (visible.length === 0 && finished.length > 0) {
        out.push({ kind: 'caughtUp', key: 'caught-up' });
      }
      if (finished.length > 0) {
        out.push({ kind: 'section', key: 'done', label: t('work.queue.sectionDone') });
        for (const task of finished) {
          out.push({ kind: 'task', key: `d-${task.id}`, task, queued: queuedRooms.has(task.id) });
        }
      }
    }

    if (out.length > 0) out.push({ kind: 'spacer', key: 'spacer' });
    return out;
  }, [connection.online, finished, queuedRooms, t, tasks.status, visible]);

  const sync = syncLine({
    online: connection.online,
    openCount: live.length,
    bufferCount: connection.buffer.length,
  });
  const buffer = bufferLabel({ online: connection.online, buffer: connection.buffer });
  const reason = queueEmptyReason(filter);

  return (
    /* The surface's own accessibility (gaps.md §5.3).
       `a11y=0` on the home screen of a surface used one-handed, gloved and
       standing — which is the surface where a screen reader and a large target
       matter most, not least. The list announces its own length and how much of
       the shift is done, because "how many rooms have I got left" is the
       question this screen exists to answer and scrolling to count is not an
       answer for somebody holding a trolley. */
    <View
      accessibilityRole="summary"
      accessibilityLabel={t('work.queue.a11yList', {
        count: String(live.length),
        done: String(finished.length),
      })}
      accessibilityHint={t('work.queue.a11yProgress', {
        done: String(finished.length),
        total: String(live.length + finished.length),
      })}
      style={{ flex: 1 }}
    >
      <Screen.List<QueueItem>
        data={items}
        keyExtractor={(item) => item.key}
        header={
          <>
            <WorkPageHead
              title={t('work.queue.title')}
              action={
                <WorkspaceChip
                  name={workspace.name}
                  role={workspace.role}
                  onPress={() => router.push('/switch')}
                />
              }
            >
              <WorkSyncLine online={connection.online}>{t(sync.key, sync.values)}</WorkSyncLine>
            </WorkPageHead>

            {!connection.online ? (
              <>
                <WorkOfflineBar
                  title={t('work.offline.bannerTitle')}
                  detail={t(buffer.key, buffer.values)}
                  actionLabel={t('work.offline.reconnect')}
                  onAction={reconnect}
                  busy={actions.busy}
                />
                {/* The note is about the LIST rather than about the connection:
                    a reader who has scrolled past the banner still has to be
                    told that what they are looking at may be behind the desk. */}
                <Text size="xs" color="textMuted" style={{ lineHeight: 18 }}>
                  {t('state.offlineLastList')}
                </Text>
              </>
            ) : null}

            {arrival ? <ArrivalBanner task={arrival} onOpen={() => openTask(arrival)} /> : null}

            {WORK_PROFILE.supervisor && inspections.rows.length > 0 ? (
              <InspectionCallout
                count={inspections.rows.length}
                onOpen={() => router.push('/inspection')}
              />
            ) : null}

            <WorkFilterTabs
              label={t('work.queue.listLabel')}
              value={String(filter)}
              onChange={(next) => setFilter(next === 'all' ? 'all' : Number(next))}
              items={floorTabs(rows).map((tab) => ({
                value: tab.value,
                label: t(tab.label.key, tab.label.values),
                count: tab.count,
              }))}
            />

            {!connection.online ? <ReconnectCard buffer={connection.buffer} /> : null}
          </>
        }
        renderItem={({ item }) => {
          if (item.kind === 'spacer') return <View style={{ height: STICKY_ACTION_CLEARANCE }} />;
          if (item.kind === 'section') return <SectionLabel>{item.label}</SectionLabel>;
          if (item.kind === 'caughtUp') {
            return (
              <EmptyState
                icon="checkCircle"
                title={t('work.queue.emptyTitle')}
                body={t(reason.key, reason.values)}
                // Caught up is good news, and it is still a dead end without a
                // way on. Rooms is what an attendant looks at next.
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    leadingIcon="bed"
                    onPress={() => router.push('/rooms')}
                  >
                    {t('state.emptyGoTo', { tab: t('nav.rooms') })}
                  </Button>
                }
              />
            );
          }
          const task = item.task;
          const done = task.status === 'done' || task.status === 'inspected';
          return (
            <QueueRow
              task={task}
              queued={item.queued}
              onOpen={() => openTask(task)}
              onStart={task.status === 'pending' ? () => startTask(task) : undefined}
              onBlock={done || task.status === 'blocked' ? undefined : () => blockTask(task)}
            />
          );
        }}
        loading={tasks.status === 'loading'}
        loadingLabel={t('state.loadingList', { label: t('work.queue.listLabel') })}
        loadingRows={3}
        empty={
          tasks.status === 'error' ? (
            <ErrorState
              title={t('state.errorTitle')}
              body={t('state.errorBody', { label: t('work.queue.listLabel') })}
              detail={tasks.error?.message}
              onRetry={tasks.retry}
            />
          ) : (
            <EmptyState
              icon="checkCircle"
              title={t('work.queue.emptyTitle')}
              body={t(reason.key, reason.values)}
              action={
                <Button
                  variant="outline"
                  size="sm"
                  leadingIcon="bed"
                  onPress={() => router.push('/rooms')}
                >
                  {t('state.emptyGoTo', { tab: t('nav.rooms') })}
                </Button>
              }
            />
          )
        }
      />

      <WorkStickyAction
        icon="sparkles"
        label={pending ? t('work.queue.takeNext') : t('work.queue.nothingPending')}
        hint={pending ? t('work.queue.takeNextHint') : undefined}
        muted={!pending}
        onPress={takeNext}
      />
    </View>
  );
}

/**
 * Frame W2's "What happens on reconnect", with the buffer printed under it.
 *
 * The card in the frame ASSERTS that changes replay in order with their
 * idempotency keys. Printing the buffer in that order turns the assertion into
 * something the reader can check, which is the difference between a promise and
 * a receipt — and it is the honest thing to show someone whose work is
 * currently sitting on one phone.
 */
function ReconnectCard({ buffer }: { buffer: readonly { key: string; room: string; kind: 'clean' | 'started' | 'blocked' | 'status' | 'ticket'; at: number }[] }) {
  const t = useT();
  const { c, space } = useTheme();
  const ordered = replayOrder(buffer);

  return (
    <Card variant="flat" title={t('work.offline.cardTitle')}>
      <View style={{ gap: space[3] }}>
        <Text size="sm" color="textBody" style={{ lineHeight: 20 }}>
          {ordered.length > 0
            ? t('work.offline.cardBody', { count: ordered.length })
            : t('work.offline.cardBodyEmpty')}
        </Text>

        {ordered.length > 0 ? (
          <View style={{ gap: space[2] }}>
            <SectionLabel>{t('work.offline.replayTitle')}</SectionLabel>
            {ordered.map((change, index) => (
              <View
                key={change.key}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}
              >
                <Text family="mono" size="xs" color="textSubtle" style={{ minWidth: 16 }}>
                  {index + 1}
                </Text>
                <Icon name="clock" size={14} color={c.warning600} />
                <Text size="sm" color="textBody" style={{ flex: 1 }}>
                  {t('work.offline.queuedRoom', {
                    room: change.room,
                    what: t(changeLabel(change)),
                  })}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Card>
  );
}
