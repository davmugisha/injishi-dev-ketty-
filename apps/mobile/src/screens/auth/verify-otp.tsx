/**
 * Verify code - frame X2, against the real API.
 *
 * ## One input, six boxes
 *
 * Frame X2's row lives in `code-input.tsx` now: the step-up screen needs the
 * same control (ADR-038 child 0 task 10) and two OTP rows in one app is how
 * they come to disagree about the paste case. The reasoning for the single
 * hidden field is there.
 *
 * ## The address is printed unmasked, and that is deliberate
 *
 * This screen shows the address the person typed ten seconds ago, exactly as
 * they typed it (AC-E5). The step-up screen masks its `sentTo` and is right to:
 * there the address was never typed, and masking hides something real. Here
 * masking would hide nothing from an attacker and would hide the TYPO from the
 * one person who can fix it.
 *
 * That is why the route param carries the trimmed but NOT lowercased string.
 * `requestSignInCode()` and `verifySignInCode()` lowercase what they send, and
 * `lower(email)` uniqueness in Postgres is what actually guarantees two
 * spellings reach one account.
 *
 * ## The error, and reduced motion
 *
 * A wrong code shakes. Under reduced motion it does not travel at all: the
 * boxes flash their danger tint instead, for the same duration. That is design
 * brief 7.6 exactly - reduced motion removes the travel, never the feedback -
 * and neither version is the ONLY signal, because the error sentence renders
 * under the row and is announced (7.5).
 *
 * ## What "verifying" verifies
 *
 * The server. `verifySignInCode()` posts to `/api/auth/sign-in/email-otp` and,
 * on success, stores the token from the `set-auth-token` response header in
 * `expo-secure-store`. A wrong code and an expired one are ONE answer from
 * Better Auth (401) and cannot be told apart, so the screen says both.
 */
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Countdown, Icon, Text, useToast } from '@/components';
import { useTheme } from '@/theme/theme';
import { useT, type MessageKey } from '@/i18n/i18n';
import { useSession } from '@/session';
import { requestSignInCode, verifySignInCode } from '@/lib/auth';
import { useDemoPersonas } from '@/queries/demo';
import { AuthCanvas } from './auth-canvas';
import { CodeInput, type CodeInputHandle } from './code-input';
import { trimEmail } from './email';
import { DEMO_CODE, RESEND_SECONDS } from './otp';

type Status = 'idle' | 'verifying' | 'error' | 'done';

export function VerifyOtpScreen() {
  const { c, space } = useTheme();
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const { signIn } = useSession();
  const { isDemoHost } = useDemoPersonas();

  const params = useLocalSearchParams<{ email?: string }>();
  const email = trimEmail(params.email ?? '');

  const [code, setCode] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  /**
   * What the error line says.
   *
   * A local key for the two refusals the app has its own words for — a wrong
   * or expired code, and a resend the server refused as too quick — and the
   * server's own string for anything else (AC-S8, AC-E13).
   */
  const [errorKey, setErrorKey] = useState<MessageKey>('auth.codeWrong');
  const [refusal, setRefusal] = useState<string | null>(null);
  const [endsAt, setEndsAt] = useState(() => Date.now() + RESEND_SECONDS * 1000);
  const [canResend, setCanResend] = useState(false);
  /** Bumped on every resend, so the countdown remounts and starts over. */
  const [round, setRound] = useState(0);
  /** The demo prefill runs once, and only on a demo host. */
  const prefilled = useRef(false);

  const input = useRef<CodeInputHandle>(null);

  /**
   * The deep link guard.
   *
   * Reached with NO address, which only a deep link can do: there is nothing to
   * verify against and nothing honest to draw, so it goes back to the screen
   * that collects one rather than rendering "We sent a code to ". An
   * IMPLAUSIBLE address goes straight through — the server is the authority on
   * whether an address is real, and refusing one here would be the client
   * deciding something it cannot know.
   */
  useEffect(() => {
    if (!email) router.replace('/(auth)/sign-in');
  }, [email, router]);

  const submit = async (value: string) => {
    setStatus('verifying');
    setRefusal(null);
    Keyboard.dismiss();

    const outcome = await verifySignInCode(email, value);

    if (outcome.status === 'ok') {
      setStatus('done');
      // The token is already in the keychain by the time this runs;
      // `signIn()` only tells the tree it is there.
      signIn();
      toast.show(t('auth.signedInToast', { email }), 'success');
      router.replace('/(tabs)');
      return;
    }

    if (outcome.status === 'refused') {
      // Better Auth answers 401 for a wrong code AND for an expired one, and
      // they cannot be told apart from here. The app's own sentence covers
      // both and offers the resend, which is the action either way.
      setErrorKey('auth.codeWrong');
      setRefusal(null);
    } else {
      // Reachability. Never shown as a refusal: the code may be perfectly
      // good and the person must not be told it is wrong.
      setErrorKey('auth.sendFailedBody');
      setRefusal(null);
    }

    setStatus('error');
    input.current?.playError();
  };

  const onChangeCode = (next: string) => {
    setCode(next);
    if (status === 'error') setStatus('idle');
  };

  /**
   * The demo host's second tap (AC-S10).
   *
   * The picker filled the address on the previous screen; this fills the code
   * the demo environment publishes and submits it, so "sign in as any persona
   * in two taps" is literally two taps. It runs ONCE — a `useRef` latch rather
   * than a dependency list, because a re-render after a failed verify must not
   * resubmit the same code forever.
   *
   * Off the demo host `isDemoHost` is false and nothing here happens at all.
   */
  useEffect(() => {
    if (!isDemoHost || prefilled.current || !email) return;
    prefilled.current = true;
    setCode(DEMO_CODE);
    void submit(DEMO_CODE);
    // `submit` is deliberately not a dependency. It is recreated every render,
    // so listing it would re-run this effect every render — and the `prefilled`
    // ref is what makes that harmless rather than a resubmit loop. The latch is
    // the guard; the dependency list is not.
  }, [isDemoHost, email]);

  /**
   * Ask for another code, and restart the countdown ONLY if it worked.
   *
   * A resend the server refused restarting the timer would tell the person a
   * new code is on its way when none is (AC-E6).
   */
  const resend = async () => {
    setCode('');
    setStatus('idle');
    setRefusal(null);
    setCanResend(false);

    const outcome = await requestSignInCode(email);

    if (outcome.status === 'ok') {
      setEndsAt(Date.now() + RESEND_SECONDS * 1000);
      setRound((r) => r + 1);
      toast.show(t('auth.resendDone'), 'neutral');
      input.current?.focus();
      return;
    }

    // It did not work, so the control comes straight back rather than locking
    // somebody out of the only action on the screen.
    setCanResend(true);
    if (outcome.status === 'refused' && /too many|rate limit|429/i.test(outcome.message)) {
      // The app's own words for a 429. Better Auth answers in English and
      // never publishes a cooldown, so there is nothing to read out of it.
      setErrorKey('auth.resendTooSoon');
      setRefusal(null);
    } else if (outcome.status === 'refused') {
      setRefusal(outcome.message);
    } else {
      setErrorKey('auth.sendFailedBody');
      setRefusal(null);
    }
    setStatus('error');
  };

  return (
    <AuthCanvas back>
      <View style={{ gap: space[3] }}>
        <Text
          accessibilityRole="header"
          family="display"
          weight="semibold"
          size="2xl"
          color="textStrong"
          style={{ letterSpacing: -0.4 }}
        >
          {t('auth.verifyTitle')}
        </Text>
        <Text size="md" color="textMuted">
          {/* Unmasked, and exactly as typed. See the note at the top. */}
          {t('auth.verifyBody', { email })}
        </Text>
      </View>

      <View style={{ marginTop: space[6] }}>
        <CodeInput
          ref={input}
          value={code}
          onChange={onChangeCode}
          onComplete={(value) => void submit(value)}
          error={status === 'error'}
          editable={status !== 'verifying' && status !== 'done'}
          label={t('auth.codeLabel')}
          hint={t('auth.codeHint')}
          autoFocus
          testID="code-field"
        />

        <View style={{ marginTop: space[3], minHeight: 22, justifyContent: 'center' }}>
          {status === 'error' ? (
            <View
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
              style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}
            >
              <Icon name="alertCircle" size={15} color={c.danger600} />
              <Text size="sm" color="danger600" style={{ flex: 1 }}>
                {/* The server's own message when the app has no words for the
                    refusal; its own words when it does. */}
                {refusal ?? t(errorKey)}
              </Text>
            </View>
          ) : status === 'verifying' || status === 'done' ? (
            <View
              accessibilityLiveRegion="polite"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <ActivityIndicator size="small" color={c.action} />
              <Text size="sm" color="textBody">
                {t('auth.verifying')}
              </Text>
            </View>
          ) : (
            <Text size="xs" color="textMuted">
              {t('auth.codeHint')}
            </Text>
          )}
        </View>
      </View>

      <View
        style={{
          marginTop: space[5],
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: space[3],
          minHeight: 44,
        }}
      >
        {canResend ? (
          <Button variant="secondary" size="md" leadingIcon="refreshCw" onPress={() => void resend()}>
            {t('auth.resend')}
          </Button>
        ) : (
          <Countdown
            key={round}
            endsAt={endsAt}
            label={t('auth.resend')}
            onDone={() => setCanResend(true)}
            render={(reading) => t('auth.resendIn', { time: reading })}
          />
        )}

        <Button variant="ghost" size="md" onPress={() => router.back()}>
          {t('auth.changeEmail')}
        </Button>
      </View>

      <View style={{ flexGrow: 1, minHeight: space[6] }} />

      <View style={{ gap: space[2] }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <Icon name="clock" size={14} color={c.textMuted} />
          <Text size="xs" color="textMuted" style={{ flex: 1 }}>
            {t('auth.rateLimit')}
          </Text>
        </View>
        {/* The code is printed ONLY where the API reports the demo environment
            (AC-E14). It used to be printed unconditionally, which on any real
            host is a screen telling somebody a code that will not work. */}
        {isDemoHost ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <Icon name="info" size={14} color={c.textMuted} />
            <Text size="xs" color="textMuted" style={{ flex: 1 }}>
              {t('auth.demoCode', { code: DEMO_CODE })}
            </Text>
          </View>
        ) : null}
      </View>
    </AuthCanvas>
  );
}
