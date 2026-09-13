/**
 * The emailed step-up (F-S02), ADR-038 child 0 task 10, AC-S7.
 *
 * ## Asked before you arrive, never after a refusal
 *
 * `WorkspaceGuard` on the API refuses an operator route when the session has
 * not passed the step-up. That refusal is correct and it is a terrible thing to
 * meet: you tap Rent roll, the screen loads, and then tells you no. So the app
 * reads `twoFactor` off the SAME `/me/workspaces` answer it learns its seats
 * from, and sends you here first.
 *
 * **The client never decides whether the step-up applies.** The server says
 * `{ required, verified }` and this screen asks for a code when it says so.
 * Deciding locally would be the app inventing an authorization rule, which is
 * exactly what ADR-012 AC-4 forbids.
 *
 * ## How long it lasts, which was established rather than invented
 *
 * For the life of the session. `two-factor.service.ts` returns
 * `verified: session.verifiedAt != null` and nothing expires it, so there is no
 * client-side expiry to model and inventing one would log people out of their
 * own operator screens on a timer the server does not keep.
 *
 * The wire shape is `{ required, verified }`. ADR-038's Value sourcing table
 * calls the second field `satisfied`; the controller calls it `verified`, and
 * the controller is what answers. The spec is owed that correction and its
 * Follow-up records it.
 *
 * ## The address is masked here, unlike verify
 *
 * `sentTo` arrives from the server already masked — `jo••••••@demo.injishi.com`
 * — and it stays that way. The person did not type it on this screen, so
 * masking hides something real: a shoulder-surfer on a shared operator handset
 * learns nothing. On the sign-in verify screen the opposite is true, because
 * the address was typed ten seconds earlier and masking would hide the typo
 * from the one person who can fix it.
 */
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Countdown, Icon, Text, useToast } from '@/components';
import { useTheme } from '@/theme/theme';
import { useT, type MessageKey } from '@/i18n/i18n';
import { api, unwrap } from '@/lib/api';
import { ENDPOINTS } from '@/lib/endpoints';
import { meKeys } from '@/lib/query-keys';
import { AuthCanvas } from './auth-canvas';
import { CodeInput, type CodeInputHandle } from './code-input';
import { RESEND_SECONDS } from './otp';

type Status = 'idle' | 'verifying' | 'error' | 'done';

interface TwoFactorStatus {
  required: boolean;
  verified: boolean;
  /** Already masked by the server. Never unmasked here. */
  sentTo: string;
}

export function StepUpScreen() {
  const { c, space } = useTheme();
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [code, setCode] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorKey, setErrorKey] = useState<MessageKey>('auth.codeWrong');
  const [refusal, setRefusal] = useState<string | null>(null);
  const [endsAt, setEndsAt] = useState(() => Date.now() + RESEND_SECONDS * 1000);
  const [canResend, setCanResend] = useState(false);
  const [round, setRound] = useState(0);
  /** The first code is sent once, on arrival, and not again on every render. */
  const sentOnce = useRef(false);

  const input = useRef<CodeInputHandle>(null);

  const { data } = useQuery({
    queryKey: meKeys.twoFactor(),
    queryFn: ({ signal }) => unwrap(api<TwoFactorStatus>(ENDPOINTS.meTwoFactor, { signal })),
    // The answer is about THIS session and changes only when this screen
    // changes it, so there is nothing to poll for.
    staleTime: Infinity,
  });

  const send = useMutation({
    mutationFn: () =>
      api<{ sentTo: string; expiresInSeconds: number }>(ENDPOINTS.meTwoFactorSend, {
        method: 'POST',
      }),
  });

  /**
   * Email a code on arrival.
   *
   * Somebody sent here did not ask for a code, so making them press a button to
   * receive one is a step that exists only because the screen was built that
   * way. The latch is a ref rather than a dependency list: a re-render after a
   * wrong code must not send a second code and invalidate the first.
   */
  useEffect(() => {
    if (sentOnce.current) return;
    sentOnce.current = true;
    send.mutate();
    // `send` is deliberately not a dependency: the mutation object is recreated
    // every render, and the `sentOnce` ref is what keeps this to one code. A
    // second code here would invalidate the first, which is the failure this
    // guard exists to prevent.
  }, []);

  const submit = async (value: string) => {
    setStatus('verifying');
    setRefusal(null);
    Keyboard.dismiss();

    const answer = await api<{ verified: true }>(ENDPOINTS.meTwoFactorVerify, {
      method: 'POST',
      body: { code: value },
    });

    if (answer.status === 'ok') {
      setStatus('done');
      // The seat list carries `twoFactor` too, so both have to be re-read
      // before the operator surface behind this screen will render. Invalidate
      // rather than write: the server is what says the session is stepped up.
      await queryClient.invalidateQueries({ queryKey: meKeys.twoFactor() });
      await queryClient.invalidateQueries({ queryKey: meKeys.workspaces() });
      toast.show(t('stepUp.done'), 'success');
      // Back to whatever sent you here. The screen is a gate, not a
      // destination, so it does not choose where you land.
      router.back();
      return;
    }

    if (answer.status === 'refused') {
      // 422 is a wrong code and the app has its own words for it. Anything else
      // is a refusal the app cannot phrase, so the server's own message shows.
      if (answer.httpStatus === 422) {
        setErrorKey('auth.codeWrong');
        setRefusal(null);
      } else {
        setRefusal(answer.message);
      }
    } else if (answer.status === 'unauthenticated') {
      // The session ended underneath us. `api.ts` has already cleared the token
      // and the shell is about to redirect, so there is nothing to say here.
      return;
    } else {
      setErrorKey('auth.sendFailedBody');
      setRefusal(null);
    }

    setStatus('error');
    input.current?.playError();
  };

  const resend = async () => {
    setCode('');
    setStatus('idle');
    setRefusal(null);
    setCanResend(false);

    const answer = await send.mutateAsync();

    if (answer.status === 'ok') {
      setEndsAt(Date.now() + RESEND_SECONDS * 1000);
      setRound((r) => r + 1);
      toast.show(t('auth.resendDone'), 'neutral');
      input.current?.focus();
      return;
    }

    // The control comes straight back rather than locking somebody out of the
    // only action on the screen, and the countdown does NOT restart, because no
    // new code is on its way.
    setCanResend(true);
    if (answer.status === 'refused' && /too many|rate limit|429/i.test(answer.message)) {
      setErrorKey('auth.resendTooSoon');
      setRefusal(null);
    } else if (answer.status === 'refused') {
      setRefusal(answer.message);
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
          {t('stepUp.title')}
        </Text>
        <Text size="md" color="textMuted">
          {/* Masked, and by the server. See the note at the top for why this
              screen differs from sign-in verify. */}
          {t('stepUp.body', { email: data?.sentTo ?? '' })}
        </Text>
      </View>

      <View style={{ marginTop: space[6] }}>
        <CodeInput
          ref={input}
          value={code}
          onChange={(next) => {
            setCode(next);
            if (status === 'error') setStatus('idle');
          }}
          onComplete={(value) => void submit(value)}
          error={status === 'error'}
          editable={status !== 'verifying' && status !== 'done'}
          label={t('auth.codeLabel')}
          hint={t('auth.codeHint')}
          autoFocus
          testID="step-up-code-field"
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
      </View>

      <View style={{ flexGrow: 1, minHeight: space[6] }} />

      {/* Why this screen exists at all, printed rather than left to be guessed.
          An operator asked for a second code with no explanation assumes
          something is wrong with their account. */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <Icon name="shield" size={14} color={c.textMuted} />
        <Text size="xs" color="textMuted" style={{ flex: 1 }}>
          {t('stepUp.why')}
        </Text>
      </View>
    </AuthCanvas>
  );
}
