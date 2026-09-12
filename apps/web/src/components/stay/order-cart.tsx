"use client";

import { Button } from "@injishi/ui";
import { Icon } from "@/components/app/icon";
import { formatRwf } from "@/lib/money";
import { orderItemCount, orderTotalRwf, type OrderLine } from "@/lib/order-store";
import { itemCountLabel } from "./stay-format";
import { QuantityStepper } from "./quantity-stepper";

/**
 * The cart, and the last thing a guest reads before an order exists.
 *
 * THE ROOM NUMBER IS INSIDE THE CONFIRMATION LINE, not in a caption above it.
 * "Deliver to room 412" sits directly over the button that sends the order,
 * because the room is the one field of this transaction the guest cannot
 * correct afterwards and the one a demo audience will look for. It comes from
 * the stay record, so it cannot be edited here — a guest who is in the wrong
 * room has a front-desk problem, not a form problem, and the chat link on the
 * hub is where that gets fixed.
 *
 * THE TOTAL IS `orderTotalRwf`, the store's own function, run on the same lines
 * that will be handed to `placeOrder`. Computing it here with a second reduce
 * is how a cart comes to show one number and a receipt another.
 *
 * IT IS STICKY ON A WIDE SCREEN AND A PLAIN BLOCK ON A NARROW ONE. A fixed
 * bottom bar on a phone would cover the last row of the menu, which is where
 * the desserts are.
 */
export function OrderCart({
  lines,
  room,
  propertyName,
  onIncrease,
  onDecrease,
  onClear,
  onPlace,
}: {
  lines: OrderLine[];
  room: string;
  propertyName: string;
  onIncrease: (productSlug: string) => void;
  onDecrease: (productSlug: string) => void;
  onClear: () => void;
  onPlace: () => void;
}) {
  const total = orderTotalRwf(lines);
  const count = orderItemCount(lines);
  const empty = lines.length === 0;

  return (
    <aside className="rounded-card border border-border bg-card p-5 lg:sticky lg:top-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold tracking-tight">Your tray</h2>
        {empty ? null : (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear
          </Button>
        )}
      </div>

      {empty ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Nothing on it yet. Add something from the card and it appears here with
          the total, before anything is sent to the kitchen.
        </p>
      ) : (
        <>
          <ul className="mt-4 space-y-3">
            {lines.map((line) => (
              <li key={line.productSlug} className="flex items-start gap-3">
                <div className="min-w-0 grow">
                  <p className="text-sm font-medium leading-snug">{line.name}</p>
                  <p className="money mt-0.5 text-xs text-muted-foreground">
                    {formatRwf(line.priceRwf)} each ·{" "}
                    {formatRwf(line.priceRwf * line.qty)}
                  </p>
                </div>
                <QuantityStepper
                  label={line.name}
                  quantity={line.qty}
                  onIncrease={() => onIncrease(line.productSlug)}
                  onDecrease={() => onDecrease(line.productSlug)}
                />
              </li>
            ))}
          </ul>

          <dl className="mt-5 border-t border-border pt-4">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-sm text-muted-foreground">
                {itemCountLabel(count)}
              </dt>
              <dd className="money font-display text-xl font-bold">
                {formatRwf(total)}
              </dd>
            </div>
          </dl>
        </>
      )}

      <div className="mt-5 rounded-card border border-border bg-background px-4 py-3">
        <p className="text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Delivering to
        </p>
        <p className="money mt-1 text-sm font-semibold">
          Room {room} · {propertyName}
        </p>
      </div>

      <Button
        variant="primary"
        fullWidth
        className="mt-4"
        disabled={empty}
        onClick={onPlace}
      >
        <Icon name="bed" className="h-4 w-4" />
        {empty ? "Add something first" : `Send to room ${room}`}
      </Button>
      {/* Worded as what a live hotel would do, not as something that has
          happened. In a demo nothing is billed and nothing reaches a kitchen,
          and a line reading "charged to your room" would be a claim rather
          than a description. */}
      <p className="mt-3 text-xs text-muted-foreground">
        In a hotel running Injishi this would go to the room bill and be settled
        at check-out. It appears in your kitchen chat straight away, and you can
        cancel it there while it is still open.
      </p>
    </aside>
  );
}
