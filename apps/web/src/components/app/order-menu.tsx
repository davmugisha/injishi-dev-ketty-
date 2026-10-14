"use client";

import { useEffect, useRef, useState } from "react";
import type { OrderableItem, OrderableOutlet, OrderPaymentAttemptStatus, PlaceOrderResult } from "@injishi/contracts";
import { Badge, Button, Input, Textarea } from "@injishi/ui";
import { formatPrice } from "@injishi/utils";
import { Icon } from "@/components/app/icon";
import type { OrderDraft } from "@/components/app/order-draft";
import { fetchOrderAttempt, MAX_QUANTITY, unitEstimateRwf } from "@/data/ordering";
import { hoursSummary, OUTLET_KIND_LABEL } from "@/data/property-facilities";
import { apiResultMessage } from "@/lib/api";

/**
 * The parts of ordering that look the same wherever a guest orders.
 *
 * `useOrderDraft` is the one implementation of what an order costs and how it
 * is paid; this is the one implementation of how those choices are PUT to a
 * person. A dish row where the price moves as options are picked, a payment
 * choice that says what each way means, and the wait on a mobile money prompt
 * are the same job on `/stay/order` and inside a conversation, and a second
 * copy of any of them would drift — the quantity stepper's accessible labels
 * and the "before tax" caveat are exactly the details a second copy loses.
 *
 * Layout is NOT here. `/stay/order` is a three-column menu screen and the
 * in-chat composer is a panel the width of the conversation; each owns its own
 * arrangement of these pieces.
 *
 * They live under `components/app/` rather than a folder of their own because
 * only `(app)`, `components/app`, `components/stay`, `components/auth`,
 * `components/shared` and `components/icons` are in the signed-in stylesheet's
 * `@source` list (`app/_injishi-app.css`). A class used only inside a folder
 * that is not on that list is never generated, and the component renders
 * missing exactly the classes nothing else in the app happens to spell.
 */

/** How often a waiting mobile money prompt is asked about. */
const ATTEMPT_POLL_MS = 2_500;

/** The outlet's own line: what it is, when it is open, how it takes money. */
export function OutletHeader({ outlet }: { outlet: OrderableOutlet }) {
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

/**
 * One dish.
 *
 * The price shown is the price of the unit AS CONFIGURED — picking a large
 * size moves it — because a menu that shows the base price beside chosen
 * options is a menu that surprises somebody at the till.
 */
export function MenuRow({
  item,
  draft,
}: {
  item: OrderableItem;
  draft: OrderDraft;
}) {
  const line = draft.cart[item.id];
  const quantity = line?.quantity ?? 0;
  return (
    <li className="flex flex-col gap-3 p-4 sm:px-5">
      <div className="flex items-start gap-4">
        <div className="min-w-0 grow">
          {/*
            A dish name is not a heading. Forty of them in a screen reader's
            heading list is noise that buries the category headings, which are
            the level somebody actually navigates a menu by.
          */}
          <p className="text-sm font-semibold">{item.name}</p>
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
            onClick={() => draft.setItemQuantity(item, quantity - 1)}
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
            onClick={() => draft.setItemQuantity(item, quantity + 1)}
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
                    onClick={() => draft.pickChoice(item, option.name, c.label)}
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

/**
 * The whole menu, category by category.
 *
 * `categoryAs` exists because the same list sits at two depths. On
 * `/stay/order` the page's `h1` is "Order food and drink" and a category is
 * the level below it; inside a conversation the `h1` is the thread title and
 * the order panel's own heading takes `h2`, so a category is one deeper. A
 * shared list that hard-coded `h2` would skip or repeat a level in one of the
 * two, which is what makes a heading outline useless to navigate by.
 */
export function MenuList({
  outlet,
  draft,
  categoryAs: Category = "h2",
}: {
  outlet: OrderableOutlet;
  draft: OrderDraft;
  categoryAs?: "h2" | "h3";
}) {
  return (
    <div className="flex flex-col gap-6">
      {outlet.categories.map((category) => (
        <section key={category.id}>
          <Category className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
            {category.name}
          </Category>
          <ul className="m-0 mt-3 list-none divide-y divide-border rounded-card border border-border bg-card p-0">
            {category.items.map((item) => (
              <MenuRow key={item.id} item={item} draft={draft} />
            ))}
          </ul>
        </section>
      ))}
    </div>
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
 * How the guest settles, and the number when that needs one.
 *
 * Only what the outlet allows is offered: `chargeToRoom` and `payNow` are the
 * server's answer for THIS guest at THIS outlet, so an outlet that will not put
 * anything on a room bill simply has no room option rather than one that fails.
 * Card is refused by the API until a hosted field exists (D-p), so it is not
 * offered at all.
 */
export function SettlementPicker({ draft }: { draft: OrderDraft }) {
  return (
    <>
      {/*
        `role="radiogroup"` on the fieldset, because the options below are
        `role="radio"`. A radio with no group around it is announced as a
        stray control with no set to be one of — the reader is told "selected"
        without being told selected out of what, and arrow keys do not move
        between them. The `legend` becomes the group's name.
      */}
      <fieldset role="radiogroup" aria-label="How you'll pay" className="flex flex-col gap-2">
        <legend className="mb-2 text-2xs font-bold uppercase tracking-widest text-muted-foreground">
          How you&apos;ll pay
        </legend>
        {draft.allowed.includes("room") ? (
          <SettlementOption
            active={draft.choice === "room"}
            onSelect={() => draft.chooseSettlement("room")}
            title="Charge to my room"
            body="Added to your bill and settled when you check out."
          />
        ) : null}
        {draft.allowed.includes("mobile_money") ? (
          <SettlementOption
            active={draft.choice === "mobile_money"}
            onSelect={() => draft.chooseSettlement("mobile_money")}
            title="Mobile money now"
            body="MTN MoMo or Airtel Money. You approve the prompt on your phone."
          />
        ) : null}
        {draft.allowed.includes("counter") ? (
          <SettlementOption
            active={draft.choice === "counter"}
            onSelect={() => draft.chooseSettlement("counter")}
            title="Pay at the counter"
            body="The outlet takes cash when you collect."
          />
        ) : null}
      </fieldset>

      {draft.choice === "mobile_money" ? (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Mobile money number</span>
          <Input
            inputMode="tel"
            autoComplete="tel"
            placeholder="078 123 4567"
            value={draft.phone}
            onChange={(e) => draft.setPhone(e.target.value)}
            aria-invalid={draft.phoneProblem !== null}
          />
          {draft.phoneProblem ? (
            <span className="text-xs text-destructive">{draft.phoneProblem}</span>
          ) : null}
        </label>
      ) : null}
    </>
  );
}

/** The optional line for the kitchen. Same ceiling as the API accepts. */
export function OrderNoteField({ draft }: { draft: OrderDraft }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">Note for the outlet (optional)</span>
      <Textarea
        value={draft.note}
        maxLength={500}
        rows={2}
        onChange={(e) => draft.setNote(e.target.value)}
      />
    </label>
  );
}

/**
 * Waiting on a mobile money prompt.
 *
 * The attempt is a row on the server, not state in this tab: polling it is safe
 * in a loop, and a guest who closes the page mid-payment has not lost the order,
 * which `/stay` still lists as "Waiting for payment".
 *
 * `doneLabel` is the only thing the two callers differ on, because where a
 * paid order takes you is the difference between the two paths: the menu screen
 * hands the guest to their stay, the conversation keeps them where they were.
 */
export function PaymentWait({
  placed,
  doneLabel,
  onDone,
  onBack,
}: {
  placed: PlaceOrderResult;
  doneLabel: string;
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
        <Icon
          name={state === "prompting" ? "smartphone" : state === "confirmed" ? "circle-check" : "triangle-alert"}
          className="size-6"
        />
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
            {doneLabel}
          </Button>
        </>
      ) : state === "confirmed" ? (
        // Both callers leave this branch at once — one navigates, one closes
        // the panel — so the sentence must be true of either. "Taking you to
        // your order" was not: inside a conversation nothing moves.
        <h2 className="font-display text-xl font-bold tracking-tight">Paid. Sending your order…</h2>
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
