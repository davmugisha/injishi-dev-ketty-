/**
 * WorkspaceChip — compact indicator of the active workspace + role. Reflects
 * Injishi's "workspace scopes everything" model; tapping it would open the
 * workspace switcher (personal / property orgs).
 *
 * Session 11's motion pass moved it onto `PressableScale`. It is the control at
 * the top right of six different tabs and it did not answer a press at all,
 * which on the one control that changes the whole shell is the worst place in
 * the app for that to be true.
 *
 * **The role is a word, or nothing.** Callers pass the seat's `role`, which is
 * the server's `orgRole` enum passed straight through: "owner" and
 * "housekeeper" in lower case, and an empty string on a broker seat, which drew
 * a blank second line and was read out as "Broker, " (mobile audit 2026-10-05,
 * SA-10). The chip turns the six enums into their words and drops an empty
 * line, so every tab is right without each caller translating. Account's own
 * rows use `seatRoleLabel`, which also knows the surface.
 */
import { View } from 'react-native';
import { Text } from './text';
import { Avatar } from './avatar';
import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { useTheme } from '@/theme/theme';
import { useT, type MessageKey } from '@/i18n/i18n';

/** The server's org roles, as the words a person reads. */
const ORG_ROLE: Readonly<Record<string, MessageKey>> = {
  owner: 'role.owner',
  manager: 'role.manager',
  receptionist: 'role.receptionist',
  finance: 'role.finance',
  hr: 'role.hr',
  housekeeper: 'role.housekeeper',
};

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
  const roleKey = ORG_ROLE[role.trim().toLowerCase()];
  const roleLine = roleKey ? t(roleKey) : role.trim();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={
        roleLine ? `${t('switch.open')}: ${name}, ${roleLine}` : `${t('switch.open')}: ${name}`
      }
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
        {roleLine ? (
          <Text size="2xs" color="textMuted" style={{ lineHeight: 12 }}>
            {roleLine}
          </Text>
        ) : null}
      </View>
      <Icon name="chevronDown" size={15} color={c.textSubtle} />
    </PressableScale>
  );
}
