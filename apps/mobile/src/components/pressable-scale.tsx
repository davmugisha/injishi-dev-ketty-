/**
 * PressableScale — the press feedback every tappable surface in the kit shares.
 * Motivated by every frame: the canvas states "one primary action per state"
 * and a primary action that does not answer the finger reads as dead.
 *
 * Three rules, and each is a refusal:
 *
 *   - **Feedback on press-IN, commit on press-OUT.** Waiting for the tap to
 *     complete before showing anything is the latency a user actually feels.
 *   - **Reduced motion drops the travel, never the feedback** (design brief
 *     §7.6). Under reduced motion the scale is held at 1 and the highlight does
 *     the whole job, so the press still registers.
 *   - **The haptic is never the only feedback.** Haptics are off system-wide
 *     for many people and silent on most Android hardware, so it rides ON TOP
 *     of a visual that stands alone. It fires once, on release, on the primary
 *     action only — a haptic per tap across a whole screen is what makes people
 *     turn them off.
 *
 * ## HeroUI's press, measured rather than guessed (ADR-064 AC-5)
 *
 * The feedback used to be a fixed 0.98 scale and an opacity dip to 0.9. Both
 * are gone, for HeroUI Native's two pieces:
 *
 *   - **The scale depends on the control's width**: `pressScale(w)`, so a wide
 *     card and a narrow chip both move by about the same few pixels. A fixed
 *     factor shrinks a card by 7pt and a chip by under one, which is why one
 *     felt heavy and the other dead. The width lives in a shared value, so a
 *     layout never costs a render.
 *   - **The tone change is an overlay in the control's own CONTENT colour**,
 *     not a fade of the whole control. HeroUI's pressed fill is its fill mixed
 *     10% toward its label colour; drawing the label colour over the fill at
 *     .10 is the same maths, and it darkens in light and lightens in dark with
 *     no scheme check. An opacity dip did the opposite of that on a dark fill.
 *
 * Scale and opacity only. Both are compositor properties, so a press costs no
 * layout and no paint; that is what keeps a list of these smooth on a
 * three-year-old Android.
 */
import { type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { easingCurves, motionMs } from '@injishi/design-tokens';
import { useReducedMotion } from '@/motion';
import { useTheme } from '@/theme/theme';
import { kitMetrics, type Palette } from '@/theme/tokens';

const { press } = kitMetrics;
const SCALE_FLOOR = press.scaleFloor;
const SHRINK_PX = press.shrinkPx;

/** Arriving and leaving on the same curve, the one HeroUI's press eases on. */
const SETTLE = Easing.bezier(...easingCurves.settle);

/**
 * How far a control of width `w` shrinks under the finger: `max(0.97, 1 - 4.5 / w)`.
 *
 * HeroUI's own expression is `1 - 0.015 × 300 / w`, which is the same thing
 * written around its 300pt reference width. The floor is ours: below 150pt it
 * would shrink a small control by more than HeroUI's widest step, and a chip
 * that visibly jumps reads as a glitch rather than a press.
 */
export function pressScale(width: number): number {
  'worklet';
  if (!(width > 0)) return SCALE_FLOOR;
  return Math.max(SCALE_FLOOR, 1 - SHRINK_PX / width);
}

export interface PressableScaleProps {
  onPress?: () => void;
  onLongPress?: () => void;
  /** Fire a light impact on release. Reserve it for the primary action. */
  haptic?: boolean;
  disabled?: boolean;
  /**
   * Busy: the control is doing what it was pressed for. Presses, the
   * highlight, the scale and the haptic are all off, it is announced busy, and
   * it keeps its full strength unless it is also `disabled` (ADR-064 AC-4).
   * Kit internal: `Button`'s `pending` is the prop a screen sets.
   */
  busy?: boolean;
  /**
   * The colour the press highlight is drawn in: the control's CONTENT colour,
   * its label or its icon, or `textBody` on a plain surface. `none` for a
   * backdrop or an inline link, which give no tone. Kit internal (AC-19).
   */
  highlight?: keyof Palette | 'none';
  /**
   * Whether the control has a fill of its own. A filled control takes the
   * highlight at .10, a transparent one at .06, where the same tint reads
   * stronger against the page. Kit internal (AC-19).
   */
  filled?: boolean;
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
  /** The drawn control's layout, for a kit component that needs its own size. */
  onLayout?: (e: LayoutChangeEvent) => void;
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

/**
 * The corners of the drawn control, so the highlight overlay is the same shape
 * as what it tints. Copied rather than clipped: `overflow: hidden` on a pill
 * would cut a button's own shadow on some platforms.
 */
const CORNER_KEYS = [
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
  'borderTopStartRadius',
  'borderTopEndRadius',
  'borderBottomStartRadius',
  'borderBottomEndRadius',
] as const;

function cornersOf(style: StyleProp<ViewStyle>): ViewStyle {
  const flat = StyleSheet.flatten(style) ?? {};
  const corners: ViewStyle = {};
  for (const key of CORNER_KEYS) {
    if (flat[key] !== undefined) (corners as Record<string, unknown>)[key] = flat[key];
  }
  return corners;
}

/** Feedback timings. The highlight is a colour change, which reduced motion keeps (motion.ts). */
const SCALE_TIMING = { duration: motionMs.settle, easing: SETTLE };
const HIGHLIGHT_TIMING = { duration: motionMs.quick, easing: SETTLE, reduceMotion: ReduceMotion.Never };

export function PressableScale({
  onPress,
  onLongPress,
  haptic = false,
  disabled = false,
  busy = false,
  highlight = 'textBody',
  filled = false,
  accessibilityRole = 'button',
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  style,
  hitSlop,
  onLayout,
  testID,
  children,
}: PressableScaleProps) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const down = useSharedValue(0);
  const tint = useSharedValue(0);
  const width = useSharedValue<number>(press.widthBeforeLayout);

  const strength = filled ? press.highlightFilled : press.highlightTransparent;
  const inert = disabled || busy;

  const shrink = useAnimatedStyle(() => ({
    // Reduced motion keeps the highlight and drops the travel entirely.
    transform: [{ scale: reduced ? 1 : 1 - down.get() * (1 - pressScale(width.get())) }],
  }));
  const glow = useAnimatedStyle(() => ({ opacity: tint.get() * strength }));

  const release = () => {
    down.set(withTiming(0, SCALE_TIMING));
    tint.set(withTiming(0, HIGHLIGHT_TIMING));
  };

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, ...(busy ? { busy } : null), ...accessibilityState }}
      // A busy control is not disabled, so it keeps the reader's focus and is
      // announced busy rather than dimmed. It answers nothing, which the
      // handlers below enforce instead of the platform's `disabled`.
      disabled={disabled}
      hitSlop={hitSlop}
      // A finger drifting a few pixels should not cancel a press the user meant.
      pressRetentionOffset={press.retentionOffset}
      testID={testID}
      onPressIn={() => {
        if (inert) return;
        down.set(withTiming(1, SCALE_TIMING));
        tint.set(withTiming(1, HIGHLIGHT_TIMING));
      }}
      // Always released, so a control that went busy mid-press never stays down.
      onPressOut={release}
      onPress={() => {
        if (inert) return;
        if (haptic) tap();
        onPress?.();
      }}
      onLongPress={onLongPress && !inert ? onLongPress : undefined}
    >
      <Animated.View
        onLayout={(e: LayoutChangeEvent) => {
          width.set(e.nativeEvent.layout.width);
          onLayout?.(e);
        }}
        style={[{ opacity: disabled ? kitMetrics.disabledOpacity : 1 }, shrink, style]}
      >
        {highlight === 'none' ? null : (
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, cornersOf(style), { backgroundColor: c[highlight] }, glow]}
          />
        )}
        {children}
      </Animated.View>
    </Pressable>
  );
}
