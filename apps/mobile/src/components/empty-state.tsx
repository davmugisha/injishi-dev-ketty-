/**
 * EmptyState — the "nothing yet" every list owes its reader.
 *
 * `ui-screens.md` §6 and `ui-registry.md` both put it the same way: **never a
 * misleading zero, always direction.** An empty list that says nothing reads as
 * a bug; one that says why it is empty and what fills it reads as a state. The
 * `action` slot is what carries the direction when there is something the
 * reader can actually do — widen a filter, sign a lease.
 */
import { type ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from './text';
import { Icon, type IconName } from './icon';
import { useTheme } from '@/theme/theme';

export function EmptyState({
  icon = 'search',
  title,
  body,
  action,
}: {
  icon?: IconName;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  const { c, radius } = useTheme();

  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`${title}. ${body}`}
      style={{
        alignItems: 'center',
        gap: 10,
        paddingVertical: 30,
        paddingHorizontal: 24,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: c.borderSubtle,
        backgroundColor: c.surface1,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: c.surface2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={20} color={c.textMuted} />
      </View>
      <Text family="display" weight="semibold" size="lg" color="textStrong" center>
        {title}
      </Text>
      <Text size="sm" color="textMuted" center style={{ lineHeight: 20, maxWidth: 280 }}>
        {body}
      </Text>
      {action ? <View style={{ marginTop: 4 }}>{action}</View> : null}
    </View>
  );
}
