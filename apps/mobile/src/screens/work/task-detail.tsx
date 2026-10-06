/**
 * Task detail — frame W3. One room, one primary action, two escapes.
 *
 * **The room number is the hero**, at 64pt, because the screen is opened while
 * standing at a door and the first job is confirming you are at the right one.
 * Everything under it answers the second question — what am I doing, how long
 * have I been, what did the desk say, what happens when I press the button.
 *
 * The primary is one control whose LABEL is the state, which is frame W3's own
 * table:
 *
 *   pending      Start cleaning
 *   in progress  Mark done
 *   blocked      Blocked — waiting on Maintenance   (inert, with the reason)
 *   done         Done — waiting on sign-off         (inert)
 *
 * Both escapes are text buttons under it rather than a second filled button,
 * because the canvas rule is one primary per state and escapes stay secondary.
 *
 * **The timer is anchored to a timestamp**, not to a counter, so an attendant
 * who locks their phone mid-clean comes back to the right reading — the kit's
 * `Elapsed` owns that, and pausing banks the seconds rather than stopping a
 * tick. The elapsed reading is what the finished task records as its minutes.
 *
 * **Every write here waits for its outcome** (mobile audit 2026-10-05, WK-04).
 * Each used to read `actions.failed` after the `await`, a value from the render
 * that pressed the button, so a failed "Mark done" toasted that the room was
 * clean and closed the screen on top of its own error. And Try again only
 * cleared the error (WK-05): the attendant had to find the button again. It
 * now runs the change that failed.
 */
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Badge,
  Card,
  Elapsed,
  EmptyState,
  ErrorState,
  Icon,
  PressableScale,
  ProgressSteps,
  Screen,
  SkeletonList,
  Text,
  usePinnedFooter,
  useToast,
  WriteError,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import type { MutationOutcome } from '@/data/use-fixture-mutation';
import { WORK_TARGET, WorkBackRow, WorkButton, WorkEyebrow, WorkSection } from './work-chrome';
import { TASK_KIND_KEY, clockOf } from './work-format';
import type { TaskStatus, WorkTask } from './work-fixtures';
import { useConnection, useTimers, useWorkActions, useWorkTasks } from './work-store';

/** Where the rail sits for each state. `blocked` stalls rather than advances. */
const RAIL_STEP: Record<TaskStatus, string> = {
  pending: 'pending',
  in_progress: 'in_progress',
  blocked: 'in_progress',
  done: 'done',
  inspected: 'done',
};

/** The four writes this screen makes, so Try again can make the same one. */
type Attempt = 'start' | 'finish' | 'check' | 'pause';

export function TaskDetail({ taskId }: { taskId: string }) {
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const { c, space, radius } = useTheme();

  const tasks = useWorkTasks();
  const timers = useTimers();
  const connection = useConnection();
  const actions = useWorkActions();

  /** The write that did not land. Drawn as the error, and what Try again runs. */
  const [failed, setFailed] = useState<Attempt | null>(null);
  /** The pinned footer's height, so the notes can scroll clear of it. */
  const [footerHeight, setFooterHeight] = useState(0);

  const task = tasks.rows.find((row) => row.id === taskId);

  /** True when the write landed; keeps the attempt for Try again when it failed. */
  const landed = useCallback((attempt: Attempt, outcome: MutationOutcome) => {
    if (outcome === 'error') setFailed(attempt);
    return outcome === 'done';
  }, []);

  const run = useCallback(
    (attempt: Attempt, row: WorkTask) => {
      setFailed(null);
      switch (attempt) {
        case 'start':
          void actions.start(row).then((outcome) => {
            if (!landed('start', outcome)) return;
            toast.show(t('work.task.startedToast', { room: row.id }), 'success');
          });
          return;
        case 'finish':
          void actions.finish(row).then(({ outcome, buffered }) => {
            // The board is the supervisor's view of this room. Reporting it
            // clean when the write did not land leaves them acting on a room
            // that is not.
            if (!landed('finish', outcome)) return;
            toast.show(
              buffered
                ? t('work.offline.savedToast')
                : t('work.task.cleanToast', { room: row.id }),
              buffered ? 'warning' : 'success',
            );
            router.back();
          });
          return;
        case 'check':
          void actions.requestCheck(row).then((outcome) => {
            if (!landed('check', outcome)) return;
            toast.show(t('work.task.checkToast', { room: row.id }), 'warning');
            router.back();
          });
          return;
        case 'pause':
          void actions.toggleTimer(row.id).then((outcome) => {
            landed('pause', outcome);
          });
          return;
      }
    },
    [actions, landed, router, t, toast],
  );

  const retry = () => {
    if (!failed || !task) return;
    actions.clearFailure();
    run(failed, task);
  };

  /* ---- the read ------------------------------------------------------- */

  // A read that has not landed, and one that failed, are both said as what they
  // are (WK-06). A failed read used to fall through to "This task is not on
  // your queue", which is a claim about the task the screen never loaded.
  if (tasks.status === 'loading') {
    return (
      <Screen>
        <WorkBackRow label={t('work.task.back')} onPress={() => router.back()} />
        <SkeletonList
          rows={2}
          label={t('state.loadingList', { label: t('work.task.listLabel') })}
        />
      </Screen>
    );
  }

  if (tasks.status === 'error') {
    return (
      <Screen>
        <WorkBackRow label={t('work.task.back')} onPress={() => router.back()} />
        <ErrorState
          title={t('state.errorTitle')}
          body={t('state.errorBody', { label: t('work.task.listLabel') })}
          detail={tasks.error?.message}
          onRetry={tasks.retry}
        />
      </Screen>
    );
  }

  if (!task) {
    return (
      <Screen>
        <WorkBackRow label={t('work.task.back')} onPress={() => router.back()} />
        <EmptyState
          icon="search"
          title={t('work.task.notFoundTitle')}
          body={t('work.task.notFoundBody')}
          action={
            <WorkButton
              variant="outline"
              label={t('work.task.backToQueue')}
              onPress={() => router.back()}
            />
          }
        />
      </Screen>
    );
  }

  const timer = timers[task.id];
  const running = task.status === 'in_progress';
  const finished = task.status === 'done' || task.status === 'inspected';
  const kind = t(TASK_KIND_KEY[task.kind]);
  const paused = !timer || timer.startedAt === null;

  const primary =
    task.status === 'pending'
      ? { label: t('work.task.start'), inert: false, run: () => run('start', task) }
      : task.status === 'in_progress'
        ? { label: t('work.task.markDone'), inert: false, run: () => run('finish', task) }
        : task.status === 'blocked'
          ? { label: t('work.task.blocked'), inert: true, run: () => {} }
          : { label: t('work.task.doneWaiting'), inert: true, run: () => {} };

  const consequence =
    task.status === 'in_progress'
      ? t('work.task.consequenceDone', { room: task.id })
      : undefined;

  // The task's OWN start time, or nothing. This used to read "Started 10:24 ·
  // your average is 22 min" on every task: a fixture clock and a fixture
  // average (mobile audit 2026-10-05, WK-13).
  const started =
    timer?.since !== undefined
      ? t('work.task.startedAt', { time: clockOf(timer.since) })
      : task.status === 'pending'
        ? t('work.task.notStarted')
        : undefined;

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <WorkBackRow label={t('work.task.back')} onPress={() => router.back()} />

        {/* A status write that did not land. At the TOP of the screen: the
            attendant's next move is one of the buttons at the bottom, and a
            failure below them is a failure they never see. */}
        {failed ? (
          <WriteError title="work.writeFailedTitle" body="work.writeFailedBody" onRetry={retry} />
        ) : null}

        <View style={{ gap: space[2] }}>
          <WorkEyebrow suffix={`${t('work.task.eyebrow', { floor: task.floor, type: task.type })}`} />
          <Text
            accessibilityRole="header"
            accessibilityLabel={t('work.queue.openTask', {
              room: task.id,
              type: task.type,
              task: kind,
            })}
            family="mono"
            weight="semibold"
            // The task ID is this screen's subject, read at arm's length by
            // someone gloved and standing. 64 is above the scale's top step
            // (3xl, 36) and snapping it would shrink the one thing the screen
            // exists to show by 28px, so it takes the derived-size escape and
            // carries its own leading.
            sizePx={64}
            lineHeightPx={70}
            color="textStrong"
            style={{ letterSpacing: -2 }}
          >
            {task.id}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
          <Badge tone="neutral">{kind}</Badge>
          {task.priority === 'high' ? (
            <Badge tone="warning" dot>
              {t('work.queue.metaHighPriority')}
            </Badge>
          ) : null}
          {task.arrival ? (
            <Badge tone="brand">{t('work.queue.metaGuest', { time: task.arrival })}</Badge>
          ) : null}
          {task.at ? (
            <Badge tone="neutral">{t('work.queue.metaPending', { time: task.at })}</Badge>
          ) : null}
        </View>

        <ProgressSteps
          blocked={task.status === 'blocked'}
          current={RAIL_STEP[task.status]}
          steps={[
            { key: 'pending', label: t('work.task.stepPending') },
            { key: 'in_progress', label: t('work.task.stepProgress') },
            { key: 'done', label: t('work.task.stepDone') },
          ]}
        />

        <Card>
          <View style={{ gap: space[2] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
              <View style={{ flex: 1 }}>
                <Elapsed
                  label={t('work.task.elapsed')}
                  startedAt={timer?.startedAt ?? null}
                  accrued={timer?.accrued ?? 0}
                  tone={task.status === 'blocked' ? 'danger600' : 'textStrong'}
                />
              </View>
              {/* The pause is only offered on a running clean. Pausing a task
                  that has not started is a control with nothing behind it. It
                  is drawn here rather than by `Elapsed`, whose own control is
                  the kit's 44pt and not this surface's 56 (WK-15). */}
              {running || timer ? (
                <TimerToggle
                  paused={paused}
                  label={paused ? t('a11y.resumeTimer') : t('a11y.pauseTimer')}
                  onPress={() => run('pause', task)}
                />
              ) : null}
            </View>
            {started ? (
              <Text size="xs" color="textMuted">
                {started}
              </Text>
            ) : null}
          </View>
        </Card>

        {task.status === 'blocked' ? (
          <View
            accessible
            accessibilityRole="summary"
            accessibilityLabel={`${t('work.task.blockedTitle')}. ${t('work.task.blockedBody', { ref: task.blockedBy ?? '—' })}`}
            style={{
              gap: space[2],
              padding: space[4],
              borderRadius: radius.lg,
              backgroundColor: c.danger100,
              borderWidth: 1,
              borderColor: c.danger500,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <Icon name="alertTriangle" size={17} color={c.danger600} />
              <Text weight="semibold" size="sm" color="textStrong">
                {t('work.task.blockedTitle')}
              </Text>
            </View>
            <Text size="sm" color="textBody" style={{ lineHeight: 20 }}>
              {t('work.task.blockedBody', { ref: task.blockedBy ?? '—' })}
            </Text>
          </View>
        ) : null}

        <WorkSection label={t('work.task.notesTitle')}>
          <Card variant="flat">
            {task.note ? (
              <View style={{ gap: space[2] }}>
                <Text size="sm" color="textBody" style={{ lineHeight: 21 }}>
                  {task.note}
                </Text>
                {task.noteBy ? (
                  <Text size="xs" color="textSubtle">
                    {task.noteBy}
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text size="sm" color="textMuted">
                {t('work.task.noNotes')}
              </Text>
            )}
          </Card>
        </WorkSection>

        {/* Clearance for the pinned footer below, measured: the footer grows
            when its labels wrap, and a fixed spacer let the notes slip under it. */}
        <View style={{ height: Math.max(156, footerHeight) }} />
      </Screen>

      <TaskFooter
        label={primary.label}
        inert={primary.inert}
        consequence={consequence}
        busy={actions.busy}
        onPrimary={primary.run}
        onReportFault={() =>
          router.push({ pathname: '/report-fault', params: { room: task.id } })
        }
        onRequestCheck={finished || task.status === 'blocked' ? undefined : () => run('check', task)}
        offline={!connection.online}
        onHeight={setFooterHeight}
      />
    </View>
  );
}

/** Frame W3's pause, at Work's floor rather than the kit's 44. */
function TimerToggle({
  paused,
  label,
  onPress,
}: {
  paused: boolean;
  label: string;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <PressableScale
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        width: WORK_TARGET,
        height: WORK_TARGET,
        borderRadius: WORK_TARGET / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.surface2,
        borderWidth: 1,
        borderColor: c.borderSubtle,
      }}
    >
      <Icon name={paused ? 'play' : 'pause'} size={20} color={c.textBody} />
    </PressableScale>
  );
}

/**
 * The pinned actions. One primary, its consequence printed underneath, and the
 * two escapes as text buttons — frame W3's exact stack.
 *
 * The inert states are drawn as inert rather than hidden: an attendant looking
 * at a blocked room should see WHY the button they expected cannot be pressed,
 * and a disappearing primary reads as a bug.
 *
 * It declares its height (`usePinnedFooter`), so the toasts this screen fires
 * rise above it rather than landing on "Mark done" (the same fault as the
 * Queue's, mobile audit 2026-10-05 WK-14), and it pads for the home indicator,
 * which it used to sit inside.
 */
function TaskFooter({
  label,
  inert,
  consequence,
  busy,
  offline,
  onPrimary,
  onReportFault,
  onRequestCheck,
  onHeight,
}: {
  label: string;
  inert: boolean;
  consequence?: string;
  busy: boolean;
  offline: boolean;
  onPrimary: () => void;
  onReportFault: () => void;
  onRequestCheck?: () => void;
  onHeight: (height: number) => void;
}) {
  const { c, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const [height, setHeight] = useState(0);
  usePinnedFooter(height);

  return (
    <View
      onLayout={(e) => {
        const measured = Math.ceil(e.nativeEvent.layout.height);
        setHeight(measured);
        onHeight(measured);
      }}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        gap: space[2],
        paddingHorizontal: space[4],
        paddingTop: 12,
        paddingBottom: insets.bottom + 14,
        backgroundColor: c.surface1,
        borderTopWidth: 1,
        borderTopColor: c.borderSubtle,
      }}
    >
      <PressableScale
        accessibilityLabel={label}
        accessibilityState={{ disabled: inert || busy }}
        haptic
        disabled={inert || busy}
        onPress={onPrimary}
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: WORK_TARGET,
          paddingHorizontal: space[4],
          paddingVertical: 12,
          borderRadius: radius.md,
          backgroundColor: inert ? c.surface3 : c.action,
        }}
      >
        <Text weight="semibold" size="md" center color={inert ? 'textMuted' : c.bgApp}>
          {label}
        </Text>
      </PressableScale>

      {consequence ? (
        <Text size="xs" color="textMuted" center style={{ lineHeight: 18 }}>
          {/* Said before the press, so in the future tense: the toast's
              "Saved on this phone" here read as if it had already happened. */}
          {offline ? t('work.task.consequenceOffline') : consequence}
        </Text>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: space[2],
        }}
      >
        <WorkButton
          variant="ghost"
          leadingIcon="wrench"
          label={t('work.task.reportFault')}
          onPress={onReportFault}
        />
        {onRequestCheck ? (
          <WorkButton
            variant="ghost"
            leadingIcon="checkCircle"
            label={t('work.task.requestCheck')}
            onPress={onRequestCheck}
          />
        ) : null}
      </View>
    </View>
  );
}
