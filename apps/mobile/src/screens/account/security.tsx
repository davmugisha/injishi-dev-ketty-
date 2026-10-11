/**
 * Security — frames R5, R14 and B25's "Security · 2FA · On ›".
 *
 * The frames draw one row and F-S12 §6 says what is behind it: a 2FA toggle,
 * the active sessions, and "sign out everywhere". This screen draws what the
 * server can actually say, and no more.
 *
 * ## Two-step sign-in is a status, not a switch
 *
 * It reads `GET /api/v1/me/two-factor`, the route the step-up screen already
 * calls. The server has no on/off route: the emailed step-up applies to anyone
 * who holds a business or broker workspace, and a session started with an
 * emailed code has already passed it (`two-factor.service.ts`). So the screen
 * reports `{ required, verified }` and offers nothing to change. It used to
 * draw a toggle over a fixture seeded "on", which flipped the fixture and
 * toasted success while the account stayed exactly as it was (mobile audit
 * 2026-10-05, SA-06). Its copy also said "Your number alone signs you in";
 * sign in is a code sent by email.
 *
 * The state carries a word as well as the shield's tint, never colour alone.
 *
 * ## The devices list is not drawn
 *
 * It was invented ("iPhone 13 · Injishi", "Chrome · Windows"), and "Sign out"
 * and "Sign out everywhere else" only edited the invention before toasting that
 * the devices were signed out. A person acting on a stolen-session suspicion
 * was told it was handled. Nothing ended. Until the list is read from Better
 * Auth's own `list-sessions` (with `revoke-session` and
 * `revoke-other-sessions` behind its buttons), the screen says plainly that it
 * cannot list other devices.
 */
import { View } from 'react-native';
import {
  BackHeader,
  Badge,
  Card,
  ErrorState,
  Icon,
  OfflineNote,
  Screen,
  Skeleton,
  Text,
  useOffline,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { useTwoFactorState, type TwoFactorState } from './account-store';

export function SecurityScreen() {
  const t = useT();
  const offline = useOffline();
  const twoFactor = useTwoFactorState();

  return (
    <>
      <BackHeader />
      <Screen title={t('security.title')}>
        {offline ? <OfflineNote /> : null}

        {/* A failed refetch keeps the last answer on screen: it is still the
            last thing the server said. Only a read that never answered shows
            the error, and its retry asks again. */}
        {twoFactor.data ? (
          <TwoFactorCard state={twoFactor.data} />
        ) : twoFactor.isError ? (
          <ErrorState
            title={t('state.errorTitle')}
            body={t('state.errorBody', { label: t('security.label') })}
            onRetry={() => void twoFactor.refetch()}
          />
        ) : (
          <TwoFactorCard state={null} />
        )}

        <Text size="xs" color="textMuted" style={{ lineHeight: 18 }}>
          {t('security.devicesNote')}
        </Text>
      </Screen>
    </>
  );
}

/**
 * The step-up state as one sentence, or a skeleton while it is read.
 *
 * Three answers, each its own sentence: needed and passed (the ordinary case
 * for an operator signed in with an emailed code), needed and not passed (the
 * step-up screen is where that is resolved), and not needed (a guest or a
 * tenant, who holds no business or broker workspace).
 */
function TwoFactorCard({ state }: { state: TwoFactorState | null }) {
  const { c, space, radius } = useTheme();
  const t = useT();

  const word = state ? t(state.required ? 'security.on' : 'security.notNeeded') : null;
  const line = state
    ? t(
        !state.required
          ? 'security.statusNotNeeded'
          : state.verified
            ? 'security.statusPassed'
            : 'security.statusOwed',
      )
    : null;

  return (
    <Card title={t('security.twoFactorTitle')} subtitle={t('security.twoFactorBody')}>
      <View
        accessible
        accessibilityLabel={
          word && line
            ? `${t('security.twoFactorLabel')}, ${word}. ${line}`
            : `${t('security.twoFactorLabel')}, ${t('state.loading')}`
        }
        style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.md,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: state?.required ? c.success100 : c.surface2,
          }}
        >
          <Icon name="shield" size={19} color={state?.required ? c.success600 : c.textMuted} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text weight="medium" size="sm" color="textStrong">
            {t('security.twoFactorLabel')}
          </Text>
          {line ? (
            <Text size="xs" color="textMuted" style={{ lineHeight: 18 }}>
              {line}
            </Text>
          ) : (
            <Skeleton width="80%" height={12} />
          )}
        </View>
        {word ? <Badge tone={state?.required ? 'success' : 'neutral'}>{word}</Badge> : null}
      </View>
    </Card>
  );
}
