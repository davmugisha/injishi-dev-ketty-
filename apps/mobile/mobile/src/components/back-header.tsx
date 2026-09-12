/**
 * BackHeader — floating circular back control for stacked detail screens,
 * matching the media-overlay back button in the source design.
 *
 * Two things Session 11's audit changed here:
 *
 *   - **The glyph goes through `Icon`.** It reached into `@expo/vector-icons`
 *     for a raw `Feather`, which is the one import the house rules name by
 *     name ("no React Native Text or Feather import in a screen"). It is a
 *     component rather than a screen so no lint rule caught it, and the result
 *     was the app's back arrow being the one glyph outside the icon map.
 *   - **It answers a press.** It is on every detail screen in the app and had
 *     no feedback at all.
 */
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';

export function BackHeader({ overlay = false }: { overlay?: boolean }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { c } = useTheme();
  const t = useT();

  return (
    <View style={{ position: 'absolute', top: insets.top + 8, left: 14, zIndex: 30 }}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('a11y.back')}
        // Drawn at 38; the floor is 44 (design brief 7.2).
        hitSlop={3}
        onPress={() => router.back()}
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          alignItems: 'center',
          justifyContent: 'center',
          // Over media the chip drops its hairline and floats on the photo;
          // it does NOT switch to a hardcoded white-on-indigo pair. `surface1`
          // and `foreground` already invert together, so the chip reads as a
          // light chip in the light scheme and a dark one in the dark scheme,
          // which is what a native overlay control does.
          backgroundColor: c.surface1,
          borderWidth: overlay ? 0 : 1,
          borderColor: c.borderDefault,
        }}
      >
        <Icon name="chevronLeft" size={22} color={c.textStrong} />
      </PressableScale>
    </View>
  );
}
