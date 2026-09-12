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
 * tick. The elapsed reading is what the finished task records as its minutes,
 * which is what frame W5's supervisor sees and frame W7's shift average uses.
 */
import { useCallback } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Badge,
  Button,
  Card,
  Elapsed,
  EmptyState,
  Icon,
  PressableScale,
  ProgressSteps,
  Screen,
  Text,
  useToast,
  WriteError,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { WorkBackRow, WorkEyebrow, WorkSection } from './work-chrome';
import { TASK_KIND_KEY } from './work-format';
import { WORK_PROFILE, type TaskStatus, type WorkTask } from './work-fixtures';
import { useConnection, useTimers, useWorkActions, useWorkTasks } from './work-store';

/** Where the rail sits for each state. `blocked` stalls rather than advances. */
const RAIL_STEP: Record<TaskStatus, string> = {
  pending: 'pending',
  in_progress: 'in_progress',
  blocked: 'in_progress',
  done: 'done',
  inspected: 'done',
};

export function TaskDetail({ taskId }: { taskId: string }) {
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const { c, space, radius } = useTheme();

  const tasks = useWorkTasks();
  const timers = useTimers();
  const connection = useConnection();
  const actions = useWorkActions();

  const task = tasks.rows.find((row) => row.id === taskId);

  const finish = useCallback(
    (row: WorkTask) => {
      void actions.finish(row).then(({ buffered }) => {
        // The board is the supervisor's view of this room. Reporting it clean
        // when the write did not land leaves them acting on a room that is not.
        if (actions.failed) return;
        toast.show(
          buffered
            ? t('work.offline.savedToast')
            : t('work.task.cleanToast', { room: row.id }),
          buffered ? 'warning' : 'success',
        );
        router.back();
      });
    },
    [actions, router, t, toast],
  );

  const start = useCallback(
    (row: WorkTask) => {
      void actions.start(row).then(() => {
        if (actions.failed) return;
        toast.show(t('work.task.startedToast', { room: row.id }), 'success');
      });
    },
    [actions, t, toast],
  );

  const requestCheck = useCallback(
    (row: WorkTask) => {
      void actions.requestCheck(row).then(() => {
        if (actions.failed) return;
        toast.show(t('work.task.checkToast', { name: WORK_PROFILE.signsOff }), 'warning');
        router.back();
      });
    },
    [actions, router, t, toast],
  );

  if (tasks.status === 'loading') {
    return (
      <Screen>
        <View style={{ gap: space[4] }}>
          <Text size="sm" color="textMuted">
            {t('state.loading')}
          </Text>
        </View>
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
            <Button variant="outline" onPress={() => router.back()}>
              {t('work.task.backToQueue')}
            </Button>
          }
        />
      </Screen>
    );
  }

  const timer = timers[task.id];
  const running = task.status === 'in_progress';
  const finished = task.status === 'done' || task.status === 'inspected';
  const kind = t(TASK_KIND_KEY[task.kind]);

  const primary =
    task.status === 'pending'
      ? { label: t('work.task.start'), inert: false, run: () => start(task) }
      : task.status === 'in_progress'
        ? { label: t('work.task.markDone'), inert: false, run: () => finish(task) }
        : task.status === 'blocked'
          ? { label: t('work.task.blocked'), inert: true, run: () => {} }
          : { label: t('work.task.doneWaiting'), inert: true, run: () => {} };

  const consequence =
    task.status === 'in_progress'
      ? t('work.task.consequenceDone', { room: task.id })
      : undefined;

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <WorkBackRow label={t('work.task.back')} onPress={() => router.back()} />

        {/* A status write that did not land. At the TOP of the screen: the
            attendant's next move is one of the buttons at the bottom, and a
            failure below them is a failure they never see. */}
        {actions.failed ? (
          <WriteError
            title="work.writeFailedTitle"
            body="work.writeFailedBody"
            onRetry={actions.clearFailure}
          />
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
            <Elapsed
              label={t('work.task.elapsed')}
              startedAt={timer?.startedAt ?? null}
              accrued={timer?.accrued ?? 0}
              tone={task.status === 'blocked' ? 'danger600' : 'textStrong'}
              // The pause is only offered on a running clean. Pausing a task
              // that has not started is a control with nothing behind it.
              onTogglePause={running || timer ? () => void actions.toggleTimer(task.id) : undefined}
            />
            <Text size="xs" color="textMuted">
              {timer
                ? t('work.task.startedAt', {
                    time: WORK_PROFILE.clock,
                    minutes: WORK_PROFILE.averageMinutes,
                  })
                : t('work.task.notStarted', { minutes: WORK_PROFILE.averageMinutes })}
            </Text>
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

        {/* Clearance for the pinned footer below. */}
        <View style={{ height: 156 }} />
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
        onRequestCheck={finished || task.status === 'blocked' ? undefined : () => requestCheck(task)}
        offline={!connection.online}
      />
    </View>
  );
}

/**
 * The pinned actions. One primary, its consequence printed underneath, and the
 * two escapes as text buttons — frame W3's exact stack.
 *
 * The inert states are drawn as inert rather than hidden: an attendant looking
 * at a blocked room should see WHY the button they expected cannot be pressed,
 * and a disappearing primary reads as a bug.
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
}: {
  label: string;
  inert: boolean;
  consequence?: string;
  busy: boolean;
  offline: boolean;
  onPrimary: () => void;
  onReportFault: () => void;
  onRequestCheck?: () => void;
}) {
  const { c, space, radius } = useTheme();
  const t = useT();

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        gap: space[2],
        paddingHorizontal: space[4],
        paddingTop: 12,
        paddingBottom: 22,
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
          minHeight: 56,
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
          {offline ? t('work.offline.savedToast') : consequence}
        </Text>
      ) : null}

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space[2] }}>
        <Button variant="ghost" size="md" leadingIcon="wrench" onPress={onReportFault}>
          {t('work.task.reportFault')}
        </Button>
        {onRequestCheck ? (
          <Button variant="ghost" size="md" leadingIcon="checkCircle" onPress={onRequestCheck}>
            {t('work.task.requestCheck')}
          </Button>
        ) : null}
      </View>
    </View>
  );
}
