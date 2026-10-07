/**
 * One row of the queue, and the live-arrival banner above it — frame W1.
 *
 * **The room number is the row's headline**, at 28pt, because that is the one
 * thing a person walking a corridor is matching against a door. Everything else
 * — the type, the task, the state, the clock the room is racing — is support,
 * and it is all on the row rather than behind a tap: an attendant should never
 * have to open a task to know whether it is the urgent one.
 *
 * The swipe is frame W1's ("swipe right = start, swipe left = block") and it is
 * never the only way to do either. `SwipeableRow` puts both in the screen
 * reader's rotor, and the detail screen the row opens carries the same two
 * actions as buttons.
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Card, Icon, PressableScale, StatusBadge, SwipeableRow, Text } from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { useReducedMotion } from '@/motion';
import { TASK_KIND_KEY, arrivalAge, taskMeta } from './work-format';
import { WORK_TARGET } from './work-chrome';
import type { WorkTask } from './work-fixtures';

export function QueueRow({
  task,
  onOpen,
  onStart,
  onBlock,
  /** Frame W2: a finished row reads "Done · Queued" until the buffer flushes. */
  queued = false,
}: {
  task: WorkTask;
  onOpen: () => void;
  onStart?: () => void;
  onBlock?: () => void;
  queued?: boolean;
}) {
  const { c, space, radius } = useTheme();
  const t = useT();

  const kind = t(TASK_KIND_KEY[task.kind]);
  const meta = taskMeta(task);
  const finished = task.status === 'done' || task.status === 'inspected';

  const body = (
    <PressableScale
      accessibilityLabel={t('work.queue.openTask', { room: task.id, type: task.type, task: kind })}
      accessibilityHint={
        onStart || onBlock ? t('a11y.swipeRow', {
          right: t('work.queue.swipeStart'),
          left: t('work.queue.swipeBlock'),
        }) : undefined
      }
      onPress={onOpen}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[4],
        // 88 at rest; frame W8 lets a Kinyarwanda row grow past 100 rather
        // than clip, which is why nothing here carries `numberOfLines`.
        minHeight: 88,
        paddingHorizontal: space[4],
        paddingVertical: space[3],
        borderRadius: radius.lg,
        backgroundColor: c.surface1,
        borderWidth: task.isNew ? 1.5 : 1,
        borderColor: task.isNew ? c.borderBrand : c.borderSubtle,
        opacity: finished ? 0.75 : 1,
      }}
    >
      <Text family="mono" weight="semibold" size="2xl" color="textStrong" style={{ minWidth: 58 }}>
        {task.id}
      </Text>

      <View style={{ flex: 1, gap: 4 }}>
        <Text weight="semibold" size="md" color="textStrong">
          {kind}
        </Text>
        <Text size="sm" color="textMuted">
          {task.type}
        </Text>
        {meta ? (
          <Text
            size="xs"
            color={task.status === 'blocked' ? 'danger600' : 'textSubtle'}
            weight={task.priority === 'high' ? 'semibold' : 'regular'}
          >
            {t(meta.key, meta.values)}
          </Text>
        ) : null}
      </View>

      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        {finished ? (
          <Text weight="semibold" size="xs" color={queued ? 'warning600' : 'success600'}>
            {t(queued ? 'work.queue.doneQueued' : 'work.queue.doneSynced')}
          </Text>
        ) : (
          <StatusBadge domain="task" state={task.status} />
        )}
        {!finished ? <Icon name="chevronRight" size={18} color={c.textSubtle} /> : null}
      </View>
    </PressableScale>
  );

  // A finished row has nothing left to swipe: offering Start on a done room is
  // the orphaned control the quality bar rules out.
  if (!onStart && !onBlock) return body;

  return (
    <SwipeableRow
      left={
        onStart
          ? { label: t('work.queue.swipeStart'), icon: 'play', tone: 'success500', onPress: onStart }
          : undefined
      }
      right={
        onBlock
          ? { label: t('work.queue.swipeBlock'), icon: 'alertTriangle', tone: 'danger500', onPress: onBlock }
          : undefined
      }
    >
      {body}
    </SwipeableRow>
  );
}

/**
 * Frame W1's live arrival: "Room 208 just checked out — Added to your queue 4s
 * ago", drawn with an accent border.
 *
 * **It is drawn as an arrival, not as a refresh**, which is the frame's own
 * note and F-P04's success criterion made visible: the desk tapped Check out
 * and the task was here inside a second. The age ticks so that the claim is
 * checkable rather than decorative — a banner frozen at "4s ago" would be a
 * screenshot, and this is the one place on the surface that has to feel live.
 *
 * It draws only a task that genuinely arrived (`isNew`, which Host's checkout
 * sets). The queue used to manufacture one, room 208 on a 6.5 second timer
 * after every launch (mobile audit 2026-10-05, WK-02).
 *
 * The tick is a 1s interval on a mounted banner and stops the moment it
 * unmounts. It is not an animation and never touches a frame budget.
 */
export function ArrivalBanner({
  task,
  onOpen,
}: {
  task: WorkTask;
  onOpen: () => void;
}) {
  const { c, space, radius } = useTheme();
  const t = useT();
  const reduced = useReducedMotion();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const age = arrivalAge(task.arrivedAt ?? now, now);

  return (
    <Animated.View
      // The purpose is "preventing a jarring change": a row that simply exists
      // where nothing was reads as a glitch. Reduced motion drops the travel
      // and the row is simply there, which is correct rather than degraded.
      entering={reduced ? undefined : FadeInDown.duration(320)}
    >
      <PressableScale
        accessibilityLabel={`${t('work.queue.arrivalTitle', { room: task.id })}. ${t(age.key, age.values)}`}
        accessibilityHint={t('work.queue.arrivalOpen', { room: task.id })}
        haptic
        onPress={onOpen}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[3],
          minHeight: 64,
          padding: space[3],
          borderRadius: radius.lg,
          backgroundColor: c.surface1,
          borderWidth: 1.5,
          borderColor: c.borderBrand,
        }}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: c.bgTint,
          }}
        >
          <Icon name="sparkles" size={19} color={c.textLink} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text weight="semibold" size="sm" color="textStrong">
            {t('work.queue.arrivalTitle', { room: task.id })}
          </Text>
          <Text
            // Polite, so the seconds do not interrupt a reader every second.
            accessibilityLiveRegion="polite"
            size="xs"
            color="textMuted"
          >
            {t(age.key, age.values)}
          </Text>
        </View>
        <Icon name="chevronRight" size={18} color={c.textSubtle} />
      </PressableScale>
    </Animated.View>
  );
}

/**
 * The supervisor's way in to frame W5, on the Queue where the rooms are.
 *
 * It renders only when the seat holds the supervisor flag, which is what the
 * session prompt asks for: an attendant without it never sees a control they
 * cannot use.
 */
export function InspectionCallout({
  count,
  onOpen,
}: {
  count: number;
  onOpen: () => void;
}) {
  const { c, space } = useTheme();
  const t = useT();
  const title = count === 1
    ? t('work.queue.inspectionOne')
    : t('work.queue.inspectionTitle', { count });

  return (
    <Card variant="tint">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <Icon name="checkCircle" size={20} color={c.textLink} />
        <Text weight="medium" size="sm" color="textStrong" style={{ flex: 1 }}>
          {title}
        </Text>
        <PressableScale
          accessibilityLabel={`${t('work.queue.inspectionOpen')}. ${title}`}
          onPress={onOpen}
          style={{
            // Work's floor, not the app's (mobile audit 2026-10-05, WK-15).
            minHeight: WORK_TARGET,
            justifyContent: 'center',
            paddingHorizontal: 18,
            borderRadius: 10,
            backgroundColor: c.surface1,
            borderWidth: 1,
            borderColor: c.borderDefault,
          }}
        >
          <Text weight="semibold" size="sm" color="textStrong">
            {t('work.queue.inspectionOpen')}
          </Text>
        </PressableScale>
      </View>
    </Card>
  );
}
