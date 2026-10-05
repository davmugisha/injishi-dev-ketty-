/**
 * Button — port of the DS Button. Variants: primary / secondary / outline /
 * ghost / danger. Sizes sm / md / lg. Optional block width + leading icon.
 *
 * ## The names are not declared here
 *
 * `@injishi/ui-contract` owns them (ADR-040 call 4), and the web `Button` in
 * `@injishi/ui` imports the same core. Both `Record`s below are keyed on the
 * contract's unions, so a name added, dropped or renamed there fails this file
 * until it moves too. A rename lands on both platforms in one change, or it
 * does not land.
 *
 * Two names moved to get here, in one change, because mobile had both
 * `secondary` and `subtle` live and doing the second rename alone would have
 * made two variants called `secondary`:
 *
 *   before       after       what it painted then
 *   secondary -> outline     surface1 fill with a borderDefault hairline
 *   subtle    -> secondary   actionSubtle fill, action ink
 *
 * They are HeroUI's names for those two looks, which is what `design-system.md`
 * section 3 asked for. The ADR's mobile child keeps the same table.
 *
 * ## HeroUI's look (ADR-064)
 *
 * Every button is a pill, and **primary is teal**: `domainHospitality` with
 * `textOnBrand`, the near-ink the accent carries at 5.7:1 (white on it is
 * 3.10:1). The ink `action` fill this used to draw appears on no button now.
 * Heights are HeroUI's 40, 48 and 56, and they are MINIMUMS: a label wraps
 * rather than being cut, so the largest system text grows the button instead
 * of clipping it (audit XC-03). There is deliberately no line clamp: frame W8
 * promises that nothing on Work truncates and `work-rw.test.tsx` enforces it,
 * and ADR-064 lets a rule our tests enforce win over HeroUI's look. Every
 * number is a `kitMetrics` name.
 *
 * **`pending`** is the one prop ADR-064 adds. The leading icon slot shows a
 * busy ring, the label stays readable, and the button holds its width so the
 * row around it does not jump. A busy button answers nothing and is announced
 * busy; it keeps its full strength, because it is working, not unavailable.
 *
 * ## Press feel
 *
 * Drawn on `PressableScale`, which owns the whole decision (feedback on
 * press-in, commit on press-out; reduced motion drops the travel and keeps the
 * tone). This passes it the label's colour as the highlight, so a pressed
 * button darkens toward its own ink, as HeroUI's pressed fill does.
 *
 * **`haptic` defaults to on for `primary` and `danger` and off elsewhere.**
 * Session 7 built `screens/tenant/haptics.ts` to fire the buzz from its own
 * handlers because it could not reach this file, and asked for exactly this:
 * *"add `haptic` to `Button`, set it on `primary` and `danger`, and delete this
 * file."* The default is the point — a rule that every screen has to remember
 * is a rule half the screens will not. The three quiet variants stay quiet
 * because a buzz on every control across a screen is what makes people turn
 * haptics off system-wide, at which point the one place it mattered is gone
 * too. Any caller can override in either direction.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { ButtonSize, ButtonVariant } from '@injishi/ui-contract';
import { Text } from './text';
import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';
import { useTheme } from '@/theme/theme';
import { kitMetrics, type Palette } from '@/theme/tokens';

type Variant = ButtonVariant<'native'>;
type Size = ButtonSize<'native'>;

/**
 * Per size: the label's type STEP; every measurement is `kitMetrics.button`.
 * A `Record` rather than ternaries, so a size the contract adds fails here
 * instead of falling through to `md` unnoticed.
 */
const LABEL: Record<Size, 'sm' | 'md' | 'lg'> = { sm: 'sm', md: 'md', lg: 'lg' };

/**
 * What each variant paints, as palette KEYS (AC-1, AC-3). Keys rather than
 * colours, because the label key is also the press highlight's colour.
 */
const PAINT: Record<Variant, { fill: keyof Palette | 'none'; ink: keyof Palette; edge?: keyof Palette }> = {
  primary: { fill: 'domainHospitality', ink: 'textOnBrand' },
  secondary: { fill: 'surface3', ink: 'textLink' },
  outline: { fill: 'none', ink: 'textBody', edge: 'borderDefault' },
  ghost: { fill: 'none', ink: 'textBody' },
  // `textOnDanger` is near-white and DERIVED, not a literal: the danger fill
  // sits at L 58 precisely so it can carry it (ADR-025 #2), and
  // `derive-palette.mjs` measures the pair at 4.66:1 on every run.
  danger: { fill: 'danger500', ink: 'textOnDanger' },
};

/** The two that commit something. See the header on why the rest stay quiet. */
const HAPTIC_BY_DEFAULT: readonly Variant[] = ['primary', 'danger'];

export interface ButtonProps {
  children: string;
  variant?: Variant;
  size?: Size;
  block?: boolean;
  leadingIcon?: IconName;
  disabled?: boolean;
  /**
   * The write this button started is in flight. Shows a busy ring in the icon
   * slot, keeps the label, holds the button's width, and refuses presses until
   * it clears. Pass the request's own in-flight state, never a timer.
   */
  pending?: boolean;
  onPress?: () => void;
  /** Overrides the label a reader hears. Default: the button's own text. */
  accessibilityLabel?: string;
  /** What activating this does, when the label alone does not say. */
  accessibilityHint?: string;
  /**
   * Fire a light impact on release. Defaults to on for `primary` and `danger`.
   * Set it false on a primary that is not the commit — a "Next" in a stepper
   * that has three more steps behind it.
   */
  haptic?: boolean;
  testID?: string;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  block = false,
  leadingIcon,
  disabled = false,
  pending = false,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  haptic,
  testID,
}: ButtonProps) {
  const { c, radius } = useTheme();
  const m = kitMetrics.button[size];
  const paint = PAINT[variant];
  const ink = c[paint.ink];

  // The width the button last laid out at while NOT busy. Read when it goes
  // busy, so a label that changes ("Send" to "Sending") or a ring that replaces
  // a wider icon can never make it narrower and shift the row (AC-4).
  const idleWidth = useRef(0);
  const onLayout = (e: LayoutChangeEvent) => {
    if (!pending) idleWidth.current = e.nativeEvent.layout.width;
  };

  const box: ViewStyle = {
    minHeight: m.minHeight,
    minWidth: pending && idleWidth.current > 0 ? idleWidth.current : undefined,
    paddingHorizontal: m.insetX,
    paddingVertical: m.insetY,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: m.gap,
    backgroundColor: paint.fill === 'none' ? 'transparent' : c[paint.fill],
    borderWidth: paint.edge ? kitMetrics.hairline : 0,
    borderColor: paint.edge ? c[paint.edge] : undefined,
    ...(block ? { alignSelf: 'stretch' } : { alignSelf: 'flex-start' }),
  };

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? children}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      busy={pending}
      haptic={haptic ?? HAPTIC_BY_DEFAULT.includes(variant)}
      highlight={paint.ink}
      filled={paint.fill !== 'none'}
      // md and lg draw at or above the 44pt floor; sm draws 40 and the hit
      // area makes up the difference without changing the visual scale.
      hitSlop={m.hitSlop}
      onPress={onPress}
      onLayout={onLayout}
      style={box}
      testID={testID}
    >
      {pending ? (
        <Spinner color={ink} slot={m.icon} />
      ) : leadingIcon ? (
        <ButtonGlyph name={leadingIcon} size={m.icon} color={ink} />
      ) : null}
      <Text
        weight="medium"
        size={LABEL[size]}
        color={ink}
        style={{ flexShrink: 1, textAlign: 'center' }}
      >
        {children}
      </Text>
    </PressableScale>
  );
}

/** The glyph is decoration: the label beside it already says what this does. */
function ButtonGlyph({
  name,
  size,
  color,
}: {
  name: IconName;
  size: number;
  color: string;
}): ReactNode {
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants">
      <Icon name={name} size={size} color={color} />
    </View>
  );
}

/**
 * One turn of the busy ring. A named exception to the motion tokens (ADR-064
 * AC-15): a spinner turns at a constant speed, and an eased one reads as a
 * stutter at the top of every turn. It also ignores Reduce Motion, as the
 * platforms' own progress indicators do, because a ring that stops looks like a
 * hung app rather than a calm one.
 */
const TURN_MS = 900;

/**
 * The busy ring: three quarters of a circle in the label's colour, centred in
 * a slot as wide as the size's icon, so the row stays centred whether or not
 * the button had an icon to replace. Hidden from screen readers: the button
 * itself is announced busy.
 */
function Spinner({ color, slot }: { color: string; slot: number }): ReactNode {
  const { radius } = useTheme();
  const turn = useSharedValue(0);

  useEffect(() => {
    turn.set(
      withRepeat(
        withTiming(1, { duration: TURN_MS, easing: Easing.linear, reduceMotion: ReduceMotion.Never }),
        -1,
        false,
        undefined,
        ReduceMotion.Never,
      ),
    );
    return () => cancelAnimation(turn);
  }, [turn]);

  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get() * 360}deg` }] }));
  const { size, stroke } = kitMetrics.spinner;

  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      testID="button-spinner"
      style={{ width: slot, alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View
        style={[
          {
            width: size,
            height: size,
            borderRadius: radius.pill,
            borderWidth: stroke,
            borderColor: color,
            // The quarter that is not drawn is what makes it read as turning.
            borderTopColor: 'transparent',
          },
          spin,
        ]}
      />
    </View>
  );
}
