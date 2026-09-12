/**
 * The connection state: the app-wide banner, the per-list note, and the one
 * test both of them and ten screens read.
 *
 * On `expo-network` rather than `@react-native-community/netinfo`: both are
 * pinned in `expo/bundledNativeModules.json`, but only `expo-network` is part
 * of the SDK itself, so it ships in Expo Go and needs no extra native config.
 *
 * It reports **reachability**, not just the radio: a phone attached to a
 * captive-portal wifi is `isConnected` and cannot reach anything, and a banner
 * that disagrees with the app's behaviour is worse than no banner.
 *
 * ## What Session 11 lifted here, and why
 *
 * `useOffline()` was written by hand in eleven places — the banner below, and
 * ten screens across five surfaces. Every one of them repeated the same
 * three-line comment about `undefined` meaning "not yet read" rather than
 * "offline", which is the tell that it is one decision rather than ten. A
 * screen that got the guard wrong would flash its offline state on every cold
 * start, and nothing but a reviewer's eye stood between the codebase and that.
 *
 * `OfflineNote` came from `screens/tenant/offline-note.tsx`, whose own header
 * asked for this: the banner says the app is offline, the note says what that
 * means for the rows under it. The prompt pack's list rule asks for both,
 * because a banner floating at the top of the screen does not tell you whether
 * the list beneath it is current, and a rent ledger that is quietly stale is a
 * ledger someone will act on.
 *
 * Motion: the banner slides down and fades in, on Reanimated and therefore on
 * the UI thread. Under reduced motion the slide is dropped and the fade is kept
 * — the design brief §7.6 rule, applied to the one piece of travel in the shell.
 */
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkState } from 'expo-network';
import { Text } from './text';
import { Icon } from './icon';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { useReducedMotion, MOTION_MS, MOTION_MS_REDUCED } from '@/motion';

const TRAVEL = 12;

/**
 * True only once a read has actually come back saying so.
 *
 * Both flags are `undefined` until the first network read lands. Treating that
 * as offline flashes the offline treatment on every cold start, so **only an
 * explicit `false` counts** — which is the whole of the decision, and the
 * reason this is one function rather than eleven inline expressions.
 */
export function useOffline(): boolean {
  const network = useNetworkState();
  return network.isConnected === false || network.isInternetReachable === false;
}

export function OfflineBanner() {
  const { c, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const reduced = useReducedMotion();
  const offline = useOffline();

  const enter = useSharedValue(0);
  useEffect(() => {
    enter.set(
      withTiming(offline ? 1 : 0, { duration: reduced ? MOTION_MS_REDUCED : MOTION_MS }),
    );
  }, [offline, reduced, enter]);

  const animated = useAnimatedStyle(() => ({
    opacity: enter.get(),
    transform: [{ translateY: reduced ? 0 : (1 - enter.get()) * -TRAVEL }],
  }));

  if (!offline) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: insets.top + 8,
          left: 14,
          right: 14,
          zIndex: 100,
        },
        animated,
      ]}
    >
      <View
        accessible
        accessibilityRole="alert"
        accessibilityLabel={`${t('state.offlineTitle')}. ${t('state.offlineBody')}`}
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 10,
          padding: 12,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: c.borderDefault,
          backgroundColor: c.surface1,
        }}
      >
        {/* `wifiOff`, not `wifi`. Session 11's audit found the banner drawing
            the CONNECTED glyph while saying the app was offline — the glyph is
            what carries the state to a greyscale or colour-blind reader (design
            brief §7.5), and here it was carrying the opposite of the sentence
            beside it. */}
        <Icon name="wifiOff" size={17} color={c.warning600} />
        <View style={{ flex: 1 }}>
          <Text weight="semibold" size="sm" color="textStrong">
            {t('state.offlineTitle')}
          </Text>
          <Text size="xs" color="textMuted" style={{ lineHeight: 18, marginTop: 1 }}>
            {t('state.offlineBody')}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

/**
 * The fourth list state, in the list rather than over it: *these are the last
 * rows that loaded.*
 *
 * Placed inside the list's own content so it scrolls with the rows it is
 * describing. It blocks nothing — offline is a state, not an error (the canvas
 * rule, and F-P10's own position) — so it is a `summary` region rather than an
 * `alert`, which would interrupt a screen reader mid-sentence to announce a
 * condition the reader is expected to keep working through.
 */
export function OfflineNote({ label }: { label?: string }) {
  const { c, space, radius } = useTheme();
  const t = useT();
  const text = label ?? t('state.offlineLastList');

  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel={text}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: space[2],
        padding: space[3],
        borderRadius: radius.md,
        backgroundColor: c.warning100,
      }}
    >
      <Icon name="wifiOff" size={16} color={c.warning600} />
      <Text size="xs" color="textBody" style={{ flex: 1, lineHeight: 18 }}>
        {text}
      </Text>
    </View>
  );
}
