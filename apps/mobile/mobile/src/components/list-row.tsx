/**
 * ListRow — icon or avatar, title, subtitle, trailing value or chevron.
 *
 * The single most repeated shape in the 37 frames. Frames R5, R7, R12, R13,
 * R14, R15, R19, B25 and W7 all draw it, and the Account screens are almost
 * nothing else. Nine surfaces hand-rolling a row is nine rows that disagree
 * about their height, their divider and their touch target.
 *
 * The floor is enforced here, not asked for: `minHeight: 44`. Every one of the
 * six shipped components the design brief §7.2 lists as under the floor is
 * under it because the floor lived in a document rather than in the component.
 *
 * A row with an `onPress` is a button; a row without one is not, and it does
 * not pretend to be — no chevron, no press feedback, and no announcement to a
 * screen reader that it can be activated. A chevron on a row that does nothing
 * is the "orphaned control" the quality bar rules out.
 */
import { type ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from './text';
import { Icon, type IconName } from './icon';
import { Avatar } from './avatar';
import { PressableScale } from './pressable-scale';
import { useTheme } from '@/theme/theme';
import type { Palette } from '@/theme/tokens';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Leading glyph. Mutually exclusive with `avatar`. */
  icon?: IconName;
  /** Leading initials. Mutually exclusive with `icon`. */
  avatar?: string;
  /** Tint the leading glyph — a destructive row, a warning row. */
  tone?: keyof Palette;
  /** Right-hand text: a value, a meta line, a state word. */
  value?: string;
  /** Anything richer on the right: a badge, a money amount, a button. */
  trailing?: ReactNode;
  onPress?: () => void;
  /** Draw the chevron. Defaults to on whenever the row is pressable. */
  chevron?: boolean;
  /** Hairline under the row. Off on the last row of a group. */
  divider?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export function ListRow({
  title,
  subtitle,
  icon,
  avatar,
  tone,
  value,
  trailing,
  onPress,
  chevron,
  divider = false,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
}: ListRowProps) {
  const { c, space, radius } = useTheme();
  const showChevron = chevron ?? !!onPress;
  // One node, one sentence: a reader should hear the row, not three fragments.
  const spoken = accessibilityLabel ?? [title, subtitle, value].filter(Boolean).join(', ');

  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        // The 44pt floor, in the component rather than in a document.
        minHeight: 44,
        paddingVertical: space[2],
      }}
    >
      {avatar ? (
        <Avatar name={avatar} size={38} />
      ) : icon ? (
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: radius.md,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: c.surface2,
          }}
        >
          <Icon name={icon} size={17} color={tone ? c[tone] : c.textBody} />
        </View>
      ) : null}

      <View style={{ flex: 1, gap: 2 }}>
        <Text weight="medium" size="sm" color={tone ?? 'textStrong'}>
          {title}
        </Text>
        {subtitle ? (
          <Text size="xs" color="textMuted" style={{ lineHeight: 18 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {value ? (
        /**
         * **Session 11's Kinyarwanda audit widened this.** It was
         * `numberOfLines={1}` with no width rule, which clips — and the
         * Kinyarwanda for a row value runs long: "2FA · On" becomes
         * "2FA · Birafunguye", "7 left" becomes "Asigaye 7",
         * "Reveal credits" becomes "Amanota yo kubona aderesi". Frame W8's
         * contract is the rule for the whole app: rows grow, labels shrink,
         * buttons wrap, **nothing truncates**.
         *
         * So it takes two lines rather than one, shrinks before the title does
         * not, and is capped at 45% so a long value cannot crowd the title it
         * belongs to off the row.
         */
        <Text
          size="sm"
          color="textMuted"
          numberOfLines={2}
          style={{ flexShrink: 1, maxWidth: '45%', textAlign: 'right' }}
        >
          {value}
        </Text>
      ) : null}
      {trailing}
      {showChevron ? <Icon name="chevronRight" size={17} color={c.textSubtle} /> : null}
    </View>
  );

  const wrapped = (
    <View
      style={
        divider ? { borderBottomWidth: 1, borderBottomColor: c.borderSubtle } : undefined
      }
    >
      {body}
    </View>
  );

  if (!onPress) {
    // Not a button, and it does not claim to be. A reader hears one static
    // sentence rather than a control it cannot activate.
    return (
      <View accessible accessibilityLabel={spoken}>
        {wrapped}
      </View>
    );
  }

  return (
    <PressableScale
      accessibilityLabel={spoken}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      onPress={onPress}
    >
      {wrapped}
    </PressableScale>
  );
}
