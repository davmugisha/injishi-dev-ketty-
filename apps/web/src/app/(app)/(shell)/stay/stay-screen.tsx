"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { GuestOrder, GuestTrip, OrderableOutlet } from "@injishi/contracts";
import { Badge, Button, Skeleton } from "@injishi/web-ui";
import { EmptyPanel } from "@/components/app/empty-panel";
import { Icon } from "@/components/app/icon";
import { fetchMyOrders, fetchOrderable, orderTone } from "@/data/ordering";
import { fetchMyTrips } from "@/data/trips";
import { apiResultMessage, type ApiResult } from "@/lib/api";
import { MyStayPanel } from "@/components/stay/my-stay-panel";
import { OrderList } from "./order-list";

/** How often the hub re-reads the orders while one of them is still moving. */
const OPEN_ORDER_POLL_MS = 15_000;

interface StayData {
  /** Booked stays whose dates include today, by the property's calendar. */
  current: GuestTrip[];
  /** Every outlet the server says this guest may order from right now. */
  outlets: OrderableOutlet[];
  orders: GuestOrder[];
}

/**
 * Read the three things the hub is made of, or the first thing that failed.
 *
 * All three are the API's: `/me/trips` for the stay, `/me/orderable` for where
 * the guest may order and how they may settle, `/me/orders` for what they have
 * ordered. There is no browser-held stay any more. The old hub read a
 * "checked in" flag a demo button wrote into localStorage.
 */
async function loadStay(): Promise<ApiResult<StayData>> {
  const [trips, orderable, orders] = await Promise.all([
    fetchMyTrips(),
    fetchOrderable(),
    fetchMyOrders(),
  ]);
  if (trips.status !== "ok") return trips;
  if (orderable.status !== "ok") return orderable;
  if (orders.status !== "ok") return orders;
  return {
    status: "ok",
    data: {
      current: trips.data.filter((t) => t.stage === "in_progress"),
      outlets: orderable.data.outlets,
      orders: orders.data,
    },
  };
}

/**
 * The whole of `/stay`, in the browser (the API session cookie belongs to the
 * API origin, so a server component would ask as nobody).
 *
 * WHAT IT DOES NOT SHOW, AND WHY. The room number: no guest route serves it,
 * and the old hub's "Room 412" was a fixture. Printing a number nobody
 * assigned is how a tray goes to the wrong door, so the card names the booking
 * and the room TYPE, which the API does serve, and stops there.
 */
export function StayScreen({ placedOrderId }: { placedOrderId: string | null }) {
  const [result, setResult] = useState<ApiResult<StayData> | null>(null);

  const load = useCallback((quiet = false) => {
    if (!quiet) setResult(null);
    let cancelled = false;
    void (async () => {
      const next = await loadStay();
      if (!cancelled) setResult(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(), [load]);

  // An order still moving is re-read on a slow interval, so "Being prepared"
  // turns into "Delivered" without a reload. Nothing polls once all are settled.
  const hasOpenOrder =
    result?.status === "ok" && result.data.orders.some((o) => orderTone(o.status) === "open");
  useEffect(() => {
    if (!hasOpenOrder) return;
    const timer = setInterval(() => load(true), OPEN_ORDER_POLL_MS);
    return () => clearInterval(timer);
  }, [hasOpenOrder, load]);

  if (result === null) return <StayLoading />;

  if (result.status === "unauthenticated") {
    return (
      <EmptyPanel
        icon="lock"
        title="Sign in to see your stay"
        action={{ label: "Sign in", href: "/sign-in?redirect=%2Fstay" }}
      >
        Your stay, and anything you order during it, only ever opens for you.
      </EmptyPanel>
    );
  }

  if (result.status !== "ok") {
    return (
      <div className="mx-auto flex max-w-narrow animate-arrive flex-col items-center gap-3 px-4 py-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-card bg-secondary text-muted-foreground">
          <Icon name="triangle-alert" className="size-6" />
        </span>
        <h2 className="font-display text-xl font-bold tracking-tight">
          We couldn&apos;t load your stay
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {apiResultMessage(result)}
        </p>
        <Button className="mt-2" onClick={() => load()}>
          Try again
        </Button>
      </div>
    );
  }

  const { current, outlets, orders } = result.data;
  const nothingHere = current.length === 0 && outlets.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-page animate-arrive flex-col gap-block px-4 py-8 sm:px-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight">My stay</h1>
        <p className="mt-1 max-w-read text-sm text-muted-foreground">
          The stay you are in today, what you can order during it, and what you
          have already ordered.
        </p>
      </header>

      {/*
        The stay the desk registered (`/me/stays`): its summary, the desks the
        guest can message, offers and refunds, or the prompt to claim it with
        the emailed code. A walk-in has no booking, so it never appears in
        `/me/trips` below; this panel is where that guest's stay lives.
      */}
      <MyStayPanel />

      {nothingHere ? (
        <section className="rounded-card border border-dashed border-input bg-card p-6">
          <h2 className="font-display text-lg font-bold tracking-tight">
            No booking is under way today
          </h2>
          <p className="mt-2 max-w-read text-sm text-muted-foreground">
            No booking on your account is under way today, and no outlet is taking
            orders from you. If a front desk checked you in, claim that stay above. Ordering to your room opens once a front desk checks
            you in. Stays you have booked are under Trips.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/trips">See my trips</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/explore">Explore stays</Link>
            </Button>
          </div>
        </section>
      ) : (
        <>
          {current.map((trip) => (
            <CurrentStayCard key={trip.id} trip={trip} />
          ))}

          <section className="grid gap-4 sm:grid-cols-2">
            {outlets.length > 0 ? (
              <ActionTile
                href="/stay/order"
                icon="coffee"
                title="Order food and drink"
                body={orderTileBody(outlets)}
                cta="See what's on"
                primary
              />
            ) : (
              <div className="flex flex-col rounded-card border border-dashed border-input bg-card p-5">
                <span className="flex size-10 items-center justify-center rounded-card bg-secondary text-muted-foreground">
                  <Icon name="coffee" className="size-5" />
                </span>
                <h2 className="mt-4 font-display text-lg font-bold tracking-tight">
                  Nothing to order yet
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  No outlet is taking orders from you right now. Ordering to your
                  room opens once the front desk has checked you in, and an outlet
                  that is closed does not appear until it opens.
                </p>
              </div>
            )}
            <ActionTile
              href="/inbox"
              icon="message-square"
              title="Message the property"
              body="Your conversations with the places you have booked, in one inbox."
              cta="Open my messages"
            />
          </section>
        </>
      )}

      {orders.length > 0 ? (
        <section>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-bold tracking-tight">Your orders</h2>
            <Button size="sm" variant="ghost" onClick={() => load(true)}>
              <Icon name="refresh-cw" className="size-4" />
              Refresh
            </Button>
          </div>
          <OrderList orders={orders} onChanged={() => load(true)} highlightId={placedOrderId} />
        </section>
      ) : null}
    </div>
  );
}

/** Where the guest can order, in one sentence built from the server's list. */
function orderTileBody(outlets: OrderableOutlet[]): string {
  const names = outlets.slice(0, 3).map((o) => o.name);
  const more = outlets.length > 3 ? ` and ${outlets.length - 3} more` : "";
  const room = outlets.some((o) => o.chargeToRoom);
  return `${names.join(", ")}${more}. ${
    room ? "Charge it to your room, or pay now where the outlet allows." : "Pay when you order."
  }`;
}

const DAY_MONTH_YEAR = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Parsed at midday, so a `yyyy-mm-dd` never prints as the day before. */
function day(iso: string): string {
  return DAY_MONTH_YEAR.format(new Date(`${iso}T12:00:00`));
}

/**
 * A booked stay whose dates include today.
 *
 * It says "under way", not "checked in": the booking's dates are the API's
 * fact, and whether the front desk has handed over a key is not something any
 * guest route reports.
 */
function CurrentStayCard({ trip }: { trip: GuestTrip }) {
  return (
    <section className="rounded-card border border-border bg-card p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="success" size="sm">
          Under way
        </Badge>
        <span className="money text-xs text-muted-foreground">Reference {trip.reference}</span>
      </div>
      <h2 className="mt-3 font-display text-2xl font-bold tracking-tight">
        {trip.propertySlug ? (
          <Link href={`/property/${trip.propertySlug}`} className="hover:underline">
            {trip.propertyName}
          </Link>
        ) : (
          trip.propertyName
        )}
      </h2>
      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Icon name="calendar-days" className="size-4" />
          <span className="money">
            {day(trip.checkIn)} to {day(trip.checkOut)}
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Icon name="bed" className="size-4" />
          {trip.roomTypeName}
        </span>
      </p>
    </section>
  );
}

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
    <Link
      href={href}
      className="flex flex-col rounded-card border border-border bg-card p-5 transition-colors hover:border-accent-brand"
    >
      <span className="flex size-10 items-center justify-center rounded-card bg-secondary text-secondary-foreground">
        <Icon name={icon} className="size-5" />
      </span>
      <h2 className="mt-4 font-display text-lg font-bold tracking-tight">{title}</h2>
      <p className="mt-1 grow text-sm leading-relaxed text-muted-foreground">{body}</p>
      <span
        className={`mt-4 inline-flex items-center gap-1.5 text-sm font-semibold ${
          primary ? "text-accent-text" : ""
        }`}
      >
        {cta}
        <Icon name="arrow-right" className="size-4" />
      </span>
    </Link>
  );
}

function StayLoading() {
  return (
    <div className="mx-auto flex w-full max-w-page flex-col gap-4 px-4 py-8 sm:px-6">
      <span className="sr-only" role="status">
        Looking up your stay
      </span>
      <Skeleton className="h-8 w-40 rounded" />
      <Skeleton className="h-32 rounded-card" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-40 rounded-card" />
        <Skeleton className="h-40 rounded-card" />
      </div>
    </div>
  );
}
