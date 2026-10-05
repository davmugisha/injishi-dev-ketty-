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
 * corridor is clean on this phone the moment it is tapped and is listed as
 * waiting. (Nothing replays that list yet: scope feature 15, mobile audit
 * 2026-10-05 WK-03.)
 *
 * An arrival — a checkout landing on the queue — is drawn as an arrival rather
 * than as a refresh, F-P04's "on the queue within one second of checkout" made
 * visible. It comes from the store, the way Host's checkout delivers one. The
 * screen used to manufacture one itself: room 208, 6.5 seconds after every
 * launch, with a success toast, for every real housekeeper (WK-02).
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Card,
  EmptyState,
  ErrorState,
  Icon,
  Screen,
  SectionLabel,
  Text,
  WorkspaceChip,
  WriteError,
  useToast,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { useDomain } from '@/domain';
import {
  STICKY_ACTION_CLEARANCE,
  WorkButton,
  WorkFilterTabs,
  WorkOfflineBar,
  WorkPageHead,
  WorkStickyAction,
  WorkSyncLine,
} from './work-chrome';
import { ArrivalBanner, InspectionCallout, QueueRow } from './queue-row';
import { WORK_PROFILE, type BufferedChange, type WorkTask } from './work-fixtures';
import {
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
  liveTasks,
  nextPending,
  onFloor,
  queueEmptyReason,
  replayOrder,
  syncLine,
  tabCountPhrase,
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
  | { kind: 'spacer'; key: string; height: number };

/** A start that did not land, kept so Try again can run it again. */
interface FailedStart {
  /** Take next also opens the room; a swipe only starts it. */
  kind: 'start' | 'takeNext';
  id: string;
}

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

  const [failed, setFailed] = useState<FailedStart | null>(null);
  /** The pinned bar's measured height, so the last row can scroll clear of it. */
  const [barHeight, setBarHeight] = useState(0);
  /** Take next opens a screen, so a second tap while the first saves must not. */
  const taking = useRef(false);

  // Empty until the read lands (`useWorkList`), so nothing below counts from
  // the seed in the meantime (mobile audit 2026-10-05, WK-24).
  const rows = tasks.rows;
  const live = liveTasks(rows);
  const finished = finishedTasks(rows);
  const visible = onFloor(live, filter);
  const pending = nextPending(rows);
  const queuedRooms = useMemo(
    () => new Set(connection.buffer.map((change) => change.room)),
    [connection.buffer],
  );

  /** A real arrival: a task that landed and has not been opened yet. */
  const arrival = rows.find((task) => task.isNew);

  /* ---- what a row does ------------------------------------------------- */

  const openTask = useCallback(
    (task: WorkTask) => {
      if (task.isNew) void actions.markSeen(task.id);
      router.push({ pathname: '/task/[taskId]', params: { taskId: task.id } });
    },
    [actions, router],
  );

  /**
   * Start a room, and say so only if it started.
   *
   * Both callers used to `void` the write and toast or navigate in its
   * `.then` whatever happened, so a start that never landed still said "Room
   * 205 started" or opened the room as if it had (mobile audit 2026-10-05,
   * WK-04). The outcome decides now: done is said, a failure is kept for Try
   * again, and a write cancelled by a reset says nothing at all.
   */
  const run = useCallback(
    (attempt: FailedStart, task: WorkTask) => {
      setFailed(null);
      if (attempt.kind === 'takeNext') taking.current = true;
      void actions.start(task).then((outcome) => {
        if (attempt.kind === 'takeNext') taking.current = false;
        if (outcome === 'error') {
          setFailed(attempt);
          return;
        }
        if (outcome !== 'done') return;
        if (attempt.kind === 'takeNext') {
          router.push({ pathname: '/task/[taskId]', params: { taskId: task.id } });
        } else {
          toast.show(t('work.task.startedToast', { room: task.id }), 'success');
        }
      });
    },
    [actions, router, t, toast],
  );

  const startTask = useCallback(
    (task: WorkTask) => run({ kind: 'start', id: task.id }, task),
    [run],
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
    // Before the read lands there is nothing to take, and "you are caught up"
    // would be a claim about a list nobody has loaded.
    if (!tasks.ready || taking.current) return;
    if (!pending) {
      toast.show(t('work.queue.caughtUpToast'), 'neutral');
      return;
    }
    run({ kind: 'takeNext', id: pending.id }, pending);
  }, [pending, run, t, tasks.ready, toast]);

  /** Try again runs the start that failed, not whatever is pending now (WK-05). */
  const retry = useCallback(() => {
    if (!failed) return;
    actions.clearFailure();
    const task = rows.find((row) => row.id === failed.id);
    // The room may have moved on since: started from its own screen, or
    // blocked by a fault. Starting it again would undo that, so let it go.
    if (!task || task.status !== 'pending') {
      setFailed(null);
      return;
    }
    run(failed, task);
  }, [actions, failed, rows, run]);

  const dismiss = useCallback(() => {
    actions.clearFailure();
    setFailed(null);
  }, [actions]);

  /**
   * Ends the simulated outage and empties the list of changes waiting. It says
   * "Back online" and nothing more: the toast used to say "3 changes synced, in
   * order, no duplicates", and nothing is sent anywhere (WK-03, WK-32).
   */
  const reconnect = useCallback(() => {
    void connection.flush().then((outcome) => {
      if (outcome === 'error') toast.show(t('work.writeFailedTitle'), 'danger');
      else if (outcome === 'done') toast.show(t('work.offline.backOnlineToast'), 'success');
    });
  }, [connection, t, toast]);

  /* ---- the list -------------------------------------------------------- */

  const clearance = Math.max(STICKY_ACTION_CLEARANCE, barHeight + 12);

  const items = useMemo<QueueItem[]>(() => {
    if (!tasks.ready) return [];
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
      const kept = finished.filter((task) => !queuedRooms.has(task.id));
      if (kept.length > 0) {
        out.push({ kind: 'section', key: 'done', label: t('work.queue.sectionDone') });
        for (const task of kept) {
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

    if (out.length > 0) out.push({ kind: 'spacer', key: 'spacer', height: clearance });
    return out;
  }, [clearance, connection.online, finished, queuedRooms, t, tasks.ready, visible]);

  const sync = syncLine({
    online: connection.online,
    ready: tasks.ready,
    openCount: live.length,
    bufferCount: connection.buffer.length,
    readAt: tasks.readAt,
  });
  const buffer = bufferLabel({ online: connection.online, buffer: connection.buffer });
  const reason = queueEmptyReason(filter);

  const goToRooms = (
    <WorkButton
      variant="outline"
      leadingIcon="bed"
      label={t('state.emptyGoTo', { tab: t('nav.rooms') })}
      onPress={() => router.push('/rooms')}
    />
  );

  return (
    /* The surface's own accessibility (gaps.md §5.3).
       `a11y=0` on the home screen of a surface used one-handed, gloved and
       standing — which is the surface where a screen reader and a large target
       matter most, not least. The list announces its own length and how much of
       the shift is done, because "how many rooms have I got left" is the
       question this screen exists to answer and scrolling to count is not an
       answer for somebody holding a trolley. Until the read lands it says
       nothing, rather than "0 rooms": the skeleton is what says it is loading
       (WK-24). */
    <View
      accessibilityRole="summary"
      accessibilityLabel={
        tasks.ready
          ? t('work.queue.a11yList', {
              count: String(live.length),
              done: String(finished.length),
            })
          : undefined
      }
      accessibilityHint={
        tasks.ready
          ? t('work.queue.a11yProgress', {
              done: String(finished.length),
              total: String(live.length + finished.length),
            })
          : undefined
      }
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
              {sync ? (
                <WorkSyncLine online={connection.online}>{t(sync.key, sync.values)}</WorkSyncLine>
              ) : null}
            </WorkPageHead>

            {/* The Work bar for the simulated outage only. A real one already
                has the app-wide banner, and this under it was the second of
                two notices saying the same thing (WK-25). */}
            {connection.simulatedOnly ? (
              <WorkOfflineBar
                title={t('work.offline.bannerTitle')}
                detail={t(buffer.key, buffer.values)}
                actionLabel={t('work.offline.reconnect')}
                onAction={reconnect}
                busy={actions.busy}
              />
            ) : null}
            {!connection.online ? (
              // The note is about the LIST rather than about the connection: a
              // reader who has scrolled past the banner still has to be told
              // that what they are looking at may be behind the desk.
              <Text size="xs" color="textMuted" style={{ lineHeight: 18 }}>
                {t('state.offlineLastList')}
              </Text>
            ) : null}

            {arrival ? <ArrivalBanner task={arrival} onOpen={() => openTask(arrival)} /> : null}

            {WORK_PROFILE.supervisor && inspections.ready && inspections.rows.length > 0 ? (
              <InspectionCallout
                count={inspections.rows.length}
                onOpen={() => router.push('/inspection')}
              />
            ) : null}

            {tasks.ready ? (
              <WorkFilterTabs
                label={t('work.queue.listLabel')}
                value={String(filter)}
                onChange={(next) => setFilter(next === 'all' ? 'all' : Number(next))}
                items={floorTabs(rows).map((tab) => {
                  const label = t(tab.label.key, tab.label.values);
                  const spoken = tabCountPhrase(label, tab.count, 'rooms');
                  return {
                    value: tab.value,
                    label,
                    count: tab.count,
                    a11yLabel: t(spoken.key, spoken.values),
                  };
                })}
              />
            ) : null}

            {!connection.online ? <ReconnectCard buffer={connection.buffer} /> : null}
          </>
        }
        renderItem={({ item }) => {
          if (item.kind === 'spacer') return <View style={{ height: item.height }} />;
          if (item.kind === 'section') return <SectionLabel>{item.label}</SectionLabel>;
          if (item.kind === 'caughtUp') {
            return (
              <EmptyState
                icon="checkCircle"
                title={t('work.queue.emptyTitle')}
                body={t(reason.key, reason.values)}
                // Caught up is good news, and it is still a dead end without a
                // way on. Rooms is what an attendant looks at next.
                action={goToRooms}
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
              action={goToRooms}
            />
          )
        }
      />

      <WorkStickyAction
        icon="sparkles"
        label={!tasks.ready || pending ? t('work.queue.takeNext') : t('work.queue.nothingPending')}
        hint={tasks.ready && pending ? t('work.queue.takeNextHint') : undefined}
        muted={tasks.ready && !pending}
        disabled={!tasks.ready}
        onPress={takeNext}
        onHeight={setBarHeight}
        // A failed start is said where the thumb is, above the primary, rather
        // than at the head of a list the attendant may have scrolled away from.
        notice={
          failed ? (
            <WriteError
              title="work.writeFailedTitle"
              body="work.writeFailedBody"
              onRetry={retry}
              secondary={{ label: 'work.dismiss', onPress: dismiss }}
            />
          ) : undefined
        }
      />
    </View>
  );
}

/**
 * Frame W2's card, with the waiting changes printed under it in the order they
 * were made, so the reader can check them rather than take them on trust.
 *
 * **It used to promise a replay that does not exist**: changes replaying "with
 * their idempotency keys, so nothing double-posts", rooms turning green on the
 * front desk grid, and a conflict card no screen has (mobile audit 2026-10-05,
 * WK-29). It now says what is true: these are saved on this phone, and the
 * desk has not seen them.
 */
function ReconnectCard({ buffer }: { buffer: readonly BufferedChange[] }) {
  const t = useT();
  const { c, space } = useTheme();
  const ordered = replayOrder(buffer);

  return (
    <Card variant="flat" title={t('work.offline.cardTitle')}>
      <View style={{ gap: space[3] }}>
        <Text size="sm" color="textBody" style={{ lineHeight: 20 }}>
          {ordered.length > 0 ? t('work.offline.cardBody') : t('work.offline.cardBodyEmpty')}
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
