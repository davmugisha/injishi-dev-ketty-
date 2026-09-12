/**
 * StatRow — label, value and unit on one line. Frame W7's shift summary draws
 * three of them in one card: "Rooms cleaned 11", "Average per room 22 min",
 * "Tasks left 3".
 *
 * Deliberately not `StatCard`. A `StatCard` is a tile that competes for
 * attention; these are a quiet ledger read top to bottom, and W7's footnote is
 * explicit about why that matters — "Only you and your supervisor see this. It
 * is not ranked against anyone." Drawing an attendant's own numbers as three
 * big tiles is the leaderboard the canvas rules out.
 *
 * The value is tabular-figure so a column of them lines up on the decimal
 * rather than jittering, and the unit is a separate node in muted so "22" reads
 * as the number and "min" as its unit.
 */
import { View } from 'react-native';
import { Text } from './text';
import { Icon, type IconName } from './icon';
import { useTheme } from '@/theme/theme';
import type { Palette } from '@/theme/tokens';

export interface StatRowProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: IconName;
  /** Tints the value. A count that is a problem is not the same as a count. */
  tone?: keyof Palette;
  divider?: boolean;
}

export function StatRow({ label, value, unit, icon, tone = 'textStrong', divider = false }: StatRowProps) {
  const { c, space } = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={`${label}, ${value}${unit ? ` ${unit}` : ''}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        minHeight: 44,
        paddingVertical: space[2],
        borderBottomWidth: divider ? 1 : 0,
        borderBottomColor: c.borderSubtle,
      }}
    >
      {icon ? <Icon name={icon} size={16} color={c.textMuted} /> : null}
      <Text size="sm" color="textBody" style={{ flex: 1 }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
        <Text family="mono" weight="semibold" size="lg" color={tone}>
          {String(value)}
        </Text>
        {unit ? (
          <Text size="xs" color="textMuted">
            {unit}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
