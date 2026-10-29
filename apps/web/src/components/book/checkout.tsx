"use client";

import type {
  BookableRoom,
  BookingResult,
  PaymentAttemptStatus,
  RoomTypeSummary,
} from "@injishi/contracts";
import { ArrowLeft, CircleAlert, Smartphone } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AirtelMark, CardMark, MtnMark } from "@/components/icons/marks";
import {
  CheckoutBackLink,
  CheckoutConfirmed,
  CheckoutExpired,
  CheckoutLoadError,
  CheckoutLoading,
  CheckoutNotBookable,
  CheckoutRefusal,
  CheckoutUnreadable,
} from "@/components/book/checkout-outcome";
import { CheckoutStep } from "@/components/book/checkout-step";
import { PaymentPrompt } from "@/components/book/payment-prompt";
import { StepPaymentMethod } from "@/components/book/step-payment-method";
import { StepReview } from "@/components/book/step-review";
import { StepWhenToPay } from "@/components/book/step-when-to-pay";
import { ReservationSummary } from "@/components/book/reservation-summary";
import { createBooking, fetchBookableRoom } from "@/data/bookings";
import { apiResultMessage, type ApiResult } from "@/lib/api";
import { formatPrice } from "@injishi/utils";
import { mintAttemptToken } from "@/lib/attempt-token";
import { computeQuote } from "@/lib/booking";
import {
  describePaymentMethod,
  EMPTY_PAYMENT_DRAFT,
  toInstrument,
  type PaymentDraft,
} from "@/lib/payment-methods";
import { CHECKOUT_STEPS, stepState, type CheckoutStepId } from "@/lib/checkout-steps";
import {
  billableGuests,
  isExpired,
  parseBooking,
  propertyHref,
  todayInKigali,
} from "@/lib/search-params";
import { track } from "@/lib/analytics";
import { useSessionUser } from "@/lib/session";
import { fetchPlatform, paymentTerms, type PaymentTerms } from "@/data/platform";

/**
 * Checkout, rebuilt on the reference's three-step "Confirm and pay" shape and
 * kept on the real data `booking-review.tsx` already read correctly (ADR-020).
 *
 * Nothing about WHAT this screen refuses or WHY changed in this rewrite — the
 * zero-nights refusal, the past-check-in refusal, the capacity refusal, the
 * expired-quote redirect, the "not open for online booking" state and all
 * five `FailureReason`s are the exact same rules `booking-review.tsx` had.
 * What changed is HOW the payment step is answered: a method list ordered
 * MTN MoMo, then Airtel Money, then card (`lib/payment-methods.ts`), inside
 * three numbered sections instead of one flat form.
 */

type FailureReason = "sold-out" | "declined" | "pending" | "unreachable" | "other";

type Submission =
  | { state: "idle" }
  | { state: "sending" }
  /**
   * The money is on somebody’s phone (ADR-047 D-j).
   *
   * Not a failure and not a success. Every Rwandan mobile money payment
   * passes through here, so it is a first-class state rather than the 402
   * this screen used to show with "press confirm again" underneath it.
   */
  | { state: "prompting"; attempt: PaymentAttemptStatus }
  | { state: "done"; booking: BookingResult }
  | { state: "failed"; reason: FailureReason; message: string };

function failureReason(httpStatus: number): FailureReason {
  switch (httpStatus) {
    case 409:
      return "sold-out";
    case 402:
      return "pending";
    case 400:
      return "declined";
    case 503:
      return "unreachable";
    default:
      return "other";
  }
}

const METHOD_MARK = { mtn_momo: MtnMark, airtel_money: AirtelMark, card: CardMark } as const;

/*
 * What survives a trip through sign-in.
 *
 * A guest who presses "Confirm and pay" with an expired session is sent to
 * sign in and brought back to this quote. They used to come back to an empty
 * form, having typed a number they now have to type again, at the exact moment
 * they had decided to pay. So the choices are kept for the round trip: the rate,
 * the method, and a mobile money number. A CARD is never kept — its number and
 * security code do not go into storage for any reason — and the page says so
 * rather than silently asking for it twice.
 */
type CarriedDraft = { nonRefundable: boolean; method: PaymentDraft["method"]; phone: string };

const carriedKey = (here: string) => `injishi.checkout:${here}`;

function carryDraft(here: string, value: CarriedDraft) {
  try {
    sessionStorage.setItem(carriedKey(here), JSON.stringify(value));
  } catch {
    // Storage refused (private mode, quota). The trip still works; only the
    // convenience is lost.
  }
}

function takeCarriedDraft(here: string): CarriedDraft | null {
  try {
    const raw = sessionStorage.getItem(carriedKey(here));
    if (!raw) return null;
    sessionStorage.removeItem(carriedKey(here));
    const v = JSON.parse(raw) as Partial<CarriedDraft>;
    if (v.method !== "mtn_momo" && v.method !== "airtel_money" && v.method !== "card") return null;
    return { nonRefundable: v.nonRefundable === true, method: v.method, phone: typeof v.phone === "string" ? v.phone : "" };
  } catch {
    return null;
  }
}

export function Checkout() {
  const params = useSearchParams();
  const session = useSessionUser();

  const selection = useMemo(() => parseBooking(params), [params]);

  const [room, setRoom] = useState<ApiResult<BookableRoom> | null>(null);
  const [nonRefundable, setNonRefundable] = useState(() => selection?.nonRefundable ?? false);
  const [draft, setDraft] = useState<PaymentDraft>(EMPTY_PAYMENT_DRAFT);
  /** The bank's rules (073-gtbank-payments AC-23, AC-24), read once from `/platform`. */
  const [terms, setTerms] = useState<PaymentTerms | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetchPlatform().then((p) => {
      if (!cancelled) setTerms(paymentTerms(p));
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const [completed, setCompleted] = useState<ReadonlySet<CheckoutStepId>>(new Set());
  const [submission, setSubmission] = useState<Submission>({ state: "idle" });
  /** Set when this visit picked up choices carried through sign-in. */
  const [welcomeBack, setWelcomeBack] = useState<"kept" | "card" | null>(null);

  const roomTypeId = selection?.roomTypeId ?? null;

  const attemptToken = useRef<string | null>(null);

  // Coming back from sign-in: restore what was carried, and walk the guest to
  // the step they were on. A mobile money number was already validated before
  // they could press confirm, so that step is done; a card has to be re-entered.
  useEffect(() => {
    const carried = takeCarriedDraft(`${window.location.pathname}${window.location.search}`);
    if (!carried) return;
    setNonRefundable(carried.nonRefundable);
    setDraft({ ...EMPTY_PAYMENT_DRAFT, method: carried.method, phone: carried.phone });
    setCompleted(new Set<CheckoutStepId>(carried.method === "card" ? ["when"] : ["when", "method"]));
    setWelcomeBack(carried.method === "card" ? "card" : "kept");
  }, []);

  useEffect(() => {
    if (!roomTypeId) {
      setRoom(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const result = await fetchBookableRoom(roomTypeId);
      if (!cancelled) setRoom(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [roomTypeId]);

  const roomType: RoomTypeSummary | null = room?.status === "ok" ? room.data.roomType : null;
  const property = room?.status === "ok" ? room.data.property : null;

  /*
   * One source for the rate, and it is the server's.
   *
   * There used to be a fallback here — `roomType?.nightlyRateRwf ??
   * property?.nightlyRateRwf` — where the second half was the FIXTURE's price.
   * So a room the API had not answered for yet, or had priced differently, was
   * quoted at whatever a hand-maintained file said, and the guest read a number
   * that had never been near the thing that charges them. A quote with two
   * possible sources is a quote that eventually disagrees with the charge.
   *
   * Now: no room type, no price, and the screen says so.
   */
  const nightlyRateRwf = roomType?.nightlyRateRwf ?? null;

  const quote = useMemo(() => {
    if (!selection || nightlyRateRwf === null) return null;
    return computeQuote({
      nightlyRateRwf,
      nights: selection.nights,
      guests: billableGuests(selection.intent.guests),
      nonRefundable,
      priceBasis: roomType?.priceBasis,
    });
  }, [selection, nightlyRateRwf, nonRefundable, roomType?.priceBasis]);

  // A changed quote is a different booking, so it gets a different attempt
  // token (ADR-020 AC-12) — same dependency list `booking-review.tsx` used.
  useEffect(() => {
    attemptToken.current = null;
  }, [
    roomTypeId,
    selection?.intent.checkIn,
    selection?.intent.checkOut,
    selection?.intent.guests,
    nonRefundable,
    // A different INSTRUMENT is a different press (ADR-047). Without these two,
    // a guest whose MTN payment was declined and who switches to Airtel would
    // send the same idempotency key, and the provider would replay the decline
    // for an account they are no longer paying from. The server's attempt
    // fingerprint covers the same ground for a client that forgets.
    draft.method,
    draft.phone,
  ]);

  // Changing an earlier answer invalidates every step after it: a guest who
  // reopens "when to pay" after picking a card has not yet re-confirmed that
  // card for the new total.
  const reopenFrom = useCallback((id: CheckoutStepId) => {
    const from = CHECKOUT_STEPS.findIndex((step) => step.id === id);
    setCompleted((prev) => {
      const next = new Set(prev);
      for (const step of CHECKOUT_STEPS.slice(from)) next.delete(step.id);
      return next;
    });
  }, []);

  const markDone = useCallback((id: CheckoutStepId) => {
    setCompleted((prev) => new Set(prev).add(id));
  }, []);

  const submit = useCallback(async () => {
    if (!selection || !roomTypeId) return;

    /*
     * No instrument, no request (ADR-047).
     *
     * `toInstrument` returns null when the chosen rail cannot charge or the
     * handset is not yet a whole number. Sending anyway would be a booking
     * nobody can be charged for, and the server would refuse it — so the
     * refusal is worded here, where the guest can act on it, rather than
     * bounced back as a validation error about a field they can see.
     */
    const instrument = toInstrument(draft);
    if (!instrument) {
      setSubmission({
        state: "failed",
        reason: "declined",
        message:
          "We still need a mobile money number to charge. Open step 2 and check it.",
      });
      return;
    }

    attemptToken.current ??= mintAttemptToken();

    setSubmission({ state: "sending" });
    const result = await createBooking({
      roomTypeId,
      checkIn: selection.intent.checkIn,
      checkOut: selection.intent.checkOut,
      guests: billableGuests(selection.intent.guests),
      nonRefundable,
      attemptToken: attemptToken.current,
      instrument,
    });

    if (result.status === "ok") {
      // Counted once per accepted request, whatever happens to the payment
      // after it; no amount and nothing about the guest goes with it.
      track("Booking Requested", { outcome: result.data.status });
      if (result.data.status === "awaiting_payment") {
        // The prompt is live on the guest’s handset. The token stays put:
        // it is how the waiting screen finds this attempt, and how a retry
        // reaches the same charge rather than starting a second one.
        setSubmission({ state: "prompting", attempt: result.data.attempt });
        return;
      }
      attemptToken.current = null;
      setSubmission({ state: "done", booking: result.data.booking });
      return;
    }

    if (result.status === "unauthenticated") {
      const here = `${window.location.pathname}${window.location.search}`;
      carryDraft(here, { nonRefundable, method: draft.method, phone: draft.phone });
      window.location.assign(`/sign-in?redirect=${encodeURIComponent(here)}`);
      return;
    }

    setSubmission({
      state: "failed",
      reason: result.status === "refused" ? failureReason(result.httpStatus) : "unreachable",
      message: apiResultMessage(result),
    });
  }, [selection, roomTypeId, nonRefundable, draft]);

  // --- The link itself is not a booking ------------------------------------

  if (!selection) {
    return <SingleColumn><CheckoutUnreadable /></SingleColumn>;
  }

  const guests = billableGuests(selection.intent.guests);

  /*
   * The property, for the screens that render BEFORE the room has loaded.
   *
   * These used to read a fixture, which is why the whole page refused to render
   * for any property without a hand-written row in `data/properties.ts`.
   * Everything they actually need is the slug the guest arrived on, which is in
   * the URL, and a name — the API's once it answers, and a neutral phrase until
   * then. No lookup, and nothing to ship to the browser.
   */
  const backTo = {
    slug: selection.propertySlug,
    name: property?.name ?? "this stay",
  };

  if (isExpired(selection.intent)) {
    return (
      <SingleColumn>
        <CheckoutExpired
          property={backTo}
          checkIn={selection.intent.checkIn}
          intentWithoutDates={{ ...selection.intent, checkIn: null, checkOut: null }}
        />
      </SingleColumn>
    );
  }

  // --- Refusals, in the server's own wording (ADR-014 AC-8) ----------------

  if (selection.nights <= 0) {
    return (
      <SingleColumn>
        <CheckoutRefusal property={backTo} reason="Check-out must be after check-in." />
      </SingleColumn>
    );
  }

  if (selection.intent.checkIn < todayInKigali()) {
    return (
      <SingleColumn>
        <CheckoutRefusal property={backTo} reason="Check-in cannot be in the past." />
      </SingleColumn>
    );
  }

  // --- Confirmed -----------------------------------------------------------

  if (submission.state === "done") {
    return (
      <SingleColumn>
        <CheckoutConfirmed booking={submission.booking} />
      </SingleColumn>
    );
  }

  // --- The money is on their phone ----------------------------------------
  if (submission.state === "prompting") {
    return (
      <SingleColumn>
        <PaymentPrompt
          attempt={submission.attempt}
          onSettled={(settled) => {
            attemptToken.current = null;
            if (settled.booking) {
              setSubmission({ state: "done", booking: settled.booking });
            }
          }}
          onEnded={(ended) => {
            // A fresh press needs a fresh token: this one is spent, and the
            // provider would replay its refusal against it.
            attemptToken.current = null;
            setSubmission({
              state: "failed",
              reason: ended.state === "expired" ? "pending" : "declined",
              message:
                ended.failureReason ??
                "That payment did not go through. Nothing has been charged.",
            });
          }}
        />
      </SingleColumn>
    );
  }

  // --- The link names no room ----------------------------------------------
  //
  // It used to print a fixture-priced breakdown here, under a heading saying
  // the stay was not bookable: a total for a stay nobody could buy, computed
  // from a rate no server had agreed to. With no room there is no price, and
  // the screen says that instead of inventing one.

  if (!roomTypeId) {
    return (
      <SingleColumn>
        <CheckoutBackLink property={backTo} selection={selection} />
        <CheckoutNotBookable property={backTo} />
      </SingleColumn>
    );
  }

  // --- Loading the real room ------------------------------------------------

  if (room === null) {
    return (
      <SingleColumn>
        <CheckoutLoading />
      </SingleColumn>
    );
  }

  if (room.status !== "ok" || !roomType || !property || !quote) {
    return (
      <SingleColumn>
        <CheckoutBackLink property={backTo} selection={selection} />
        <CheckoutLoadError
          property={backTo}
          selection={selection}
          message={
            room.status === "ok"
              ? "This room is no longer priced for booking."
              : apiResultMessage(room)
          }
        />
      </SingleColumn>
    );
  }

  // Capacity is checked against the REAL room type, never a fixture's guess.
  if (roomType.capacity != null && guests > roomType.capacity) {
    return (
      <SingleColumn>
        <CheckoutRefusal
          property={backTo}
          reason={`That room type sleeps at most ${roomType.capacity}.`}
        />
      </SingleColumn>
    );
  }

  const requestToBook = roomType.bookingMode === "request_to_book";
  const payLabel = requestToBook ? "Request to book" : "Confirm and pay";
  const MethodMark = METHOD_MARK[draft.method];

  return (
    <div className="mx-auto w-full max-w-page px-5 py-8 lg:py-10">
      <div className="mb-6 flex items-center gap-4 lg:mb-10">
        {/* `backTo`, not `property`: the slug to go back to is the one the
            guest arrived on, and the API's is nullable for a property still in
            the registration pipeline. */}
        <BackButton property={backTo} selection={selection} />
        <h1 className="text-2xl font-semibold text-page-fg lg:text-3xl">Confirm and pay</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px] lg:gap-10">
        <div className="flex flex-col gap-6">
          {welcomeBack ? (
            <p role="status" className="animate-settle-in rounded border border-input p-3 text-sm text-page-fg">
              {welcomeBack === "kept"
                ? "You're signed in, and your choices are just as you left them."
                : "You're signed in. For your safety we never keep card details, so please enter your card once more."}
            </p>
          ) : null}
          {CHECKOUT_STEPS.map((step, index) => {
            const state = stepState(step.id, completed);

            if (step.id === "when") {
              return (
                <CheckoutStep
                  key={step.id}
                  step={step}
                  index={index}
                  state={state}
                  summary={`Pay ${formatPrice(quote.grossRwf)} now`}
                  onChange={() => reopenFrom("when")}
                >
                  <StepWhenToPay
                    totalRwf={quote.grossRwf}
                    nonRefundable={nonRefundable}
                    onToggleNonRefundable={setNonRefundable}
                    nonrefundableEligible={roomType.nonrefundableEligible}
                    onNext={() => markDone("when")}
                  />
                </CheckoutStep>
              );
            }

            if (step.id === "method") {
              return (
                <CheckoutStep
                  key={step.id}
                  step={step}
                  index={index}
                  state={state}
                  summary={
                    <span className="inline-flex items-center gap-2">
                      <MethodMark width={18} height={18} aria-hidden />
                      {describePaymentMethod(draft)}
                    </span>
                  }
                  onChange={() => reopenFrom("method")}
                >
                  <StepPaymentMethod
                    draft={draft}
                    onChange={setDraft}
                    onNext={() => markDone("method")}
                    terms={terms}
                    amountRwf={quote.grossRwf}
                  />
                </CheckoutStep>
              );
            }

            return (
              <CheckoutStep key={step.id} step={step} index={index} state={state}>
                {submission.state === "failed" ? (
                  <SubmissionFailure submission={submission} />
                ) : null}
                <StepReview
                  draft={draft}
                  payLabel={payLabel}
                  pendingLabel={requestToBook ? "Sending your request…" : "Confirming your booking…"}
                  pending={submission.state === "sending"}
                  onConfirm={() => void submit()}
                />
                {session.status === "anonymous" ? (
                  <p className="mt-3 text-center text-xs text-page-fg-70">
                    You will be asked to sign in to confirm. We will bring you straight
                    back to this quote.
                  </p>
                ) : null}
                <p className="mt-3 text-xs text-page-fg-70">
                  Nothing is stored. A fresh mobile money prompt is captured into escrow,
                  and the host receives the full amount at payout.
                </p>
              </CheckoutStep>
            );
          })}
        </div>

        <ReservationSummary
          property={property}
          selection={selection}
          quote={quote}
          room={roomType}
          cancellationTier={roomType.cancellationTier}
          nonRefundable={nonRefundable}
        />
      </div>

      <MobileTotalBar totalRwf={quote.grossRwf} nonRefundable={nonRefundable} />
    </div>
  );
}

/**
 * The total, pinned, at phone width.
 *
 * The grid collapses to one column below `lg`, and the summary rail is the
 * second cell — so it renders BELOW all three steps. The confirm button and the
 * amount it charges were never on screen together on a phone, which is the
 * majority of this market. The rail still holds the full breakdown; this is the
 * one number that must not be able to scroll away from the button.
 *
 * It is `lg:hidden`, because above that width the rail is sticky and saying the
 * total twice on one screen is noise. `pb-[env(safe-area-inset-bottom)]` keeps
 * it clear of the iOS home indicator, and the matching spacer below stops the
 * bar covering the last step's own content at the bottom of the scroll.
 */
function MobileTotalBar({
  totalRwf,
  nonRefundable,
}: {
  totalRwf: number;
  nonRefundable: boolean;
}) {
  return (
    <>
      <div aria-hidden className="h-20 lg:hidden" />
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-input bg-card px-5 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 lg:hidden">
        <div className="mx-auto flex w-full max-w-page items-center justify-between gap-4">
          <span className="flex min-w-0 flex-col">
            <span className="text-2xs font-semibold uppercase tracking-[0.04em] text-page-fg-70">
              Total
            </span>
            <b className="truncate text-base text-page-fg">{formatPrice(totalRwf)}</b>
          </span>
          <span className="shrink-0 text-right text-xs text-page-fg-70">
            {nonRefundable ? "Non-refundable rate" : "Held in escrow"}
          </span>
        </div>
      </div>
    </>
  );
}

/** The width the single-message screens render at — not the two-column flow. */
function SingleColumn({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-read px-5 py-10">{children}</div>;
}

function BackButton({
  property,
  selection,
}: {
  property: { slug: string; name: string };
  selection: NonNullable<ReturnType<typeof parseBooking>>;
}) {
  return (
    <Link
      href={propertyHref(property.slug, selection.intent)}
      aria-label={`Back to ${property.name}`}
      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-page-fg hover:bg-surface-tertiary"
    >
      <ArrowLeft width={20} height={20} strokeWidth={1.8} aria-hidden />
    </Link>
  );
}

/**
 * The five outcomes worded apart (ADR-020 AC-17), same wording
 * `booking-review.tsx` used. The sentence is always the server's own; only
 * the second line, which says what to DO, is the page's.
 */
function SubmissionFailure({
  submission,
}: {
  submission: Extract<Submission, { state: "failed" }>;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // The answer lands above the button the guest just pressed, and on a phone
  // that can be off screen. Bring it into view — after a short pause, so the
  // page does not lurch the instant the button lets go.
  useEffect(() => {
    const timer = setTimeout(() => {
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      ref.current?.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" });
    }, 300);
    return () => clearTimeout(timer);
  }, [submission]);

  // Waiting on the guest's phone is not a failure, and must not look like one.
  const waiting = submission.reason === "pending";
  const Icon = waiting ? Smartphone : CircleAlert;

  return (
    <div
      ref={ref}
      role="alert"
      className="mb-4 flex animate-settle-in gap-3 rounded border border-input p-3 text-sm text-page-fg"
    >
      <Icon
        aria-hidden
        className={waiting ? "mt-0.5 size-4 shrink-0 text-accent-text" : "mt-0.5 size-4 shrink-0 text-destructive"}
      />
      <div>
        <p>{submission.message}</p>
        {waiting ? (
          <p className="mt-2 text-page-fg-70">
            Approve the payment on your phone, then press confirm again. The same
            request is reused, so you cannot be charged twice.
          </p>
        ) : null}
        {submission.reason === "sold-out" ? (
          <p className="mt-2 text-page-fg-70">
            Nothing has been charged. Pick different dates and you will get a fresh
            total.
          </p>
        ) : null}
        {submission.reason === "unreachable" ? (
          <p className="mt-2 text-page-fg-70">
            This is on us, not on your account. Trying again is safe: it reuses the
            same request, so you cannot be charged twice.
          </p>
        ) : null}
      </div>
    </div>
  );
}
