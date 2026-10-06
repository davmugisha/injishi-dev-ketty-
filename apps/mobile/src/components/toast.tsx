/**
 * Toast — what a local fixture mutation says back.
 *
 * Motivated by the interactive twin, which toasts on every commit: "Room 205 is
 * clean — the front desk sees it live", "Recorded as paid — stamped mock, not
 * settled", "Reminder sent to Yves R. by SMS (mock)". Those sentences are the
 * product, not decoration: several of them are the only place the prototype
 * admits a write was mocked, and the canvas rule is that consequences are
 * printed rather than discovered later.
 *
 * Decisions the twin settles and this keeps:
 *
 *   - **One at a time.** A second `show()` replaces the first rather than
 *     stacking. A queue of toasts is a queue of things the user has stopped
 *     reading.
 *   - **3.2 seconds**, the twin's own timer.
 *   - **Above the tab bar**, so it never covers the control that caused it.
 *
 * It is a live region, so a screen reader announces it without stealing focus —
 * a toast that grabs focus interrupts whatever the reader was doing, and the
 * message is never worth that.
 *
 * Mounted once in `app/_layout.tsx` under the providers. A screen calls
 * `useToast().show(text, tone)`; nothing renders a toast itself.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AccessibilityInfo, Platform, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './text';
import { Icon, type IconName } from './icon';
import { usePinnedFooterHeight } from './pinned-footer';
import { useTheme } from '@/theme/theme';
import type { Palette } from '@/theme/tokens';
import { useT } from '@/i18n/i18n';
import { useReducedMotion, MOTION_MS } from '@/motion';

/** The twin's own dwell time. */
export const TOAST_MS = 3200;

export type ToastTone = 'neutral' | 'success' | 'warning' | 'danger';

const INK: Record<ToastTone, keyof Palette> = {
  neutral: 'textBody',
  success: 'success600',
  warning: 'warning600',
  danger: 'danger600',
};

const GLYPH: Record<ToastTone, IconName> = {
  neutral: 'info',
  success: 'checkCircle',
  warning: 'alertTriangle',
  danger: 'alertCircle',
};

interface ToastState {
  show: (text: string, tone?: ToastTone) => void;
  dismiss: () => void;
}

const ToastContext = createContext<ToastState | null>(null);

interface Current {
  text: string;
  tone: ToastTone;
  /** Bumped on every show so a repeat of the same text still re-animates. */
  seq: number;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Current | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const seq = useRef(0);

  const dismiss = useCallback(() => {
    clearTimeout(timer.current);
    setCurrent(null);
  }, []);

  const show = useCallback((text: string, tone: ToastTone = 'neutral') => {
    clearTimeout(timer.current);
    seq.current += 1;
    setCurrent({ text, tone, seq: seq.current });
    timer.current = setTimeout(() => setCurrent(null), TOAST_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const value = useMemo<ToastState>(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {current ? <ToastView key={current.seq} text={current.text} tone={current.tone} /> : null}
    </ToastContext.Provider>
  );
}

function ToastView({ text, tone }: { text: string; tone: ToastTone }) {
  const { c, space, radius, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const pinnedFooter = usePinnedFooterHeight();
  const t = useT();
  const reduced = useReducedMotion();
  const enter = useSharedValue(0);

  useEffect(() => {
    enter.set(withTiming(1, { duration: reduced ? 1 : MOTION_MS }));
  }, [enter, reduced]);

  /**
   * **Session 11's audit fix.** `accessibilityLiveRegion` is Android-only in
   * React Native, so every toast in the prototype was silent under VoiceOver:
   * the region announced on Android, the `alert` role was inert on iOS, and the
   * one place several screens admit a write was mocked was the one place a
   * VoiceOver reader never heard. Two sessions reported it against their own
   * undo bars (`components/undo-bar.tsx` carries the same split) and neither
   * could fix it from a caller.
   *
   * Guarded to iOS so Android does not hear the sentence twice, once from the
   * live region and once from here.
   */
  useEffect(() => {
    if (Platform.OS === 'android') return;
    AccessibilityInfo.announceForAccessibility(`${t('state.toastRegion')}: ${text}`);
  }, [text, t]);

  const animated = useAnimatedStyle(() => ({
    opacity: enter.get(),
    // Reduced motion keeps the fade and drops the rise.
    transform: [{ translateY: reduced ? 0 : (1 - enter.get()) * 12 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: space[4],
          right: space[4],
          // Clear of the tab bar and the home indicator, and of any action bar
          // the screen pins above them (`pinned-footer.ts`), so it never
          // covers, or hides behind, the control that caused it.
          bottom: Math.max(insets.bottom + 78, pinnedFooter + 12),
        },
        animated,
      ]}
    >
      <View
        // A live region announces without stealing focus. `polite` on purpose:
        // an assertive toast interrupts whatever the reader was reading, and a
        // confirmation is never worth that.
        accessible
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${t('state.toastRegion')}: ${text}`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingVertical: 13,
          paddingHorizontal: space[4],
          borderRadius: radius.lg,
          backgroundColor: c.surface1,
          borderWidth: 1,
          borderColor: c.borderSubtle,
          ...shadow.lg,
        }}
      >
        <Icon name={GLYPH[tone]} size={18} color={c[INK[tone]]} />
        <Text size="sm" color="textBody" style={{ flex: 1, lineHeight: 20 }}>
          {text}
        </Text>
      </View>
    </Animated.View>
  );
}

/**
 * Outside a provider this is a no-op rather than a throw. A toast is a
 * courtesy: a component rendered in isolation — a test, a Storybook-style
 * harness — should still render, not crash on the way to saying "saved".
 */
const NOOP: ToastState = { show: () => {}, dismiss: () => {} };

export function useToast(): ToastState {
  return useContext(ToastContext) ?? NOOP;
}
