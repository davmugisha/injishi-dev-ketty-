"use client";

import { diningOutlet, groupByCategory, type DiningProduct } from "@/data/dining";
import { formatRwf } from "@/lib/money";
import { quantityOf, type Cart } from "./cart";
import { QuantityStepper } from "./quantity-stepper";

/**
 * The room-service card, printed the way a menu is printed.
 *
 * SECTIONS COME FROM `groupByCategory`, which orders them by
 * `DINING_CATEGORY_ORDER` — Starters before Mains before Beers. Sorting them
 * alphabetically, which is what a bare `Object.keys` would do, opens the menu
 * on Beers and closes it on Starters, and that is nobody's idea of a menu.
 * Sections with nothing in them never appear, because the grouping is derived
 * from the products passed in rather than from the canonical list.
 *
 * THE OUTLET IS NAMED ON EVERY ROW. A property sells from two or three places —
 * a grill, a terrace bar — and a guest who orders a gin and tonic at eleven at
 * night should be able to see it comes from the bar that is open until one,
 * rather than from the kitchen that closed at eleven. It is resolved through
 * `diningOutlet` rather than carried on the product, so a renamed outlet
 * renames everywhere at once.
 *
 * A SOLD-OUT LINE STAYS ON THE CARD, greyed and unorderable. Hiding it would be
 * easier and would be worse: a guest who came to this screen for the sambaza
 * needs to learn that it has gone, not to wonder whether they misremembered the
 * menu. The stepper is disabled rather than removed so the row keeps its shape
 * and the column does not jag.
 */
export function MenuList({
  products,
  cart,
  onAdd,
  onRemove,
}: {
  products: DiningProduct[];
  cart: Cart;
  onAdd: (product: DiningProduct) => void;
  onRemove: (product: DiningProduct) => void;
}) {
  const sections = groupByCategory(products);

  return (
    <div className="space-y-8">
      {sections.map((section) => (
        <section key={section.category}>
          {/* h2, because a menu section is a peer of "Your tray" beside it.
              It was an h3 first and skipped a level under the page's h1, which
              a screen reader reads as a missing section. */}
          <h2 className="text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
            {section.category}
          </h2>
          <ul className="mt-3 divide-y divide-border rounded-card border border-border bg-card">
            {section.products.map((product) => {
              const outlet = diningOutlet(product.outletSlug);
              const qty = quantityOf(cart, product.slug);
              return (
                <li
                  key={product.slug}
                  className="flex items-start gap-4 p-4 sm:px-5"
                >
                  <div className="min-w-0 grow">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <h3
                        className={`text-sm font-semibold ${
                          product.available ? "" : "text-muted-foreground line-through"
                        }`}
                      >
                        {product.name}
                      </h3>
                      {outlet ? (
                        <span className="text-2xs text-muted-foreground">
                          {outlet.name} · {outlet.hours}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 max-w-read text-xs leading-relaxed text-muted-foreground">
                      {product.description}
                    </p>
                    {product.available ? null : (
                      <p className="mt-1.5 text-xs font-semibold text-muted-foreground">
                        The kitchen has stopped serving this today.
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <p className="money text-sm font-semibold">
                      {formatRwf(product.priceRwf)}
                    </p>
                    <QuantityStepper
                      label={product.name}
                      quantity={qty}
                      disabled={!product.available}
                      onIncrease={() => onAdd(product)}
                      onDecrease={() => onRemove(product)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
