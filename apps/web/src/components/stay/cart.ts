import type { DiningProduct } from "@/data/dining";
import type { OrderLine } from "@/lib/order-store";

/**
 * The cart, and it is deliberately the smallest thing that could work.
 *
 * A map of product slug to quantity, and nothing else. The name, the price and
 * the outlet are all resolvable from `data/dining.ts`, so storing them here
 * would create a second copy that can disagree with the menu the guest is
 * looking at — a cart saying 9,500 beside a card saying 10,500.
 *
 * The COPY happens once, at `cartLines`, on the way into the order: from that
 * moment the line is history and must not follow a later menu edit. That is the
 * rule `OrderLine` already states at its declaration, and this is the single
 * place in the guest app that crosses from one regime to the other.
 *
 * A quantity of zero is never stored; `setQuantity` removes the key instead, so
 * `Object.keys(cart).length` is the number of distinct lines and no caller has
 * to filter zeroes out first.
 */
export type Cart = Readonly<Record<string, number>>;

export const EMPTY_CART: Cart = {};

export function quantityOf(cart: Cart, productSlug: string): number {
  return cart[productSlug] ?? 0;
}

/** Set an exact quantity. Zero or less removes the line. */
export function setQuantity(cart: Cart, productSlug: string, qty: number): Cart {
  const next = { ...cart };
  if (qty <= 0) {
    delete next[productSlug];
  } else {
    // A cap rather than an unbounded number: the stepper is a hold-to-repeat
    // control on a touch screen, and a guest who leans on it must not be able
    // to send the kitchen an order for four hundred brochettes.
    next[productSlug] = Math.min(qty, 20);
  }
  return next;
}

export function addOne(cart: Cart, productSlug: string): Cart {
  return setQuantity(cart, productSlug, quantityOf(cart, productSlug) + 1);
}

export function removeOne(cart: Cart, productSlug: string): Cart {
  return setQuantity(cart, productSlug, quantityOf(cart, productSlug) - 1);
}

/**
 * The cart as order lines, in menu order.
 *
 * Driven by the `products` array rather than by the cart's own key order, so
 * the confirmation reads in the same sequence as the menu the guest built it
 * from — object key order is not something to rely on for a sequence a person
 * will compare against a screen they just left.
 *
 * A slug in the cart that is not in `products` is dropped rather than looked up
 * globally. That is the scoping rule holding at the last possible moment: even
 * a hand-edited cart cannot put another hotel's dish onto this hotel's ticket.
 */
export function cartLines(cart: Cart, products: DiningProduct[]): OrderLine[] {
  return products
    .filter((product) => quantityOf(cart, product.slug) > 0)
    .map((product) => ({
      productSlug: product.slug,
      name: product.name,
      priceRwf: product.priceRwf,
      qty: quantityOf(cart, product.slug),
    }));
}
