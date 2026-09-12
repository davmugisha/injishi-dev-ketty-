/**
 * 404 — Expo Router renders this for any path with no route behind it.
 *
 * The app ships 8 of the MVP's 13 routes, so a deep link written against the
 * design (`/book/:roomTypeId`, `/self-check-in/:bookingId`, `/(auth)/sign-in`)
 * lands here today. That is worth saying plainly rather than showing a blank
 * screen: `ui-screens.md` §6 asks for an error surface that is human-readable
 * and bilingual, and "it may never have shipped" is the honest half of it.
 */
import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, EmptyState } from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';

export default function NotFoundScreen() {
  const { c, space } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useT();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={{
          flex: 1,
          backgroundColor: c.bgApp,
          justifyContent: 'center',
          paddingHorizontal: space[4],
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        <EmptyState
          icon="search"
          title={t('state.notFoundTitle')}
          body={t('state.notFoundBody')}
          action={
            <Button variant="primary" size="lg" onPress={() => router.replace('/')}>
              {t('state.notFoundAction')}
            </Button>
          }
        />
      </View>
    </>
  );
}
