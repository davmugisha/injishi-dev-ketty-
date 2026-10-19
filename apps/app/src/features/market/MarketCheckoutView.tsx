"use client";

import {
  ArrowRight,
  ArrowsRotateRight,
  Calendar,
  Check,
  ChevronLeft,
  CircleCheck,
  Clock,
  Comment,
  CreditCard,
  Hourglass,
  Lock,
  PaperPlane,
  Route,
  SealCheck,
  Smartphone,
  StarFill,
  Thunderbolt,
  Vault,
} from "@gravity-ui/icons";
import {
  Alert,
  Button,
  Card,
  Chip,
  Description,
  Input,
  Label,
  Modal,
  Separator,
  Spinner,
  TextField,
  Toast,
  toast,
} from "@heroui/react";
import { NativeSelect, RadioButtonGroup } from "@heroui-pro/react";
import { screenHref } from "@injishi/data";
import type { MarketCheckout, MarketProperty, MarketTone, Option, PaymentMethod } from "@injishi/data/fixtures/market";
import type { StockKey } from "@injishi/data/media";
import { stock } from "@injishi/data/media";
import { GateChip, KeyValueList, LinkButton, Photo, TextLink } from "@injishi/ui";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  type CheckoutResult,
  cancelCheckoutRequestAction,
  checkPaymentAction,
  payCheckoutAction,
  saveCheckoutDetailsAction,
} from "./actions";
import { plural, propertyHref, rwf } from "./format";
import { MarketHeader, MarketMain, type MarketVisitor } from "./MarketChrome";

export type CheckoutScreen =
  | "checkout"
  | "approve-on-phone"
  | "payment-unclear"
  | "booked"
  | "request"
  | "request-sent";

const PAY_STAGES = ["Sent", "Approve", "Booked"];
const REQUEST_STAGES = ["Sent", "Hotel replies", "You pay", "Booked"];

const BAR: Record<MarketTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  accent: "bg-accent",
  default: "bg-default",
  info: "bg-accent",
};

/**
 * Marketplace checkout (artifact: MarketCheckout.dc.html). `initial` is the `?state=` variant. The booking route
 * takes the room, dates, party and payment and nothing else: "Your details" saves the person's own contact record,
 * and arrival time and requests are given after booking (pre-arrival check-in, a message to the hotel), never
 * collected here as if they went with the booking.
 */
export function MarketCheckoutView({
  visitor,
  booking,
  property,
  photo,
  methods,
  countries,
  initial,
}: {
  visitor: MarketVisitor | null;
  booking: MarketCheckout;
  property: MarketProperty;
  photo: StockKey;
  methods: PaymentMethod[];
  countries: Option[];
  /** Arrival times and request tags of the prototype: not collected, since the booking route takes neither. */
  arrivals: Option[];
  tags: Option[];
  initial: CheckoutScreen;
}) {
  const isRequest = booking.id === "request";
  const [screen, setScreen] = useState<CheckoutScreen>(initial);
  const [methodId, setMethodId] = useState(methods[0]?.id ?? "mtn");
  const [editDetails, setEditDetails] = useState(false);
  /** The person's contact details as last saved (`PUT /me/guest-contact`), and the edit in progress. */
  const [details, setDetails] = useState(booking.guest);
  const [draft, setDraft] = useState(booking.guest);
  const [savingDetails, startSavingDetails] = useTransition();
  /** A request withdrawn from this screen: the refund the server decided. */
  const [withdrawn, setWithdrawn] = useState<number | null>(null);
  const [withdrawing, startWithdrawing] = useTransition();
  const [resent, setResent] = useState(false);
  const [secs, setSecs] = useState(0);
  const [numbers, setNumbers] = useState<Record<string, string>>(() =>
    Object.fromEntries(methods.map((m) => [m.id, m.number ?? ""])),
  );
  /** The real attempt: what the API said about the last press of Pay or Send request. */
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [lastCheck, setLastCheck] = useState<string>("");
  const [paying, startPaying] = useTransition();
  const polling = useRef<string | null>(null);

  const method = methods.find((m) => m.id === methodId) ?? methods[0];
  const sub = booking.rate * booking.nights;
  // The guest service fee the booking service adds to every stay (absent from the prototype's documents).
  const fee = booking.serviceFee ?? 0;
  const total = sub + fee;
  const vat = Math.round((total * booking.vatRate) / (100 + booking.vatRate));
  const amount = rwf(total);
  const propertyUrl = propertyHref(booking.property);
  const showForm =
    screen === "checkout" || screen === "request" || screen === "approve-on-phone" || screen === "payment-unclear";
  const countryOptions = countries.some((c) => c.id === draft.country)
    ? countries
    : [...countries, { id: draft.country, label: draft.country }];
  const payLabel = !method ? "" : method.kind === "card" ? method.mask : `${method.provider} ${method.mask}`;
  const mm = Math.floor(secs / 60);
  const ss = String(secs % 60).padStart(2, "0");

  // The prompt's countdown, from the provider's own expiry.
  useEffect(() => {
    if (screen !== "approve-on-phone" || !result?.expiresAt) return;
    const ends = Date.parse(result.expiresAt);
    const tick = () => setSecs(Math.max(0, Math.round((ends - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [screen, result?.expiresAt]);

  /** Where the API says a press got to: booked, still on the phone, or over. */
  const land = (r: CheckoutResult) => {
    setResult(r);
    setLastCheck(
      new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "Africa/Kigali",
      }).format(new Date()),
    );
    if (r.state === "confirmed") {
      polling.current = null;
      setScreen(r.bookingStatus === "pending_approval" ? "request-sent" : "booked");
    } else if (r.state === "refused" || r.state === "expired") {
      polling.current = null;
      setScreen(isRequest ? "request" : "checkout");
      toast.danger(
        r.failureReason ??
          (r.state === "expired"
            ? "Nobody approved the prompt in time. Nothing was taken."
            : "The payment was declined. Nothing was taken."),
      );
    } else {
      setScreen("approve-on-phone");
    }
  };

  // While a prompt sits on the handset, ask every two seconds (the API's poll is built for it).
  useEffect(() => {
    const token = result?.state === "prompting" ? result.attemptToken : null;
    polling.current = token;
    if (!token) return;
    const id = window.setInterval(async () => {
      if (polling.current !== token) return;
      try {
        const next = await checkPaymentAction(token);
        if (polling.current !== token) return;
        if (next.ok) land(next.value);
        else {
          polling.current = null;
          setScreen("payment-unclear");
        }
      } catch {
        polling.current = null;
        setScreen("payment-unclear");
      }
    }, 2000);
    return () => window.clearInterval(id);
  }, [result?.state, result?.attemptToken]);

  /** One press of Pay (or Send request): a fresh attempt token, minted here and only here. */
  const pay = () => {
    if (!method || method.kind === "card") {
      toast.danger(
        "Card payments need the bank's secure card form, which is not connected yet. Pay with mobile money.",
      );
      return;
    }
    const network = method.id === "airtel" ? "airtel_money" : "mtn_momo";
    const token = crypto.randomUUID();
    startPaying(async () => {
      const r = await payCheckoutAction(booking.id, { network, number: numbers[method.id] ?? "" }, token);
      if (r.ok) land(r.value);
      else toast.danger(r.error);
    });
  };

  /** "Done" on Your details: saved to the person's contact record, or the refusal shown and the edit kept open. */
  const saveDetails = () =>
    startSavingDetails(async () => {
      const r = await saveCheckoutDetailsAction({
        firstName: draft.firstName,
        lastName: draft.lastName,
        mobile: draft.mobile,
        country: draft.country,
      });
      if (!r.ok) {
        toast.danger(r.error);
        return;
      }
      setDetails(draft);
      setEditDetails(false);
      toast.success("Saved to your account");
    });

  /** "Cancel request": the pending request is cancelled on the API, which refunds it. */
  const withdraw = (ref: string) =>
    startWithdrawing(async () => {
      const r = await cancelCheckoutRequestAction(ref);
      if (!r.ok) {
        toast.danger(r.error);
        return;
      }
      setWithdrawn(r.value.refundRwf);
    });

  const checkNow = () => {
    const token = result?.attemptToken;
    if (!token) return;
    startPaying(async () => {
      const r = await checkPaymentAction(token);
      if (r.ok) land(r.value);
      else toast.danger(r.error);
    });
  };

  const reference = result?.reference ?? booking.reference;
  const replyBy = result?.approvalExpiresAt
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Africa/Kigali",
      }).format(new Date(result.approvalExpiresAt))
    : booking.replyBy;

  return (
    <>
      <MarketHeader
        width="regular"
        visitor={visitor}
        returnTo={screenHref("MarketCheckout")}
        showNav={false}
        actions={
          <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
            <Lock className="size-3.5" aria-hidden="true" />
            Secure checkout
          </span>
        }
      />
      <div className="flex flex-1 flex-col">
        <MarketMain width="narrow" className="gap-6 pt-7">
          {showForm ? (
            <>
              <div className="flex items-center gap-2">
                <LinkButton href={propertyUrl} variant="ghost" isIconOnly aria-label={`Back to ${property.name}`}>
                  <ChevronLeft className="size-4" />
                </LinkButton>
                <h1 className="text-[28px] leading-9 font-semibold tracking-[-0.02em]">
                  {isRequest ? "Request to book" : "Confirm and pay"}
                </h1>
              </div>
              <div className="flex flex-wrap items-start gap-x-12 gap-y-8">
                <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-4">
                  <Card className="gap-4 px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <h2 id="d-h" className="flex items-center gap-2 text-base font-semibold">
                          Your details
                          {editDetails ? null : <CircleCheck className="size-4 text-accent" aria-hidden="true" />}
                        </h2>
                        {editDetails ? null : (
                          <span className="text-[13px] text-muted">
                            {details.firstName} {details.lastName} · {details.email} · {details.mobile}
                          </span>
                        )}
                      </div>
                      {editDetails ? (
                        <Button variant="ghost" size="sm" isDisabled={savingDetails} onPress={saveDetails}>
                          Done
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-expanded={false}
                          onPress={() => {
                            setDraft(details);
                            setEditDetails(true);
                          }}
                        >
                          Edit
                        </Button>
                      )}
                    </div>
                    {editDetails ? (
                      <>
                        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]">
                          <TextField
                            fullWidth
                            value={draft.firstName}
                            onChange={(v) => setDraft((d) => ({ ...d, firstName: v }))}
                            className="gap-1"
                          >
                            <Label htmlFor="fn">First name</Label>
                            <Input id="fn" autoComplete="given-name" />
                          </TextField>
                          <TextField
                            fullWidth
                            value={draft.lastName}
                            onChange={(v) => setDraft((d) => ({ ...d, lastName: v }))}
                            className="gap-1"
                          >
                            <Label htmlFor="ln">Last name</Label>
                            <Input id="ln" autoComplete="family-name" />
                          </TextField>
                          <TextField fullWidth value={details.email} isReadOnly className="gap-1">
                            <Label htmlFor="em">Email</Label>
                            <Input id="em" type="email" autoComplete="email" />
                            <Description>The email you sign in with</Description>
                          </TextField>
                          <TextField
                            fullWidth
                            value={draft.mobile}
                            onChange={(v) => setDraft((d) => ({ ...d, mobile: v }))}
                            className="gap-1"
                          >
                            <Label htmlFor="ph">Mobile</Label>
                            <Input id="ph" type="tel" autoComplete="tel" />
                          </TextField>
                          <NativeSelect fullWidth className="gap-1">
                            <Label htmlFor="ct">Country of residence</Label>
                            <NativeSelect.Trigger
                              id="ct"
                              value={draft.country}
                              onChange={(e) => setDraft((d) => ({ ...d, country: e.target.value }))}
                            >
                              {countryOptions.map((c) => (
                                <NativeSelect.Option key={c.id} value={c.id}>
                                  {c.label}
                                </NativeSelect.Option>
                              ))}
                              <NativeSelect.Indicator />
                            </NativeSelect.Trigger>
                          </NativeSelect>
                        </div>
                        <span className="text-xs text-muted">
                          Saved to your account when you press Done. The booking is in your name.
                        </span>
                      </>
                    ) : null}
                  </Card>

                  <Card className="gap-4 px-6 py-5" aria-labelledby="pay-h">
                    <div className="flex flex-col gap-0.5">
                      <h2 id="pay-h" className="text-base font-semibold">
                        {isRequest ? "Pay if accepted" : "Pay with"}
                      </h2>
                      {isRequest ? (
                        <span className="text-[13px] text-muted">
                          Held until the hotel replies, refunded in full if they decline.
                        </span>
                      ) : null}
                    </div>
                    <RadioButtonGroup
                      aria-label="Payment method"
                      value={methodId}
                      onChange={(v) => {
                        if (v) setMethodId(String(v));
                      }}
                      layout="grid"
                      className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(150px,100%),1fr))]"
                    >
                      {methods.map((m) => (
                        <RadioButtonGroup.Item
                          key={m.id}
                          value={m.id}
                          className="flex-row items-center gap-2.5 rounded-2xl px-4 py-3.5 text-left"
                        >
                          {m.kind === "card" ? (
                            <CreditCard className="size-5" aria-hidden="true" />
                          ) : (
                            <Smartphone className="size-5" aria-hidden="true" />
                          )}
                          <span className="flex-1 text-sm font-semibold">{m.label}</span>
                          <RadioButtonGroup.Indicator />
                        </RadioButtonGroup.Item>
                      ))}
                    </RadioButtonGroup>
                    {method?.kind === "mobile" ? (
                      <TextField
                        fullWidth
                        value={numbers[method.id] ?? ""}
                        onChange={(v) => setNumbers((cur) => ({ ...cur, [method.id]: v }))}
                        className="max-w-[360px] gap-1"
                      >
                        <Label htmlFor={`msisdn-${method.id}`}>{method.label} number</Label>
                        <Input id={`msisdn-${method.id}`} inputMode="tel" autoComplete="tel" />
                        <Description>You’ll approve with your PIN on this phone.</Description>
                      </TextField>
                    ) : null}
                    {method?.kind === "card" ? (
                      <div className="grid grid-cols-[2fr_1fr_1fr] gap-2.5">
                        <TextField fullWidth className="min-w-0 gap-1">
                          <Label htmlFor="cn">Card number</Label>
                          <Input
                            id="cn"
                            placeholder="1234 1234 1234 1234"
                            inputMode="numeric"
                            autoComplete="cc-number"
                          />
                        </TextField>
                        <TextField fullWidth className="min-w-0 gap-1">
                          <Label htmlFor="ce">Expiry</Label>
                          <Input id="ce" placeholder="MM / YY" autoComplete="cc-exp" />
                        </TextField>
                        <TextField fullWidth className="min-w-0 gap-1">
                          <Label htmlFor="cv">CVC</Label>
                          <Input id="cv" placeholder="123" inputMode="numeric" autoComplete="cc-csc" />
                        </TextField>
                      </div>
                    ) : null}
                  </Card>

                  <Card className="gap-2 px-6 py-5" aria-labelledby="x-h">
                    <h2 id="x-h" className="text-base font-semibold">
                      Arrival and requests <span className="text-[13px] font-normal text-muted">· after booking</span>
                    </h2>
                    <span className="text-[13px] text-muted">
                      Not sent with the booking. Once it is booked, give your arrival time in pre-arrival check-in and
                      message the hotel from your trip.
                    </span>
                  </Card>

                  <Card className="gap-3.5 px-6 py-5" aria-labelledby="c-h">
                    <div className="flex items-baseline justify-between gap-3">
                      <h2 id="c-h" className="text-base font-semibold">
                        Cancellation
                      </h2>
                      <span className="text-xs text-muted">Rwanda time</span>
                    </div>
                    <div
                      aria-hidden="true"
                      className="grid gap-1"
                      style={{ gridTemplateColumns: booking.cancellation.map((t) => `${t.weight}fr`).join(" ") }}
                    >
                      {booking.cancellation.map((t) => (
                        <span key={t.id} className={`h-1.5 rounded-full ${BAR[t.tone]}`} />
                      ))}
                    </div>
                    <ul
                      className="grid gap-1 text-[13px]"
                      style={{ gridTemplateColumns: booking.cancellation.map((t) => `${t.weight}fr`).join(" ") }}
                    >
                      {booking.cancellation.map((t) => (
                        <li key={t.id} className="flex min-w-0 flex-col">
                          <span className="font-semibold">{t.label}</span>
                          <span className="text-xs text-muted">{t.until}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>

                  <div className="flex flex-col gap-3 pt-1">
                    <p className="text-xs leading-[18px] text-muted">
                      {isRequest ? "By sending, you accept the" : "By paying, you accept the"}{" "}
                      <TextLink href={propertyUrl}>house rules</TextLink> and{" "}
                      <TextLink href={propertyUrl}>cancellation terms</TextLink>.
                    </p>
                    <Button
                      className="h-[54px] w-full rounded-[14px] text-base font-semibold"
                      isDisabled={paying}
                      onPress={pay}
                    >
                      {isRequest ? <PaperPlane className="size-4" /> : <Lock className="size-4" />}
                      {isRequest ? "Send request" : `Pay ${amount}`}
                    </Button>
                  </div>
                </div>

                <aside aria-label="Booking summary" className="min-w-[min(300px,100%)] flex-[0_1_400px] self-stretch">
                  <Card aria-labelledby="s-h" className="sticky top-5 gap-4 rounded-3xl p-5">
                    <div className="flex items-center gap-3.5">
                      <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-[14px] bg-surface-secondary">
                        <Photo image={stock[photo]} alt="" fill sizes="96px" />
                      </div>
                      <div className="flex min-w-0 flex-col gap-1">
                        <h2 id="s-h" className="text-[15px] font-semibold">
                          {property.name}
                        </h2>
                        <span className="inline-flex items-center gap-1 text-[13px] text-muted">
                          <StarFill className="size-3.5 text-warning" aria-hidden="true" />
                          {property.rating.toFixed(1)} ({property.reviewCount}) · {property.area}
                        </span>
                        <Chip size="sm" variant="soft" color={isRequest ? "default" : "accent"} className="self-start">
                          {isRequest ? <Clock className="size-3" /> : <Thunderbolt className="size-3" />}
                          <Chip.Label>{booking.confirmation}</Chip.Label>
                        </Chip>
                      </div>
                    </div>
                    <Separator />
                    <ul className="flex flex-col gap-3.5 text-sm">
                      <SummaryRow label="Dates" value={booking.dates} href={propertyUrl} />
                      <SummaryRow label="Guests" value={booking.guests} href={propertyUrl} />
                      <SummaryRow label="Room" value={`${booking.room} · ${booking.plan}`} href={propertyUrl} />
                    </ul>
                    <Separator />
                    <dl className="flex flex-col gap-2.5 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <dt>
                          {rwf(booking.rate)} × {plural(booking.nights, "night", "nights")}
                        </dt>
                        <dd className="tabular">{rwf(sub)}</dd>
                      </div>
                      {fee ? (
                        <div className="flex items-center justify-between gap-3">
                          <dt>Service fee</dt>
                          <dd className="tabular">{rwf(fee)}</dd>
                        </div>
                      ) : null}
                      <div className="flex items-center justify-between gap-3">
                        <dt className="inline-flex items-center gap-2 text-muted">
                          VAT {booking.vatRate}% included
                          <GateChip>{booking.vatStatus}</GateChip>
                        </dt>
                        <dd className="text-muted tabular">{rwf(vat)}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3 border-t border-separator pt-3 text-base font-semibold">
                        <dt>{isRequest ? "Total if accepted" : "Total"}</dt>
                        <dd className="tabular">{amount}</dd>
                      </div>
                    </dl>
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <Vault className="size-3.5" aria-hidden="true" />
                      <span className="flex-1">Paid to {booking.payee}</span>
                      <Chip size="sm" variant="soft" color="success">
                        <SealCheck className="size-3" />
                        <Chip.Label>Verified</Chip.Label>
                      </Chip>
                    </div>
                  </Card>
                </aside>
              </div>
            </>
          ) : null}

          {screen === "booked" ? (
            <section aria-labelledby="ok-h" className="mx-auto flex w-full max-w-[640px] flex-col gap-6">
              <div className="flex flex-col items-center gap-3 pt-2 text-center">
                <span className="flex size-16 items-center justify-center rounded-full bg-success-soft text-success-soft-foreground">
                  <Check className="size-7" aria-hidden="true" />
                </span>
                <h1 id="ok-h" className="text-[32px] leading-10 font-semibold tracking-[-0.02em]">
                  You’re booked!
                </h1>
                <p className="text-[15px] text-muted">Confirmation sent to {booking.guest.email}</p>
              </div>
              <Card className="gap-0 overflow-hidden rounded-3xl p-0">
                <div className="relative h-[180px] bg-surface-secondary">
                  <Photo image={stock[photo]} alt="" fill sizes="640px" />
                  <span className="absolute bottom-3 left-4 text-sm text-white">{booking.room} room</span>
                </div>
                <div className="flex flex-col gap-5 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-col gap-0.5">
                      <h2 className="text-xl leading-[26px] font-semibold">{property.name}</h2>
                      <span className="text-sm text-muted">
                        {booking.room} · {booking.guests}
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-xs text-muted">Confirmation</span>
                      <span className="text-base font-semibold tabular">{reference}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 rounded-2xl border border-separator">
                    <div className="flex flex-col gap-0.5 border-r border-separator px-4 py-3.5">
                      <span className="text-xs text-muted">Check-in</span>
                      <span className="text-base font-semibold">{booking.checkIn.day}</span>
                      <span className="text-[13px] text-muted">{booking.checkIn.time}</span>
                    </div>
                    <div className="flex flex-col gap-0.5 px-4 py-3.5">
                      <span className="text-xs text-muted">Check-out</span>
                      <span className="text-base font-semibold">{booking.checkOut.day}</span>
                      <span className="text-[13px] text-muted">{booking.checkOut.time}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <LinkButton href={screenHref("GuestTrip")} variant="secondary" className="min-w-[140px] flex-1">
                      <Route className="size-4" />
                      Directions
                    </LinkButton>
                    <Button
                      variant="secondary"
                      className="min-w-[140px] flex-1"
                      onPress={() => toast.warning("Adding the stay to a calendar is not available yet.")}
                    >
                      <Calendar className="size-4" />
                      Add to calendar
                    </Button>
                    <LinkButton href={screenHref("GuestTrip")} variant="secondary" className="min-w-[140px] flex-1">
                      <Comment className="size-4" />
                      Message hotel
                    </LinkButton>
                  </div>
                </div>
              </Card>
              <Card variant="secondary" className="gap-3 px-5 py-[18px]" aria-labelledby="paid-h">
                <div className="flex items-center justify-between gap-3">
                  <h2 id="paid-h" className="text-[15px] font-semibold">
                    Paid {amount}
                  </h2>
                  <Chip size="sm" variant="soft" color="success">
                    <Check className="size-3" />
                    <Chip.Label>Verified</Chip.Label>
                  </Chip>
                </div>
                <KeyValueList
                  items={[
                    {
                      label: "Method",
                      value: result?.payerMasked ? `${method?.provider} ${result.payerMasked}` : payLabel,
                    },
                    { label: "Reference", value: <span className="tabular">{result?.providerRef ?? reference}</span> },
                    { label: "Paid to", value: booking.payee },
                  ]}
                />
                <span className="text-xs text-muted">The hotel issues your fiscal receipt (EBM) at check-out.</span>
              </Card>
              <div className="flex items-center justify-center gap-2 text-[13px]">
                <CircleCheck className="size-4 text-success-soft-foreground" aria-hidden="true" />
                {booking.freeCancellation}
              </div>
              <div className="flex flex-wrap justify-center gap-2.5">
                <LinkButton href={screenHref("GuestTrip")} size="lg">
                  View your trip
                  <ArrowRight className="size-4" />
                </LinkButton>
                <LinkButton href={screenHref("GuestAccount")} variant="secondary" size="lg">
                  All trips
                </LinkButton>
              </div>
            </section>
          ) : null}

          {screen === "request-sent" ? (
            <section aria-labelledby="rq-h" className="mx-auto flex w-full max-w-[640px] flex-col gap-6">
              <div className="flex flex-col items-center gap-3 pt-2 text-center">
                <span className="flex size-16 items-center justify-center rounded-full bg-accent-soft text-accent-soft-foreground">
                  <PaperPlane className="size-7" aria-hidden="true" />
                </span>
                <h1 id="rq-h" className="text-[32px] leading-10 font-semibold tracking-[-0.02em]">
                  {withdrawn === null ? "Request sent" : "Request withdrawn"}
                </h1>
                <p className="text-[15px] leading-[22px] text-muted">
                  {withdrawn === null
                    ? `The hotel replies by ${replyBy}. Your payment is held and refunded in full if they decline.`
                    : `${reference} is cancelled. ${rwf(withdrawn)} is refunded.`}
                </p>
              </div>
              <Card className="gap-5 rounded-3xl p-6">
                <StageTrack label="Request progress" labels={REQUEST_STAGES} current={1} />
                <KeyValueList
                  items={[
                    { label: "Room", value: `${booking.room} · ${booking.guests}` },
                    { label: "Dates", value: booking.dates },
                    {
                      label: "If accepted",
                      value: (
                        <span className="tabular">
                          {amount} · {payLabel}
                        </span>
                      ),
                    },
                    { label: "Request", value: <span className="tabular">{reference}</span> },
                  ]}
                />
                <Alert status="default">
                  <Alert.Indicator>
                    <Lock />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>Room held until {replyBy}</Alert.Title>
                    <Alert.Description>
                      If the hotel doesn’t reply in time, the hold ends and you can pick another room.
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
              </Card>
              <div className="flex flex-wrap justify-center gap-2.5">
                <LinkButton href={screenHref("GuestAccount")} size="lg">
                  Go to Trips
                </LinkButton>
                {withdrawn === null && reference ? (
                  <Button variant="ghost" size="lg" isDisabled={withdrawing} onPress={() => withdraw(reference)}>
                    Cancel request
                  </Button>
                ) : (
                  <LinkButton href={propertyUrl} variant="ghost" size="lg">
                    Back to {property.name}
                  </LinkButton>
                )}
              </div>
            </section>
          ) : null}
        </MarketMain>
      </div>

      <Modal.Backdrop isOpen={screen === "approve-on-phone"} isDismissable={false}>
        <Modal.Container size="sm" placement="center">
          <Modal.Dialog
            aria-labelledby="pend-h"
            className="items-center gap-[18px] px-7 py-8 text-center sm:max-w-[420px]"
          >
            <span className="relative flex size-[76px] items-center justify-center rounded-full bg-accent-soft text-accent-soft-foreground">
              {method?.kind === "card" ? (
                <CreditCard className="size-7" aria-hidden="true" />
              ) : (
                <Smartphone className="size-7" aria-hidden="true" />
              )}
              <Spinner
                color="accent"
                aria-label="Waiting for approval"
                className="absolute -top-1.5 -left-1.5 size-[88px]"
              />
            </span>
            <div className="flex flex-col items-center gap-1.5">
              <h2 id="pend-h" className="text-[22px] leading-7 font-semibold">
                {method?.kind === "card" ? "Confirm with your bank" : "Approve on your phone"}
              </h2>
              <p className="text-sm text-muted">
                {method?.kind === "card"
                  ? "Use your banking app or the SMS code."
                  : `Enter your ${method?.provider} PIN on ${method?.mask}.`}
              </p>
            </div>
            <span className="text-[30px] leading-9 font-semibold tracking-[-0.02em] tabular">{amount}</span>
            <StageTrack label="Payment progress" labels={PAY_STAGES} current={1} />
            {resent ? (
              <Chip size="sm" variant="soft" className="self-center">
                <ArrowsRotateRight className="size-3" />
                <Chip.Label>New prompt sent · the first was cancelled</Chip.Label>
              </Chip>
            ) : null}
            <span className="text-[13px] text-muted tabular">
              {secs > 0 ? `Expires in ${mm}:${ss} · room held for you` : "Prompt expired · resend to try again"}
            </span>
            <div className="flex w-full gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onPress={() => {
                  polling.current = null;
                  setResult(null);
                  setScreen(isRequest ? "request" : "checkout");
                }}
              >
                Change method
              </Button>
              {method?.kind === "card" ? null : (
                <Button
                  variant="secondary"
                  className="flex-1"
                  isDisabled={paying}
                  onPress={() => {
                    // A new prompt is a new press: a fresh attempt; the first one lapses on its own.
                    polling.current = null;
                    setResent(true);
                    pay();
                  }}
                >
                  <ArrowsRotateRight className="size-4" />
                  Resend
                </Button>
              )}
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      <Modal.Backdrop isOpen={screen === "payment-unclear"} isDismissable={false}>
        <Modal.Container size="sm" placement="center">
          <Modal.Dialog aria-labelledby="unk-h" className="gap-[18px] p-7 sm:max-w-[460px]">
            <span className="flex size-14 items-center justify-center rounded-full bg-warning-soft text-warning-soft-foreground">
              <Hourglass className="size-7" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-1.5">
              <h2 id="unk-h" className="text-[22px] leading-7 font-semibold">
                Checking your payment
              </h2>
              <p className="text-sm text-muted">
                {method?.provider} hasn’t confirmed yet. Please don’t pay again: if it goes through, the booking confirmation is emailed to you.
              </p>
            </div>
            <div className="rounded-2xl bg-surface-secondary px-4 py-3.5">
              <KeyValueList
                items={[
                  { label: "Amount", value: <span className="tabular">{amount}</span> },
                  {
                    label: "Payment",
                    value: (
                      <span className="tabular">{result?.attemptToken.slice(0, 8) ?? booking.payment.intent}</span>
                    ),
                  },
                  { label: "Last check", value: lastCheck || "Not yet" },
                  {
                    label: "Room held",
                    value: result?.expiresAt
                      ? `Until ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kigali" }).format(new Date(result.expiresAt))}`
                      : booking.payment.heldUntil,
                  },
                ]}
              />
            </div>
            <div className="flex gap-2">
              <LinkButton href={screenHref("PublicHelp")} variant="ghost" className="flex-1">
                Get help
              </LinkButton>
              <Button className="flex-1" isDisabled={paying} onPress={checkNow}>
                <ArrowsRotateRight className="size-4" />
                Check now
              </Button>
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
      <Toast.Provider placement="bottom" />
    </>
  );
}

function SummaryRow({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="flex flex-col gap-0.5">
        <span className="font-semibold">{label}</span>
        <span>{value}</span>
      </span>
      <TextLink href={href} className="text-[13px] font-semibold underline">
        Change
      </TextLink>
    </li>
  );
}

/** Horizontal step track (artifact: the payment and request progress rows). */
function StageTrack({ labels, current, label }: { labels: string[]; current: number; label: string }) {
  return (
    <ol
      aria-label={label}
      className="grid w-full"
      style={{ gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` }}
    >
      {labels.map((name, i) => {
        const done = i < current;
        const on = i === current;
        return (
          <li
            key={name}
            aria-current={on ? "step" : undefined}
            className="flex flex-col items-center gap-1.5 text-center"
          >
            <span className="flex w-full items-center">
              <span
                className={`h-0.5 flex-1 ${i === 0 ? "bg-transparent" : i <= current ? "bg-accent" : "bg-separator"}`}
              />
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
                  done ? "bg-accent text-accent-foreground" : "bg-surface text-accent"
                } ${done ? "" : on ? "shadow-[inset_0_0_0_2px_var(--accent)]" : "shadow-[inset_0_0_0_1.5px_var(--border-secondary)]"}`}
              >
                {done ? <Check className="size-3" aria-hidden="true" /> : null}
                {on ? <span className="size-2 rounded-full bg-accent" /> : null}
              </span>
              <span
                className={`h-0.5 flex-1 ${i === labels.length - 1 ? "bg-transparent" : i < current ? "bg-accent" : "bg-separator"}`}
              />
            </span>
            <span className={`text-xs ${on ? "font-semibold" : "font-medium"} ${i <= current ? "" : "text-muted"}`}>
              {name}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
