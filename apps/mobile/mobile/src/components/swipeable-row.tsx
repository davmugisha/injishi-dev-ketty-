/**
 * SwipeableRow — a row with a left and a right action behind it.
 *
 * Motivated by frame W1, which draws room 104 mid-swipe with a green "Start"
 * revealed on the left, and notes the two directions plainly: **swipe right =
 * start, swipe left = block.** Used one-handed, gloved, standing in a corridor,
 * which is why the action is a swipe rather than a menu behind a chevron.
 *
 * Built on Gesture Handler's `ReanimatedSwipeable`, so the drag runs on the UI
 * thread and keeps up with the finger while the JS thread is busy — the exact
 * condition a queue screen is under when the live-arrival timer fires.
 *
 * **A swipe is never the only way to do the thing.** It is invisible, it is
 * undiscoverable, and it is unavailable to anyone driving the screen with a
 * screen reader or a switch. So the row also carries its actions as
 * accessibility actions, which is what puts them in VoiceOver's rotor and
 * TalkBack's menu, and the caller is expected to keep the same actions
 * reachable from the detail screen the row opens.
 *
 * The haptic fires when the action COMMITS, not when the panel opens: a buzz on
 * every drag is a buzz nobody reads as meaning anything.
 */
import { type ReactNode } from 'react';
import { Platform, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRef } from 'react';
import { Text } from './text';
import { Icon, type IconName } from './icon';
import { useTheme } from '@/theme/theme';
import type { Palette } from '@/theme/tokens';
import { useT } from '@/i18n/i18n';

export interface SwipeAction {
  label: string;
  icon: IconName;
  /** The panel fill. A palette key, like everything else. */
  tone: keyof Palette;
  onPress: () => void;
}

export interface SwipeableRowProps {
  /** Revealed by swiping RIGHT. Frame W1's "Start". */
  left?: SwipeAction;
  /** Revealed by swiping LEFT. Frame W1's "Block". */
  right?: SwipeAction;
  children: ReactNode;
}

/** The width the panel opens to. One action, one comfortable target. */
const PANEL = 88;

function ActionPanel({
  action,
  side,
  progress,
  onFire,
}: {
  action: SwipeAction;
  side: 'left' | 'right';
  progress: SharedValue<number>;
  onFire: () => void;
}) {
  const { c, radius } = useTheme();

  // The glyph slides in with the panel rather than sitting at full offset from
  // the first pixel, so a half-open swipe looks half-open.
  const animated = useAnimatedStyle(() => ({
    opacity: Math.min(1, progress.get()),
    transform: [
      { translateX: (1 - Math.min(1, progress.get())) * (side === 'left' ? -20 : 20) },
    ],
  }));

  return (
    <View
      style={{
        width: PANEL,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: c[action.tone],
        borderRadius: radius.lg,
        marginVertical: 2,
      }}
    >
      <Animated.View style={[{ alignItems: 'center', gap: 4 }, animated]}>
        <Icon name={action.icon} size={20} color={c.surface1} />
        <Text weight="semibold" size="xs" color={c.surface1}>
          {action.label}
        </Text>
      </Animated.View>
    </View>
  );
}

export function SwipeableRow({ left, right, children }: SwipeableRowProps) {
  const t = useT();
  const ref = useRef<SwipeableMethods>(null);

  const fire = (action: SwipeAction) => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    ref.current?.close();
    action.onPress();
  };

  const actions = [
    ...(left ? [{ name: left.label, label: left.label, run: () => fire(left) }] : []),
    ...(right ? [{ name: right.label, label: right.label, run: () => fire(right) }] : []),
  ];

  return (
    <View
      // A swipe reaches no screen reader and no switch control. These put the
      // same two actions in the rotor, which is what makes the row operable
      // without the gesture at all.
      accessibilityActions={actions.map((a) => ({ name: a.name, label: a.label }))}
      onAccessibilityAction={(event) => {
        actions.find((a) => a.name === event.nativeEvent.actionName)?.run();
      }}
      accessibilityHint={
        left && right
          ? t('a11y.swipeRow', { right: left.label, left: right.label })
          : undefined
      }
    >
      <ReanimatedSwipeable
        ref={ref}
        friction={2}
        // Enough travel that a brush against the row does not open it, and
        // little enough that a deliberate flick does.
        leftThreshold={PANEL * 0.6}
        rightThreshold={PANEL * 0.6}
        overshootLeft={false}
        overshootRight={false}
        renderLeftActions={
          left
            ? (progress) => (
                <ActionPanel action={left} side="left" progress={progress} onFire={() => fire(left)} />
              )
            : undefined
        }
        renderRightActions={
          right
            ? (progress) => (
                <ActionPanel action={right} side="right" progress={progress} onFire={() => fire(right)} />
              )
            : undefined
        }
        onSwipeableOpen={(direction) => {
          if (direction === 'left' && left) fire(left);
          if (direction === 'right' && right) fire(right);
        }}
      >
        {children}
      </ReanimatedSwipeable>
    </View>
  );
}
