/**
 * The small pieces the three booking steps share.
 *
 * Local to this folder rather than in the barrel, per the parallel-session rule
 * (MOBILE-PROTOTYPE-PROMPTS.md Part 3): a session builds what it needs inside
 * its own folder and Session 11 lifts what a second surface turns out to want.
 * Three of these were candidates — `AdapterChip`, `Choice` and
 * `BookPrimaryAction` — because Tenant rent (frame R12) draws the same
 * MoMo-first payment sheet and the same mock-adapter warning. **Session 11
 * lifted the first**: three surfaces had drawn the adapter chip three ways, and
 * `AdapterNote` in the kit is now the one of them. The other two stayed here,
 * because Tenant did not in the end draw either.
 */
import { type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import {
  AdapterNote,
  Badge,
  Icon,
  MoneyAmount,
  PressableScale,
  Text,
  type IconName,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { useReducedMotion } from '@/motion';

/**
 * The mock-adapter disclosure.
 *
 * Design brief §4.3: **every screen showing money renders its adapter mode
 * inline, because a mocked success must never look like a real one.** It is a
 * warning badge and a sentence rather than a footnote, and it appears on all
 * three money screens the canvas draws it on.
 */
export function AdapterChip() {
  const t = useT();
  // Session 11 lifted the shape into the kit after finding three of them. This
  // keeps the name the booking screens already call and supplies the copy.
  return <AdapterNote label={t('book.mockAdapter')} body={t('book.mockAdapterBody')} />;
}

/** A label on the left and a value on the right. The canvas's `factRow`. */
export function FactRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
      }}
    >
      <Text size="sm" color="textMuted">
        {label}
      </Text>
      <Text
        weight={strong ? 'semibold' : 'medium'}
        size="sm"
        color="textStrong"
        style={{ flexShrink: 1, textAlign: 'right' }}
      >
        {value}
      </Text>
    </View>
  );
}

/** The same row, with money on the right so it keeps the RWF prefix form. */
export function MoneyRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}
    >
      <Text weight={strong ? 'semibold' : 'regular'} size="sm" color={strong ? 'textStrong' : 'textMuted'}>
        {label}
      </Text>
      <MoneyAmount
        value={value}
        strong={strong}
        tone={strong ? 'brand' : undefined}
        size={strong ? 'md' : 'sm'}
      />
    </View>
  );
}

/**
 * A radio row: the payment methods, and anything else that is one-of-several.
 *
 * A drawn ring rather than a platform radio, for the reason the policy sheet
 * draws its own switch — React Native has no radio, and the two community ones
 * paint from platform colours that cannot be resolved through the palette
 * (design brief §8.4). The whole row is the target, which is how it clears 44pt
 * without a 22pt ring pretending to.
 */
export function Choice({
  selected,
  title,
  hint,
  icon,
  onPress,
  testID,
  children,
}: {
  selected: boolean;
  title: string;
  hint?: string;
  icon?: IconName;
  onPress: () => void;
  testID?: string;
  /** Revealed under the row when it is the selected one. */
  children?: ReactNode;
}) {
  const { c, space, radius } = useTheme();

  return (
    <View
      style={{
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: selected ? c.borderBrand : c.borderSubtle,
        backgroundColor: selected ? c.actionSubtle : c.surface1,
        overflow: 'hidden',
      }}
    >
      <PressableScale
        accessibilityRole="radio"
        accessibilityLabel={hint ? `${title}. ${hint}` : title}
        accessibilityState={{ selected }}
        onPress={onPress}
        testID={testID}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[3],
          minHeight: 44,
          paddingVertical: 13,
          paddingHorizontal: 14,
        }}
      >
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            width: 22,
            height: 22,
            borderRadius: radius.pill,
            borderWidth: 2,
            borderColor: selected ? c.action : c.borderStrong,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {selected ? (
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: radius.pill,
                backgroundColor: c.action,
              }}
            />
          ) : null}
        </View>

        <View style={{ flex: 1, gap: 2 }}>
          <Text weight="semibold" size="md" color="textStrong">
            {title}
          </Text>
          {hint ? (
            <Text size="xs" color="textMuted" style={{ lineHeight: 17 }}>
              {hint}
            </Text>
          ) : null}
        </View>

        {icon ? <Icon name={icon} size={18} color={selected ? c.action : c.textSubtle} /> : null}
      </PressableScale>

      {selected && children ? (
        <View
          style={{
            paddingHorizontal: 14,
            paddingBottom: 14,
            paddingTop: 2,
            gap: space[3],
          }}
        >
          {children}
        </View>
      ) : null}
    </View>
  );
}

/**
 * A tick box with its label as the target.
 *
 * Used for the house-rules acknowledgement, which FL07 §4 puts before payment.
 * The tick is a glyph and not a fill, so it survives greyscale (§7.5), and the
 * label is inside the target because a 20pt box beside 40pt of text is a box
 * most people miss.
 */
export function CheckRow({
  checked,
  label,
  hint,
  onToggle,
  testID,
}: {
  checked: boolean;
  label: string;
  hint?: string;
  onToggle: (next: boolean) => void;
  testID?: string;
}) {
  const { c, space, radius } = useTheme();

  return (
    <PressableScale
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ checked }}
      onPress={() => onToggle(!checked)}
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        minHeight: 44,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: checked ? c.borderBrand : c.borderSubtle,
        backgroundColor: checked ? c.actionSubtle : c.surface2,
      }}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 22,
          height: 22,
          borderRadius: radius.xs,
          borderWidth: checked ? 0 : 2,
          borderColor: c.borderStrong,
          backgroundColor: checked ? c.action : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked ? <Icon name="check" size={14} color={c.bgApp} /> : null}
      </View>

      <Text weight="medium" size="sm" color="textStrong" style={{ flex: 1, lineHeight: 20 }}>
        {label}
      </Text>
    </PressableScale>
  );
}

/** An icon and a sentence, for the escrow and timezone notes. */
export function Note({ icon, children }: { icon: IconName; children: string }) {
  const { c } = useTheme();
  return (
    <View accessible accessibilityLabel={children} style={{ flexDirection: 'row', gap: 10 }}>
      <Icon name={icon} size={15} color={c.textMuted} />
      <Text size="sm" color="textMuted" style={{ flex: 1, lineHeight: 19 }}>
        {children}
      </Text>
    </View>
  );
}

/* ----------------------------------------------------- the primary action */

/**
 * The one primary action a booking step gets, with its blocked reason and its
 * paying state.
 *
 * **Not `Button`.** The kit's `Button` is a plain `Pressable` with an opacity
 * dip: no scale, no haptic, and no way to say "working". The common header asks
 * for a scale to 0.98 plus a light haptic on the primary action, and this
 * screen additionally has to hold a 1.2 second paying state during which the
 * control must be visibly busy and must not fire twice. `Button` is frozen in
 * the barrel until Session 11, so this is built here and named in the report as
 * the component Session 11 should fold back into it.
 *
 * **The reason sits above the button, always, when the button is off.** Design
 * brief and canvas both: consequences are printed under the button rather than
 * discovered after it. A disabled control with no explanation is the orphaned
 * control the quality bar rules out.
 *
 * **Under reduced motion the spinner is dropped and the label carries the
 * state.** `ActivityIndicator` is pure travel, and §7.6's rule is that reduced
 * motion removes travel and never feedback — so the feedback becomes the word.
 */
export function BookPrimaryAction({
  label,
  busyLabel,
  busy,
  blockedReason,
  onPress,
  testID,
}: {
  label: string;
  busyLabel: string;
  busy: boolean;
  blockedReason: string | null;
  onPress: () => void;
  testID?: string;
}) {
  const { c, space, radius } = useTheme();
  const reduced = useReducedMotion();
  const disabled = blockedReason !== null || busy;

  return (
    <View style={{ flex: 1, gap: blockedReason ? 10 : 0 }}>
      {blockedReason ? (
        <View
          accessible
          accessibilityRole="alert"
          accessibilityLabel={blockedReason}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 7,
            paddingHorizontal: 10,
            borderRadius: radius.sm,
            backgroundColor: c.bgTint,
          }}
        >
          <Icon name="info" size={14} color={c.textMuted} />
          <Text size="xs" color="textBody" style={{ flex: 1, lineHeight: 18 }}>
            {blockedReason}
          </Text>
        </View>
      ) : null}

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={busy ? busyLabel : label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        haptic
        onPress={onPress}
        testID={testID}
        style={{
          height: 48,
          borderRadius: radius.md,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space[2],
          backgroundColor: c.action,
          opacity: blockedReason ? 0.45 : 1,
        }}
      >
        {busy && !reduced ? <ActivityIndicator size="small" color={c.bgApp} /> : null}
        <Text weight="semibold" size="md" color={c.bgApp}>
          {busy ? busyLabel : label}
        </Text>
      </PressableScale>
    </View>
  );
}
