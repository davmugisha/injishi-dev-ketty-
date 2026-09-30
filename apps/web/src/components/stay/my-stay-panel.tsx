"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Input, Textarea } from "@injishi/ui";
import {
  REFUND_DETAIL_MAX,
  StayRefundReason,
  type GuestOffer,
  type MyStay,
  type StayDepartment,
  type StayRefundQuote,
} from "@injishi/contracts";
import { Icon } from "@/components/app/icon";
import { toast } from "@/components/app/toast";
import {
  claimStay,
  currentStay,
  fetchMyStays,
  fetchRefundQuote,
  fetchStayDepartments,
  fetchStayOffers,
  openDepartmentRequest,
  raiseRefundRequest,
  redeemOffer,
} from "@/data/my-stay";
import { apiResultMessage, type ApiResult } from "@/lib/api";

/**
 * THE REAL STAY, on the screen that has always shown a made-up one (§6.8).
 *
 * `/stay` shipped reading its whole world out of `localStorage` — the hotel,
 * the room, the dates — written by a demo control on the same page. That was
 * honest while no endpoint could answer "which stay am I in"; four now can, and
 * this panel is what asks them.
 *
 * ## It renders three states and all three are real screens
 *
 * 1. **Looking.** A quiet line, never a spinner and never a conclusion. Saying
 *    "you are not checked in" during the fetch is a lie that flashes on every
 *    navigation, which is the exact bug `useGuestStay`'s `ready` flag exists to
 *    avoid.
 * 2. **No stay.** A claim prompt, because the most likely reason a person is on
 *    this screen with no stay is that a front desk registered them ten minutes
 *    ago and they have a code in their hand.
 * 3. **A stay.** Where they are, what the bill stands at, the desks they can
 *    write to, what they can take off the bill, and how to ask for money back.
 *
 * ## Nothing here decides anything
 *
 * Every verdict on this screen — what an offer is worth, whether it can be
 * taken, what the house rules owe on a refund — is resolved by the API and
 * rendered as it comes. The eligibility function ships in `@injishi/contracts`
 * and this app could call it, and deliberately does not: its inputs are the
 * locked tier, the nights already slept and what was actually paid, none of
 * which is on this screen. A number computed from what a browser happens to
 * know is a number the property's queue will contradict.
 */
export function MyStayPanel() {
  const [stay, setStay] = useState<MyStay | null>(null);
  const [ready, setReady] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await fetchMyStays();
    setReady(true);
    if (result.status !== "ok") {
      setStay(null);
      // `unauthenticated` is not reported as a problem here: the shell's
      // middleware has already bounced anyone without a session, so seeing it
      // means the session ended mid-page and a re-gate is on its way.
      setProblem(
        result.status === "unauthenticated" ? null : apiResultMessage(result),
      );
      return;
    }
    setProblem(null);
    setStay(currentStay(result.data));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!ready) {
    return (
      <p className="text-sm text-muted-foreground">Looking up your stay…</p>
    );
  }

  if (!stay) return <ClaimPrompt problem={problem} onClaimed={load} />;

  return (
    <div className="space-y-6">
      <StaySummary stay={stay} />
      <DesksPanel stay={stay} />
      <OffersPanel stay={stay} onApplied={load} />
      <RefundPanel stay={stay} onRaised={load} />
    </div>
  );
}

/* -------------------------------------------------------------- no stay yet */

function ClaimPrompt({
  problem,
  onClaimed,
}: {
  problem: string | null;
  onClaimed: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const result = await claimStay(code);
    setBusy(false);
    if (result.status === "ok") {
      setCode("");
      setError(null);
      toast("Claimed. This stay is on your account now.");
      onClaimed();
      return;
    }
    setError(apiResultMessage(result));
  }

  return (
    <section className="rounded-card border border-border bg-card p-6">
      <h2 className="font-display text-lg font-bold tracking-tight">
        Claim the stay the front desk registered
      </h2>
      <p className="mt-2 max-w-read text-sm text-muted-foreground">
        If you checked in at a counter, the property already has your stay on
        record and emailed you a code. Enter it and this screen becomes your
        room: the desks you can message, what is on your bill, and the offers
        you qualify for.
      </p>
      {problem ? (
        <p className="mt-3 text-xs font-semibold text-destructive" role="alert">
          {problem}
        </p>
      ) : null}
      <form noValidate onSubmit={submit} className="mt-4 flex flex-wrap gap-2">
        <Input
          aria-label="Claim code"
          className="money w-48 uppercase"
          placeholder="UMWE-7241"
          autoComplete="off"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError(null);
          }}
        />
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Claiming…" : "Claim stay"}
        </Button>
      </form>
      {error ? (
        <p className="mt-2 text-xs font-semibold text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

/* --------------------------------------------------------------- the basics */

function StaySummary({ stay }: { stay: MyStay }) {
  return (
    <section className="rounded-card border border-border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="success" size="sm">
              Checked in
            </Badge>
            <span className="text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
              {stay.checkInMode === "self" ? "Self check-in" : "Front desk"}
            </span>
          </div>
          <h2 className="mt-3 font-display text-2xl font-bold leading-tight tracking-tight">
            {stay.propertyName ?? "Your stay"}
          </h2>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="calendar-days" className="h-4 w-4" />
              <span className="money">
                Arrived {formatDay(stay.entryAt)}
                {stay.plannedExitAt ? ` · leaving ${formatDay(stay.plannedExitAt)}` : ""}
              </span>
            </span>
            {stay.bookingReference ? (
              <span className="money inline-flex items-center gap-1.5">
                <Icon name="file-text" className="h-4 w-4" />
                {stay.bookingReference}
              </span>
            ) : null}
          </p>
        </div>

        <div className="flex gap-3">
          {stay.roomLabel ? (
            <div className="rounded-card border border-border bg-background px-5 py-4 text-center">
              <p className="text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Your room
              </p>
              <p className="money mt-1 font-display text-3xl font-bold leading-none">
                {stay.roomLabel}
              </p>
            </div>
          ) : null}
          {stay.balanceRwf !== null ? (
            <div className="rounded-card border border-border bg-background px-5 py-4 text-center">
              <p className="text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
                On your bill
              </p>
              <p className="money mt-1 font-display text-2xl font-bold leading-none">
                {money(stay.balanceRwf)}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- the desks */

/**
 * The internal departments a guest may write to, one conversation each.
 *
 * ROUTED TO A DESK, NEVER TO A PERSON, which is the property's own rule
 * (ADR-016 D14) and the reason a shift change never strands a question. The
 * list is whatever the property marked guest-requestable: a flag that has
 * existed since ADR-016 with nothing reading it, because no guest surface could
 * start a conversation at all.
 */
/**
 * This panel belongs to `/stay` alone, and is no longer exported.
 *
 * `/inbox` used to render it too, which is how the department capability came
 * to be invisible to every guest who had booked and not yet arrived: this
 * component needs a `MyStay`, and a person with a booking has none. `/inbox`
 * now has its own section on `GET /me/departments`
 * (`components/app/inbox-desks.tsx`), which answers for stays and bookings
 * alike. This one stays because `/stay` IS one stay — it holds the id, its
 * unread counts are that stay's, and `POST /me/stays/:id/requests` is the
 * narrower route for exactly that case.
 */
function DesksPanel({ stay }: { stay: MyStay }) {
  const [desks, setDesks] = useState<StayDepartment[] | null>(null);
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await fetchStayDepartments(stay.id);
    setDesks(result.status === "ok" ? result.data : []);
  }, [stay.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function send(departmentId: string) {
    setBusy(true);
    const result = await openDepartmentRequest(stay.id, { departmentId, body });
    setBusy(false);
    if (result.status === "ok") {
      setBody("");
      setOpenFor(null);
      setError(null);
      toast("Sent. The desk will answer in your inbox.");
      void load();
      return;
    }
    setError(apiResultMessage(result));
  }

  if (desks === null) {
    return <p className="text-sm text-muted-foreground">Loading the desks…</p>;
  }
  if (desks.length === 0) {
    return (
      <section className="rounded-card border border-dashed border-input bg-card p-6">
        <h2 className="font-display text-lg font-bold tracking-tight">
          Message the hotel
        </h2>
        <p className="mt-2 max-w-read text-sm text-muted-foreground">
          This property has not opened any of its desks to guest messages yet.
          The front desk can still be reached in person or by phone.
        </p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="font-display text-lg font-bold tracking-tight">
        Message a desk
      </h2>
      <p className="mt-1 max-w-read text-sm text-muted-foreground">
        Each desk is its own conversation and stays with the department, not
        with whoever is on shift.
      </p>
      <ul className="mt-3 space-y-3">
        {desks.map((desk) => (
          <li
            key={desk.id}
            className="rounded-card border border-border bg-card p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{desk.name}</p>
                <p className="text-xs text-muted-foreground">
                  {desk.threadId
                    ? desk.unreadCount > 0
                      ? `${desk.unreadCount} unread`
                      : "Conversation open"
                    : "No conversation yet"}
                  {desk.phone ? ` · ${desk.phone}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                {desk.threadId ? (
                  <Button asChild variant="outline" size="sm">
                    <a href={`/inbox/${desk.threadId}`}>Open</a>
                  </Button>
                ) : null}
                <Button
                  variant={desk.threadId ? "outline" : "primary"}
                  size="sm"
                  onClick={() => {
                    setOpenFor(openFor === desk.id ? null : desk.id);
                    setError(null);
                  }}
                >
                  <Icon name="message-square" className="h-4 w-4" />
                  Say something
                </Button>
              </div>
            </div>

            {openFor === desk.id ? (
              <div className="mt-3">
                <Textarea
                  aria-label={`Message ${desk.name}`}
                  rows={3}
                  value={body}
                  placeholder="What do you need?"
                  onChange={(e) => {
                    setBody(e.target.value);
                    setError(null);
                  }}
                />
                {error ? (
                  <p
                    className="mt-1.5 text-xs font-semibold text-destructive"
                    role="alert"
                  >
                    {error}
                  </p>
                ) : null}
                <Button
                  variant="primary"
                  size="sm"
                  className="mt-2"
                  disabled={busy || body.trim().length === 0}
                  onClick={() => void send(desk.id)}
                >
                  {busy ? "Sending…" : "Send"}
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/* -------------------------------------------------------------- the offers */

function OffersPanel({
  stay,
  onApplied,
}: {
  stay: MyStay;
  onApplied: () => void;
}) {
  const [offers, setOffers] = useState<GuestOffer[] | null>(null);
  const [code, setCode] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(
    async (withCode?: string) => {
      const result = await fetchStayOffers(stay.id, withCode);
      setOffers(result.status === "ok" ? result.data : []);
    },
    [stay.id],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function apply(offer: GuestOffer) {
    setBusyId(offer.id);
    const result = await redeemOffer(
      stay.id,
      offer.id,
      offer.requiresCode ? code : undefined,
    );
    setBusyId(null);
    if (result.status === "ok") {
      toast(`${money(result.data.discountRwf)} off. Your bill is now ${money(result.data.balanceRwf)}.`);
      onApplied();
      void load(code || undefined);
      return;
    }
    toast(apiResultMessage(result));
  }

  if (offers === null) return null;

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-bold tracking-tight">
          Offers from this property
        </h2>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void load(code.trim() || undefined);
          }}
        >
          <Input
            aria-label="Offer code"
            className="money w-36 uppercase"
            placeholder="Have a code?"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Button type="submit" variant="outline" size="sm">
            Check
          </Button>
        </form>
      </div>

      {offers.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Nothing running here at the moment.
        </p>
      ) : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {offers.map((offer) => (
            <li
              key={offer.id}
              className="rounded-card border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{offer.name}</p>
                <Badge
                  variant={offer.redeemed ? "success" : offer.eligible ? "accent" : "subtle"}
                  size="sm"
                >
                  {offer.discountKind === "percentage"
                    ? `${offer.discountValue}% off`
                    : `${money(offer.discountValue)} off`}
                </Badge>
              </div>
              {offer.description ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {offer.description}
                </p>
              ) : null}
              {/*
                The refusal comes from the server and is rendered verbatim. It
                names the condition the guest actually failed — "2 nights
                minimum", "for guests staying here tonight" — which is the
                difference between a card they can act on and a button that
                just does not work.
              */}
              <p className="money mt-2 text-xs text-muted-foreground">
                {offer.redeemed
                  ? "Already used on this stay"
                  : offer.eligible
                    ? `Takes ${money(offer.discountRwf)} off your bill`
                    : (offer.reason ?? "Not available")}
              </p>
              {offer.eligible && !offer.redeemed ? (
                <Button
                  variant="primary"
                  size="sm"
                  className="mt-3"
                  disabled={busyId === offer.id}
                  onClick={() => void apply(offer)}
                >
                  {busyId === offer.id ? "Applying…" : "Apply to my bill"}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------------------------------------- the refund */

/** The guest's words for each coded reason. The codes are the API's. */
const REASON_LABEL: Record<string, string> = {
  service_failure: "Something wasn't delivered",
  room_not_as_described: "The room isn't what was described",
  cleanliness: "Cleanliness",
  noise: "Noise",
  maintenance_unresolved: "Something broken wasn't fixed",
  overcharged: "A charge on my bill is wrong",
  early_departure: "I'm leaving early",
  changed_plans: "My plans changed",
  other: "Something else",
};

function RefundPanel({
  stay,
  onRaised,
}: {
  stay: MyStay;
  onRaised: () => void;
}) {
  const [reason, setReason] = useState<StayRefundReason>("service_failure");
  const [detail, setDetail] = useState("");
  const [quote, setQuote] = useState<StayRefundQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let live = true;
    void fetchRefundQuote(stay.id, reason).then((result: ApiResult<StayRefundQuote>) => {
      if (live) setQuote(result.status === "ok" ? result.data : null);
    });
    return () => {
      live = false;
    };
  }, [stay.id, reason]);

  if (stay.openRefundRequestId || sent) {
    return (
      <section className="rounded-card border border-border bg-card p-6">
        <h2 className="font-display text-lg font-bold tracking-tight">
          Your refund request
        </h2>
        <p className="mt-2 max-w-read text-sm text-muted-foreground">
          The property has it and will answer in writing. If they say no, the
          answer names the rule it is based on — the rate you booked, the
          nights already stayed, the window on your booking — so you can see
          what it turned on. You will find the answer in your account.
        </p>
      </section>
    );
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const result = await raiseRefundRequest(stay.id, { reason, detail });
    setBusy(false);
    if (result.status === "ok") {
      setSent(true);
      setError(null);
      toast(`Sent as ${result.data.reference}. The property will answer.`);
      onRaised();
      return;
    }
    setError(apiResultMessage(result));
  }

  return (
    <section className="rounded-card border border-border bg-card p-6">
      <h2 className="font-display text-lg font-bold tracking-tight">
        Something wrong? Ask for money back
      </h2>
      <p className="mt-1 max-w-read text-sm text-muted-foreground">
        The property decides, and a refusal has to name the rule it rests on.
      </p>

      <form noValidate onSubmit={submit} className="mt-4 space-y-3">
        <div>
          <label htmlFor="refund-reason" className="block text-sm font-semibold">
            What happened
          </label>
          <select
            id="refund-reason"
            className="mt-1 w-full rounded-card border border-input bg-background px-3 py-2 text-sm"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value as StayRefundReason);
              setError(null);
            }}
          >
            {StayRefundReason.options.map((option) => (
              <option key={option} value={option}>
                {REASON_LABEL[option] ?? option}
              </option>
            ))}
          </select>
        </div>

        {/*
          The rule, in the property's own words, BEFORE anything is sent. It is
          the same sentence the desk sees on the decision screen, from the same
          call — so a guest is never shown one figure here and answered with
          another there.
        */}
        {quote ? (
          <p
            className={`rounded-card border px-3 py-2 text-xs ${
              quote.eligible
                ? "border-border bg-background text-muted-foreground"
                : "border-input bg-background text-muted-foreground"
            }`}
          >
            <Icon name="info" className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
            {quote.rule}
          </p>
        ) : null}

        <div>
          <label htmlFor="refund-detail" className="block text-sm font-semibold">
            In your own words
          </label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            What happened, when, and which nights it affected. A property can
            check &ldquo;the bathroom wasn&rsquo;t cleaned on Tuesday&rdquo;; it
            cannot check &ldquo;cleanliness&rdquo;.
          </p>
          <Textarea
            id="refund-detail"
            rows={4}
            className="mt-1"
            maxLength={REFUND_DETAIL_MAX}
            value={detail}
            onChange={(e) => {
              setDetail(e.target.value);
              setError(null);
            }}
          />
        </div>

        {error ? (
          <p className="text-xs font-semibold text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          variant="primary"
          disabled={busy || detail.trim().length < 10 || Boolean(quote?.refusal)}
        >
          {busy ? "Sending…" : "Send this to the property"}
        </Button>
        {quote?.refusal ? (
          <p className="text-xs text-muted-foreground">{quote.refusal}</p>
        ) : null}
      </form>
    </section>
  );
}

/* --------------------------------------------------------------- helpers */

/** `189000` → `RWF 189,000`. The one place this panel formats money. */
function money(amountRwf: number): string {
  return `RWF ${amountRwf.toLocaleString("en-RW")}`;
}

/** An ISO instant as `Sun 20 Sep`. Dates only; the hour is not the point. */
function formatDay(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Africa/Kigali",
  }).format(new Date(iso));
}
