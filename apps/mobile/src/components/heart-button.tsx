/**
 * HeartButton — save a stay. Motivated by the Guest canvas Explore and
 * ListingDetail artboards, where it sits on the photograph.
 *
 * Controlled: the `saved` prop is the truth and the caller owns it. An
 * uncontrolled heart that keeps its own state is a heart that disagrees with
 * the Saved tab the moment you navigate.
 *
 * The animation is the one place in this kit that is allowed a spring, and it
 * earns it under the gate: saving is occasional, not something done dozens of
 * times a session, and the purpose is state indication — the outline-to-filled
 * flip is the whole confirmation, because there is no other feedback on a tap
 * that saves. The overshoot is small (dampingRatio 0.6) and reduced motion
 * drops it to a straight fade, keeping the state change visible.
 *
 * The haptic fires only on SAVE, never on unsave. Adding is the moment worth
 * marking; removing is a correction, and buzzing at someone for undoing
 * something reads as a scold.
 *
 * **Session 11's motion pass put it on `PressableScale`.** The spring was
 * already right and already on the UI thread; what was missing was the press
 * itself. A 36pt control on a photograph that gives nothing back until the
 * finger LIFTS is the case press-in feedback exists for, and the heart is the
 * most-tapped control on Explore.
 */
import { Platform, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { useReducedMotion } from '@/motion';

export interface HeartButtonProps {
  saved: boolean;
  onToggle: (next: boolean) => void;
  /** `over` floats on a photograph; `bare` sits on a surface. */
  variant?: 'over' | 'bare';
  size?: number;
}

export function HeartButton({ saved, onToggle, variant = 'over', size = 20 }: HeartButtonProps) {
  const { c, radius, scrim, onPhoto } = useTheme();
  const t = useT();
  const reduced = useReducedMotion();
  const pop = useSharedValue(1);

  const animated = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));

  const toggle = () => {
    const next = !saved;
    if (next) {
      if (reduced) {
        pop.set(withTiming(1, { duration: 1 }));
      } else {
        pop.set(0.82);
        pop.set(withSpring(1, { duration: 420, dampingRatio: 0.6 }));
      }
      if (Platform.OS !== 'web') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    }
    onToggle(next);
  };

  const over = variant === 'over';
  const glyph = saved ? c.danger500 : over ? onPhoto : c.textBody;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={saved ? t('a11y.unsave') : t('a11y.save')}
      accessibilityState={{ selected: saved }}
      // Drawn at 36; hitSlop carries it to the 44pt floor (design brief §7.2).
      hitSlop={4}
      // The haptic is fired below, on SAVE only, so `PressableScale`'s own is
      // left off: two impacts on one tap read as a stutter, not as feedback.
      onPress={toggle}
    >
      <Animated.View
        style={[
          {
            width: 36,
            height: 36,
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: over ? scrim.caption[1] : c.surface2,
          },
          animated,
        ]}
      >
        {/* Feather has no filled heart, so the fill is a second glyph behind
            the outline at the same size — which is also what makes the two
            states differ by SHAPE and not by colour alone (design brief §7.5). */}
        {saved ? (
          <View style={{ position: 'absolute' }}>
            <Icon name="heart" size={size} color={c.danger500} />
          </View>
        ) : null}
        <Icon name="heart" size={size} color={glyph} />
      </Animated.View>
    </PressableScale>
  );
}
