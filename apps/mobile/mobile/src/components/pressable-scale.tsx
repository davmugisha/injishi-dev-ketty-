/**
 * PressableScale — the press feedback every tappable surface in the prototype
 * shares. Motivated by every frame: the canvas states "one primary action per
 * state" and a primary action that does not answer the finger reads as dead.
 *
 * Three rules, and each is a refusal:
 *
 *   - **Feedback on press-IN, commit on press-OUT.** Waiting for the tap to
 *     complete before showing anything is the latency a user actually feels.
 *   - **Reduced motion drops the travel, never the feedback** (design brief
 *     §7.6). Under reduced motion the scale is held at 1 and the opacity dip
 *     does the whole job, so the press still registers.
 *   - **The haptic is never the only feedback.** Haptics are off system-wide
 *     for many people and silent on most Android hardware, so it rides ON TOP
 *     of a visual that stands alone. It fires once, on release, on the primary
 *     action only — a haptic per tap across a whole screen is what makes people
 *     turn them off.
 *
 * Scale and opacity only. Both are compositor properties, so a press costs no
 * layout and no paint; that is what keeps a list of these smooth on a
 * three-year-old Android.
 */
import { type ReactNode } from 'react';
import { Platform, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useReducedMotion } from '@/motion';

/** 100-150ms is the press-feedback band; 120 sits in the middle of it. */
const PRESS_MS = 120;
const PRESSED_SCALE = 0.98;
const PRESSED_OPACITY = 0.9;

export interface PressableScaleProps {
  onPress?: () => void;
  onLongPress?: () => void;
  /** Fire a light impact on release. Reserve it for the primary action. */
  haptic?: boolean;
  disabled?: boolean;
  /**
   * `switch` was added by Session 11's audit. `work-connection.tsx` built a
   * glove-sized toggle here and had to report `checkbox` because that was the
   * widest role this union offered — its own header flagged it. Both announce
   * an on/off state, but a reader who hears "switch" knows the gesture, and a
   * component should not have to lie about what it is to use the kit.
   */
  accessibilityRole?:
    | 'button'
    | 'link'
    | 'radio'
    | 'checkbox'
    | 'switch'
    | 'tab'
    | 'imagebutton';
  accessibilityLabel: string;
  accessibilityHint?: string;
  accessibilityState?: { selected?: boolean; disabled?: boolean; checked?: boolean };
  style?: StyleProp<ViewStyle>;
  /** Extends the touch area without growing the drawn control (44pt floor). */
  hitSlop?: number;
  testID?: string;
  children: ReactNode;
}

/**
 * Haptics has no web implementation and rejects rather than no-oping in some
 * environments. A missing buzz must never surface as an unhandled rejection.
 */
function tap(): void {
  if (Platform.OS === 'web') return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function PressableScale({
  onPress,
  onLongPress,
  haptic = false,
  disabled = false,
  accessibilityRole = 'button',
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  style,
  hitSlop,
  testID,
  children,
}: PressableScaleProps) {
  const reduced = useReducedMotion();
  const pressed = useSharedValue(0);

  const animated = useAnimatedStyle(() => ({
    // Reduced motion keeps the opacity dip and drops the travel entirely.
    transform: [{ scale: reduced ? 1 : 1 - pressed.get() * (1 - PRESSED_SCALE) }],
    opacity: 1 - pressed.get() * (1 - PRESSED_OPACITY),
  }));

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, ...accessibilityState }}
      disabled={disabled}
      hitSlop={hitSlop}
      // A finger drifting a few pixels should not cancel a press the user meant.
      pressRetentionOffset={12}
      testID={testID}
      onPressIn={() => pressed.set(withTiming(1, { duration: PRESS_MS }))}
      onPressOut={() => pressed.set(withTiming(0, { duration: PRESS_MS }))}
      onPress={() => {
        if (haptic) tap();
        onPress?.();
      }}
      onLongPress={onLongPress}
    >
      <Animated.View style={[{ opacity: disabled ? 0.45 : 1 }, animated, style]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
