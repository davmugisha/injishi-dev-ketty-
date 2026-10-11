/**
 * StickyBar — the pinned action bar at the foot of a detail screen.
 *
 * Both detail routes end in the same bar: a fact on the left, the primary
 * action on the right, over a hairline-topped surface. It reads its own theme
 * and safe-area inset so a caller cannot get the bottom padding wrong — that
 * padding is what keeps the action clear of the home indicator, and it was
 * duplicated by hand in every screen that grew one.
 *
 * It measures itself and declares its height (`pinned-footer.ts`), so a toast
 * fired from this screen rises above the bar rather than sliding in behind the
 * action that caused it.
 */
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/theme';
import { usePinnedFooter } from './pinned-footer';

export function StickyBar({ children }: { children: ReactNode }) {
  const { c, space } = useTheme();
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(0);
  usePinnedFooter(height);

  return (
    <View
      onLayout={(e) => setHeight(Math.ceil(e.nativeEvent.layout.height))}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: space[4],
        paddingTop: 14,
        paddingBottom: insets.bottom + 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: c.surface1,
        borderTopWidth: 1,
        borderTopColor: c.borderSubtle,
      }}
    >
      {children}
    </View>
  );
}
