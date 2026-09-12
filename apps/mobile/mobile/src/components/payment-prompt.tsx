/**
 * PaymentPrompt — what the guest sees while their money is somewhere else.
 *
 * This is the UI half of `src/data/payment-attempt.ts`, and the two are
 * deliberately separate: the machine is testable without a screen, and this is
 * the only place its five non-idle states are drawn. Both money screens render
 * this one component, so `book/[roomTypeId]` and `pay-rent` cannot come to say
 * different things about the same rail.
 *
 * ## What it refuses to do
 *
 * **It is never a bare spinner.** `benchmarks.md` §4 is explicit: a spinner
 * models a synchronous rail, and neither Rwandan rail is one. The `prompting`
 * state names the handset the prompt went to, says the PIN is entered *there*,
 * gives the USSD fallback for that rail, and tells the guest they may leave the
 * app — because they are about to, and an app that looks like it will lose
 * their payment if they do is an app that makes them wait staring at it.
 *
 * **It never claims a result the rail has not given.** `unknown` says so and
 * offers to check again. It does not say "failed" and it does not say
 * "success", and it explicitly tells the guest not to pay twice, because that
 * is the mistake this screen exists to prevent.
 *
 * **Every terminal state carries its next action** as a real button, not as a
 * sentence about one. `ui-rules.md` bans a raw error, and an error the reader
 * cannot act on is the same defect wearing a nicer message.
 *
 * ## The reference
 *
 * On an asynchronous rail the transaction reference is the ONLY thing a person
 * can act on: it is what they read to an agent and what a support ticket is
 * about. `benchmarks.md` §4 takes this from M-Pesa, and it is why the reference
 * is the largest thing on the confirmed state, in tabular figures, with a copy
 * control beside it — not a line of body text under a tick.
 *
 * `adapter-chip` stays on every state while the adapter is mocked
 * ([ui-rules.md](../../../../injishi.context/dox/ui-rules.md)). A mocked success
 * must never look like a real one, and the state that most needs saying so is
 * the confirmed one.
 */
import { View } from 'react-native';
import { Text } from './text';
import { Icon, type IconName } from './icon';
import { Button } from './button';
import { Card } from './card';
import { AdapterChip } from './adapter-chip';
import { MoneyAmount } from './money-amount';
import { useTheme } from '@/theme/theme';
import { useT, type MessageKey } from '@/i18n/i18n';
import type { AttemptState, PaymentAttempt } from '@/data/payment-attempt';
import type { Palette } from '@/theme/tokens';

/** Per-state presentation. Kept as data so the five cannot drift apart. */
const LOOK: Record<
  Exclude<AttemptState, 'idle'>,
  { icon: IconName; tint: keyof Palette; ink: keyof Palette; title: MessageKey }
> = {
  prompting: { icon: 'smartphone', tint: 'warning100', ink: 'warning600', title: 'pay.checkYourPhone' },
  confirmed: { icon: 'checkCircle', tint: 'success100', ink: 'success600', title: 'pay.confirmedTitle' },
  unknown: { icon: 'clock', tint: 'warning100', ink: 'warning600', title: 'pay.stillConfirming' },
  refused: { icon: 'xCircle', tint: 'danger100', ink: 'danger600', title: 'pay.refusedTitle' },
  expired: { icon: 'clock', tint: 'danger100', ink: 'danger600', title: 'pay.expiredTitle' },
};

/** The USSD fallback belongs to the rail, not to the screen. */
const USSD: Record<string, MessageKey> = {
  momo: 'pay.ussdMomo',
  airtel: 'pay.ussdAirtel',
};

export interface PaymentPromptProps {
  attempt: PaymentAttempt;
  /** The guest asking the rail again. Only offered on `unknown`. */
  onCheckAgain: () => void;
  /** A fresh press, after a refusal or a timeout. Mints a NEW attempt token. */
  onTryAgain: () => void;
  /** Offered on `refused` only: the rail said no, so another rail may say yes. */
  onChangeMethod?: () => void;
  /** Called once the guest has seen a `confirmed` and moved on. */
  onDone?: () => void;
  /** The label on the continue button. The two screens go different places. */
  doneLabel?: MessageKey;
}

export function PaymentPrompt({
  attempt,
  onCheckAgain,
  onTryAgain,
  onChangeMethod,
  onDone,
  doneLabel = 'book.continue',
}: PaymentPromptProps) {
  const { c, space, radius } = useTheme();
  const t = useT();

  const state = attempt.state === 'idle' ? 'prompting' : attempt.state;
  const look = LOOK[state];
  const handset = attempt.handset || '—';

  return (
    <Card>
      <View
        style={{ gap: space[4] }}
        accessibilityLiveRegion="polite"
        accessibilityLabel={t('pay.a11yState', { state: t(look.title) })}
      >
        {/* ------------------------------------------------------ the state */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.pill,
              backgroundColor: c[look.tint],
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={look.icon} size={22} color={c[look.ink]} />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text family="display" weight="semibold" size="lg" color="textStrong">
              {t(look.title)}
            </Text>
            <MoneyAmount value={attempt.amountRwf} size="sm" strong />
          </View>
        </View>

        {/* ------------------------------------------------- what to do now */}
        {state === 'prompting' ? (
          <View style={{ gap: space[2] }}>
            <Text size="sm" color="textBody">
              {t('pay.checkYourPhoneBody', { handset })}
            </Text>
            {USSD[attempt.rail] ? (
              <Text size="sm" color="textMuted">
                {t(USSD[attempt.rail], { handset })}
              </Text>
            ) : null}
            {/* The guest is about to background the app. Saying so is what
                stops them waiting on this screen for a prompt that is already
                on their lock screen. */}
            <Text size="xs" color="textMuted">
              {t('pay.leavingNote')}
            </Text>
          </View>
        ) : null}

        {state === 'unknown' ? (
          <View style={{ gap: space[3] }}>
            <Text size="sm" color="textBody">
              {t('pay.unknownBody')}
            </Text>
            <Button variant="outline" onPress={onCheckAgain} leadingIcon="refreshCw">
              {t('pay.checkAgain')}
            </Button>
          </View>
        ) : null}

        {state === 'refused' || state === 'expired' ? (
          <View style={{ gap: space[3] }}>
            <Text size="sm" color="textBody">
              {attempt.reason ? t(attempt.reason, { handset }) : ''}
            </Text>
            {/* The next action, as a sentence AND as a button. A terminal state
                that only describes itself is the raw error ui-rules.md bans. */}
            <Text size="sm" color="textMuted">
              {t(
                state === 'expired'
                  ? 'pay.nextExpired'
                  : attempt.reason === 'pay.insufficientFunds'
                    ? 'pay.nextInsufficient'
                    : 'pay.nextRefused',
              )}
            </Text>
            <View style={{ gap: space[2] }}>
              <Button variant="primary" onPress={onTryAgain}>
                {t('pay.tryAgain')}
              </Button>
              {onChangeMethod ? (
                <Button variant="ghost" onPress={onChangeMethod}>
                  {t('book.howYouPay')}
                </Button>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* ------------------------------------------------- the deliverable */}
        {state === 'confirmed' && attempt.reference ? (
          <View style={{ gap: space[3] }}>
            <View
              style={{
                gap: 4,
                padding: space[4],
                borderRadius: radius.lg,
                backgroundColor: c.surface2,
              }}
            >
              <Text size="2xs" weight="semibold" color="textMuted" style={{ letterSpacing: 1 }}>
                {t('pay.reference').toUpperCase()}
              </Text>
              {/* The largest thing on the screen, in tabular figures. On an
                  async rail this is the only thing the guest can act on. */}
              <Text
                family="mono"
                weight="semibold"
                size="xl"
                color="textStrong"
                accessibilityLabel={attempt.reference.split('').join(' ')}
                selectable
              >
                {attempt.reference}
              </Text>
              <Text size="xs" color="textMuted">
                {t('pay.referenceHint')}
              </Text>
            </View>
            {onDone ? (
              <Button variant="primary" onPress={onDone}>
                {t(doneLabel)}
              </Button>
            ) : null}
          </View>
        ) : null}

        {/* A mocked success must never look like a real one, and the confirmed
            state is where that matters most. */}
        <AdapterChip label={t('pay.mockAdapter')} hint={t('pay.mockAdapterHint')} />
      </View>
    </Card>
  );
}
