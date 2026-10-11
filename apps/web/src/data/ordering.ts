import {
  GuestOrderDetail,
  GuestOrderList,
  OrderableList,
  OrderPaymentAttemptStatus,
  PlaceOrderResult,
  type GuestOrder,
  type OrderableItem,
  type OrderableOutlet,
  type PlaceOrderRequest,
  type ServiceOrderStatus,
} from "@injishi/contracts";
import { apiFetchParsed, type ApiResult } from "@/lib/api";

/**
 * In-stay ordering against the REAL API (ADR-050 D-n, D-o).
 *
 * This replaces `lib/order-store.ts`, which fabricated orders in localStorage
 * against the `data/dining.ts` fixture: nothing it "placed" reached a kitchen.
 * `apps/mobile/src/queries/ordering.ts` proved these request shapes first.
 *
 * What the SERVER decides and this file never second guesses: which outlets
 * the guest may order from (their open stays, each outlet's policy, its hours,
 * its stock), whether an order may go on a room bill, and every price and tax
 * on a placed order. The cart total before placing is the menu's own TAX
 * EXCLUSIVE sum and is labelled as an estimate; the totals after placing are
 * the server's locked snapshots.
 *
 * Every read is parsed against its contract schema (`safeParse`); a body that
 * does not match is `failed`, never rendered.
 */

/**
 * `GET /api/v1/me/orderable`: every outlet the caller may order from right now.
 *
 * `propertyId` ADDS a property to the ones resolved from the caller's open
 * stays; it does not restrict the answer to it (`guest-ordering.service.ts`
 * unions the two). That is what lets a conversation ask about the hotel it is
 * ABOUT rather than the hotel the guest happens to be standing in — and it is
 * why a caller that cares about one property must filter the answer itself.
 * `threadOrdering` in `lib/thread-ordering.ts` is where that filter lives.
 */
export function fetchOrderable(propertyId?: string): Promise<ApiResult<OrderableList>> {
  const query = propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : "";
  return apiFetchParsed(OrderableList, `/api/v1/me/orderable${query}`);
}

/** `GET /api/v1/me/orders`: the caller's own orders, newest first. */
export async function fetchMyOrders(): Promise<ApiResult<GuestOrder[]>> {
  const result = await apiFetchParsed(GuestOrderList, "/api/v1/me/orders");
  return result.status === "ok" ? { status: "ok", data: result.data.orders } : result;
}

/** `GET /api/v1/me/orders/:id`: one order with its trail. */
export function fetchMyOrder(id: string): Promise<ApiResult<GuestOrderDetail>> {
  return apiFetchParsed(GuestOrderDetail, `/api/v1/me/orders/${encodeURIComponent(id)}`);
}

/**
 * `POST /api/v1/me/orders`. `idempotencyKey` is minted once per cart and reused
 * on every retry of that cart, so a press that times out and is pressed again
 * is one order on the bill, not two.
 */
export function placeOrder(
  body: PlaceOrderRequest,
  idempotencyKey: string,
): Promise<ApiResult<PlaceOrderResult>> {
  return apiFetchParsed(PlaceOrderResult, "/api/v1/me/orders", {
    method: "POST",
    body,
    idempotencyKey,
  });
}

/** `POST /api/v1/me/orders/:id/cancel`. Refused (409) once money moved or the kitchen started. */
export function cancelMyOrder(id: string): Promise<ApiResult<GuestOrderDetail>> {
  return apiFetchParsed(GuestOrderDetail, `/api/v1/me/orders/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
  });
}

/** `GET /api/v1/me/orders/attempts/:token`: where a pay now mobile money prompt got to. */
export function fetchOrderAttempt(token: string): Promise<ApiResult<OrderPaymentAttemptStatus>> {
  return apiFetchParsed(
    OrderPaymentAttemptStatus,
    `/api/v1/me/orders/attempts/${encodeURIComponent(token)}`,
  );
}

// --- The cart ---------------------------------------------------------------

/** Quantity bounds the API accepts per line (`PlaceOrderRequest`). */
export const MAX_QUANTITY = 50;

/** One line of a cart: how many, and the choices picked per option name. */
export interface CartLine {
  quantity: number;
  choices: Readonly<Record<string, readonly string[]>>;
}

/** One outlet's cart: item id to line. One order goes to one outlet. */
export type Cart = Readonly<Record<string, CartLine>>;

export const EMPTY_CART: Cart = Object.freeze({});

export function setQuantity(cart: Cart, itemId: string, quantity: number): Cart {
  const next: Record<string, CartLine> = { ...cart };
  const bounded = Math.max(0, Math.min(MAX_QUANTITY, Math.floor(quantity)));
  if (bounded === 0) delete next[itemId];
  else next[itemId] = { quantity: bounded, choices: cart[itemId]?.choices ?? {} };
  return next;
}

/**
 * Toggle one choice of one option on a line.
 *
 * An option with `maxChoices` 1 behaves like a radio: picking another choice
 * replaces the first. Above 1, a choice past the limit is ignored rather than
 * silently dropping an earlier pick.
 */
export function toggleChoice(
  cart: Cart,
  item: OrderableItem,
  optionName: string,
  label: string,
): Cart {
  const line = cart[item.id];
  const option = item.options.find((o) => o.name === optionName);
  if (!line || !option) return cart;
  const current = line.choices[optionName] ?? [];
  let picked: string[];
  if (current.includes(label)) picked = current.filter((c) => c !== label);
  else if (option.maxChoices <= 1) picked = [label];
  else if (current.length >= option.maxChoices) return cart;
  else picked = [...current, label];
  return { ...cart, [item.id]: { ...line, choices: { ...line.choices, [optionName]: picked } } };
}

function itemsOf(outlet: OrderableOutlet): Map<string, OrderableItem> {
  return new Map(outlet.categories.flatMap((c) => c.items).map((i) => [i.id, i]));
}

/** The price of one unit with its picked options, tax exclusive, as the menu states it. */
export function unitEstimateRwf(item: OrderableItem, line: CartLine): number {
  let price = item.priceRwf;
  for (const option of item.options) {
    for (const label of line.choices[option.name] ?? []) {
      price += option.choices.find((c) => c.label === label)?.priceDeltaRwf ?? 0;
    }
  }
  return price;
}

/**
 * The cart as the menu prices it: item count and the TAX EXCLUSIVE subtotal.
 * An estimate for the button, never a bill; a line no longer on the menu is
 * left out rather than priced from memory.
 */
export function cartSummary(
  cart: Cart,
  outlet: OrderableOutlet | undefined,
): { count: number; subtotalRwf: number } {
  if (!outlet) return { count: 0, subtotalRwf: 0 };
  const items = itemsOf(outlet);
  let count = 0;
  let subtotalRwf = 0;
  for (const [id, line] of Object.entries(cart)) {
    const item = items.get(id);
    if (!item) continue;
    count += line.quantity;
    subtotalRwf += unitEstimateRwf(item, line) * line.quantity;
  }
  return { count, subtotalRwf };
}

/**
 * The first line that still owes a required option, named, or null.
 *
 * The API refuses such an order with a 422 anyway; saying so before the press
 * saves the guest a round trip and names the dish.
 */
export function missingChoice(cart: Cart, outlet: OrderableOutlet): string | null {
  const items = itemsOf(outlet);
  for (const [id, line] of Object.entries(cart)) {
    const item = items.get(id);
    if (!item) continue;
    const owed = item.options.find((o) => o.required && (line.choices[o.name] ?? []).length === 0);
    if (owed) return `Pick ${owed.name.toLowerCase()} for ${item.name}.`;
  }
  return null;
}

/** How the guest settles, as the request names it. */
export type Settlement =
  | { kind: "room" }
  | { kind: "mobile_money"; network: "mtn_momo" | "airtel_money"; msisdn: string }
  | { kind: "counter" };

/** The request body for a cart, dropping anything no longer on the menu. */
export function orderRequest(
  cart: Cart,
  outlet: OrderableOutlet,
  settlement: Settlement,
  guestNote?: string,
): PlaceOrderRequest {
  const items = itemsOf(outlet);
  const note = guestNote?.trim();
  return {
    outletId: outlet.id,
    context: settlement.kind === "room" ? "in_house_folio" : "pay_now",
    items: Object.entries(cart)
      .filter(([id]) => items.has(id))
      .map(([serviceItemId, line]) => {
        const selectedOptions = Object.entries(line.choices)
          .filter(([, choices]) => choices.length > 0)
          .map(([name, choices]) => ({ name, choices: [...choices] }));
        return {
          serviceItemId,
          quantity: line.quantity,
          ...(selectedOptions.length > 0 ? { selectedOptions } : {}),
        };
      }),
    ...(note ? { guestNote: note } : {}),
    ...(settlement.kind === "mobile_money"
      ? {
          instrument: {
            kind: "mobile_money" as const,
            network: settlement.network,
            msisdn: settlement.msisdn,
          },
        }
      : {}),
  };
}

// --- Status, in the guest's words ------------------------------------------

/**
 * Every order status, as the guest reads it. A `Record` over the contract's
 * union, so a new status fails the build here instead of printing a blank.
 */
export const ORDER_STATUS_LABEL: Record<ServiceOrderStatus, string> = {
  pending_payment: "Waiting for payment",
  payment_failed: "Payment didn't go through",
  submitted: "Sent",
  acknowledged: "Accepted",
  in_progress: "Being prepared",
  ready: "Ready",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
  rejected: "Declined by the outlet",
};

export type OrderTone = "open" | "done" | "stopped";

/** Still coming, arrived, or not happening. Three tones rather than ten colours. */
export function orderTone(status: ServiceOrderStatus): OrderTone {
  if (status === "delivered" || status === "completed") return "done";
  if (status === "cancelled" || status === "rejected" || status === "payment_failed") return "stopped";
  return "open";
}

/** "1 item" / "3 items". */
export function itemCountLabel(count: number): string {
  return `${count} ${count === 1 ? "item" : "items"}`;
}
