/**
 * WorkConnection — frame W2's "Simulate no signal" switch, plus what the buffer
 * is currently holding.
 *
 * Session 11 owns the Account screen and mounts this under its Work section.
 * It is built here because the state it drives is this surface's: the same flag
 * decides whether the Queue groups by floor or by sync state, whether a
 * finished room reads "Done · Queued", and whether "Mark done" toasts "the
 * front desk sees it live" or "saved on this phone".
 *
 * **Two sources, one state.** The switch fakes an outage; `expo-network` reports
 * a real one. They are deliberately the same fact to every screen — walking
 * into a lift and flipping this switch produce the identical surface — and the
 * row says which one is currently in force, because a switch that reads "off"
 * on a phone with no bars would be lying.
 *
 * The switch is a `Pressable` reporting `accessibilityRole="checkbox"` rather
 * than React Native's `Switch`, for the reason the rest of this surface is
 * bigger than the floor: the platform control draws at 51x31 with no way to
 * grow it, and this is used with a glove on. `checkbox` rather than `switch`
 * because that is the role `PressableScale` accepts, and both announce the
 * same on/off state to a reader — this is worth revisiting if Session 11 ever
 * widens that prop.
 */
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';
import { Button, Icon, PressableScale, Text, useToast } from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { useReducedMotion } from '@/motion';
import { bufferLabel, changeLabel, flushPhrase, replayOrder } from './work-format';
import { useConnection } from './work-store';

export function WorkConnection() {
  const t = useT();
  const toast = useToast();
  const { c, space, radius } = useTheme();
  const connection = useConnection();

  const label = bufferLabel({ online: connection.online, buffer: connection.buffer });
  const ordered = replayOrder(connection.buffer);

  const toggle = () => {
    if (connection.simulated) {
      void connection.flush().then((count) => {
        const phrase = flushPhrase(count);
        toast.show(t(phrase.key, phrase.values), 'success');
      });
      return;
    }
    void connection.setSimulated(true).then(() => {
      toast.show(t('work.offline.lostToast'), 'warning');
    });
  };

  return (
    <View style={{ gap: space[3] }}>
      {/* Its own heading, so the block is self-contained wherever Session 11
          mounts it rather than depending on the section it lands in. */}
      <Text
        weight="bold"
        size="xs"
        color="textMuted"
        style={{ letterSpacing: 1, textTransform: 'uppercase' }}
      >
        {t('work.offline.title')}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <Icon
          name={connection.online ? 'wifi' : 'wifiOff'}
          size={19}
          color={connection.online ? c.success600 : c.warning600}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Text weight="medium" size="sm" color="textStrong">
            {t('work.offline.simulateLabel')}
          </Text>
          <Text size="xs" color="textMuted">
            {t(label.key, label.values)}
          </Text>
        </View>
        <GloveSwitch
          on={connection.simulated}
          label={t('work.offline.simulateLabel')}
          hint={t('work.offline.simulateHint')}
          onToggle={toggle}
        />
      </View>

      {/* A real outage is not something the switch can undo, and saying so is
          the difference between a control that looks broken and one that is
          explaining itself. */}
      {connection.realOffline ? (
        <View
          accessible
          accessibilityRole="summary"
          accessibilityLabel={t('work.offline.realOffline')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[2],
            padding: space[3],
            borderRadius: radius.md,
            backgroundColor: c.warning100,
          }}
        >
          <Icon name="alertTriangle" size={15} color={c.warning600} />
          <Text size="xs" color="textBody" style={{ flex: 1, lineHeight: 18 }}>
            {t('work.offline.realOffline')}
          </Text>
        </View>
      ) : null}

      {ordered.length > 0 ? (
        <View style={{ gap: space[2] }}>
          {ordered.map((change, index) => (
            <Text key={change.key} size="xs" color="textMuted">
              {`${index + 1}. ${t('work.offline.queuedRoom', {
                room: change.room,
                what: t(changeLabel(change)),
              })}`}
            </Text>
          ))}
          <Button variant="outline" size="md" leadingIcon="refreshCw" onPress={toggle}>
            {t('work.offline.reconnect')}
          </Button>
        </View>
      ) : null}

      <Text size="xs" color="textSubtle" style={{ lineHeight: 18 }}>
        {t('work.offline.simulateHint')}
      </Text>
    </View>
  );
}

/**
 * A switch sized for a gloved thumb: 64x44 with a 32pt knob, against the
 * platform's 51x31 — which cannot be grown and is why this is a `Pressable`
 * reporting `accessibilityRole="checkbox"` rather than RN's own `Switch`.
 * 44 is the floor, and on this surface the floor is the minimum rather than
 * the target. Motion is a 150ms translate on the UI thread — a two-state
 * toggle, so a timing curve rather than a spring, and reduced motion drops the
 * travel and keeps the colour change.
 */
function GloveSwitch({
  on,
  label,
  hint,
  onToggle,
}: {
  on: boolean;
  label: string;
  hint: string;
  onToggle: () => void;
}) {
  const { c, radius } = useTheme();
  const reduced = useReducedMotion();
  const progress = useSharedValue(on ? 1 : 0);

  useEffect(() => {
    progress.set(withTiming(on ? 1 : 0, { duration: reduced ? 1 : 150 }));
  }, [on, progress, reduced]);

  const knob = useAnimatedStyle(() => ({
    transform: [{ translateX: reduced ? (on ? 28 : 4) : 4 + progress.get() * 24 }],
  }));

  return (
    <PressableScale
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ checked: on }}
      onPress={onToggle}
      style={{
        width: 64,
        height: 44,
        borderRadius: radius.pill,
        justifyContent: 'center',
        backgroundColor: on ? c.warning500 : c.surface3,
        borderWidth: 1,
        borderColor: on ? c.warning600 : c.borderDefault,
      }}
    >
      <Animated.View
        style={[
          {
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: c.surface1,
          },
          knob,
        ]}
      />
    </PressableScale>
  );
}
