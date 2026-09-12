/**
 * WorkspaceChip — compact indicator of the active workspace + role. Reflects
 * Injishi's "workspace scopes everything" model; tapping it would open the
 * workspace switcher (personal / property orgs).
 *
 * Session 11's motion pass moved it onto `PressableScale`. It is the control at
 * the top right of six different tabs and it did not answer a press at all,
 * which on the one control that changes the whole shell is the worst place in
 * the app for that to be true.
 */
import { View } from 'react-native';
import { Text } from './text';
import { Avatar } from './avatar';
import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';

export function WorkspaceChip({
  name,
  role,
  onPress,
}: {
  name: string;
  role: string;
  onPress?: () => void;
}) {
  const { c, radius } = useTheme();
  const t = useT();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${t('switch.open')}: ${name}, ${role}`}
      // Drawn at 40; hitSlop carries it to the 44pt floor (design brief §7.2).
      hitSlop={2}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingLeft: 6,
        paddingRight: 10,
        height: 40,
        borderRadius: radius.pill,
        backgroundColor: c.surface1,
        borderWidth: 1,
        borderColor: c.borderDefault,
      }}
    >
      <Avatar name={name} size="xs" square />
      <View>
        <Text weight="semibold" size="xs" color="textStrong" style={{ lineHeight: 14 }}>
          {name}
        </Text>
        <Text size="2xs" color="textMuted" style={{ lineHeight: 12 }}>
          {role}
        </Text>
      </View>
      <Icon name="chevronDown" size={15} color={c.textSubtle} />
    </PressableScale>
  );
}
