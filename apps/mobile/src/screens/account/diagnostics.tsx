/**
 * Diagnostics — failures forced on purpose, to prove crash reporting on a real
 * build (ADR-063 AC-1 to AC-4, AC-7).
 *
 * Exists only in development builds and the two tester builds (`preview`,
 * `beta`): the Account row is absent elsewhere, the route sits behind
 * `Stack.Protected`, and the route file renders "not found" on its own as well,
 * so a production build cannot reach it even by a direct link.
 *
 * Every button tags what follows as `diagnostic` before it breaks anything, so
 * a test report never emails anyone. The JavaScript error carries canary text
 * (an email, a phone number, a file on the phone) that must arrive scrubbed:
 * that is the on device proof of AC-5.
 *
 * The freeze button arrives with its native module (Build plan task 10).
 */
import { useState } from 'react';
import { View } from 'react-native';
import { BackHeader, Button, Card, Screen } from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import {
  DiagnosticsTestRenderError,
  forceJsError,
  forceNativeCrash,
  markDiagnostic,
} from '@/lib/crash-reporter';

/** Throws while rendering, which is what the crash screen exists to catch. */
function BreakOnRender(): null {
  throw new DiagnosticsTestRenderError();
}

export function DiagnosticsScreen() {
  const t = useT();
  const { space } = useTheme();
  // Thrown from state, so the crash screen's Reload mounts a fresh tree with
  // this back at false, and the app recovers.
  const [broken, setBroken] = useState(false);

  return (
    <>
      <BackHeader />
      <Screen title={t('diagnostics.title')}>
        {broken ? <BreakOnRender /> : null}
        <Card subtitle={t('diagnostics.body')}>
          <View style={{ gap: space[3] }}>
            <Button testID="diagnostics-js-error" variant="outline" block onPress={forceJsError}>
              {t('diagnostics.jsError')}
            </Button>
            <Button
              testID="diagnostics-render-error"
              variant="outline"
              block
              onPress={() => {
                markDiagnostic();
                setBroken(true);
              }}
            >
              {t('diagnostics.renderError')}
            </Button>
            <Button testID="diagnostics-native-crash" variant="danger" block onPress={forceNativeCrash}>
              {t('diagnostics.nativeCrash')}
            </Button>
          </View>
        </Card>
      </Screen>
    </>
  );
}
