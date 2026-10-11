/**
 * EmptyState — the "nothing yet" every list owes its reader.
 *
 * `ui-screens.md` §6 and `ui-registry.md` both put it the same way: **never a
 * misleading zero, always direction.** An empty list that says nothing reads as
 * a bug; one that says why it is empty and what fills it reads as a state. The
 * `action` slot is what carries the direction when there is something the
 * reader can actually do — widen a filter, sign a lease.
 *
 * **The summary is the words; the action is its sibling.** The card used to be
 * one `accessible` element, and on iOS that is ONE stop: the action inside it
 * ("Find a stay", "Go to the start") could not be reached with VoiceOver, so
 * the direction this component exists to give was the one thing a screen
 * reader user could not take (the same trap as `ErrorState`, mobile audit
 * 2026-10-05, XC-02).
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
        accessible
        accessibilityRole="summary"
        accessibilityLabel={`${title}. ${body}`}
        style={{ alignItems: 'center', gap: 10 }}
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
      </View>
      {action ? <View style={{ marginTop: 4 }}>{action}</View> : null}
    </View>
  );
}
