/**
 * UndoBar — a toast with a control in it.
 *
 * **Two surfaces built this separately and Session 11 merged them.** Session 6
 * wrote `screens/saved/undo-bar.tsx` for unsaving a stay; Session A wrote
 * `screens/host/host-undo-bar.tsx` for reversing an approve or a decline. The
 * two headers reached the same four conclusions independently, which is the
 * strongest evidence available that this is one component:
 *
 *   - The kit's `Toast` cannot carry it. `show(text, tone)` takes no action, is
 *     `pointerEvents="none"`, and dismisses after 3.2 seconds — which is right
 *     for something that is READ and wrong for something that is USED.
 *   - It needs a longer dwell than a toast, and a longer one again when a
 *     screen reader is running: hearing a sentence, swiping to find the button
 *     and double-tapping it is a longer span than reading and reaching.
 *   - It has to announce on both platforms, and that takes two mechanisms.
 *   - It sits above the tab bar, so the control it offers is never under the
 *     home indicator or the bar.
 *
 * ## Announcing it, and why one line was not enough
 *
 * Session 6's first version carried `accessibilityRole="alert"` and nothing
 * else, which announced on **neither** platform. `accessibilityLiveRegion` is
 * Android-only in React Native; iOS has no live-region concept there at all, so
 * the role alone is inert. The result was a bar that appeared, offered an undo,
 * and vanished in silence — and the reader least able to notice a row leaving a
 * list was the one not told it had.
 *
 * So there are two mechanisms, split by platform and mutually exclusive:
 * Android gets `accessibilityLiveRegion="polite"`, iOS gets an explicit
 * `announceForAccessibility`. Announcing on both reads the sentence twice.
 *
 * **The announcement names the action, not just the outcome.** A reader told
 * only that a stay was unsaved has been given no reason to go looking for a
 * button, so the undo would be reachable and undiscovered.
 *
 * **The container is not `accessible`, deliberately.** Marking it so collapses
 * it into one node and swallows the button inside it, which would announce the
 * undo and then make it unreachable — worse than silence.
 */
import { useEffect } from 'react';
import { AccessibilityInfo, Platform, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './text';
import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { useReducedMotion } from '@/motion';

/**
 * How long an undo stays reachable when it is being READ.
 *
 * Longer than a toast's 3.2s, which is a reading time for a line of text rather
 * than the span in which somebody realises they tapped the wrong row.
 */
export const UNDO_MS = 8000;

/**
 * How long it stays reachable when it is being HEARD. Both sessions arrived at
 * the same number from the same argument: a control nobody can reach in time is
 * the same as no control.
 */
export const UNDO_SCREEN_READER_MS = 12000;

/**
 * Whether this platform needs the sentence spoken explicitly.
 *
 * Exported and pure because it is the whole of the bug above, and because a
 * test cannot reach it through the component — the `Platform` a test imports
 * and the one the component imports are different objects under this jest
 * preset, so the decision is asserted here rather than nowhere.
 */
export function announcesExplicitly(os: string): boolean {
  return os !== 'android';
}

export interface UndoState {
  /** What happened, in a sentence, already translated. */
  text: string;
  onUndo: () => void;
}

export interface UndoBarProps {
  /** `null` renders nothing, so a caller can hold one nullable piece of state. */
  state: UndoState | null;
  /** Called when the window closes without the action being taken. */
  onDismiss: () => void;
  /** Overrides the action's label. Defaults to the catalogue's "Undo". */
  actionLabel?: string;
  /** What a screen reader hears on the action, when it is more than the label. */
  actionA11yLabel?: string;
  /** The glyph beside the sentence. Defaults to the undo arrow. */
  icon?: IconName;
}

export function UndoBar({
  state,
  onDismiss,
  actionLabel,
  actionA11yLabel,
  icon = 'rotateCcw',
}: UndoBarProps) {
  const { c, space, radius, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const reduced = useReducedMotion();

  const label = actionLabel ?? t('state.undo');
  const spoken = actionA11yLabel ?? label;

  /**
   * The dwell, chosen from whether anyone is listening.
   *
   * `isScreenReaderEnabled` is a promise, so the timer is armed after it
   * settles. If it rejects — the same class of environment where
   * `PressableScale` finds Haptics rejecting rather than no-oping — the sighted
   * dwell is used rather than no timer at all, because a bar that never
   * dismisses is worse than one that dismisses early.
   */
  useEffect(() => {
    if (!state) return;
    let cancelled = false;
    let id: ReturnType<typeof setTimeout> | undefined;

    const arm = (ms: number) => {
      if (!cancelled) id = setTimeout(onDismiss, ms);
    };

    void AccessibilityInfo.isScreenReaderEnabled()
      .then((on) => arm(on ? UNDO_SCREEN_READER_MS : UNDO_MS))
      .catch(() => arm(UNDO_MS));

    return () => {
      cancelled = true;
      if (id) clearTimeout(id);
    };
  }, [state, onDismiss]);

  // iOS only. Android hears the live region below and would otherwise hear the
  // sentence twice.
  useEffect(() => {
    if (!state || !announcesExplicitly(Platform.OS)) return;
    AccessibilityInfo.announceForAccessibility(`${state.text} ${spoken}`);
  }, [state, spoken]);

  if (!state) return null;

  return (
    <Animated.View
      entering={reduced ? FadeIn.duration(1) : SlideInDown.springify().damping(18)}
      exiting={FadeOut}
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: space[4],
        right: space[4],
        // Clear of the tab bar as well as the home indicator: this holds a
        // control, and a control under the bar is a control nobody can press.
        bottom: insets.bottom + 78,
      }}
    >
      <View
        // Android reads this when the bar appears; iOS is handled above. NOT
        // `accessible`: that would swallow the button.
        accessibilityLiveRegion="polite"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[2],
          paddingVertical: 8,
          paddingLeft: space[4],
          paddingRight: 8,
          minHeight: 56,
          borderRadius: radius.lg,
          backgroundColor: c.surface1,
          borderWidth: 1,
          borderColor: c.borderSubtle,
          ...shadow.lg,
        }}
      >
        <Icon name={icon} size={17} color={c.textMuted} />
        <Text size="sm" color="textBody" style={{ flex: 1, lineHeight: 19 }}>
          {state.text}
        </Text>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={spoken}
          haptic
          onPress={() => {
            state.onUndo();
            onDismiss();
          }}
          style={{
            minHeight: 44,
            paddingHorizontal: 14,
            justifyContent: 'center',
            borderRadius: radius.md,
          }}
        >
          <Text weight="semibold" size="sm" color="textLink">
            {label}
          </Text>
        </PressableScale>
      </View>
    </Animated.View>
  );
}
