/**
 * Frame R12's sheet · Pay rent — MTN MoMo, then Airtel Money.
 *
 * The order is not alphabetical and is not a preference: it is the order those
 * rails answer in. Frame R12 drew a card row last. It waits for the payment
 * gateway: a card will be typed into the gateway's own secure page, never into
 * this app, and until a gateway exists no card rail does (see
 * `screens/guest/book-format.ts`).
 *
 * **The demo's alone.** The rail behind this sheet is a client timer, not a
 * gateway, so `app/_layout.tsx` opens the route only when `usePlatform().isDemo`
 * says so, and every entry point (Rent's hero, lease detail's sticky bar) is
 * drawn on the same test (mobile audit 2026-10-05, TN-07). On the demo stack
 * the "mock adapter" wording below is true, which is why it stays.
 *
 * ## What gaps.md B2 changed here, and why it is not a screen change
 *
 * This sheet used to collect a method and settle: press, wait, done. That
 * models a card rail. **Neither Rwandan rail is one.** MTN answers through the
 * MoMo app or `*182*7*1#`, Airtel through `*500*4#`; in both cases the tenant
 * receives a prompt, **leaves this app, enters a PIN somewhere else, and the
 * result arrives asynchronously**. A sheet that ends at collection is a sheet
 * that has not modelled the thing it is doing.
 *
 * So it collects the HANDSET the prompt goes to — which it did not before, and
 * which is the one fact the tenant needs while they are somewhere else — and
 * hands the rest to `data/payment-attempt.ts`. That machine is shared with the
 * guest checkout, so the two cannot come to describe the same rail differently,
 * and the four states are drawn by one component.
 *
 * ## The period is frozen at the press
 *
 * The attempt token is keyed by the period being paid, and the period used to
 * be re-derived on every render from what was still owed. Paying it is exactly
 * what makes it stop being owed, so the moment the ledger recorded the payment
 * the token moved, the attempt read as nothing, and the confirmation and its
 * reference vanished about a third of a second after they appeared (TN-08).
 * The press now freezes the period, and with it the token, until the sheet
 * closes.
 *
 * ## The refusal, which is the most deliberate thing on this screen
 *
 * **Rent is the one write excluded from the offline queue.** Eight other
 * actions in this app survive being started with no signal; this does not, and
 * `data-seam.md` §5 gives the reason in a sentence: *"A queued payment is a
 * payment nobody consciously authorised at the moment it fires."* A tenant who
 * presses pay in a basement and walks away has not agreed to a charge that
 * lands twenty minutes later.
 *
 * So the sheet refuses, says why in those words, and **leaves the obligation
 * visible** — the amount stays on screen and the due date stays with it. A
 * refusal that also hid the debt would be a screen that made the problem go
 * away for the wrong person.
 *
 * ## Nothing moves
 *
 * FL28 §6 asks that mocked settlements be labelled, and ui-rules.md is stronger
 * — "a mocked success must never look like a real one". The sheet says so before
 * the button, `PaymentPrompt` repeats it on every state including the confirmed
 * one, the period is stamped `mock` by `applyRentPayment`, and every screen that
 * later draws that row inherits the stamp.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Button,
  EmptyState,
  ErrorState,
  formatMoney,
  Icon,
  InputField,
  MoneyAmount,
  PaymentPrompt,
  PressableScale,
  Sheet,
  SkeletonList,
  Text,
  todayIso,
  useOffline,
  useToast,
  WriteError,
  type IconName,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT, type MessageKey } from '@/i18n/i18n';
import { useSettleRent, useTenancy } from '@/data/tenancy-store';
import { nextDuePeriod, type PayMethod, type RentPeriod } from '@/data/rentals';
import { isSettled, usePaymentAttempt } from '@/data/payment-attempt';
import { useMyIdentity } from '@/queries/profile';
import { digitsOf, displayPhone, formatPhone, isComplete, isPlausible } from '../auth/phone';
import { formatFullDay } from './dates';

interface MethodRow {
  value: PayMethod;
  icon: IconName;
  label: MessageKey;
  meta: MessageKey;
  /** The rail's own prefixes, so a number on the wrong network says so. */
  prefixes: readonly string[];
  /** What the shared machine calls this rail — it decides the USSD fallback. */
  rail: string;
}

/** Frame R12's order, and the rails' own answer time. */
const METHODS: MethodRow[] = [
  {
    value: 'mtn_momo',
    icon: 'smartphone',
    label: 'payRent.mtn',
    meta: 'payRent.mtnMeta',
    prefixes: ['78', '79'],
    rail: 'momo',
  },
  {
    value: 'airtel_money',
    icon: 'smartphone',
    label: 'payRent.airtel',
    meta: 'payRent.airtelMeta',
    prefixes: ['72', '73'],
    rail: 'airtel',
  },
];

/** How the ledger write for a confirmed payment stands. */
type LedgerState = 'idle' | 'saving' | 'done' | 'error';

export function PayRent() {
  const { c, space, radius } = useTheme();
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const offline = useOffline();
  const identity = useMyIdentity();
  const { leaseId, month } = useLocalSearchParams<{ leaseId?: string; month?: string }>();

  const read = useTenancy(leaseId);
  const tenancy = read.data;
  const settle = useSettleRent();

  // MoMo is pre-selected rather than left blank: it is the rail nearly every
  // tenant uses, and a sheet whose primary action is disabled on open makes the
  // common case two taps to answer a question that has one obvious answer. The
  // choice is still visible and still changeable before anything happens.
  const [method, setMethod] = useState<PayMethod>('mtn_momo');
  const [handset, setHandset] = useState('');
  const [touched, setTouched] = useState(false);
  const methodPicked = useRef(false);

  /**
   * The handset starts as the number on the account, when the server has one
   * (mobile audit 2026-10-05, TN-28; `038-tenant-surface.md`).
   *
   * Only a server answer counts: the placeholder identity is nobody, and a
   * guessed number would send a prompt to a stranger. The rail follows the
   * number's own network, or an Airtel number would open on MoMo with the
   * button disabled and no error said, because an untouched field is never
   * red. Anything the person has typed or picked wins over all of this.
   */
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || touched || !identity.fromServer || !identity.phone) return;
    const digits = digitsOf(identity.phone);
    if (!isPlausible(digits)) return;
    prefilled.current = true;
    setHandset(digits);
    const network = METHODS.find((m) => m.prefixes.some((p) => digits.startsWith(p)));
    if (network && !methodPicked.current) setMethod(network.value);
  }, [identity.fromServer, identity.phone, touched]);

  const owed = tenancy
    ? (tenancy.history.find((p) => p.month === month && p.status !== 'paid') ??
      nextDuePeriod(tenancy))
    : undefined;

  /**
   * The period this sheet is paying, fixed at the press. See "The period is
   * frozen at the press" in the header: re-deriving it after the ledger wrote
   * the payment is what made the confirmation disappear (TN-08).
   */
  const [pressed, setPressed] = useState<RentPeriod | null>(null);
  const period = pressed ?? owed;

  const spec = METHODS.find((m) => m.value === method) ?? METHODS[0];

  /**
   * One token per attempt, keyed by what is being paid.
   *
   * ADR-020 D-c's rule, applied here: one press mints one token and every
   * re-check of that press reuses it, or a re-check becomes a second charge.
   * The lease and the month are in it because paying September and paying
   * October are two intents; the HANDSET is not, because correcting a typo in
   * the number is the same intent and re-minting there would charge twice.
   */
  const [nonce, setNonce] = useState(0);
  const tenancyId = tenancy?.id;
  const periodMonth = period?.month;
  const token = useMemo(
    () => (tenancyId && periodMonth ? `rent:${tenancyId}:${periodMonth}:${nonce}` : null),
    [tenancyId, periodMonth, nonce],
  );
  const { attempt, submit, checkAgain, dismiss } = usePaymentAttempt(token);

  const national = digitsOf(handset);
  const handsetError = useMemo((): MessageKey | null => {
    if (!touched || national === '') return null;
    if (!isComplete(national) || !isPlausible(national)) return 'payRent.handsetInvalid';
    if (!spec.prefixes.some((p) => national.startsWith(p))) return 'payRent.handsetWrongNetwork';
    return null;
  }, [touched, national, spec.prefixes]);

  const ready = isPlausible(national) && spec.prefixes.some((p) => national.startsWith(p));

  /**
   * Start the prompt.
   *
   * `settleAttempt` stands in for the rail's callback and is the ONLY caller of
   * `confirm` — this screen never reaches `confirmed` itself, which is
   * obligation 3. When the API lands it is replaced by a webhook read and
   * nothing here changes.
   */
  const pay = useCallback(() => {
    if (!tenancy || !period || !token || !ready) return;
    // Freeze what is being paid before anything can change it (TN-08). The
    // token derived from it is the one `submit` is about to use.
    setPressed(period);
    // Submit, and stop. What happens next is the rail's, and the screen has no
    // way to reach it — `confirm` and `settle` are not exported to a screen.
    submit({ handset: displayPhone(national), rail: spec.rail, amountRwf: period.amount });
  }, [tenancy, period, token, ready, submit, national, spec.rail]);

  /**
   * The ledger is written when — and only when — the rail confirms.
   *
   * An effect rather than a callback, because the confirmation may arrive while
   * the tenant is in the MoMo app and this component has been remounted since.
   * A `.then()` on the press would have been lost with the press.
   *
   * The toast follows the write's OUTCOME (mobile audit 2026-10-05, TN-12). It
   * used to fire on every settle, so a ledger that failed to record a payment
   * was announced as settled. A failure now says the payment went through and
   * was not recorded, keeps the reference on screen, and offers a retry.
   */
  const [ledger, setLedger] = useState<LedgerState>('idle');
  const record = useCallback(async () => {
    if (!tenancy || !period) return;
    setLedger('saving');
    const outcome = await settle.mutate({
      leaseId: tenancy.id,
      month: period.month,
      paidOn: todayIso(),
      method,
    });
    if (outcome === 'done') {
      setLedger('done');
      toast.show(t('payRent.toast', { month: period.month }), 'success');
    } else if (outcome === 'error') {
      setLedger('error');
    } else {
      // Dropped by a sign out mid flight: nothing was written and nobody is
      // left to tell.
      setLedger('idle');
    }
  }, [tenancy, period, settle.mutate, method, toast, t]);

  const settled = attempt?.state === 'confirmed';
  /** The token whose confirmation has been handed to the ledger, once. */
  const recordedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!settled || !token || recordedFor.current === token) return;
    recordedFor.current = token;
    void record();
  }, [settled, token, record]);

  /**
   * Forget a confirmed attempt once the sheet that showed it goes away, by
   * Done or by a swipe (TN-08: the journal never dropped one).
   *
   * Only once the ledger holds it. A confirmation whose ledger write failed is
   * kept, so reopening the sheet for the same month finds the confirmed attempt
   * and records it again rather than offering to take the money twice. An open
   * attempt is never forgotten here: the prompt outliving the sheet is the
   * whole point of the journal.
   */
  const forgetOnClose = useRef<{ dismiss: () => void; forget: boolean }>({
    dismiss,
    forget: false,
  });
  forgetOnClose.current = { dismiss, forget: settled && ledger === 'done' };
  useEffect(
    () => () => {
      if (forgetOnClose.current.forget) forgetOnClose.current.dismiss();
    },
    [],
  );

  const tryAgain = useCallback(() => {
    dismiss();
    // A fresh press is a NEW intent and therefore a new token. Reusing the old
    // one would ask the rail about the attempt the tenant has just been told
    // failed. The period is unfrozen with it, so the form shows what is owed
    // now.
    setPressed(null);
    setNonce((n) => n + 1);
  }, [dismiss]);

  // Leaving is the whole of Done. The attempt is forgotten as the sheet
  // unmounts, above, so the confirmation stays on screen through the close
  // rather than flashing back to the form for the length of the animation.
  const done = useCallback(() => router.back(), [router]);

  if (read.status === 'loading') {
    return (
      <Sheet title={t('payRent.title')} grabber>
        <SkeletonList rows={3} label={t('state.loading')} />
      </Sheet>
    );
  }

  // A read that failed might not fail next time, so it gets a retry. It used to
  // share a branch with a missing lease and read "Lease not found" over a body
  // about signing (TN-21).
  if (read.status === 'error') {
    return (
      <Sheet title={t('payRent.title')} grabber>
        <ErrorState
          title={t('state.errorTitle')}
          body={t('state.errorBody', { label: t('lease.listLabel') })}
          detail={read.error?.message}
          onRetry={read.retry}
        />
      </Sheet>
    );
  }

  // The read succeeded and there is no such lease: a stable fact, so no retry.
  if (!tenancy) {
    return (
      <Sheet title={t('payRent.title')} grabber>
        <EmptyState icon="alertCircle" title={t('lease.notFound')} body={t('leases.emptyBody')} />
      </Sheet>
    );
  }

  if (!period) {
    return (
      <Sheet title={t('payRent.title')} grabber>
        <EmptyState
          icon="checkCircle"
          title={t('payRent.nothingDueTitle')}
          body={t('payRent.nothingDueBody')}
        />
      </Sheet>
    );
  }

  const dueLine = period.dueOn
    ? t('rent.due', { date: formatFullDay(period.dueOn, t) })
    : period.month;

  /* ------------------------------------------------ the rail is answering */

  if (attempt) {
    return (
      <Sheet title={t('payRent.title')} grabber>
        <View style={{ gap: space[4] }}>
          <PaymentPrompt
            attempt={attempt}
            onCheckAgain={checkAgain}
            onTryAgain={tryAgain}
            onDone={isSettled(attempt) ? done : undefined}
            // "Not now" under a payment that has gone through read as though it
            // had not (TN-20).
            doneLabel="payRent.done"
          />
          {ledger === 'error' ? (
            <WriteError
              title="payRent.ledgerFailedTitle"
              body="payRent.ledgerFailedBody"
              onRetry={() => void record()}
            />
          ) : null}
          {/* The obligation stays visible under every state that is not a
              confirmation. A tenant looking at "not approved" still owes the
              rent, and a screen that dropped the amount at that moment would be
              hiding the thing they came to deal with. */}
          {!isSettled(attempt) ? <StillOwed amount={period.amount} month={period.month} /> : null}
        </View>
      </Sheet>
    );
  }

  /* -------------------------------------------------------- offline: refuse */

  if (offline) {
    return (
      <Sheet title={t('payRent.title')} grabber>
        <View style={{ gap: space[4] }}>
          <View
            accessible
            accessibilityRole="alert"
            style={{
              gap: space[2],
              padding: space[4],
              borderRadius: radius.lg,
              backgroundColor: c.warning100,
              borderWidth: 1,
              borderColor: c.warning500,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <Icon name="wifiOff" size={16} color={c.warning600} />
              <Text weight="semibold" size="sm" color="textStrong">
                {t('pay.offlineTitle')}
              </Text>
            </View>
            <Text size="sm" color="textBody">
              {t('pay.offlineBody')}
            </Text>
          </View>
          {/* Refusing is not the same as making the debt disappear. */}
          <StillOwed amount={period.amount} month={period.month} />
        </View>
      </Sheet>
    );
  }

  return (
    <Sheet
      title={t('payRent.title')}
      subtitle={t('payRent.subtitle', { month: period.month, unit: tenancy.unit })}
      grabber
      footer={
        <>
          <Button
            variant="primary"
            size="lg"
            block
            leadingIcon="wallet"
            disabled={!ready}
            onPress={pay}
          >
            {t('payRent.action')}
          </Button>
          <Button variant="ghost" size="md" block onPress={() => router.back()}>
            {t('payRent.cancel')}
          </Button>
        </>
      }
    >
      {/* What is being paid, before how. The label carries the amount and the
          due date: a wrapper's label replaces what is inside it, and "Amount,
          September 2026" alone never said how much (TN-17). */}
      <View
        accessible
        accessibilityLabel={[t('payRent.amount'), formatMoney(period.amount), dueLine].join(', ')}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: space[3],
          padding: space[4],
          borderRadius: radius.lg,
          backgroundColor: c.surface2,
        }}
      >
        <View style={{ gap: 2 }}>
          <Text size="xs" color="textMuted">
            {t('payRent.amount')}
          </Text>
          <Text weight="semibold" size="sm" color="textStrong">
            {dueLine}
          </Text>
        </View>
        <MoneyAmount value={period.amount} strong size="xl" />
      </View>

      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t('payRent.method')}
        style={{ gap: space[2] }}
      >
        <Text
          weight="bold"
          size="xs"
          color="textMuted"
          style={{ letterSpacing: 1, textTransform: 'uppercase' }}
        >
          {t('payRent.method')}
        </Text>

        {METHODS.map((row) => {
          const on = row.value === method;
          return (
            <PressableScale
              key={row.value}
              accessibilityRole="radio"
              accessibilityLabel={`${t(row.label)}, ${t(row.meta)}`}
              accessibilityState={{ selected: on }}
              onPress={() => {
                methodPicked.current = true;
                setMethod(row.value);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space[3],
                minHeight: 56,
                paddingHorizontal: space[4],
                paddingVertical: space[3],
                borderRadius: radius.lg,
                backgroundColor: on ? c.bgTint : c.surface1,
                borderWidth: on ? 1.5 : 1,
                borderColor: on ? c.borderBrand : c.borderDefault,
              }}
            >
              <Icon name={row.icon} size={20} color={on ? c.textLink : c.textMuted} />
              <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                <Text weight="semibold" size="md" color="textStrong">
                  {t(row.label)}
                </Text>
                <Text size="xs" color="textMuted" numberOfLines={1}>
                  {t(row.meta)}
                </Text>
              </View>
              {/* Never colour alone (design brief §7.5): the ring is the state,
                  the tint only reinforces it. */}
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  borderWidth: on ? 6.5 : 1.5,
                  borderColor: on ? c.action : c.borderStrong,
                }}
              />
            </PressableScale>
          );
        })}
      </View>

      {/* The handset the prompt goes to. New with B2: the sheet used to settle
          without ever asking WHERE the prompt should land, which is the one
          thing a tenant with two SIMs needs to know. An untouched field is
          never red — colouring an empty field on arrival is a form starting an
          argument with someone who has done nothing. */}
      <InputField
        label={t('payRent.handset')}
        value={formatPhone(national)}
        onChangeText={(next) => {
          setHandset(next);
          setTouched(true);
        }}
        placeholder={t('payRent.handsetPlaceholder')}
        prefix="+250"
        keyboardType="phone-pad"
        autoComplete="tel"
        maxLength={11}
        helper={handsetError ? undefined : t('payRent.handsetHelp')}
        error={handsetError ? t(handsetError, { network: t(spec.label) }) : undefined}
        testID="pay-rent-handset"
      />

      <View
        accessible
        accessibilityRole="alert"
        style={{
          gap: space[2],
          padding: space[4],
          borderRadius: radius.lg,
          backgroundColor: c.warning100,
          borderWidth: 1,
          borderColor: c.warning500,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <Icon name="alertTriangle" size={16} color={c.warning600} />
          <Text weight="semibold" size="sm" color="textStrong">
            {t('payRent.mockTitle')}
          </Text>
        </View>
        <Text size="sm" color="textBody">
          {t('payRent.mockBody')}
        </Text>
      </View>
    </Sheet>
  );
}

/** The debt, kept on screen through every state that is not a confirmation. */
function StillOwed({ amount, month }: { amount: number; month: string }) {
  const { c, space, radius } = useTheme();
  const t = useT();
  return (
    <View
      accessible
      // The amount is in the label, not only on the screen (TN-17).
      accessibilityLabel={[t('payRent.stillOwed'), formatMoney(amount), month].join(', ')}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: space[3],
        padding: space[4],
        borderRadius: radius.lg,
        backgroundColor: c.surface2,
      }}
    >
      <View style={{ gap: 2 }}>
        <Text size="xs" color="textMuted">
          {t('payRent.stillOwed')}
        </Text>
        <Text weight="semibold" size="sm" color="textStrong">
          {month}
        </Text>
      </View>
      <MoneyAmount value={amount} strong size="lg" />
    </View>
  );
}
