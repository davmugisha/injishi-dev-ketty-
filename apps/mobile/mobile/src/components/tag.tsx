/**
 * Tag — filter chip with selected / interactive states. Port of the DS Tag.
 *
 * `accessibilityRole="radio"` is hardcoded and that is the point of it: a Tag
 * is one option in a single choice. A rail that mixes a radio, a checkbox and a
 * button needs `FilterChip`, which takes the role as a required prop.
 *
 * Session 11's motion pass moved it onto `PressableScale`: it had no press
 * feedback at all, and a 30pt chip that does not move under a thumb reads as
 * decoration.
 */
import { Text } from './text';
import { PressableScale } from './pressable-scale';
import { useTheme } from '@/theme/theme';

export function Tag({
  children,
  selected = false,
  onPress,
}: {
  children: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const { c, radius } = useTheme();
  return (
    <PressableScale
      accessibilityRole="radio"
      accessibilityLabel={children}
      accessibilityState={{ selected }}
      // Drawn at 30, the shortest control in the set (design brief 7.2).
      hitSlop={7}
      onPress={onPress}
      style={{
        height: 30,
        paddingHorizontal: 12,
        borderRadius: radius.sm,
        justifyContent: 'center',
        backgroundColor: selected ? c.actionSubtle : c.surface2,
        borderWidth: 1,
        borderColor: selected ? c.brand300 : c.borderSubtle,
      }}
    >
      <Text weight="medium" size="sm" color={selected ? 'brand700' : 'textBody'}>
        {children}
      </Text>
    </PressableScale>
  );
}
