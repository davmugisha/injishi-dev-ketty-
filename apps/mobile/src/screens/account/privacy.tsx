/**
 * Privacy — Account's row for what the app sends (ADR-063 AC-8).
 *
 * One switch today, **Send crash reports**, on by default. PostHog's analytics
 * switch joins it when feature 22 is specified, which is why the screen is
 * called Privacy rather than Crash reports.
 *
 * The switch is a choice about the PHONE, not the account: it lives in the
 * keychain under a key only `crash-reporter.ts` reads or writes, and sign out
 * and account deletion never touch it.
 *
 * What the line under the switch says is the point of the screen, because the
 * two directions take effect at different times and a person deserves to know
 * which one they are in:
 *
 *   - **Off** stops reports at once, and says a report already saved on the
 *     phone stays there unless reporting is turned back on.
 *   - **On** starts at the next launch. Sentry is only ever started before the
 *     first screen, so it cannot honestly claim to be running now.
 *   - **A failed save** says so, in the words for its direction. A failed
 *     "off" still leaves reporting off for this run: the reporter mutes itself
 *     before it tries to write.
 *   - **A build that does not report at all** (a development build, the web
 *     preview, a build with no DSN) says that instead of either effect.
 */
import { useState, useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { BackHeader, Card, Icon, PressableScale, Screen, Text } from '@/components';
import { useTheme } from '@/theme/theme';
import { useT, type MessageKey } from '@/i18n/i18n';
import {
  isCrashReportingPossible,
  isCrashReportingStarted,
  readCrashReportingChoice,
  setCrashReportingEnabled,
} from '@/lib/crash-reporter';

type Choice = 'on' | 'off';

/*
 * The choice, shared by this screen and the Account row that names it. Read
 * once, lazily, from the reporter; after that this module holds it, so the row
 * updates the moment the switch moves rather than on the next keychain read.
 */
let choice: Choice | null = null;
const listeners = new Set<() => void>();

function currentChoice(): Choice {
  if (choice === null) choice = readCrashReportingChoice();
  return choice;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function publish(next: Choice): void {
  choice = next;
  listeners.forEach((listener) => listener());
}

/** Forget the cached choice, so the next read goes to the keychain. For tests. */
export function resetCrashReportingChoice(): void {
  choice = null;
}

/** Whether crash reports are switched on, for the Account row and this screen. */
export function useCrashReportingChoice(): Choice {
  return useSyncExternalStore(subscribe, currentChoice, currentChoice);
}

/**
 * Move the switch. Off shows at once, because the reporter has already stopped
 * by the time the slow write starts; on shows only once it is saved.
 */
async function choose(on: boolean): Promise<'saved' | 'notSaved'> {
  if (!on) publish('off');
  const result = await setCrashReportingEnabled(on);
  if (on) publish(result === 'saved' ? 'on' : 'off');
  return result;
}

/** The line under the switch, from what this build can do and what just happened. */
function effectLine(on: boolean, failed: Choice | null): MessageKey | null {
  if (!isCrashReportingPossible()) return 'privacy.notReporting';
  if (failed === 'off') return 'privacy.saveFailed';
  if (failed === 'on') return 'privacy.saveFailedOn';
  if (!on) return 'privacy.offNow';
  return isCrashReportingStarted() ? null : 'privacy.onNextLaunch';
}

export function PrivacyScreen() {
  const { c, space, radius } = useTheme();
  const t = useT();
  const on = useCrashReportingChoice() === 'on';
  const [failed, setFailed] = useState<Choice | null>(null);
  const [saving, setSaving] = useState(false);
  const effect = effectLine(on, failed);

  const toggle = () => {
    const next = !on;
    setSaving(true);
    setFailed(null);
    void choose(next).then((result) => {
      setSaving(false);
      if (result === 'notSaved') setFailed(next ? 'on' : 'off');
    });
  };

  return (
    <>
      <BackHeader />
      <Screen title={t('privacy.title')}>
        <Card title={t('privacy.crashReports')} subtitle={t('privacy.crashReportsBody')}>
          <View style={{ gap: space[3] }}>
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
                  backgroundColor: on ? c.success100 : c.surface2,
                }}
              >
                <Icon name="lock" size={19} color={on ? c.success600 : c.textMuted} />
              </View>
              {/* The state carries a word, never the colour alone. */}
              <Text weight="medium" size="sm" color="textStrong" style={{ flex: 1 }}>
                {t(on ? 'account.privacyOn' : 'account.privacyOff')}
              </Text>
              <PressableScale
                testID="privacy-crash-switch"
                accessibilityRole="switch"
                accessibilityLabel={t('privacy.crashReports')}
                accessibilityState={{ checked: on, disabled: saving }}
                disabled={saving}
                haptic
                onPress={toggle}
                style={{
                  minHeight: 44,
                  paddingHorizontal: 16,
                  justifyContent: 'center',
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: on ? c.borderBrand : c.borderDefault,
                  backgroundColor: on ? c.actionSubtle : c.surface1,
                }}
              >
                <Text weight="semibold" size="sm" color={on ? 'textLink' : 'textBody'}>
                  {t(on ? 'security.turnOff' : 'security.turnOn')}
                </Text>
              </PressableScale>
            </View>

            {effect ? (
              <Text testID="privacy-effect" size="sm" color="textBody" accessibilityLiveRegion="polite">
                {t(effect)}
              </Text>
            ) : null}

            <Text size="xs" color="textMuted">
              {t('privacy.whereStored')}
            </Text>
          </View>
        </Card>
      </Screen>
    </>
  );
}
