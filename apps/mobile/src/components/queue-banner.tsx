/**
 * QueueBanner — the visible half of the offline write queue.
 *
 * `data-seam.md` §5's second rule: *"A queued item is visible and cancellable.
 * A user must be able to see that something is waiting and abandon it. An
 * invisible queue that fires three hours later is worse than a refusal."*
 *
 * This is that sentence as a component. It sits under `OfflineBanner` in the
 * shell, and the pairing is deliberate: the offline banner says the app cannot
 * reach the network, and this says what the app is holding on the person's
 * behalf because of it. One without the other is half the picture — a banner
 * that only reports the radio leaves the person wondering whether the message
 * they just sent exists anywhere.
 *
 * It shows nothing when the queue is empty, which is most of the time. A banner
 * that is always there is a banner nobody reads.
 *
 * ## `queued` and `failed` are drawn differently on purpose
 *
 * `queued` is not a problem — it is the app working as designed, and it is
 * toned as information. `failed` is something the person has to decide about,
 * and it carries both actions: try now, or discard. Colouring them the same
 * would train someone to ignore the one that matters, which is the same lesson
 * ADR-028 records about a rule that fires on correct code.
 */
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';
import { Text } from './text';
import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { useReducedMotion, MOTION_MS, MOTION_MS_REDUCED } from '@/motion';
import { useWriteQueue } from '@/data/write-queue';

const TRAVEL = 10;

export function QueueBanner() {
  const { c, space, radius } = useTheme();
  const t = useT();
  const reduced = useReducedMotion();
  const { pending, failed, cancel, retry } = useWriteQueue();

  const shown = pending.length > 0;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(shown ? 1 : 0, {
      duration: reduced ? MOTION_MS_REDUCED : MOTION_MS,
    });
  }, [shown, reduced, progress]);

  // Under reduced motion the travel is dropped and the fade is kept — the
  // design brief §7.6 rule, the same one `OfflineBanner` follows.
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: reduced ? 0 : (1 - progress.value) * -TRAVEL }],
  }));

  if (!shown) return null;

  const broken = failed.length > 0;
  const count = pending.length;

  return (
    <Animated.View style={style}>
      <View
        accessibilityRole="alert"
        accessibilityLabel={t('queue.a11yPending', { count: String(count) })}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[3],
          marginHorizontal: space[4],
          padding: space[3],
          borderRadius: radius.md,
          backgroundColor: broken ? c.danger100 : c.neutral200,
        }}
      >
        <Icon
          name={broken ? 'alertTriangle' : 'clock'}
          size={18}
          color={broken ? c.danger600 : c.textMuted}
        />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text size="sm" weight="medium" color="textStrong">
            {count === 1 ? t('queue.waitingOne') : t('queue.waitingMany', { count: String(count) })}
          </Text>
          <Text size="xs" color="textMuted">
            {broken ? t('queue.sendFailed') : t('queue.willSend')}
          </Text>
        </View>

        {broken ? (
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            <QueueAction label={t('queue.retry')} onPress={() => void retry()} tone="textStrong" />
            <QueueAction
              label={t('queue.cancelOne')}
              onPress={() => failed.forEach((item) => cancel(item.id))}
              tone="textMuted"
            />
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

/** A 44px target, because a banner control is still a control. */
function QueueAction({
  label,
  onPress,
  tone,
}: {
  label: string;
  onPress: () => void;
  tone: 'textStrong' | 'textMuted';
}) {
  const { space } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={10}
      style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: space[2] }}
    >
      <Text size="sm" weight="semibold" color={tone}>
        {label}
      </Text>
    </PressableScale>
  );
}
