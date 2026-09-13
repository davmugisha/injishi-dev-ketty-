/**
 * Guest ordering against the REAL API (ADR-050 D-n, D-o; slice 1).
 *
 * The first guest surface in this app that is not fixtures. Both routes sit
 * under `/me/`, so `isPersonScoped()` leaves `x-workspace-id` off: a guest
 * ordering a coffee does not hold the hotel's workspace, and the server scopes
 * everything by who they are.
 *
 * What the SERVER decides and this file never second guesses: which outlets
 * are orderable, whether they are open, what is in stock, and every price and
 * tax on a placed order. The cart total shown before placing is the menu's own
 * tax exclusive sum, labelled as such; the totals after placing are the
 * server's locked snapshots and are shown as they came (AC-23).
 */
import type {
  GuestOrder,
  OrderableList,
  OrderableOutlet,
  PlaceOrderRequest,
} from '@injishi/contracts';
import { useQuery } from '@tanstack/react-query';

import { api, unwrap, type ApiResult } from '../lib/api';
import { ENDPOINTS } from '../lib/endpoints';
import { meKeys } from '../lib/query-keys';
import { useOptionalSession } from '../session';

export function fetchOrderable(signal?: AbortSignal): Promise<OrderableList> {
  return unwrap(api<OrderableList>(ENDPOINTS.meOrderable, { signal }));
}

/**
 * Every outlet the guest may order from right now.
 *
 * A short `staleTime`, because an outlet closes and an item sells out while the
 * screen is open; the server refuses a stale order anyway, and this only saves
 * the guest the refusal.
 */
export function useOrderable() {
  const session = useOptionalSession();
  return useQuery({
    queryKey: meKeys.orderable(),
    queryFn: ({ signal }) => fetchOrderable(signal),
    enabled: session?.status === 'authenticated',
    staleTime: 30 * 1000,
  });
}

/**
 * Place an order. Returns the four outcomes rather than throwing, because the
 * screen has to show the server's own sentence when it refuses (a closed
 * outlet, a sold out item, a signed bill).
 *
 * `idempotencyKey` is minted by the caller once per cart and reused on every
 * retry of that cart, so a press that times out and is pressed again is one
 * order, not two coffees on the bill.
 */
export function placeOrder(
  body: PlaceOrderRequest,
  idempotencyKey: string,
): Promise<ApiResult<GuestOrder>> {
  return api<GuestOrder>(ENDPOINTS.meOrders, { method: 'POST', body, idempotencyKey });
}

/** One outlet's cart: item id to quantity. */
export type Cart = Readonly<Record<string, number>>;

/** Quantity bounds the API accepts per line. */
export const MAX_QUANTITY = 50;

export function setQuantity(cart: Cart, itemId: string, quantity: number): Cart {
  const next = { ...cart };
  const bounded = Math.max(0, Math.min(MAX_QUANTITY, Math.floor(quantity)));
  if (bounded === 0) delete next[itemId];
  else next[itemId] = bounded;
  return next;
}

/**
 * The cart as the menu prices it: item count and the TAX EXCLUSIVE subtotal.
 * An estimate for the button, never a bill; items no longer on the menu are
 * left out rather than priced from memory.
 */
export function cartSummary(
  cart: Cart,
  outlet: OrderableOutlet | undefined,
): { count: number; subtotalRwf: number } {
  if (!outlet) return { count: 0, subtotalRwf: 0 };
  const prices = new Map(
    outlet.categories.flatMap((c) => c.items).map((i) => [i.id, i.priceRwf]),
  );
  let count = 0;
  let subtotalRwf = 0;
  for (const [id, quantity] of Object.entries(cart)) {
    const price = prices.get(id);
    if (price === undefined) continue;
    count += quantity;
    subtotalRwf += price * quantity;
  }
  return { count, subtotalRwf };
}

/** The request body for a cart, dropping anything no longer on the menu. */
export function orderRequest(
  cart: Cart,
  outlet: OrderableOutlet,
  guestNote?: string,
): PlaceOrderRequest {
  const onMenu = new Set(outlet.categories.flatMap((c) => c.items).map((i) => i.id));
  const note = guestNote?.trim();
  return {
    outletId: outlet.id,
    context: 'in_house_folio',
    items: Object.entries(cart)
      .filter(([id]) => onMenu.has(id))
      .map(([serviceItemId, quantity]) => ({ serviceItemId, quantity })),
    ...(note ? { guestNote: note } : {}),
  };
}
