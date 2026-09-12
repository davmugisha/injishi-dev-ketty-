/**
 * Security — frames R5, R14 and B25's "Security · 2FA · On ›".
 *
 * The frames draw one row and F-S12 §6 says what is behind it: a 2FA toggle,
 * the active sessions, and "sign out everywhere". §9 names the case the whole
 * screen exists for — *a stolen session token, mitigated by sign-out-everywhere*
 * — and that is why the sessions list is the larger half rather than the
 * toggle.
 *
 * Three decisions worth knowing:
 *
 * **The current device cannot be revoked from the list.** Signing out the phone
 * in your hand from a row labelled "this device" is a control that reads as a
 * mistake even when it is not one, and `Sign out` on Account is where that
 * lives. `applySessionChange` enforces it rather than the row hiding it, so a
 * future caller cannot get it wrong.
 *
 * **An old session is marked, not alarmed.** An unused device is usually just
 * an unused device. What a person can actually spot is the one they do not
 * recognise, so the row carries the place and how long ago — the two facts that
 * make recognition possible — and a quiet marker past two weeks.
 *
 * **"Sign out everywhere" asks first.** It is the one control here whose effect
 * a person cannot see from this screen: every other device, including ones they
 * are not holding. A confirm that names the count is the difference between a
 * decision and a surprise.
 */
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';
import {
  BackHeader,
  Badge,
  Button,
  Card,
  ErrorState,
  Icon,
  ListRow,
  ModalSheet,
  OfflineNote,
  PressableScale,
  Screen,
  SkeletonList,
  Text,
  useOffline,
  useToast,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { useReducedMotion } from '@/motion';
import { todayIso } from '@/components';
import { isStaleSession, sessionMeta } from './account-format';
import { useSessionMutation, useSessions, useTwoFactor } from './account-store';

export function SecurityScreen() {
  const { c, space, radius } = useTheme();
  const t = useT();
  const toast = useToast();
  const offline = useOffline();
  const reduced = useReducedMotion();
  const today = todayIso();

  const { on: twoFactor, toggle } = useTwoFactor();
  const sessions = useSessions();
  const revoke = useSessionMutation();
  const [confirming, setConfirming] = useState(false);

  const rows = sessions.data ?? [];
  const others = rows.filter((s) => !s.current);
  const busy = revoke.status === 'saving' || toggle.status === 'saving';

  return (
    <>
      <BackHeader />
      <Screen title={t('security.title')}>
        {offline ? <OfflineNote /> : null}

        <Card title={t('security.twoFactorTitle')} subtitle={t('security.twoFactorBody')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: twoFactor ? c.success100 : c.surface2,
              }}
            >
              <Icon name="shield" size={19} color={twoFactor ? c.success600 : c.textMuted} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text weight="medium" size="sm" color="textStrong">
                {t('security.twoFactorLabel')}
              </Text>
              {/* The state carries a word, never the colour alone. */}
              <Text size="xs" color="textMuted">
                {t(twoFactor ? 'security.twoFactorOn' : 'security.twoFactorOff')}
              </Text>
            </View>
            <PressableScale
              accessibilityRole="switch"
              accessibilityLabel={t('security.twoFactorLabel')}
              accessibilityHint={t('security.twoFactorHint')}
              accessibilityState={{ checked: twoFactor }}
              disabled={busy}
              haptic
              onPress={() => {
                void toggle.mutate(!twoFactor).then(() =>
                  toast.show(
                    t(twoFactor ? 'security.twoFactorOffToast' : 'security.twoFactorOnToast'),
                    twoFactor ? 'warning' : 'success',
                  ),
                );
              }}
              style={{
                minHeight: 44,
                paddingHorizontal: 16,
                justifyContent: 'center',
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: twoFactor ? c.borderBrand : c.borderDefault,
                backgroundColor: twoFactor ? c.actionSubtle : c.surface1,
              }}
            >
              <Text weight="semibold" size="sm" color={twoFactor ? 'textLink' : 'textBody'}>
                {t(twoFactor ? 'security.turnOff' : 'security.turnOn')}
              </Text>
            </PressableScale>
          </View>
        </Card>

        {sessions.status === 'loading' ? (
          <SkeletonList rows={3} label={t('state.loadingList', { label: t('security.label') })} />
        ) : sessions.status === 'error' ? (
          <ErrorState
            title={t('state.errorTitle')}
            body={t('state.errorBody', { label: t('security.label') })}
            detail={sessions.error?.message}
            onRetry={sessions.retry}
          />
        ) : (
          <>
            <Card
              title={t('security.devicesTitle')}
              subtitle={t('security.devicesBody', { count: rows.length })}
              bodyStyle={{ paddingVertical: 2 }}
            >
              {/* Revoking removes a row, and "sign out everywhere else" removes
                  several at once. `LinearTransition` closes the gap they leave
                  so the rows below settle rather than jump; `FadeOut` is what
                  makes the removal legible as a removal. Both on the UI thread,
                  and both dropped under reduced motion — the row still goes,
                  it just does not travel (design brief §7.6). */}
              <Animated.View layout={reduced ? undefined : LinearTransition}>
                {rows.map((session, i) => {
                  const stale = isStaleSession(session, today);
                  return (
                    <Animated.View key={session.id} exiting={reduced ? undefined : FadeOut.duration(140)}>
                    <ListRow
                      icon={session.current ? 'smartphone' : 'globe'}
                      tone={stale ? 'warning600' : undefined}
                      title={session.label}
                      subtitle={sessionMeta(session, today, t)}
                      divider={i < rows.length - 1}
                      chevron={false}
                      accessibilityLabel={`${session.label}, ${sessionMeta(session, today, t)}${
                        session.current ? `, ${t('security.thisDevice')}` : ''
                      }${stale ? `, ${t('security.stale')}` : ''}`}
                      trailing={
                        session.current ? (
                          <Badge tone="brand" dot>
                            {t('security.thisDevice')}
                          </Badge>
                        ) : (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            {stale ? (
                              <Badge tone="warning" dot>
                                {t('security.stale')}
                              </Badge>
                            ) : null}
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              accessibilityLabel={t('security.revokeOne', {
                                device: session.label,
                              })}
                              onPress={() => {
                                void revoke
                                  .mutate({ kind: 'revoke', id: session.id })
                                  .then(() =>
                                    toast.show(
                                      t('security.revokedToast', { device: session.label }),
                                      'success',
                                    ),
                                  );
                              }}
                            >
                              {t('security.revoke')}
                            </Button>
                          </View>
                        )
                      }
                    />
                    </Animated.View>
                  );
                })}
              </Animated.View>
            </Card>

            <View style={{ gap: space[2] }}>
              <Button
                variant="danger"
                size="lg"
                block
                leadingIcon="logOut"
                disabled={others.length === 0 || busy}
                onPress={() => setConfirming(true)}
              >
                {t('security.revokeAll')}
              </Button>
              {/* The consequence, printed under the button rather than found
                  after it. Zero others is a state with its own sentence, not a
                  greyed button with no explanation. */}
              <Text size="xs" color="textMuted" style={{ lineHeight: 18 }}>
                {others.length === 0
                  ? t('security.revokeAllNone')
                  : t('security.revokeAllNote', { count: others.length })}
              </Text>
            </View>
          </>
        )}
      </Screen>

      <ModalSheet
        visible={confirming}
        onClose={() => setConfirming(false)}
        title={t('security.confirmTitle')}
        subtitle={t('security.confirmBody', { count: others.length })}
        footer={
          <>
            <Button
              variant="danger"
              size="lg"
              block
              disabled={busy}
              onPress={() => {
                setConfirming(false);
                void revoke
                  .mutate({ kind: 'revoke_others' })
                  .then(() =>
                    toast.show(
                      t('security.revokedAllToast', { count: others.length }),
                      'success',
                    ),
                  );
              }}
            >
              {t('security.confirmAction')}
            </Button>
            <Button variant="ghost" size="lg" block onPress={() => setConfirming(false)}>
              {t('security.confirmCancel')}
            </Button>
          </>
        }
      >
        <Text size="sm" color="textBody" style={{ lineHeight: 20 }}>
          {t('security.confirmDetail')}
        </Text>
      </ModalSheet>
    </>
  );
}
