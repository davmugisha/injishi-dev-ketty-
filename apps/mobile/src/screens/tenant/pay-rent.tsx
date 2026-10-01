/**
 * Frame R12's sheet · Pay rent — MTN MoMo, then Airtel Money.
 *
 * The order is not alphabetical and is not a preference: it is the order those
 * rails answer in. Frame R12 drew a card row last; it is gone by the owner's
 * decision of 2026-10-01, because no card rail exists on the API and the app
 * takes no card details (see `screens/guest/book-format.ts`).
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
  type IconName,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT, type MessageKey } from '@/i18n/i18n';
import { useSettleRent, useTenancy } from '@/data/tenancy-store';
import { nextDuePeriod, type PayMethod } from '@/data/rentals';
import { isSettled, usePaymentAttempt } from '@/data/payment-attempt';
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

export function PayRent() {
  const { c, space, radius } = useTheme();
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const offline = useOffline();
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

  const period = tenancy
    ? (tenancy.history.find((p) => p.month === month && p.status !== 'paid') ??
      nextDuePeriod(tenancy))
    : undefined;

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
  const token = useMemo(
    () => (tenancy && period ? `rent:${tenancy.id}:${period.month}:${nonce}` : null),
    [tenancy, period, nonce],
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

  const saving = settle.status === 'saving';

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
   */
  const settled = attempt?.state === 'confirmed';
  const wrote = useRef(false);
  useEffect(() => {
    if (!settled || wrote.current || !tenancy || !period) return;
    wrote.current = true;
    void settle
      .mutate({ leaseId: tenancy.id, month: period.month, paidOn: todayIso(), method })
      .then(() => toast.show(t('payRent.toast', { month: period.month }), 'success'));
  }, [settled, tenancy, period, settle, method, toast, t]);

  const tryAgain = useCallback(() => {
    dismiss();
    // A fresh press is a NEW intent and therefore a new token. Reusing the old
    // one would ask the rail about the attempt the tenant has just been told
    // failed.
    setNonce((n) => n + 1);
  }, [dismiss]);

  const done = useCallback(() => {
    dismiss();
    router.back();
  }, [dismiss, router]);

  if (read.status === 'loading') {
    return (
      <Sheet title={t('payRent.title')} grabber>
        <SkeletonList rows={3} label={t('state.loading')} />
      </Sheet>
    );
  }

  if (read.status === 'error' || !tenancy) {
    return (
      <Sheet title={t('payRent.title')} grabber>
        <EmptyState
          icon="alertCircle"
          title={t('lease.notFound')}
          body={t('rent.noneBody')}
          action={
            <Button variant="outline" onPress={read.retry} leadingIcon="refreshCw">
              {t('state.retry')}
            </Button>
          }
        />
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
            doneLabel="payRent.cancel"
          />
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
            disabled={saving || !ready}
            onPress={pay}
          >
            {saving ? t('payRent.paying') : t('payRent.action')}
          </Button>
          <Button variant="ghost" size="md" block disabled={saving} onPress={() => router.back()}>
            {t('payRent.cancel')}
          </Button>
        </>
      }
    >
      {/* What is being paid, before how. */}
      <View
        accessible
        accessibilityLabel={`${t('payRent.amount')}, ${period.month}`}
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
            {period.dueOn ? t('rent.due', { date: formatFullDay(period.dueOn, t) }) : period.month}
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
              disabled={saving}
              onPress={() => setMethod(row.value)}
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
      accessibilityLabel={`${t('payRent.stillOwed')}, ${month}`}
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
