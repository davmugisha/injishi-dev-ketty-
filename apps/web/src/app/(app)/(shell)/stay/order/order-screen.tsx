"use client";

import { useMemo, useState } from "react";
import { Button } from "@injishi/ui";
import { Icon } from "@/components/app/icon";
import {
  availableOnly,
  outletsForProperty,
  productsForOutlet,
  productsForProperty,
} from "@/data/dining";
import { isCheckedIn } from "@/lib/guest-stay";
import { placeOrder, type RoomOrder } from "@/lib/order-store";
import {
  addOne,
  cartLines,
  EMPTY_CART,
  removeOne,
  type Cart,
} from "@/components/stay/cart";
import { CheckInPanel } from "@/components/stay/check-in-panel";
import { DINING_DEMO_DETAIL, DemoDataNotice } from "../demo-data-notice";
import { MenuList } from "@/components/stay/menu-list";
import { OrderCart } from "@/components/stay/order-cart";
import { OrderPlaced } from "@/components/stay/order-placed";
import { useGuestStay } from "@/components/stay/use-stay";

/** The outlet filter's "everything this hotel sells" position. */
const ALL_OUTLETS = "__all__";

/**
 * The room-service screen: a menu, a cart, and one button that creates an order.
 *
 * THE MENU IS `productsForProperty(stay.propertySlug)` AND NOTHING ELSE. That
 * one call is the contract this whole feature exists to demonstrate — a product
 * tied to a hotel is offered to that hotel's guests and to nobody else — so the
 * screen never widens it to "and anything nearby", never falls back to the full
 * catalogue when the property has no outlets, and never reads a product by slug
 * from outside the scoped array (see `cartLines`, which filters against this
 * same list on the way into the order).
 *
 * THE OUTLET FILTER IS A NARROWING, NOT A SOURCE. It runs `productsForOutlet`
 * and then intersects with the property's own products, so a filter cannot be
 * the route by which another hotel's card appears: an outlet slug typed into
 * state that belongs to a different property yields an empty intersection
 * rather than a foreign menu.
 *
 * THREE SCREENS IN ONE COMPONENT, and they are sequential rather than
 * alternative: not checked in → ordering → placed. `placed` holds the order the
 * store returned, which is what lets the confirmation name the thread the guest
 * should follow it in. Clearing it is what "Order something else" does, and the
 * cart is already empty by then because `placeOrder` succeeded.
 */
export function OrderScreen() {
  const { stay, ready, refresh } = useGuestStay();
  const [cart, setCart] = useState<Cart>(EMPTY_CART);
  const [outletFilter, setOutletFilter] = useState<string>(ALL_OUTLETS);
  const [placed, setPlaced] = useState<RoomOrder | null>(null);

  const propertySlug = stay === null ? null : stay.propertySlug;

  const menu = useMemo(() => productsForProperty(propertySlug), [propertySlug]);
  const outlets = useMemo(() => outletsForProperty(propertySlug), [propertySlug]);

  const shown = useMemo(() => {
    if (outletFilter === ALL_OUTLETS) return menu;
    const slugs = new Set(productsForOutlet(outletFilter).map((p) => p.slug));
    return menu.filter((product) => slugs.has(product.slug));
  }, [menu, outletFilter]);

  // Built from the FULL property menu, not from `shown`: a guest who adds a
  // beer, then filters to the grill, must not watch the beer fall out of their
  // cart because it is no longer on screen.
  const lines = useMemo(() => cartLines(cart, menu), [cart, menu]);

  if (!ready) {
    return (
      <div className="mx-auto max-w-page px-4 py-8 sm:px-6">
        <p className="text-sm text-muted-foreground">Looking up your stay…</p>
      </div>
    );
  }

  if (!isCheckedIn(stay) || stay === null) {
    return (
      <div className="mx-auto max-w-page space-y-6 px-4 py-8 sm:px-6">
        <BackToStay />
        <header>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Room service
          </h1>
          <p className="mt-1 max-w-read text-sm text-muted-foreground">
            A hotel's bar and restaurant card is offered to the guests staying in
            it, so there is no menu to show until you are checked in somewhere.
            Once you are, this screen carries that hotel's card and delivers to
            your room number.
          </p>
        </header>

        <DemoDataNotice detail={DINING_DEMO_DETAIL} />

        <CheckInPanel
          heading="No room to deliver to yet"
          intro="Room service needs a room. Check in below and the card for that hotel — and only that hotel — opens here."
          onCheckedIn={refresh}
        />
      </div>
    );
  }

  if (placed !== null) {
    return (
      <div className="mx-auto max-w-page space-y-6 px-4 py-8 sm:px-6">
        <BackToStay />
        <OrderPlaced
          order={placed}
          propertyName={stay.propertyName}
          onOrderMore={() => setPlaced(null)}
        />
        <DemoDataNotice detail={DINING_DEMO_DETAIL} />
      </div>
    );
  }

  const orderable = availableOnly(menu).length;

  return (
    <div className="mx-auto max-w-page space-y-6 px-4 py-8 sm:px-6">
      <BackToStay />

      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Room service at {stay.propertyName}
        </h1>
        <p className="money mt-1 text-sm text-muted-foreground">
          Delivering to room {stay.room} · {orderable} of {menu.length} items
          available now
        </p>
      </header>

      <DemoDataNotice detail={DINING_DEMO_DETAIL} />

      {menu.length === 0 ? (
        <NothingToSell propertyName={stay.propertyName} />
      ) : (
        <>
          {outlets.length > 1 ? (
            <nav className="flex flex-wrap gap-2" aria-label="Filter by outlet">
              <OutletChip
                label="Everything"
                active={outletFilter === ALL_OUTLETS}
                onSelect={() => setOutletFilter(ALL_OUTLETS)}
              />
              {outlets.map((outlet) => (
                <OutletChip
                  key={outlet.slug}
                  label={outlet.name}
                  active={outletFilter === outlet.slug}
                  onSelect={() => setOutletFilter(outlet.slug)}
                />
              ))}
            </nav>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
            <MenuList
              products={shown}
              cart={cart}
              onAdd={(product) => setCart((current) => addOne(current, product.slug))}
              onRemove={(product) =>
                setCart((current) => removeOne(current, product.slug))
              }
            />

            <OrderCart
              lines={lines}
              room={stay.room}
              propertyName={stay.propertyName}
              onIncrease={(slug) => setCart((current) => addOne(current, slug))}
              onDecrease={(slug) => setCart((current) => removeOne(current, slug))}
              onClear={() => setCart(EMPTY_CART)}
              onPlace={() => {
                if (lines.length === 0) return;
                // One call creates the order AND posts the opening line into
                // the kitchen thread. There is deliberately no path here that
                // does one without the other.
                const order = placeOrder({
                  propertySlug: stay.propertySlug,
                  room: stay.room,
                  lines,
                });
                setCart(EMPTY_CART);
                setPlaced(order);
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

function BackToStay() {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2">
      <a href="/stay">
        <Icon name="arrow-left" className="h-4 w-4" />
        My stay
      </a>
    </Button>
  );
}

/**
 * A hotel that sells nothing.
 *
 * It is reachable — `data/dining.ts` covers five properties out of the whole
 * marketplace — and it is not an error. Saying so and pointing at the chat is
 * more use than an empty menu, because a guest who wants a sandwich at a hotel
 * with no card still has a front desk.
 */
function NothingToSell({ propertyName }: { propertyName: string }) {
  return (
    <section className="rounded-card border border-dashed border-input bg-card p-6">
      <h2 className="font-display text-lg font-bold tracking-tight">
        {propertyName} does not sell food and drink through Injishi yet
      </h2>
      <p className="mt-2 max-w-read text-sm text-muted-foreground">
        No bar or restaurant here has published a card, so there is nothing to
        order to your room. The front desk is still one message away and can tell
        you what is open.
      </p>
      <Button asChild variant="primary" size="sm" className="mt-4">
        <a href="/inbox">Message the front desk</a>
      </Button>
    </section>
  );
}

/** One position of the outlet filter. A button, because it changes what is listed. */
function OutletChip({
  label,
  active,
  onSelect,
}: {
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <Button
      variant={active ? "primary" : "outline"}
      size="sm"
      aria-pressed={active}
      onClick={onSelect}
    >
      {label}
    </Button>
  );
}
