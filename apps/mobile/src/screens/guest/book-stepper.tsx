/**
 * The booking stepper — Guest canvas artboards 5, 6 and 7, F-B05, FL07.
 *
 * Three steps, **one primary action each**, which is FL07 §9's own UX note and
 * the canvas's cross-cutting rule. The bar at the foot holds that action and
 * nothing else that commits; everything else on the screen is an escape or an
 * edit.
 *
 * ## The decisions worth knowing
 *
 * **It is keyed on the Room type, not the property.** The route is
 * `book/[roomTypeId]` because the Room type is what owns rate, capacity,
 * booking mode and cancellation tier (ui-glossary, F-B03). The property is
 * looked up FROM the room, never the other way round.
 *
 * **The dates are copied out of the search once, and are the stepper's own
 * afterwards.** `SEARCH_KEY` is what Explore and the Property detail page share,
 * and the CTA hands its dates over in the route params. From the moment this
 * screen opens they belong to the draft: editing dates inside a checkout should
 * not silently rewrite the Explore results waiting behind it. The canvas does
 * not settle this and it is listed as a decision in the report.
 *
 * **Going back a step is not going back a route.** The header's back button
 * walks the steps down to 1 and only then leaves the screen, which is what
 * makes "every step keeps its draft when you go back" true for the gesture a
 * guest actually makes. The draft is in the fixture store, so it survives the
 * route change too.
 *
 * **The attempt token is minted per press and re-minted per quote** (ADR-020
 * D-c, AC-12, AC-14). `book-draft.ts` owns the rule; this screen just asks for
 * the token belonging to the current quote and passes it to the write.
 *
 * **The sign-in gate is the shell's, not this screen's.** FL07 §4 step 4 puts
 * the gate immediately before confirm; in this app `app/_layout.tsx` already
 * sends an anonymous session to `(auth)/sign-in` before the tabs mount, so a
 * guest who reaches this route is authenticated. A second gate here would be a
 * check that can never fire, and ADR-020 AC-16's "lands back on the same quote"
 * is satisfied by the draft outliving the trip through sign-in.
 *
 * ## Mobile audit 2026-10-05, what this screen now refuses
 *
 *   - **No booking from a write that did not land.** The Trip is written after
 *     the rail confirms; if that write fails the screen says so and offers a
 *     retry, rather than routing to a confirmation of nothing (brief item 1).
 *   - **No hidden payment.** While a prompt is out (`isOpen`), back and the
 *     step's edits are locked and the attempt stays on screen even if the quote
 *     moved under it (GK-13).
 *   - **No spent draft.** A confirmed booking clears its draft, so the next
 *     booking of the same room starts from its own dates (GK-12).
 *   - **No silent money.** The bar's spoken label carries the amount, and a
 *     change of payment state is announced on iOS, where the prompt's live
 *     region does nothing (GK-18).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { billableGuests } from '@/data/search';
import { AccessibilityInfo, Platform, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAX_NIGHTS } from '@injishi/contracts';
import {
  Button,
  EmptyState,
  ErrorState,
  Icon,
  MoneyAmount,
  Skeleton,
  PaymentPrompt,
  Stepper,
  StickyBar,
  Text,
  WriteError,
  formatMoney,
  type DateRange,
  useOffline,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT, type MessageKey } from '@/i18n/i18n';
import { useFixture } from '@/data/use-fixture';
import { readFixture } from '@/data/use-fixture-mutation';
import { useBookingDraft } from '@/data/booking-draft';
import { DEFAULT_SEARCH, SEARCH_KEY, type GuestParty, type StaySearch } from '@/data/search';
import { getRoomType, getStayDetail, type RoomCard, type StayDetail } from '@/data/property-detail';
import {
  get as readAttempt,
  isOpen,
  isSettled,
  usePaymentAttempt,
  type AttemptState,
} from '@/data/payment-attempt';
import {
  EMPTY_BOOK_DRAFT,
  mintTrip,
  quoteSignature,
  useBookDraft,
  useCreateBooking,
  type BookDraft,
} from './book-draft';
import {
  STEP_GATES,
  quote,
  type PayMethod,
  type StepInput,
} from './book-format';
import { BookPrimaryAction } from './book-parts';
import { BookStepDates } from './book-step-dates';
import { BookStepSummary } from './book-step-summary';
import { BookStepPay } from './book-step-pay';

const STEP_TITLES: readonly MessageKey[] = ['book.step1', 'book.step2', 'book.step3'];
const STEP_SHORT: readonly MessageKey[] = ['book.stepShort1', 'book.stepShort2', 'book.stepShort3'];

/**
 * The payment state, as the words VoiceOver says when it changes. The same
 * titles `PaymentPrompt` draws; announced here because iOS ignores the
 * prompt's live region (GK-18).
 */
const ATTEMPT_SPOKEN: Record<Exclude<AttemptState, 'idle'>, MessageKey> = {
  prompting: 'pay.checkYourPhone',
  confirmed: 'pay.confirmedTitle',
  unknown: 'pay.stillConfirming',
  refused: 'pay.refusedTitle',
  expired: 'pay.expiredTitle',
};

export interface BookStepperScreenProps {
  roomTypeId: string | undefined;
  /** From the Property detail page's CTA. Seeds the draft on a cold open. */
  checkIn?: string;
  checkOut?: string;
  nonRefundable?: string;
}

export function BookStepperScreen({
  roomTypeId,
  checkIn,
  checkOut,
  nonRefundable,
}: BookStepperScreenProps) {
  const t = useT();
  const read = useFixture<RoomCard | undefined>(`room:${roomTypeId}`, () =>
    roomTypeId ? getRoomType(roomTypeId) : undefined,
  );

  if (!roomTypeId) return <NotBookable />;
  if (read.status === 'loading') return <BookSkeleton />;
  if (read.status === 'error') {
    return (
      <Framed>
        {/* No raw server text as the detail (GB-27). */}
        <ErrorState
          title={t('state.errorTitle')}
          body={t('state.errorBody', { label: t('book.bookingLabel') })}
          onRetry={read.retry}
        />
      </Framed>
    );
  }

  const room = read.data;
  const detail = room ? getStayDetail(room.stayId) : undefined;
  if (!room || !detail) return <NotBookable />;

  return (
    <Loaded
      room={room}
      detail={detail}
      seedCheckIn={checkIn}
      seedCheckOut={checkOut}
      seedNonRefundable={nonRefundable === '1'}
    />
  );
}

/**
 * The stepper with data.
 *
 * Split so every hook below is declared unconditionally: the loading, error and
 * not-bookable branches return before there is a draft, a quote or a timer.
 */
function Loaded({
  room,
  detail,
  seedCheckIn,
  seedCheckOut,
  seedNonRefundable,
}: {
  room: RoomCard;
  detail: StayDetail;
  seedCheckIn?: string;
  seedCheckOut?: string;
  seedNonRefundable: boolean;
}) {
  const { c, space } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const router = useRouter();

  const roomTypeId = room.summary.id;

  /* ------------------------------------------------------------ the draft */

  /**
   * The cold-open seed. The route params win, and the guest's committed search
   * stands in when the screen is reached without them — a deep link, or a
   * restored back stack.
   */
  const seed = useCallback((): BookDraft => {
    const search = readFixture<StaySearch>(SEARCH_KEY, DEFAULT_SEARCH);
    return {
      ...EMPTY_BOOK_DRAFT,
      dates: {
        start: seedCheckIn ?? search.dates.start,
        end: seedCheckOut ?? search.dates.end,
      },
      party: search.guests,
    };
  }, [seedCheckIn, seedCheckOut]);

  const { draft, patch, tokenForPress, clear } = useBookDraft(roomTypeId, seed);

  // The non-refundable switch belongs to Session 3's per-property draft, which
  // the policy sheet also writes. Reading it here rather than copying it is
  // what keeps the sheet and this screen from disagreeing.
  const { draft: propertyDraft, selectRoom, setNonRefundable } = useBookingDraft(detail.property.id);

  /**
   * Point the property draft at the room this route names.
   *
   * Without it a deep link into `book/[roomTypeId]` would leave the policy
   * sheet showing whichever room the Property detail page last selected, or
   * none. `selectRoom` clears the non-refundable flag by design — the rate is a
   * property of the room — so the seed from the route params is applied after
   * it, in that order.
   */
  useEffect(() => {
    if (propertyDraft.roomTypeId === roomTypeId) return;
    selectRoom(roomTypeId);
    if (seedNonRefundable && room.summary.nonrefundableEligible) setNonRefundable(true);
  }, [
    propertyDraft.roomTypeId,
    roomTypeId,
    room.summary.nonrefundableEligible,
    seedNonRefundable,
    selectRoom,
    setNonRefundable,
  ]);

  // AC-19: the option exists only where the room sells one, so a room that does
  // not can never be quoted at the discounted rate even if the flag is stale.
  const takesNonRefundable = propertyDraft.nonRefundable && room.summary.nonrefundableEligible;

  /* ------------------------------------------------------------ the quote */

  const money = useMemo(
    () =>
      quote({
        nightlyRateRwf: room.summary.nightlyRateRwf,
        dates: draft.dates,
        nonRefundable: takesNonRefundable,
        guests: billableGuests(draft.party),
      }),
    [room.summary.nightlyRateRwf, draft.dates, draft.party, takesNonRefundable],
  );

  const signature = quoteSignature({
    roomTypeId,
    dates: draft.dates,
    party: draft.party,
    nonRefundable: takesNonRefundable,
  });

  const input: StepInput = {
    dates: draft.dates,
    party: draft.party,
    sleeps: room.summary.capacity ?? 0,
    soldOut: room.remaining <= 0,
    acceptedRules: draft.acceptedRules,
    method: draft.method,
    handset: draft.handset,
  };

  const step = Math.min(Math.max(draft.step, 0), 2);

  /**
   * Offline blocks the PAYMENT and nothing before it.
   *
   * The canvas rule is that offline is a state and never blocks work, so steps
   * 1 and 2 carry on: choosing dates and reading a price are local. Step 3 is
   * not — ADR-020 D-a puts a provider call on that press, and a mock adapter
   * that answered it anyway would manufacture the one thing design brief §4.3
   * forbids, a mocked success that looks like a real one. This is also AC-17's
   * fifth state, `unreachable`, said in as many words.
   *
   * It is checked before the field gates because no amount of correcting a
   * handset will let the press through while the phone cannot reach anything.
   * `undefined` is not offline: both flags are undefined until the first read
   * lands, and treating that as offline would block the button on every cold
   * open.
   */
  const offline = useOffline();

  const blockedKey =
    step === 2 && offline ? 'book.blockedOffline' : STEP_GATES[step](input);

  /* ---------------------------------------------------------- the payment */

  const create = useCreateBooking();

  /**
   * The attempt this press belongs to (gaps.md B1).
   *
   * The checkout used to await 1.2 seconds and route to the confirmation. That
   * models a card rail, and **neither Rwandan rail is one**: the guest receives
   * a prompt, leaves this app to enter a PIN, and the result arrives by
   * callback — often not at all on the first ask. `benchmarks.md` §4 calls this
   * the highest-value finding in the mobile guide, and the state machine it
   * asks for lives in `data/payment-attempt.ts` and is shared with `pay-rent`.
   *
   * The token is `book-draft.ts`'s, unchanged: ADR-020 D-c's one-press-one-token
   * rule is the same rule the machine needs, and minting a second here would be
   * a second charge.
   */
  const quoted = draft.attemptToken && draft.tokenFor === signature ? draft.attemptToken : null;
  // An attempt still out with the rail stays on screen even when the quote has
  // moved under it, from the policy sheet or the property page. Looking it up
  // by the NEW quote alone made the prompt vanish while the old payment
  // settled unseen (mobile audit 2026-10-05, GK-13).
  const held =
    draft.attemptToken && isOpen(readAttempt(draft.attemptToken)) ? draft.attemptToken : null;
  const token = quoted ?? held;
  const { attempt, submit, checkAgain, dismiss } = usePaymentAttempt(token);
  const paying = attempt?.state === 'prompting';
  /** Out with the rail: back and the step's edits are locked until it answers. */
  const open = isOpen(attempt);

  /**
   * Say a change of payment state out loud on iOS. The prompt's live region
   * and its label sit on a plain `View`, which VoiceOver never announces, so a
   * guest using it heard neither "Payment confirmed" nor a decline (GK-18).
   * Android has the live region, and announcing there too would say it twice.
   */
  const attemptState = attempt?.state;
  useEffect(() => {
    if (Platform.OS !== 'ios' || !attemptState || attemptState === 'idle') return;
    AccessibilityInfo.announceForAccessibility(
      t('pay.a11yState', { state: t(ATTEMPT_SPOKEN[attemptState]) }),
    );
  }, [attemptState, t]);

  /**
   * The booking is minted when — and only when — the rail confirms.
   *
   * An effect rather than a `.then()` on the press, and that is the whole
   * point: the confirmation arrives while the guest is in the MoMo app, and
   * this component may have been remounted since. A booking written before the
   * money settled is a reservation nobody paid for; one written in a callback
   * that died with the press is a payment with no reservation.
   *
   * Nothing here decides the outcome. `confirm` and `settle` are not exported
   * to a screen — the rail runs inside `usePaymentAttempt`, which is what makes
   * obligation 3 structural rather than a convention somebody could forget.
   */
  const settled = attempt?.state === 'confirmed';
  const minted = useRef(false);
  /**
   * The Trip write after the money settled did not land. Its `bookingId` is
   * set only from a `done` outcome, so a failed write never routes to a
   * confirmation of a booking that does not exist; the screen says so and
   * offers the retry instead (brief item 1).
   */
  const [mintFailed, setMintFailed] = useState(false);
  const [mintRound, setMintRound] = useState(0);
  const writeTrip = create.mutate;
  useEffect(() => {
    if (!settled || minted.current || draft.bookingId || mintFailed) return;
    minted.current = true;
    let trip: ReturnType<typeof mintTrip>;
    try {
      trip = mintTrip({
        detail,
        room,
        dates: draft.dates,
        party: draft.party,
        nonRefundable: takesNonRefundable,
      });
    } catch {
      // AC-17: the checkout says WHICH failure happened. A booking that cannot
      // be minted after the money moved is the one case a guest must not be
      // left guessing about, so it surfaces rather than stalling.
      minted.current = false;
      setMintFailed(true);
      return;
    }
    void writeTrip(trip).then((outcome) => {
      if (outcome === 'done') {
        patch({ bookingId: trip.id });
        return;
      }
      minted.current = false;
      setMintFailed(true);
    });
  }, [
    settled,
    draft.bookingId,
    draft.dates,
    draft.party,
    writeTrip,
    detail,
    patch,
    room,
    takesNonRefundable,
    mintFailed,
    mintRound,
  ]);

  const retryMint = useCallback(() => {
    setMintFailed(false);
    setMintRound((n) => n + 1);
  }, []);

  const onPrimary = useCallback(() => {
    if (step < 2) {
      patch({ step: step + 1 });
      return;
    }
    if (!money || paying) return;

    // ADR-020 D-c: one press, one token, reused on every retry of THIS press.
    // `tokenForPress` stores it on the draft, which is where `token` above
    // reads it back from on the next render.
    tokenForPress(signature);
    submit({
      handset: `+250 ${draft.handset}`,
      rail: draft.method,
      amountRwf: money.grossRwf,
    });
  }, [draft.handset, draft.method, money, paying, patch, signature, step, submit, tokenForPress]);

  /** A fresh press after a refusal is a NEW intent, so it needs a new token. */
  const onTryAgain = useCallback(() => {
    dismiss();
    patch({ attemptToken: null, tokenFor: null });
  }, [dismiss, patch]);

  /**
   * The guest has seen the reference. Now they may go to the confirmation, and
   * the draft is spent: it is cleared, so the next booking of this room starts
   * from its own dates rather than reopening this one at "Confirm and pay"
   * (GK-12).
   */
  const onPaid = useCallback(() => {
    const bookingId = draft.bookingId;
    dismiss();
    if (!bookingId) return;
    router.replace({
      pathname: '/book/[roomTypeId]/confirmed',
      params: { roomTypeId, bookingId },
    });
    clear();
  }, [clear, dismiss, draft.bookingId, roomTypeId, router]);

  /* ------------------------------------------------------------- the back */

  const onBack = useCallback(() => {
    // Locked while a prompt is out: stepping back to change the quote is what
    // hid a live payment (GK-13).
    if (open) return;
    if (step > 0) patch({ step: step - 1 });
    else router.back();
  }, [open, patch, router, step]);

  /* ------------------------------------------------------------- the bar */

  // Step 1 is accommodation only, the figure its own card prints (rate x
  // guests x nights) and the label says; the fee joins on step 2. The bar used
  // to show the gross under "Accommodation so far", about 2.1 times the card
  // for the default party (GK-14).
  const barTotal = !money ? null : step === 0 ? money.accommodationRwf : money.grossRwf;
  const barLabel = step === 0 ? t('book.runningTotal') : t('book.totalLabel');
  const instant = room.summary.bookingMode === 'instant_book';

  const primaryLabel =
    step === 0
      ? t('book.continue')
      : step === 1
        ? t('book.continueToPay')
        : instant
          ? t('book.confirmAndPay')
          : t('book.requestAndPay');

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      {/* ----------------------------------------------------- the header */}
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: space[4], gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              step > 0 ? t('book.backToStep', { step: t(STEP_SHORT[step - 1]) }) : t('a11y.back')
            }
            accessibilityState={{ disabled: open }}
            disabled={open}
            hitSlop={3}
            onPress={onBack}
            testID="book-back"
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: c.surface1,
              borderWidth: 1,
              borderColor: c.borderDefault,
              opacity: open ? 0.45 : 1,
            }}
          >
            <Icon name="chevronLeft" size={22} color={c.textStrong} />
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text
              family="display"
              weight="semibold"
              size="xl"
              color="textStrong"
              numberOfLines={1}
              style={{ letterSpacing: -0.4 }}
            >
              {t(STEP_TITLES[step])}
            </Text>
          </View>
        </View>

        <Stepper steps={STEP_SHORT.map((key) => t(key))} current={step} />
      </View>

      {/* ------------------------------------------------------ the step */}
      <ScrollView
        contentContainerStyle={{
          padding: space[4],
          paddingTop: space[5],
          paddingBottom: insets.bottom + 190,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* The rail's answer, in place of the step it belongs to.
            This used to be one `ErrorState` behind a `failed` boolean, which
            could say only "it did not work". The machine has four answers and
            three of them are not failures — `prompting` (go and enter your PIN
            on that handset), `unknown` (we do not know yet, and do not pay
            again), and the two terminal refusals, each naming its own next
            action. A boolean cannot hold that, which is why B1 was a state
            machine rather than an error state. */}
        {attempt ? (
          <View style={{ marginBottom: space[4] }}>
            <PaymentPrompt
              attempt={attempt}
              onCheckAgain={checkAgain}
              onTryAgain={onTryAgain}
              onChangeMethod={() => {
                onTryAgain();
                patch({ step: 2 });
              }}
              onDone={isSettled(attempt) && draft.bookingId ? onPaid : undefined}
              doneLabel="book.continue"
            />
            {mintFailed ? (
              <View style={{ marginTop: space[3] }}>
                <WriteError
                  title="book.saveFailedTitle"
                  body="book.saveFailedBody"
                  onRetry={retryMint}
                />
              </View>
            ) : null}
          </View>
        ) : null}

        {step === 0 ? (
          <BookStepDates
            detail={detail}
            room={room}
            dates={draft.dates}
            party={draft.party}
            money={money}
            onDates={(dates: DateRange) => patch({ dates })}
            onParty={(party: GuestParty) => patch({ party })}
          />
        ) : null}

        {step === 1 && money ? (
          <BookStepSummary
            detail={detail}
            room={room}
            dates={draft.dates}
            party={draft.party}
            money={money}
            nonRefundable={takesNonRefundable}
            acceptedRules={draft.acceptedRules}
            onNonRefundable={setNonRefundable}
            onAcceptRules={(acceptedRules) => patch({ acceptedRules })}
            onOpenPolicy={() =>
              router.push({
                pathname: '/listing/[id]/policy',
                params: { id: detail.property.id },
              })
            }
          />
        ) : null}

        {step === 2 && money ? (
          <BookStepPay
            room={room}
            money={money}
            method={draft.method}
            handset={draft.handset}
            locked={open}
            onMethod={(method: PayMethod) => patch({ method })}
            onHandset={(handset) => patch({ handset })}
          />
        ) : null}
      </ScrollView>

      {/* -------------------------------------------------------- the bar */}
      <StickyBar>
        <View style={{ flex: 1, gap: 12 }}>
          {barTotal === null ? null : (
            <View
              accessible
              // The amount is IN the label. An accessible row is one element,
              // so a label of "Total" alone hid the price from a screen-reader
              // user right up to the payment (GK-18).
              accessibilityLabel={`${barLabel}, ${formatMoney(barTotal)}`}
              testID="book-bar-total"
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: space[3],
              }}
            >
              <Text size="xs" color="textMuted" numberOfLines={1} style={{ flexShrink: 1 }}>
                {barLabel}
              </Text>
              <MoneyAmount value={barTotal} strong tone="brand" size="lg" />
            </View>
          )}

          <BookPrimaryAction
            label={primaryLabel}
            busyLabel={t('book.paying')}
            busy={paying}
            // `{count}` is read only by the too-long reason; it is MAX_NIGHTS,
            // the contract's own number (GK-30).
            blockedReason={blockedKey ? t(blockedKey, { count: MAX_NIGHTS }) : null}
            onPress={() => void onPrimary()}
            testID="book-primary"
          />
        </View>
      </StickyBar>
    </View>
  );
}

/* ------------------------------------------------------------ the states */

function Framed({ children }: { children: React.ReactNode }) {
  const { c, space } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.bgApp,
        paddingTop: insets.top + 56,
        paddingHorizontal: space[4],
      }}
    >
      {children}
    </View>
  );
}

/**
 * A Room type that is not there, or a route with no id.
 *
 * A booking link outlives the listing it came from — shared in a message, kept
 * in a back stack, opened a season later — so this is a reachable state and not
 * a developer error, and it offers the way out rather than a dead end.
 */
function NotBookable() {
  const t = useT();
  const router = useRouter();
  return (
    <Framed>
      <EmptyState
        icon="calendar"
        title={t('book.notFoundTitle')}
        body={t('book.notFoundBody')}
        action={
          <Button variant="primary" onPress={() => router.replace('/')}>
            {t('book.notFoundAction')}
          </Button>
        }
      />
    </Framed>
  );
}

/**
 * The stepper while the room resolves.
 *
 * The step header is drawn for real rather than skeletoned: it is known before
 * the read lands, and greying out something that is not loading tells the
 * reader the wrong thing about what they are waiting for.
 */
function BookSkeleton() {
  const { c, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('state.loading')}
      style={{ flex: 1, backgroundColor: c.bgApp, paddingTop: insets.top + 8 }}
    >
      <View style={{ paddingHorizontal: space[4], gap: 12 }}>
        <Skeleton width="58%" height={26} />
        <Skeleton width="100%" height={22} radius={radius.sm} />
      </View>
      <View style={{ padding: space[4], paddingTop: space[5], gap: space[4] }}>
        <Skeleton width="100%" height={104} radius={radius.lg} />
        <Skeleton width="100%" height={280} radius={radius.lg} />
        <Skeleton width="100%" height={96} radius={radius.lg} />
      </View>
    </View>
  );
}
