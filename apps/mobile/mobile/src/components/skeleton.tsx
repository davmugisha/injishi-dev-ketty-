/**
 * Skeleton — the loading placeholder, and `SkeletonList` for a list of them.
 *
 * It pulses in **opacity only**. That is not a stylistic choice: a shimmer is a
 * gradient travelling across the block, and the design brief §7.6 says reduced
 * motion removes the travel and keeps the feedback. An opacity pulse is already
 * the feedback with the travel taken out, so under reduced motion it simply
 * holds still at its mid value and the block is still legibly a placeholder.
 *
 * The whole group is one accessibility node saying what is loading. A screen
 * reader announcing six anonymous grey rectangles is worse than silence.
 */
import { useEffect, useRef } from 'react';
import { Animated, View, type DimensionValue } from 'react-native';
import { useTheme } from '@/theme/theme';
import { useReducedMotion, MOTION_MS } from '@/motion';

export function Skeleton({
  width = '100%',
  height = 14,
  radius: r,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
}) {
  const { c, radius } = useTheme();
  const reduced = useReducedMotion();
  const pulse = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (reduced) {
      pulse.setValue(0.6);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: MOTION_MS * 2, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.6, duration: MOTION_MS * 2, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, pulse]);

  return (
    <Animated.View
      style={{
        width,
        height,
        borderRadius: r ?? radius.sm,
        backgroundColor: c.surface3,
        opacity: pulse,
      }}
    />
  );
}

/**
 * A stand-in for a list of cards. `rows` should match what the real list
 * usually holds, so the page does not jump height when the read lands.
 */
export function SkeletonList({ rows = 3, label }: { rows?: number; label: string }) {
  const { c, radius } = useTheme();

  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} style={{ gap: 16 }}>
      {Array.from({ length: rows }, (_, i) => (
        <View
          key={i}
          style={{
            gap: 12,
            padding: 18,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: c.borderSubtle,
            backgroundColor: c.surface1,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Skeleton width={44} height={44} radius={radius.md} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton width="62%" height={15} />
              <Skeleton width="40%" height={12} />
            </View>
          </View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: c.borderSubtle,
            }}
          >
            <Skeleton width={92} height={13} />
            <Skeleton width={68} height={13} />
          </View>
        </View>
      ))}
    </View>
  );
}
