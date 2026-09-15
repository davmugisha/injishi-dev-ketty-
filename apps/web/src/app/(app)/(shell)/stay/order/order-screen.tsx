"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  instrumentProblem,
  networkForMsisdn,
  type OrderableItem,
  type OrderableList,
  type OrderableOutlet,
  type OrderPaymentAttemptStatus,
  type PlaceOrderResult,
} from "@injishi/contracts";
import { Badge, Button, Input, Skeleton, Textarea } from "@injishi/ui";
import { formatPrice } from "@injishi/utils";
import { EmptyPanel } from "@/components/app/empty-panel";
import { Icon } from "@/components/app/icon";
import {
  cartSummary,
  EMPTY_CART,
  fetchOrderAttempt,
  fetchOrderable,
  itemCountLabel,
  MAX_QUANTITY,
  missingChoice,
  orderRequest,
  placeOrder,
  setQuantity,
  toggleChoice,
  unitEstimateRwf,
  type Cart,
  type Settlement,
} from "@/data/ordering";
import { hoursSummary, OUTLET_KIND_LABEL } from "@/data/property-facilities";
import { apiResultMessage, type ApiResult } from "@/lib/api";
import { mintAttemptToken } from "@/lib/attempt-token";
import { normaliseMsisdn } from "@/lib/payment-methods";

/** How often a waiting mobile money prompt is asked about. */
const ATTEMPT_POLL_MS = 2_500;

type SettlementChoice = "room" | "mobile_money" | "counter";

/**
 * Order food and drink: every outlet the guest may order from right now, its
 * live menu, a cart and one button (ADR-050 D-n, D-o, AC-19, AC-21, AC-22).
 *
 * `GET /api/v1/me/orderable` DECIDES WHAT IS SHOWN. The browser decides nothing
 * about policy, hours or stock: an outlet that is closed, or that this guest
 * may not order from, is simply absent. When the menu goes stale while the
 * screen is open, the server's refusal is shown in its own words and the menu
 * is read again.
 *
 * HOW THE GUEST SETTLES comes from the same answer. `chargeToRoom` offers the
 * room bill; `payNow` offers mobile money (a prompt on their handset, polled at
 * `GET /me/orders/attempts/:token`) or cash at the counter. Card is refused by
 * the API until a hosted field exists, so it is not offered.
 *
 * One cart per outlet, because one order goes to one outlet's board. The
 * `Idempotency-Key` is minted once per cart and settlement and survives a retry
 * of the same press, so a timeout pressed again is one order, not two.
 */
export function OrderScreen() {
  const router = useRouter();
  const [orderable, setOrderable] = useState<ApiResult<OrderableList> | null>(null);
  const [outletId, setOutletId] = useState<string | null>(null);
  const [carts, setCarts] = useState<Record<string, Cart>>({});
  const [settlementChoice, setSettlementChoice] = useState<SettlementChoice | null>(null);
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [waiting, setWaiting] = useState<PlaceOrderResult | null>(null);

  const loadMenu = useCallback(async () => {
    setOrderable(await fetchOrderable());
  }, []);

  useEffect(() => {
    void loadMenu();
  }, [loadMenu]);

  const outlets = orderable?.status === "ok" ? orderable.data.outlets : [];
  const outlet = outlets.find((o) => o.id === outletId) ?? outlets[0];
  const cart = outlet ? (carts[outlet.id] ?? EMPTY_CART) : EMPTY_CART;
  const summary = cartSummary(cart, outlet);

  // The settlement the guest picked, or the first the outlet allows.
  const allowed: SettlementChoice[] = outlet
    ? [
        ...(outlet.chargeToRoom ? (["room"] as const) : []),
        ...(outlet.payNow ? (["mobile_money", "counter"] as const) : []),
      ]
    : [];
  const choice = settlementChoice && allowed.includes(settlementChoice) ? settlementChoice : allowed[0];

  const national = normaliseMsisdn(phone);
  const network = national ? networkForMsisdn(national) : null;
  const settlement: Settlement | null =
    choice === "room"
      ? { kind: "room" }
      : choice === "counter"
        ? { kind: "counter" }
        : choice === "mobile_money" && national && network
          ? { kind: "mobile_money", network, msisdn: national }
          : null;

  const phoneProblem =
    choice !== "mobile_money" || phone.trim() === ""
      ? null
      : !national
        ? "Enter a Rwandan mobile number, like 078 123 4567."
        : settlement?.kind === "mobile_money"
          ? instrumentProblem({ kind: "mobile_money", network: settlement.network, msisdn: settlement.msisdn })
          : `No Rwandan network issues numbers starting ${national.slice(0, 2)}.`;

  const choiceProblem = outlet ? missingChoice(cart, outlet) : null;

  // One key per intent: this outlet, this cart, this way of paying.
  const signature = useMemo(
    () => JSON.stringify([outlet?.id ?? "", cart, settlement]),
    [outlet?.id, cart, settlement],
  );
  const key = useRef<{ signature: string; value: string } | null>(null);
  useEffect(() => setRefusal(null), [signature]);

  const change = (item: OrderableItem, quantity: number) => {
    if (!outlet) return;
    setCarts((all) => ({ ...all, [outlet.id]: setQuantity(all[outlet.id] ?? EMPTY_CART, item.id, quantity) }));
  };
  const pick = (item: OrderableItem, optionName: string, label: string) => {
    if (!outlet) return;
    setCarts((all) => ({
      ...all,
      [outlet.id]: toggleChoice(all[outlet.id] ?? EMPTY_CART, item, optionName, label),
    }));
  };

  const finish = (orderId: string) => {
    router.push(`/stay?placed=${encodeURIComponent(orderId)}`);
  };

  const submit = async () => {
    if (!outlet || !settlement || summary.count === 0 || busy || choiceProblem || phoneProblem) return;
    if (key.current?.signature !== signature) {
      key.current = { signature, value: mintAttemptToken() };
    }
    setBusy(true);
    setRefusal(null);
    const answer = await placeOrder(orderRequest(cart, outlet, settlement, note), key.current.value);
    setBusy(false);

    if (answer.status === "ok") {
      setCarts((all) => ({ ...all, [outlet.id]: EMPTY_CART }));
      key.current = null;
      // A mobile money order waits on the handset (or was refused at once);
      // every other order is already on the outlet's board.
      if (answer.data.attempt && answer.data.attempt.state !== "confirmed") {
        setWaiting(answer.data);
        return;
      }
      finish(answer.data.id);
      return;
    }
    if (answer.status === "refused") {
      // The server's own sentence: a closed outlet, a sold out dish, a bill
      // already signed. Read the menu again so it stops offering what it refused.
      setRefusal(answer.message);
      void loadMenu();
      return;
    }
    setRefusal(
      answer.status === "failed"
        ? "We couldn't get an answer from Injishi. Your cart is kept; pressing the button again will not order twice."
        : apiResultMessage(answer),
    );
  };

  if (waiting) {
    return (
      <PaymentWait
        placed={waiting}
        onDone={() => finish(waiting.id)}
        onBack={() => {
          setWaiting(null);
          void loadMenu();
        }}
      />
    );
  }

  if (orderable === null) return <MenuLoading />;

  if (orderable.status === "unauthenticated") {
    return (
      <EmptyPanel
        icon="lock"
        title="Sign in to order"
        action={{ label: "Sign in", href: "/sign-in?redirect=%2Fstay%2Forder" }}
      >
        Orders go on your own bill or your own phone, so ordering needs you signed in.
      </EmptyPanel>
    );
  }

  if (orderable.status !== "ok") {
    return (
      <div className="mx-auto flex max-w-narrow animate-arrive flex-col items-center gap-3 px-4 py-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-card bg-secondary text-muted-foreground">
          <Icon name="triangle-alert" className="size-6" />
        </span>
        <h2 className="font-display text-xl font-bold tracking-tight">
          We couldn&apos;t load what&apos;s on
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {apiResultMessage(orderable)}
        </p>
        <Button className="mt-2" onClick={() => void loadMenu()}>
          Try again
        </Button>
      </div>
    );
  }

  if (!outlet) {
    return (
      <div className="mx-auto flex w-full max-w-page flex-col gap-4 px-4 py-8 sm:px-6">
        <BackToStay />
        <EmptyPanel icon="coffee" title="Nothing to order from right now" action={{ label: "Back to my stay", href: "/stay" }}>
          No outlet is taking orders from you at the moment. Ordering to your
          room opens once a front desk has checked you in, and an outlet that is
          closed appears here when it opens.
        </EmptyPanel>
      </div>
    );
  }

  const canPlace =
    summary.count > 0 && settlement !== null && !busy && choiceProblem === null && phoneProblem === null;

  return (
    <div className="mx-auto flex w-full max-w-page flex-col gap-block px-4 py-8 sm:px-6">
      <BackToStay />

      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight">Order food and drink</h1>
        <p className="mt-1 text-sm text-muted-foreground">{outlet.propertyName}</p>
      </header>

      {outlets.length > 1 ? (
        <nav className="flex flex-wrap gap-2" aria-label="Choose where to order from">
          {outlets.map((o) => {
            const count = cartSummary(carts[o.id] ?? EMPTY_CART, o).count;
            return (
              <Button
                key={o.id}
                size="sm"
                variant={o.id === outlet.id ? "primary" : "outline"}
                aria-pressed={o.id === outlet.id}
                onClick={() => setOutletId(o.id)}
              >
                {o.name}
                {count > 0 ? ` (${count})` : ""}
              </Button>
            );
          })}
        </nav>
      ) : null}

      <OutletHeader outlet={outlet} />

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {outlet.categories.map((category) => (
            <section key={category.id}>
              <h2 className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
                {category.name}
              </h2>
              <ul className="m-0 mt-3 list-none divide-y divide-border rounded-card border border-border bg-card p-0">
                {category.items.map((item) => (
                  <MenuRow
                    key={item.id}
                    item={item}
                    cart={cart}
                    onChange={(q) => change(item, q)}
                    onPick={(option, label) => pick(item, option, label)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>

        <aside className="flex flex-col gap-4 rounded-card border border-border bg-card p-5 lg:sticky lg:top-6">
          <h2 className="font-display text-lg font-bold tracking-tight">Your order</h2>

          {summary.count === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing in it yet. Add something from the menu and it appears here
              before anything is sent.
            </p>
          ) : (
            <div className="flex items-baseline justify-between gap-3 border-b border-border pb-3">
              <span className="text-sm text-muted-foreground">{itemCountLabel(summary.count)}</span>
              <span className="text-right">
                <span className="money block font-display text-xl font-bold">
                  {formatPrice(summary.subtotalRwf)}
                </span>
                <span className="text-xs text-muted-foreground">before tax; the order shows the total</span>
              </span>
            </div>
          )}

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-2xs font-bold uppercase tracking-widest text-muted-foreground">
              How you&apos;ll pay
            </legend>
            {allowed.includes("room") ? (
              <SettlementOption
                active={choice === "room"}
                onSelect={() => setSettlementChoice("room")}
                title="Charge to my room"
                body="Added to your bill and settled when you check out."
              />
            ) : null}
            {allowed.includes("mobile_money") ? (
              <SettlementOption
                active={choice === "mobile_money"}
                onSelect={() => setSettlementChoice("mobile_money")}
                title="Mobile money now"
                body="MTN MoMo or Airtel Money. You approve the prompt on your phone."
              />
            ) : null}
            {allowed.includes("counter") ? (
              <SettlementOption
                active={choice === "counter"}
                onSelect={() => setSettlementChoice("counter")}
                title="Pay at the counter"
                body="The outlet takes cash when you collect."
              />
            ) : null}
          </fieldset>

          {choice === "mobile_money" ? (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Mobile money number</span>
              <Input
                inputMode="tel"
                autoComplete="tel"
                placeholder="078 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                aria-invalid={phoneProblem !== null}
              />
              {phoneProblem ? <span className="text-xs text-destructive">{phoneProblem}</span> : null}
            </label>
          ) : null}

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Note for the outlet (optional)</span>
            <Textarea value={note} maxLength={500} rows={2} onChange={(e) => setNote(e.target.value)} />
          </label>

          {choiceProblem && summary.count > 0 ? (
            <p className="text-sm text-muted-foreground">{choiceProblem}</p>
          ) : null}

          {refusal ? (
            <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
              <Icon name="triangle-alert" className="mt-0.5 size-4 shrink-0" />
              <span>{refusal}</span>
            </p>
          ) : null}

          <Button fullWidth disabled={!canPlace} onClick={() => void submit()}>
            {busy ? "Placing…" : summary.count === 0 ? "Add something first" : `Place order at ${outlet.name}`}
          </Button>
        </aside>
      </div>
    </div>
  );
}

function BackToStay() {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
      <Link href="/stay">
        <Icon name="arrow-left" className="size-4" />
        My stay
      </Link>
    </Button>
  );
}

function OutletHeader({ outlet }: { outlet: OrderableOutlet }) {
  const hours = hoursSummary(outlet.hours);
  return (
    <section className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-secondary p-inset text-secondary-foreground">
      <span className="flex size-10 items-center justify-center rounded-card bg-card">
        <Icon name="coffee" className="size-5" />
      </span>
      <div className="min-w-0 grow">
        <p className="font-semibold">{outlet.name}</p>
        <p className="text-xs text-muted-foreground">
          {OUTLET_KIND_LABEL[outlet.outletKind]}
          {hours ? ` · ${hours}` : ""}
          {outlet.operatorLabel ? ` · ${outlet.operatorLabel}` : ""}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {outlet.chargeToRoom ? <Badge variant="accent" size="sm">Room charge</Badge> : null}
        {outlet.payNow ? <Badge variant="outline" size="sm">Pay now</Badge> : null}
      </div>
    </section>
  );
}

function MenuRow({
  item,
  cart,
  onChange,
  onPick,
}: {
  item: OrderableItem;
  cart: Cart;
  onChange: (quantity: number) => void;
  onPick: (optionName: string, label: string) => void;
}) {
  const line = cart[item.id];
  const quantity = line?.quantity ?? 0;
  return (
    <li className="flex flex-col gap-3 p-4 sm:px-5">
      <div className="flex items-start gap-4">
        <div className="min-w-0 grow">
          <h3 className="text-sm font-semibold">{item.name}</h3>
          {item.description ? (
            <p className="mt-1 max-w-read text-xs leading-relaxed text-muted-foreground">
              {item.description}
            </p>
          ) : null}
          <p className="money mt-1 text-sm">
            {formatPrice(line ? unitEstimateRwf(item, line) : item.priceRwf)}
            {item.prepTimeMinutes ? (
              <span className="text-xs text-muted-foreground"> · about {item.prepTimeMinutes} min</span>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            disabled={quantity === 0}
            onClick={() => onChange(quantity - 1)}
            aria-label={`One fewer ${item.name}`}
          >
            <Icon name="minus" className="size-4" />
          </Button>
          <span className="money w-6 text-center text-sm font-semibold" aria-live="off">
            {quantity === 0 ? "" : quantity}
          </span>
          <Button
            variant="ghost"
            size="icon"
            disabled={quantity >= MAX_QUANTITY}
            onClick={() => onChange(quantity + 1)}
            aria-label={`One more ${item.name}`}
          >
            <Icon name="plus" className="size-4" />
          </Button>
        </div>
      </div>

      {line && item.options.length > 0 ? (
        <div className="flex flex-col gap-2">
          {item.options.map((option) => {
            const picked = line.choices[option.name] ?? [];
            return (
              <div key={option.name} role="group" aria-label={option.name} className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {option.name}
                  {option.required ? " (required)" : ""}
                </span>
                {option.choices.map((c) => (
                  <Button
                    key={c.label}
                    size="sm"
                    variant={picked.includes(c.label) ? "primary" : "outline"}
                    aria-pressed={picked.includes(c.label)}
                    onClick={() => onPick(option.name, c.label)}
                  >
                    {c.label}
                    {c.priceDeltaRwf !== 0
                      ? ` ${c.priceDeltaRwf > 0 ? "+" : "−"}${formatPrice(Math.abs(c.priceDeltaRwf))}`
                      : ""}
                  </Button>
                ))}
              </div>
            );
          })}
        </div>
      ) : null}
    </li>
  );
}

function SettlementOption({
  active,
  onSelect,
  title,
  body,
}: {
  active: boolean;
  onSelect: () => void;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={`flex flex-col items-start gap-0.5 rounded border p-3 text-left ${
        active ? "border-accent bg-secondary" : "border-border bg-card"
      }`}
    >
      <span className="text-sm font-semibold">{title}</span>
      <span className="text-xs text-muted-foreground">{body}</span>
    </button>
  );
}

/**
 * Waiting on a mobile money prompt, then sending the guest to follow the order.
 *
 * The attempt is a row on the server, not state in this tab: polling it is safe
 * in a loop, and a guest who closes the page mid-payment has not lost the order,
 * which `/stay` still lists as "Waiting for payment".
 */
function PaymentWait({
  placed,
  onDone,
  onBack,
}: {
  placed: PlaceOrderResult;
  onDone: () => void;
  onBack: () => void;
}) {
  const token = placed.attempt?.attemptToken ?? null;
  const [attempt, setAttempt] = useState<OrderPaymentAttemptStatus | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const state = attempt?.state ?? placed.attempt?.state ?? "prompting";
  const left = useRef(false);

  useEffect(() => {
    if (!token || state !== "prompting") return;
    let stopped = false;
    const tick = async () => {
      const result = await fetchOrderAttempt(token);
      if (stopped) return;
      if (result.status === "ok") {
        setProblem(null);
        setAttempt(result.data);
      } else {
        // Not knowing is not a failure of the payment: keep asking, say so.
        setProblem(apiResultMessage(result));
      }
    };
    const timer = setInterval(() => void tick(), ATTEMPT_POLL_MS);
    void tick();
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [token, state]);

  useEffect(() => {
    if (state !== "confirmed" || left.current) return;
    left.current = true;
    onDone();
  }, [state, onDone]);

  const failure = attempt?.failureReason ?? placed.attempt?.failureReason ?? null;
  const payer = attempt?.payerMasked ?? placed.attempt?.payerMasked ?? null;

  return (
    <div className="mx-auto flex max-w-narrow animate-arrive flex-col items-center gap-3 px-4 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-card bg-secondary text-muted-foreground">
        <Icon name={state === "prompting" ? "smartphone" : state === "confirmed" ? "circle-check" : "triangle-alert"} className="size-6" />
      </span>
      {state === "prompting" ? (
        <>
          <h2 className="font-display text-xl font-bold tracking-tight">Approve the payment on your phone</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We sent a prompt for <span className="money">{formatPrice(placed.totalRwf)}</span>
            {payer ? <> to <span className="money">{payer}</span></> : null}. Order{" "}
            <span className="money">{placed.orderNumber}</span> goes to {placed.outletName} once
            it is paid.
          </p>
          <span className="sr-only" role="status">
            Waiting for your payment
          </span>
          {problem ? <p className="text-xs text-muted-foreground">{problem} We&apos;ll keep checking.</p> : null}
          <Button variant="outline" className="mt-2" onClick={onDone}>
            Follow it on My stay
          </Button>
        </>
      ) : state === "confirmed" ? (
        <h2 className="font-display text-xl font-bold tracking-tight">Paid. Taking you to your order…</h2>
      ) : (
        <>
          <h2 className="font-display text-xl font-bold tracking-tight">
            {state === "expired" ? "The payment prompt timed out" : "The payment didn't go through"}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {failure ?? "Nothing was taken."} Order {placed.orderNumber} was not sent to the outlet.
          </p>
          <Button className="mt-2" onClick={onBack}>
            Back to the menu
          </Button>
        </>
      )}
    </div>
  );
}

function MenuLoading() {
  return (
    <div className="mx-auto flex w-full max-w-page flex-col gap-4 px-4 py-8 sm:px-6">
      <span className="sr-only" role="status">
        Getting what&apos;s on
      </span>
      <Skeleton className="h-8 w-56 rounded" />
      <Skeleton className="h-16 rounded-card" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-64 rounded-card lg:col-span-2" />
        <Skeleton className="h-64 rounded-card" />
      </div>
    </div>
  );
}
