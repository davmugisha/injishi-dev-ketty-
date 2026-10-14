"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  instrumentProblem,
  networkForMsisdn,
  type OrderableItem,
  type OrderableOutlet,
  type PlaceOrderResult,
} from "@injishi/contracts";
import {
  cartSummary,
  EMPTY_CART,
  missingChoice,
  orderRequest,
  placeOrder,
  setQuantity,
  toggleChoice,
  type Cart,
  type Settlement,
} from "@/data/ordering";
import { apiResultMessage } from "@/lib/api";
import { mintAttemptToken } from "@/lib/attempt-token";
import { normaliseMsisdn } from "@/lib/payment-methods";

/**
 * ONE implementation of an order in progress, for both screens that take one.
 *
 * `/stay/order` is the menu-first path — the guest browses, then orders. A
 * conversation is the chat path — the guest is already talking to the property
 * and wants a coffee without losing the thread. They are different screens and
 * must stay different screens, but they are the SAME order: the same cart, the
 * same tax-exclusive estimate, the same required-option check, the same
 * settlement rules, the same idempotency key.
 *
 * This file exists because the alternative was writing that twice. A second
 * implementation of "what does this order cost" is a bug this repository has
 * already paid for once — three copies of `button.tsx` with a fix in one of
 * them is why `no-duplicate-shared-component` exists — and a pricing rule is a
 * worse thing to fork than a border radius.
 *
 * WHAT IS NOT HERE, deliberately: the menu's markup, where the guest goes
 * afterwards, and whether ordering is offered at all. The first is layout and
 * differs; the second is the caller's (`/stay/order` navigates, a conversation
 * stays put — that is the whole point of the chat path); the third is the
 * server's, via `lib/thread-ordering.ts`.
 *
 * The arithmetic itself still lives in `data/ordering.ts` — `cartSummary`,
 * `orderRequest`, `missingChoice` are pure and tested there. This hook is the
 * React state around them.
 */

/** How the guest settles, as the three buttons name it. */
export type SettlementChoice = "room" | "mobile_money" | "counter";

export interface OrderDraft {
  /** The cart for the outlet passed in. Carts are kept per outlet. */
  cart: Cart;
  /** Item count and the TAX EXCLUSIVE subtotal the menu states. An estimate. */
  summary: { count: number; subtotalRwf: number };
  setItemQuantity: (item: OrderableItem, quantity: number) => void;
  pickChoice: (item: OrderableItem, optionName: string, label: string) => void;
  /**
   * How many items are waiting in ANOTHER outlet's cart.
   *
   * A guest comparing two menus fills one, switches to look at the other and
   * must find the first still filled when they switch back. The picker prints
   * this beside each outlet's name, which is the only thing that makes the
   * kept cart visible — without it, switching away looks like losing it.
   */
  cartCount: (outlet: OrderableOutlet) => number;

  /** The ways this outlet allows, in the order they are offered. */
  allowed: SettlementChoice[];
  /** The one in force: what the guest picked, or the first this outlet allows. */
  choice: SettlementChoice | undefined;
  chooseSettlement: (choice: SettlementChoice) => void;

  phone: string;
  setPhone: (value: string) => void;
  /** Why this number cannot be charged, once something has been typed. */
  phoneProblem: string | null;

  note: string;
  setNote: (value: string) => void;

  /** The first line still owing a required option, named. */
  choiceProblem: string | null;
  /** The server's own sentence for a refusal, or ours for an unreachable API. */
  refusal: string | null;
  busy: boolean;
  canPlace: boolean;

  /** A mobile money order waiting on the handset. Render `<PaymentWait>`. */
  waiting: PlaceOrderResult | null;
  /**
   * End the wait, whichever way it ended.
   *
   * One function for backing out and for a confirmed payment, because both
   * leave the same two facts behind: this tab is no longer watching an
   * attempt, and the menu it was ordering from is a minute old and may have
   * lost the stock this order just took.
   */
  closeWait: () => void;

  place: () => Promise<void>;
}

export function useOrderDraft({
  outlet,
  threadId,
  onPlaced,
  onMenuStale,
}: {
  /** The outlet in view. Undefined while the menu is loading or empty. */
  outlet: OrderableOutlet | undefined;
  /** The conversation this order is placed from, when there is one (D-s). */
  threadId?: string;
  /** The order is on the outlet's board (or paid). Called once, per order. */
  onPlaced: (placed: PlaceOrderResult) => void;
  /** The menu is out of date — a refusal proved it. Read it again. */
  onMenuStale: () => void;
}): OrderDraft {
  const [carts, setCarts] = useState<Record<string, Cart>>({});
  const [settlementChoice, setSettlementChoice] = useState<SettlementChoice | null>(null);
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [waiting, setWaiting] = useState<PlaceOrderResult | null>(null);

  // The callbacks are read through refs so `place` keeps a stable identity and
  // a caller does not have to remember to `useCallback` them. A caller that
  // forgot would re-mint nothing and break nothing, but it would re-run every
  // effect keyed on this hook's output on every keystroke in the note field.
  const placed = useRef(onPlaced);
  const stale = useRef(onMenuStale);
  useEffect(() => {
    placed.current = onPlaced;
    stale.current = onMenuStale;
  });

  const cart = outlet ? (carts[outlet.id] ?? EMPTY_CART) : EMPTY_CART;
  const summary = cartSummary(cart, outlet);

  const allowed: SettlementChoice[] = outlet
    ? [
        ...(outlet.chargeToRoom ? (["room"] as const) : []),
        ...(outlet.payNow ? (["mobile_money", "counter"] as const) : []),
      ]
    : [];
  const choice =
    settlementChoice && allowed.includes(settlementChoice) ? settlementChoice : allowed[0];

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
          ? instrumentProblem({
              kind: "mobile_money",
              network: settlement.network,
              msisdn: settlement.msisdn,
            })
          : `No Rwandan network issues numbers starting ${national.slice(0, 2)}.`;

  const choiceProblem = outlet ? missingChoice(cart, outlet) : null;

  // One key per INTENT: this outlet, this cart, this way of paying. Minted once
  // and reused on every retry of that intent, so a press that times out and is
  // pressed again is one order on the bill. Changing the cart changes the
  // intent, and a new intent gets a new key.
  const signature = useMemo(
    () => JSON.stringify([outlet?.id ?? "", cart, settlement]),
    [outlet?.id, cart, settlement],
  );
  const key = useRef<{ signature: string; value: string } | null>(null);
  useEffect(() => setRefusal(null), [signature]);

  const setItemQuantity = useCallback(
    (item: OrderableItem, quantity: number) => {
      if (!outlet) return;
      setCarts((all) => ({
        ...all,
        [outlet.id]: setQuantity(all[outlet.id] ?? EMPTY_CART, item.id, quantity),
      }));
    },
    [outlet],
  );

  const pickChoice = useCallback(
    (item: OrderableItem, optionName: string, label: string) => {
      if (!outlet) return;
      setCarts((all) => ({
        ...all,
        [outlet.id]: toggleChoice(all[outlet.id] ?? EMPTY_CART, item, optionName, label),
      }));
    },
    [outlet],
  );

  const cartCount = useCallback(
    (which: OrderableOutlet) => cartSummary(carts[which.id] ?? EMPTY_CART, which).count,
    [carts],
  );

  const canPlace =
    summary.count > 0 &&
    settlement !== null &&
    !busy &&
    choiceProblem === null &&
    phoneProblem === null;

  const place = useCallback(async () => {
    if (!outlet || !settlement || summary.count === 0 || busy) return;
    if (choiceProblem || phoneProblem) return;
    if (key.current?.signature !== signature) {
      key.current = { signature, value: mintAttemptToken() };
    }
    setBusy(true);
    setRefusal(null);
    const answer = await placeOrder(
      { ...orderRequest(cart, outlet, settlement, note), ...(threadId ? { threadId } : {}) },
      key.current.value,
    );
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
      placed.current(answer.data);
      return;
    }
    if (answer.status === "refused") {
      // The server's own sentence: a closed outlet, a sold out dish, a bill
      // already signed. Read the menu again so it stops offering what it refused.
      setRefusal(answer.message);
      stale.current();
      return;
    }
    setRefusal(
      answer.status === "failed"
        ? "We couldn't get an answer from Injishi. Your cart is kept; pressing the button again will not order twice."
        : apiResultMessage(answer),
    );
  }, [outlet, settlement, summary.count, busy, choiceProblem, phoneProblem, signature, cart, note, threadId]);

  const closeWait = useCallback(() => {
    setWaiting(null);
    stale.current();
  }, []);

  return {
    cart,
    summary,
    setItemQuantity,
    pickChoice,
    cartCount,
    allowed,
    choice,
    chooseSettlement: setSettlementChoice,
    phone,
    setPhone,
    phoneProblem,
    note,
    setNote,
    choiceProblem,
    refusal,
    busy,
    canPlace,
    waiting,
    closeWait,
    place,
  };
}
