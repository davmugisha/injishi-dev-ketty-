/**
 * Sign out — the confirm behind Account's danger-outline row.
 *
 * All three Account frames draw the control and none of them draws what happens
 * when it is pressed. A confirm is the right answer for two reasons the frames
 * could not have shown:
 *
 *   - **It is the one control whose feedback is the app disappearing.** Every
 *     other destructive action in this app leaves the reader on a screen that
 *     says what changed; this one leaves them at sign-in with nothing to read.
 *   - **This account holds five seats.** Signing out is not leaving one
 *     workspace, it is leaving all of them, and somebody who meant to switch
 *     workspaces and hit the wrong row should be told that before it happens
 *     rather than after — which is why the sheet names the switcher as the
 *     thing they might have wanted.
 *
 * A quarter-height sheet, so the primary sits directly under the sentence and
 * there is no dead zone under it.
 *
 * `signOut()` flips the session flag; the redirect in `app/_layout.tsx`'s
 * `Shell` is what moves the reader, because a screen that navigated itself and
 * a shell that also redirects are two things racing to the same route.
 */
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Icon, Sheet, Text } from '@/components';
import { useTheme } from '@/theme/theme';
import { useDomain } from '@/domain';
import { useSession } from '@/session';
import { useT } from '@/i18n/i18n';
import { useMyIdentity } from '@/queries/profile';

export function SignOutSheet() {
  const { c, space, radius } = useTheme();
  const router = useRouter();
  const t = useT();
  const { signOut } = useSession();
  const { workspace, workspaces } = useDomain();

  // Whose session this ends, from `GET /api/v1/me/profile`. A confirmation
  // naming the wrong person is the one thing this sheet must not do — it is
  // the last screen before a destructive act, and the name is the whole of
  // what the reader checks before tapping.
  const me = useMyIdentity();

  /**
   * How many seats this signs you out of.
   *
   * The resolved list rather than the fixture (ADR-038 child 0 task 8), minus
   * the parked seats, which the switcher never offers and which a person would
   * not count among the ones they use.
   *
   * Never zero. Before the list resolves it is empty, and "signs you out of 0
   * workspaces" is both alarming and false: you are signed into at least the
   * seat you are standing in, which is what the fallback says.
   */
  const seats = workspaces.filter((w) => !w.parked).length || 1;

  return (
    <Sheet
      grabber
      title={t('signOut.title')}
      subtitle={t('signOut.subtitle', { name: me.name })}
      footer={
        <>
          <Button
            variant="danger"
            size="lg"
            block
            leadingIcon="logOut"
            onPress={() => {
              // Dismiss first, so the sheet is not still mounted over the
              // sign-in screen the shell is about to redirect to.
              router.back();
              signOut();
            }}
          >
            {t('signOut.confirm')}
          </Button>
          <Button variant="ghost" size="lg" block onPress={() => router.back()}>
            {t('signOut.cancel')}
          </Button>
        </>
      }
    >
      <View
        accessible
        accessibilityLabel={t('signOut.scope', { count: seats })}
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: space[3],
          padding: space[4],
          borderRadius: radius.lg,
          backgroundColor: c.warning100,
        }}
      >
        <Icon name="alertTriangle" size={17} color={c.warning600} />
        <Text size="sm" color="textBody" style={{ flex: 1, lineHeight: 20 }}>
          {t('signOut.scope', { count: seats })}
        </Text>
      </View>

      {/* What they might have meant instead. Offered as a sentence rather than
          a second button: two buttons of equal weight beside a destructive one
          is how a confirm stops reading as a question. */}
      <Text size="sm" color="textMuted" style={{ lineHeight: 19 }}>
        {t('signOut.switchInstead', { name: workspace.name })}
      </Text>
    </Sheet>
  );
}
