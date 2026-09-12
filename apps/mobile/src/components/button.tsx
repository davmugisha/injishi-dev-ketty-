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
 *   before       after       what it paints
 *   secondary -> outline     surface1 fill with a borderDefault hairline
 *   subtle    -> secondary   actionSubtle fill, action ink
 *
 * They are HeroUI's names for those two looks, which is what `design-system.md`
 * section 3 asked for. The ADR's mobile child keeps the same table.
 *
 * ## What Session 11's motion pass changed
 *
 * It draws on `PressableScale` now rather than on a bare `Pressable` with an
 * opacity dip. The prompt pack's rule is one sentence — *"press feedback is a
 * scale to 0.98 plus a light haptic on the primary action"* — and `Button` met
 * neither half of it, which mattered more than it sounds: almost every primary
 * action in the app is a `Button`, so the one control the rule was written for
 * was the one control that did not follow it.
 *
 * `PressableScale` already owned the whole decision (feedback on press-in,
 * commit on press-out; reduced motion drops the travel and keeps the opacity;
 * scale and opacity only, so a press costs no layout). Reimplementing a second
 * copy of that here would have been a second thing to keep in agreement.
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
import { type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import type { ButtonSize, ButtonVariant } from '@injishi/ui-contract';
import { Text } from './text';
import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';
import { useTheme } from '@/theme/theme';
import { fontSize, type Palette } from '@/theme/tokens';

type Variant = ButtonVariant<'native'>;
type Size = ButtonSize<'native'>;

/**
 * Per size: the box height, the side padding, the label's type STEP, and which
 * corner. A `Record` rather than the ternaries it replaced, so a size the
 * contract adds fails here instead of falling through to `md` unnoticed.
 */
const SIZE: Record<
  Size,
  { height: number; paddingH: number; label: 'xs' | 'sm' | 'md'; corner: 'sm' | 'md' }
> = {
  sm: { height: 32, paddingH: 12, label: 'xs', corner: 'sm' },
  md: { height: 40, paddingH: 18, label: 'sm', corner: 'md' },
  lg: { height: 48, paddingH: 24, label: 'md', corner: 'md' },
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
  onPress,
  accessibilityLabel,
  accessibilityHint,
  haptic,
  testID,
}: ButtonProps) {
  const { c, radius } = useTheme();

  const { height, paddingH, label: labelSize, corner } = SIZE[size];
  // The label's STEP, and the glyph's pixel size beside it. They are two
  // different kinds of number: the label is chosen from the type scale, the
  // glyph is measured against the label so the two share an optical size.
  const glyphPx = fontSize[labelSize] + 3;
  const br = radius[corner];

  const fills: Record<Variant, { bg: string; fg: keyof Palette | string; border?: string }> = {
    // `action` is the solid NEUTRAL button (HeroUI `primary`, which aliases
    // `foreground`), so its text is `bgApp` — HeroUI's `primaryForeground`
    // aliases `background`. `textOnBrand` belongs on an ACCENT fill, and using
    // it here would paint near-ink on near-ink in the light scheme.
    primary: { bg: c.action, fg: c.bgApp },
    outline: { bg: c.surface1, fg: 'textStrong', border: c.borderDefault },
    secondary: { bg: c.actionSubtle, fg: c.action },
    ghost: { bg: 'transparent', fg: 'textBody' },
    // `textOnDanger` is near-white and DERIVED, not a literal: the danger
    // fill sits at L 58 precisely so it can carry it (ADR-025 #2), and
    // `derive-palette.mjs` measures the pair at 4.66:1 on every run. The
    // hex that used to be here could not move when the palette did.
    danger: { bg: c.danger500, fg: c.textOnDanger },
  };
  const v = fills[variant];

  const base: ViewStyle = {
    height,
    paddingHorizontal: paddingH,
    borderRadius: br,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: v.bg,
    borderWidth: v.border ? 1 : 0,
    borderColor: v.border,
    ...(block ? { alignSelf: 'stretch' } : { alignSelf: 'flex-start' }),
  };

  const fgColor = (typeof v.fg === 'string' && v.fg in c ? c[v.fg as keyof Palette] : v.fg) as string;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? children}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      haptic={haptic ?? HAPTIC_BY_DEFAULT.includes(variant)}
      // sm (32) and md (40) both draw under the 44px floor; the hit area makes
      // up the difference without changing the visual scale (design brief §7.2).
      hitSlop={Math.max(0, (44 - height) / 2)}
      onPress={onPress}
      style={base}
      testID={testID}
    >
      {leadingIcon ? (
        <ButtonGlyph name={leadingIcon} size={glyphPx} color={fgColor} />
      ) : null}
      <Text weight="semibold" size={labelSize} color={fgColor}>
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
