/**
 * WorkConnection — what the phone's connection is, what is waiting on it, and,
 * on the demo only, frame W2's "Simulate no signal" switch.
 *
 * Session 11 owns the Account screen and mounts this under its Work section.
 * It is built here because the state it drives is this surface's: the same flag
 * decides whether the Queue groups by floor or by sync state, whether a
 * finished room reads "Done · Queued", and whether "Mark done" says it was
 * marked clean or saved on this phone.
 *
 * **Two sources, one state.** The switch fakes an outage; `expo-network` reports
 * a real one. They are deliberately the same fact to every screen — walking
 * into a lift and flipping this switch produce the identical surface — and the
 * block says which one is currently in force, because a switch that reads "off"
 * on a phone with no bars would be lying.
 *
 * **The switch is the demo's, and only the demo's** (`usePlatform().isDemo`).
 * ADR-038 AC-W10 allows it on the demo host alone, and it shipped to every Work
 * seat: a real housekeeper could flip it and send every change into a buffer
 * that nothing replays (mobile audit 2026-10-05, WK-10). Everyone keeps the
 * real reachability row and the list of what is waiting.
 *
 * **Reconnect empties that list and does nothing else.** It used to share the
 * switch's handler, which on a phone whose switch was OFF — a real outage, now
 * over, with changes left waiting — turned the simulated outage ON and toasted
 * "Signal lost" (WK-11). A real outage can no longer reach the switch at all.
 */
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';
import { Icon, PressableScale, Text, useToast } from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { useReducedMotion } from '@/motion';
import { usePlatform } from '@/queries/platform';
import type { MutationOutcome } from '@/data/use-fixture-mutation';
import { WORK_TARGET, WorkButton } from './work-chrome';
import { bufferLabel, changeLabel, replayOrder } from './work-format';
import { useConnection } from './work-store';

export function WorkConnection() {
  const t = useT();
  const toast = useToast();
  const { c, space, radius } = useTheme();
  const connection = useConnection();
  const { isDemo } = usePlatform();

  const label = bufferLabel({ online: connection.online, buffer: connection.buffer });
  const status = t(label.key, label.values);
  const ordered = replayOrder(connection.buffer);

  /** Says what a connection write did, and never a success it did not have. */
  const report = (outcome: MutationOutcome, said: string, tone: 'success' | 'warning') => {
    if (outcome === 'error') toast.show(t('work.writeFailedTitle'), 'danger');
    else if (outcome === 'done') toast.show(said, tone);
  };

  const reconnect = () => {
    void connection.flush().then((outcome) =>
      report(outcome, t('work.offline.backOnlineToast'), 'success'),
    );
  };

  const toggleSimulated = () => {
    if (!connection.simulated) {
      void connection.setSimulated(true).then((outcome) =>
        report(outcome, t('work.offline.lostToast'), 'warning'),
      );
      return;
    }
    // Ending the simulation under a REAL outage is not coming back online: the
    // phone still cannot reach anything, so the changes stay listed as waiting
    // and the toast says where the phone actually is.
    if (connection.realOffline) {
      void connection.setSimulated(false).then((outcome) =>
        report(outcome, t('work.offline.realOffline'), 'warning'),
      );
      return;
    }
    reconnect();
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

      <View
        accessible
        accessibilityLabel={status}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}
      >
        <Icon
          name={connection.online ? 'wifi' : 'wifiOff'}
          size={19}
          color={connection.online ? c.success600 : c.warning600}
        />
        <Text weight="medium" size="sm" color="textStrong" style={{ flex: 1 }}>
          {status}
        </Text>
      </View>

      {isDemo ? (
        <SimulateRow
          on={connection.simulated}
          label={t('work.offline.simulateLabel')}
          hint={t('work.offline.simulateHint')}
          onToggle={toggleSimulated}
        />
      ) : null}

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
          {/* Not while the phone is really offline: "Back online" would be
              untrue, and the changes are still waiting on signal. */}
          {!connection.realOffline ? (
            <WorkButton
              variant="outline"
              leadingIcon="refreshCw"
              label={t('work.offline.reconnect')}
              onPress={reconnect}
            />
          ) : null}
        </View>
      ) : null}

      {isDemo ? (
        <Text size="xs" color="textSubtle" style={{ lineHeight: 18 }}>
          {t('work.offline.simulateHint')}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * The demo switch, as one row: the label and the switch are a single 56pt
 * target rather than a 44pt switch beside a label you cannot press (mobile
 * audit 2026-10-05, WK-15).
 *
 * The row reports `switch`, the role `PressableScale` gained for exactly this
 * control; the drawn switch inside it is decoration and hidden from a reader.
 */
function SimulateRow({
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
  const { space } = useTheme();

  return (
    <PressableScale
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ checked: on }}
      onPress={onToggle}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        minHeight: WORK_TARGET,
      }}
    >
      <Text weight="medium" size="sm" color="textStrong" style={{ flex: 1 }}>
        {label}
      </Text>
      <GloveSwitch on={on} />
    </PressableScale>
  );
}

/**
 * The drawn switch: 64x44 with a 32pt knob, against the platform's 51x31 —
 * which cannot be grown. The row around it is the target. Motion is a 150ms
 * translate on the UI thread — a two-state toggle, so a timing curve rather
 * than a spring, and reduced motion drops the travel and keeps the colour
 * change.
 */
function GloveSwitch({ on }: { on: boolean }) {
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
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
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
    </View>
  );
}
