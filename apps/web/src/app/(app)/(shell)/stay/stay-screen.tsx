"use client";

import { Button } from "@injishi/ui";
import { Icon } from "@/components/app/icon";
import { outletsForProperty, productsForProperty } from "@/data/dining";
import { checkOutGuest, clearGuestStay, isCheckedIn } from "@/lib/guest-stay";
import { isTerminalOrderState } from "@/lib/order-store";
import { CheckInPanel } from "@/components/stay/check-in-panel";
import { DINING_DEMO_DETAIL, DemoDataNotice } from "./demo-data-notice";
import { OrderCard } from "@/components/stay/order-card";
import { OutletStrip } from "@/components/stay/outlet-strip";
import { StayHeader } from "@/components/stay/stay-header";
import { useGuestStay, useRoomOrders } from "@/components/stay/use-stay";

/**
 * The whole of `/stay`, in the browser.
 *
 * THREE STATES, AND ALL THREE ARE RENDERED. Until the effect has run we have
 * not looked in storage yet, and saying "you are not checked in" during that
 * window is a lie that flashes on every navigation — so `ready` gates the
 * decision and the waiting state is a quiet line rather than a spinner. After
 * that it is either a guest in a room or a person who is not, and the second is
 * a first-class screen here (see `CheckInPanel`), not a failure.
 *
 * WHAT THE HUB IS FOR. Two things a guest does from a hotel room, and they are
 * the two large controls: order something, or say something. Everything else on
 * the screen — the outlets, the open orders, the dates — is context for one of
 * those two. `/inbox` is the department chat another part of this build owns;
 * this screen links to it rather than growing a second conversation surface.
 *
 * ORDERS ARE READ THROUGH `useRoomOrders`, which subscribes to the store, so an
 * order advanced by the operator app in another tab moves on this screen
 * without a reload. That is the demo's best moment and it costs one hook.
 */
export function StayScreen() {
  const { stay, ready, refresh } = useGuestStay();
  const { orders } = useRoomOrders(stay === null ? null : stay.propertySlug);

  if (!ready) {
    return (
      <div className="mx-auto max-w-page px-4 py-8 sm:px-6">
        <p className="text-sm text-muted-foreground">Looking up your stay…</p>
      </div>
    );
  }

  if (!isCheckedIn(stay)) {
    return <NotCheckedIn onCheckedIn={refresh} />;
  }

  // `isCheckedIn` has already refused null; this narrows it for TypeScript
  // without a non-null assertion, which this codebase does not use.
  if (stay === null) return null;

  const outlets = outletsForProperty(stay.propertySlug);
  const menuSize = productsForProperty(stay.propertySlug).length;
  // Counted off the subscribed array rather than by calling `readOpenOrders`
  // here: a second read during render would answer from storage while the list
  // beside it answers from state, and the two would disagree for exactly as
  // long as it takes a change event to land.
  const open = orders.filter((order) => !isTerminalOrderState(order.state)).length;

  return (
    <div className="mx-auto max-w-page space-y-6 px-4 py-8 sm:px-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight">My stay</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything for the room you are in tonight.
        </p>
      </header>

      <StayHeader stay={stay} />

      <DemoDataNotice detail={DINING_DEMO_DETAIL} />

      <section className="grid gap-4 sm:grid-cols-2">
        <ActionTile
          href="/stay/order"
          icon="bed"
          title="Order food and drink"
          body={`${menuSize} items from ${outlets.length} ${
            outlets.length === 1 ? "outlet" : "outlets"
          } in this hotel, delivered to room ${stay.room}.`}
          cta="Open room service"
          primary
        />
        <ActionTile
          href="/inbox"
          icon="message-square"
          title="Message the hotel"
          body="Front desk, housekeeping, the kitchen, maintenance and security — each desk is its own conversation, and your orders report into the kitchen one."
          cta="Open my messages"
        />
      </section>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-bold tracking-tight">
            Your room orders
          </h2>
          <p className="money text-xs text-muted-foreground">
            {orders.length === 0
              ? "Nothing ordered yet"
              : `${orders.length} in total · ${open} still open`}
          </p>
        </div>

        {orders.length === 0 ? (
          <div className="mt-3 rounded-card border border-dashed border-input bg-card p-6">
            <p className="max-w-read text-sm text-muted-foreground">
              Anything you order from the room-service card appears here with the
              state it is in — accepted, being prepared, on its way up — and in
              the kitchen conversation at the same time.
            </p>
            <Button asChild variant="primary" size="sm" className="mt-4">
              <a href="/stay/order">See the menu</a>
            </Button>
          </div>
        ) : (
          <ul className="mt-3 space-y-4">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </ul>
        )}
      </section>

      {outlets.length > 0 ? (
        <section>
          <h2 className="font-display text-lg font-bold tracking-tight">
            Eating and drinking here
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            What this hotel runs, and when each place is open.
          </p>
          <div className="mt-3">
            <OutletStrip outlets={outlets} />
          </div>
        </section>
      ) : null}

      <DemoStayControls onChanged={refresh} />
    </div>
  );
}

/**
 * The screen for somebody who is not in a hotel room.
 *
 * It leads with what the address is FOR rather than with what is missing. "No
 * stay found" tells a person nothing they can act on; a description of what
 * appears here once they are in a room tells them whether to come back.
 */
function NotCheckedIn({ onCheckedIn }: { onCheckedIn: () => void }) {
  return (
    <div className="mx-auto max-w-page space-y-6 px-4 py-8 sm:px-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight">My stay</h1>
        <p className="mt-1 max-w-read text-sm text-muted-foreground">
          This is where the hotel you are currently in appears: your room number,
          your dates, the room-service card for that hotel, and the desks you can
          message. It fills in when you check in at reception.
        </p>
      </header>

      <DemoDataNotice detail={DINING_DEMO_DETAIL} />

      <CheckInPanel
        heading="You are not checked in anywhere"
        intro="Nothing is wrong. Room service and the department chat both belong to a hotel you are standing in, so they stay closed until a stay is on this account. Your booked stays are under Trips."
        onCheckedIn={onCheckedIn}
      />

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <a href="/trips">See my trips</a>
        </Button>
        <Button asChild variant="ghost">
          <a href="/explore">Explore stays</a>
        </Button>
      </div>
    </div>
  );
}

/** One of the two things a guest does from a room, as a tile. */
function ActionTile({
  href,
  icon,
  title,
  body,
  cta,
  primary = false,
}: {
  href: string;
  icon: string;
  title: string;
  body: string;
  cta: string;
  primary?: boolean;
}) {
  return (
    <a
      href={href}
      className="flex flex-col rounded-card border border-border bg-card p-5 transition-colors hover:border-accent-brand"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-card bg-secondary text-secondary-foreground">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <h2 className="mt-4 font-display text-lg font-bold tracking-tight">{title}</h2>
      <p className="mt-1 grow text-sm leading-relaxed text-muted-foreground">{body}</p>
      <span
        className={`mt-4 inline-flex items-center gap-1.5 text-sm font-semibold ${
          primary ? "text-accent-text" : ""
        }`}
      >
        {cta}
        <Icon name="arrow-right" className="h-4 w-4" />
      </span>
    </a>
  );
}

/**
 * The presenter's reset, kept where a presenter can find it and a guest cannot
 * mistake it for hotel machinery.
 *
 * Two controls, because they do different things and conflating them is how an
 * earlier draft wiped a rehearsed order history on check-out. "Check out" ends
 * the stay and keeps the record, which is what lets the app still name where
 * the guest was. "Forget the stay" removes it entirely and is what a presenter
 * runs between two demonstrations.
 */
function DemoStayControls({ onChanged }: { onChanged: () => void }) {
  return (
    <section className="rounded-card border border-dashed border-input p-5">
      <h2 className="text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
        Demo controls
      </h2>
      <p className="mt-2 max-w-read text-xs text-muted-foreground">
        This stay was written into this browser, not by a front desk. These two
        controls exist so a demonstration can be run again from the beginning;
        neither reaches the hotel.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            checkOutGuest();
            onChanged();
          }}
        >
          Check out (demo)
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            clearGuestStay();
            onChanged();
          }}
        >
          Forget this stay
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Orders already placed survive both: they belong to the order store, not
        to the stay, and checking out of a hotel does not unsay what you ordered
        from it.
      </p>
    </section>
  );
}
