/**
 * 404 — Expo Router renders this for any path with no route behind it.
 *
 * A link to a path the app does not have lands here: an old link, a mistyped
 * one, or a route since retired. That is worth saying plainly rather than
 * showing a blank screen (`ui-screens.md` §6), in the reader's words rather
 * than the builder's: the copy used to say the screen "may never have
 * shipped", which is a sentence about the prototype (mobile audit 2026-10-05,
 * SA-31). A route that exists but is not open for this seat never reaches this
 * screen: its guard in `app/_layout.tsx` sends the reader home instead.
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
