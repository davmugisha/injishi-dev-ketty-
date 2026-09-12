"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { GuestTrip } from "@injishi/contracts";
import { Badge, Button, Skeleton } from "@injishi/ui";
import { formatPrice } from "@injishi/utils";
import { EmptyPanel } from "@/components/app/empty-panel";
import { Icon } from "@/components/app/icon";
import { fetchMyTrips, groupTrips } from "@/data/trips";
import { apiResultMessage, type ApiResult } from "@/lib/api";

/**
 * The stays this person booked, read from `GET /api/v1/me/trips`.
 *
 * It renders the four states a read has, and none of them lies:
 *
 *  - **Loading** is three skeleton cards with a present-tense announcement.
 *    Not a spinner — the product's loading vocabulary is the shimmer
 *    (`ui-tokens.md` § Motion).
 *  - **Empty** means empty NOW, because the endpoint answered. That is the whole
 *    point of this screen existing: the old copy had to hedge ("we're still
 *    connecting this page") because a hardcoded empty state cannot tell a guest
 *    with no bookings apart from a guest whose bookings nothing could fetch.
 *  - **Failed** owns the failure and offers the retry. It never says "you have
 *    no trips", which is the one wrong thing to tell somebody whose stay exists.
 *  - **Signed out** can happen even behind the middleware gate: a cookie
 *    outlives the session it names. It sends them back with a return path.
 *
 * A client component because the API guards this with the Better Auth session
 * cookie, which belongs to the API origin — a server component would ask as
 * nobody and be answered 401 (the same reason `ReceiptScreen` runs here).
 */
export function TripsScreen() {
  const [result, setResult] = useState<ApiResult<GuestTrip[]> | null>(null);

  const load = useCallback(() => {
    setResult(null);
    let cancelled = false;
    void (async () => {
      const next = await fetchMyTrips();
      if (!cancelled) setResult(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(load, [load]);

  if (result === null) return <TripsLoading />;

  if (result.status === "unauthenticated") {
    return (
      <EmptyPanel
        icon="lock"
        title="Sign in to see your trips"
        action={{ label: "Sign in", href: "/sign-in?redirect=%2Ftrips" }}
      >
        A trip names the guest who booked it, so it only ever opens for them.
        Signing in again brings you straight back here.
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
          We couldn&apos;t load your trips
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {apiResultMessage(result)} Nothing is wrong with your bookings — this is
          the list that didn&apos;t arrive.
        </p>
        <Button className="mt-2" onClick={load}>
          Try again
        </Button>
      </div>
    );
  }

  if (result.data.length === 0) {
    return (
      <EmptyPanel icon="map-pin" title="No trips yet" action={{ label: "Explore stays", href: "/explore" }}>
        Stays you book appear here with their dates, their price and their
        receipt. If you rent your home through Injishi, that lives under My
        lease instead.
      </EmptyPanel>
    );
  }

  const groups = groupTrips(result.data);

  return (
    <div className="mx-auto flex w-full max-w-wide animate-arrive flex-col gap-block px-4 py-8">
      <TripSection title="Upcoming" trips={groups.current} />
      <TripSection title="Past stays" trips={groups.past} />
      <TripSection title="Cancelled" trips={groups.cancelled} />
    </div>
  );
}

function TripSection({ title, trips }: { title: string; trips: GuestTrip[] }) {
  if (trips.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 font-display text-lg font-bold tracking-tight">{title}</h2>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {trips.map((trip) => (
          <li key={trip.id}>
            <TripCard trip={trip} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * One stay.
 *
 * Every number here was LOCKED at booking and is printed as stored — the price
 * a guest sees on this card is the price they were charged, not one this screen
 * worked out (`ui-rules.md` § Money & Dates).
 *
 * The reference is the loudest small thing on the card on purpose: it is what a
 * front desk asks for, and it is the address of the receipt.
 */
function TripCard({ trip }: { trip: GuestTrip }) {
  const badge = STATUS_BADGE[trip.stage];

  return (
    <article className="rounded-card border border-border bg-card p-inset">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-card-foreground">
            {trip.propertySlug ? (
              <Link href={`/property/${trip.propertySlug}`} className="hover:underline">
                {trip.propertyName}
              </Link>
            ) : (
              trip.propertyName
            )}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {trip.roomTypeName}
            {trip.districtName ? ` · ${trip.districtName}` : ""}
          </p>
        </div>
        {/* Colour never carries this alone: the badge prints the word. */}
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Fact label="Dates">
          {formatStayDates(trip.checkIn, trip.checkOut)}
        </Fact>
        <Fact label={trip.nights === 1 ? "Night" : "Nights"}>{trip.nights}</Fact>
        <Fact label="Guests">{trip.guests}</Fact>
        <Fact label="Paid">
          {trip.grossRwf === null ? "—" : formatPrice(trip.grossRwf)}
        </Fact>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-3">
        <span className="money text-sm text-muted-foreground">
          Reference <b className="text-card-foreground">{trip.reference}</b>
        </span>
        <span className="grow" />
        {trip.nonRefundable ? (
          <span className="text-xs text-muted-foreground">Non-refundable rate</span>
        ) : null}
        <Button asChild size="sm" variant="outline">
          <Link href={`/receipt/${encodeURIComponent(trip.reference)}`}>See receipt</Link>
        </Button>
      </div>
    </article>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-card-foreground">{children}</dd>
    </div>
  );
}

/**
 * Stage → the badge a guest reads. `StatusBadge` in `@injishi/ui` is the
 * operator vocabulary over a booking's raw status; this is the guest's, and it
 * answers a different question — not "what state is this row in" but "is this
 * happening, has it happened, or is it off".
 */
const STATUS_BADGE: Record<
  GuestTrip["stage"],
  { label: string; variant: "success" | "accent" | "outline" | "danger" }
> = {
  in_progress: { label: "You're there now", variant: "success" },
  upcoming: { label: "Upcoming", variant: "accent" },
  past: { label: "Stayed", variant: "outline" },
  cancelled: { label: "Cancelled", variant: "danger" },
};

const DAY_MONTH = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const DAY_MONTH_YEAR = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/**
 * `12 – 15 Oct 2026`, collapsing the month when both ends share one.
 *
 * Parsed at midday rather than midnight: a `yyyy-mm-dd` read as UTC midnight and
 * formatted in a western-hemisphere timezone prints the day before, which is how
 * a guest ends up reading the wrong arrival date for their own stay.
 */
function formatStayDates(checkIn: string, checkOut: string): string {
  const from = new Date(`${checkIn}T12:00:00`);
  const to = new Date(`${checkOut}T12:00:00`);
  const sameMonth =
    from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth();
  return `${sameMonth ? from.getDate() : DAY_MONTH.format(from)} – ${DAY_MONTH_YEAR.format(to)}`;
}

function TripsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-wide flex-col gap-3 px-4 py-8">
      <span className="sr-only" role="status">
        Getting your trips
      </span>
      <Skeleton className="mb-1 h-6 w-32 rounded" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-card border border-border bg-card p-inset">
          <Skeleton className="h-5 w-1/2 rounded" />
          <Skeleton className="mt-2 h-4 w-1/3 rounded" />
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Skeleton className="h-8 rounded" />
            <Skeleton className="h-8 rounded" />
            <Skeleton className="h-8 rounded" />
            <Skeleton className="h-8 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
