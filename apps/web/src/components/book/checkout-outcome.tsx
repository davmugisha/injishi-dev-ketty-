"use client";

import Link from "next/link";
import { ArrowLeft, Check, Send } from "lucide-react";
import { Button, Skeleton } from "@injishi/ui";
import { formatDateRange, formatPrice } from "@injishi/utils";
import type { BookingResult } from "@injishi/contracts";
import { fromParamDate, propertyHref, type BookingSelection } from "@/lib/search-params";

/**
 * The one-column screens: everything checkout can say before there are three
 * steps to show, or instead of them.
 *
 * `booking-review.tsx` carried each of these inline, once each, styled the
 * same way by hand every time. Here they are five small components sharing
 * one `CheckoutCard` shell, so the card this screen lands on when a link is
 * broken is visually the same card it lands on when a booking succeeds.
 */
export function CheckoutCard({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-card bg-card p-6 shadow-sm lg:p-8">{children}</section>
  );
}

export function CheckoutBackLink({
  property,
  selection,
}: {
  property: { slug: string; name: string };
  selection: BookingSelection;
}) {
  return (
    <Link
      href={propertyHref(property.slug, selection.intent)}
      className="mb-4 inline-flex items-center gap-2 text-sm text-page-fg-70 hover:underline"
    >
      <ArrowLeft width={14} height={14} strokeWidth={1.6} aria-hidden />
      Back to {property.name}
    </Link>
  );
}

export function CheckoutUnreadable() {
  return (
    <CheckoutCard>
      <h1 className="mb-2 text-xl text-page-fg">We could not read that booking</h1>
      <p className="mb-6 text-sm text-page-fg-70">
        The dates or the accommodation are missing from the link. Start again from
        the accommodation page and your selection will carry through.
      </p>
      <Button asChild>
        <Link href="/explore">Browse stays</Link>
      </Button>
    </CheckoutCard>
  );
}

export function CheckoutExpired({
  property,
  checkIn,
  intentWithoutDates,
}: {
  property: { slug: string; name: string };
  checkIn: string;
  intentWithoutDates: Parameters<typeof propertyHref>[1];
}) {
  return (
    <CheckoutCard>
      <h1 className="mb-2 text-xl text-page-fg">This quote has expired</h1>
      <p className="mb-2 text-sm text-page-fg-70">
        It was priced for {formatLongDate(checkIn)}, which has now passed.
      </p>
      <p className="mb-6 text-sm text-page-fg-70">
        A price is fixed to the dates it was quoted for, so we will not carry this
        one over. Pick new dates and you will get a fresh total before you commit
        to anything.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href={propertyHref(property.slug, intentWithoutDates)}>Pick new dates</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/explore">Browse stays</Link>
        </Button>
      </div>
    </CheckoutCard>
  );
}

export function CheckoutRefusal({
  property,
  reason,
}: {
  property: { slug: string; name: string };
  reason: string;
}) {
  return (
    <CheckoutCard>
      <h1 className="mb-2 text-xl text-page-fg">We cannot book that stay</h1>
      <p className="mb-6 text-sm text-page-fg-70">{reason}</p>
      <Button asChild>
        <Link href={`/property/${property.slug}`}>Back to {property.name}</Link>
      </Button>
    </CheckoutCard>
  );
}

/**
 * The link names no room.
 *
 * It used to print a price breakdown under this heading, computed from the
 * FIXTURE's nightly rate. That was a total for a stay nobody could buy, from a
 * rate no server had agreed to, on a card whose whole message is "you cannot
 * buy this" — the most misleading number on the screen. With no room there is
 * no price, and saying so is the whole content of the card now.
 */
export function CheckoutNotBookable({
  property,
}: {
  property: { slug: string; name: string };
}) {
  return (
    <CheckoutCard>
      <h1 className="mb-2 text-xl text-page-fg">
        {property.name} is not open for online booking yet
      </h1>
      <p className="mb-2 text-sm text-page-fg-70">
        This accommodation has not published its rooms on Injishi, so there is
        nothing to reserve and nothing will be charged. We cannot quote a price
        for it either — a total we made up here would not be one anybody has
        agreed to honour.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/explore">Browse stays you can book</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/support">Ask us about this stay</Link>
        </Button>
      </div>
    </CheckoutCard>
  );
}

export function CheckoutLoading() {
  return (
    <CheckoutCard>
      <Skeleton className="mb-4 h-7 w-2/3 rounded" />
      <Skeleton className="mb-2 h-4 w-full rounded" />
      <Skeleton className="mb-6 h-4 w-4/5 rounded" />
      <Skeleton className="h-12 w-full rounded" />
      <span className="sr-only">Getting the latest price for this stay</span>
    </CheckoutCard>
  );
}

export function CheckoutLoadError({
  property,
  selection,
  message,
}: {
  property: { slug: string; name: string };
  selection: BookingSelection;
  message: string;
}) {
  return (
    <CheckoutCard>
      <h1 className="mb-2 text-xl text-page-fg">We couldn&apos;t load this stay</h1>
      <p className="mb-6 text-sm text-page-fg-70">
        {message} Your dates are kept in the address, so trying again picks up
        exactly where you were.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => window.location.reload()}>Try again</Button>
        <Button asChild variant="outline">
          <Link href={propertyHref(property.slug, selection.intent)}>
            Back to the accommodation
          </Link>
        </Button>
      </div>
    </CheckoutCard>
  );
}

/**
 * The best moment in the product, and it used to look exactly like the card
 * for a broken link: same shell, no mark, no movement, and a primary action
 * that led to a Trips page which cannot list the booking yet. A person who has
 * just paid is holding their breath until they see that it landed. So it lands:
 * the check is set down with a small spring, the heading takes focus so a
 * screen reader says it first, and the next step is the receipt — the one page
 * that shows this booking back to them.
 */
export function CheckoutConfirmed({ booking }: { booking: BookingResult }) {
  const awaitingHost = booking.status === "pending_approval";

  return (
    <CheckoutCard>
      <div className="animate-arrive">
        <span className="mb-4 flex size-12 animate-acknowledge items-center justify-center rounded-full bg-accent text-accent-foreground">
          {awaitingHost ? (
            <Send width={22} height={22} strokeWidth={2} aria-hidden />
          ) : (
            <Check width={24} height={24} strokeWidth={2.4} aria-hidden />
          )}
        </span>
        {/* Focus lands on the news, not on whatever the pressed button left behind. */}
        <h1 tabIndex={-1} autoFocus className="mb-2 text-xl text-page-fg outline-none">
          {awaitingHost ? "Request sent — you're nearly there" : "You're booked"}
        </h1>
        <p className="mb-6 text-sm text-page-fg-70">
          {awaitingHost
            ? "The host has to confirm. Your payment is held safely in escrow until they do, and comes back to you in full if they decline or don't answer in time."
            : "Your room is held for you. Your payment stays in escrow until you check in."}
        </p>
      </div>
      <dl className="mb-6 flex flex-col gap-3 text-sm">
        <Row label="Reference" value={booking.reference} />
        <Row label="Status" value={awaitingHost ? "Awaiting host" : "Confirmed"} />
        <Row
          label="Stay"
          value={formatDateRange(
            fromParamDate(booking.checkIn) as Date,
            fromParamDate(booking.checkOut) as Date,
          )}
        />
        <Row label="Held in escrow" value={formatPrice(booking.breakdown.grossRwf)} />
        {booking.nonRefundable ? <Row label="Rate" value="Non-refundable" /> : null}
      </dl>
      <p className="mb-6 text-xs text-page-fg-70">
        Keep your reference handy for the front desk. Your receipt is kept with
        your trips.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href={`/receipt/${encodeURIComponent(booking.reference)}`}>See your receipt</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/trips">See your trips</Link>
        </Button>
        {/* Offered whatever the status. A guest who has just booked usually has
            a question next — an airport pickup, an early check in — and one
            still awaiting the host's answer has the most to ask, which is
            exactly who the old `awaitingHost` guard withheld it from. A
            `pending_approval` booking is live (`live-booking.ts`), so `/inbox`
            offers this property's desks for it. */}
        <Button asChild variant="outline">
          <Link href="/inbox">
            Message the property
          </Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/explore">Keep exploring</Link>
        </Button>
      </div>
    </CheckoutCard>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-page-fg-70">{label}</dt>
      <dd className="text-right font-medium text-page-fg">{value}</dd>
    </div>
  );
}

const LONG_DATE = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatLongDate(isoDate: string): string {
  return LONG_DATE.format(new Date(`${isoDate}T00:00:00`));
}
