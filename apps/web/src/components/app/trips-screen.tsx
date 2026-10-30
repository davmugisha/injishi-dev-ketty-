"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { GuestTrip } from "@injishi/contracts";
import { Badge, Button, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from "@injishi/web-ui";
import { formatPrice } from "@injishi/utils";
import { CancelBooking } from "@/components/app/cancel-booking";
import { EmptyPanel } from "@/components/app/empty-panel";
import { Icon } from "@/components/app/icon";
import { fetchMyTrips, fetchTripPlace, groupTrips, type TripPlace } from "@/data/trips";
import { apiResultMessage, type ApiResult } from "@/lib/api";
import { displayNameFrom } from "@/lib/avatar";
import { useSessionUser } from "@/lib/session";

/**
 * The guest's home (2026-10-30 redesign): the next trip as the page's centre, with everything a guest
 * needs before they go (when they may arrive, how to reach the desk, the way there), then every other
 * stay in tabs. Read from `GET /api/v1/me/trips`; each card also reads the place's public page for its
 * photograph and arrival facts, and simply leaves them out when that read fails.
 *
 * It renders the four states a read has, and none of them lies: loading (skeletons), empty (the endpoint
 * answered), failed (owns the failure and offers the retry, never "you have no trips"), and signed out.
 *
 * Every number on a card was LOCKED at booking and is printed as stored.
 */
export function TripsScreen() {
  const [result, setResult] = useState<ApiResult<GuestTrip[]> | null>(null);
  const { user } = useSessionUser();

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

  const places = useTripPlaces(result?.status === "ok" ? result.data : []);

  if (result === null) return <TripsLoading />;

  if (result.status === "unauthenticated") {
    return (
      <EmptyPanel icon="lock" title="Sign in to see your trips" action={{ label: "Sign in", href: "/sign-in?redirect=%2Ftrips" }}>
        A trip names the guest who booked it, so it only ever opens for them. Signing in again brings you
        straight back here.
      </EmptyPanel>
    );
  }

  if (result.status !== "ok") {
    return (
      <div className="mx-auto flex max-w-narrow animate-arrive flex-col items-center gap-3 px-4 py-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-card bg-secondary text-muted-foreground">
          <Icon name="triangle-alert" className="size-6" />
        </span>
        <h2 className="font-display text-xl font-bold tracking-tight">We couldn&apos;t load your trips</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {apiResultMessage(result)} Nothing is wrong with your bookings — this is the list that didn&apos;t
          arrive.
        </p>
        <Button className="mt-2" onClick={load}>
          Try again
        </Button>
      </div>
    );
  }

  // The same name the sidebar shows: the profile's, else the one an email address gives.
  const firstName = user ? (displayNameFrom(user.name, user.email).trim().split(/\s+/)[0] ?? "") : "";

  if (result.data.length === 0) {
    return (
      <div className="mx-auto w-full max-w-wide animate-arrive px-4 py-8 sm:px-6">
        <Greeting firstName={firstName} line="Where to next? Your stays will live here." />
        <div className="mt-6 overflow-hidden rounded-card border border-border bg-card">
          <div className="grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-8">
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight">No trips yet</h2>
              <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
                Book a stay and it appears here with its dates, how to reach the property, the way there and
                its receipt. A home you rent through Injishi lives under My lease.
              </p>
            </div>
            <Button asChild size="lg">
              <Link href="/explore">
                <Icon name="search" className="size-4" />
                Explore stays
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const groups = groupTrips(result.data);
  const [next, ...moreUpcoming] = groups.current;
  const counts = { upcoming: moreUpcoming.length, past: groups.past.length, cancelled: groups.cancelled.length };
  const firstTab = counts.upcoming ? "upcoming" : counts.past ? "past" : "cancelled";
  const summary = next
    ? next.stage === "in_progress"
      ? `You're at ${next.propertyName} now.`
      : `${groups.current.length === 1 ? "One trip" : `${groups.current.length} trips`} coming up.`
    : `${groups.past.length} ${groups.past.length === 1 ? "stay" : "stays"} so far.`;

  return (
    <div className="mx-auto flex w-full max-w-wide animate-arrive flex-col gap-8 px-4 py-8 sm:px-6">
      <Greeting firstName={firstName} line={summary} />

      {next ? <NextTrip trip={next} place={places[next.id]} onChanged={load} /> : null}

      {counts.upcoming + counts.past + counts.cancelled > 0 ? (
        <Tabs defaultValue={firstTab}>
          <TabsList variant="underline" aria-label="Your other trips">
            {counts.upcoming ? <TabsTrigger value="upcoming">Also coming up · {counts.upcoming}</TabsTrigger> : null}
            {counts.past ? <TabsTrigger value="past">Past stays · {counts.past}</TabsTrigger> : null}
            {counts.cancelled ? <TabsTrigger value="cancelled">Cancelled · {counts.cancelled}</TabsTrigger> : null}
          </TabsList>
          <TabsContent value="upcoming">
            <TripGrid trips={moreUpcoming} places={places} onChanged={load} />
          </TabsContent>
          <TabsContent value="past">
            <TripGrid trips={groups.past} places={places} />
          </TabsContent>
          <TabsContent value="cancelled">
            <TripGrid trips={groups.cancelled} places={places} />
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}

/** Each trip's place, read once per property and shared by every card that names it. */
function useTripPlaces(trips: readonly GuestTrip[]): Record<string, TripPlace | null | undefined> {
  const [bySlug, setBySlug] = useState<Record<string, TripPlace | null>>({});
  const slugs = useMemo(() => [...new Set(trips.map((t) => t.propertySlug).filter((s): s is string => !!s))], [trips]);
  useEffect(() => {
    let live = true;
    for (const slug of slugs) {
      if (slug in bySlug) continue;
      void fetchTripPlace(slug).then((place) => {
        if (live) setBySlug((prev) => ({ ...prev, [slug]: place }));
      });
    }
    return () => {
      live = false;
    };
    // `bySlug` is read to skip known slugs only; a new answer must not refetch the rest.
  }, [slugs]);
  return Object.fromEntries(trips.map((t) => [t.id, t.propertySlug ? bySlug[t.propertySlug] : null]));
}

function Greeting({ firstName, line }: { firstName: string; line: string }) {
  return (
    <header>
      <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
        {firstName ? `Hello, ${firstName}` : "Your trips"}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{line}</p>
    </header>
  );
}

// ── The next trip ────────────────────────────────────────────────────────────────────────────────────

function NextTrip({ trip, place, onChanged }: { trip: GuestTrip; place: TripPlace | null | undefined; onChanged: () => void }) {
  const when = countdown(trip);
  const map =
    place?.latitude != null && place.longitude != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`
      : null;
  const whatsapp = whatsappLink(place?.whatsapp ?? null);
  return (
    <article
      aria-label={`Your next trip: ${trip.propertyName}`}
      className="overflow-hidden rounded-card border border-border bg-card shadow-sm"
    >
      <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Photo trip={trip} place={place} className="aspect-[16/10] lg:aspect-auto lg:min-h-[340px]" eager />

        <div className="flex min-w-0 flex-col gap-5 p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Badge variant={trip.stage === "in_progress" ? "success" : "accent"}>{when}</Badge>
              <h3 className="mt-3 font-display text-2xl font-bold tracking-tight">
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
          </div>

          <div className="grid grid-cols-2 overflow-hidden rounded-card border border-border">
            <DateBlock
              label="Check-in"
              date={trip.checkIn}
              time={
                place?.checkInTime
                  ? `From ${hhmm(place.checkInTime)}${place.checkInUntil ? ` to ${hhmm(place.checkInUntil)}` : ""}`
                  : null
              }
            />
            <DateBlock
              label="Check-out"
              date={trip.checkOut}
              time={place?.checkOutTime ? `By ${hhmm(place.checkOutTime)}` : null}
              divided
            />
          </div>

          <dl className="grid grid-cols-3 gap-4">
            <Fact label={trip.nights === 1 ? "Night" : "Nights"}>{trip.nights}</Fact>
            <Fact label={trip.guests === 1 ? "Guest" : "Guests"}>{trip.guests}</Fact>
            <Fact label="Paid">{trip.grossRwf === null ? "—" : formatPrice(trip.grossRwf)}</Fact>
          </dl>

          {place ? (
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-sm">
              {place.frontDeskOpens && place.frontDeskCloses ? (
                <InfoRow icon="clock">
                  Front desk open {hhmm(place.frontDeskOpens)} to {hhmm(place.frontDeskCloses)}
                </InfoRow>
              ) : place.frontDesk === "24h" ? (
                <InfoRow icon="clock">Front desk open day and night</InfoRow>
              ) : null}
              {place.directions ? <InfoRow icon="map">{place.directions}</InfoRow> : null}
              {whatsapp ? (
                <InfoRow icon="smartphone">
                  <a href={whatsapp} target="_blank" rel="noreferrer" className="font-medium underline-offset-4 hover:underline">
                    WhatsApp the property · {place.whatsapp}
                  </a>
                </InfoRow>
              ) : null}
            </ul>
          ) : null}

          <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-4">
            {trip.stage === "in_progress" ? (
              <Button asChild>
                <Link href="/stay">
                  <Icon name="door-open" className="size-4" />
                  My stay
                </Link>
              </Button>
            ) : null}
            <Button asChild variant={trip.stage === "in_progress" ? "outline" : "primary"}>
              <Link href="/inbox">
                <Icon name="message-square" className="size-4" />
                Message the property
              </Link>
            </Button>
            {map ? (
              <Button asChild variant="outline">
                <a href={map} target="_blank" rel="noreferrer">
                  <Icon name="map-pin" className="size-4" />
                  Directions
                </a>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link href={`/receipt/${encodeURIComponent(trip.reference)}`}>
                <Icon name="file-text" className="size-4" />
                Receipt
              </Link>
            </Button>
            <span className="grow" />
            <Reference value={trip.reference} />
          </div>
          <div className="-mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {trip.paymentStatus === "refund_pending" ? (
              <Link href="/account/refunds" className="font-semibold underline">
                Refund on its way
              </Link>
            ) : null}
            {trip.nonRefundable ? <span>Non-refundable rate</span> : null}
            {isCancellableStatus(trip) ? (
              // The server decides whether it may still be cancelled and what it refunds; the dialog
              // asks for that quote before offering to confirm.
              <CancelBooking reference={trip.reference} onCancelled={onChanged} />
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function DateBlock({ label, date, time, divided }: { label: string; date: string; time: string | null; divided?: boolean }) {
  const d = new Date(`${date}T12:00:00`);
  return (
    <div className={`flex flex-col gap-0.5 p-4 ${divided ? "border-l border-border" : ""}`}>
      <span className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="font-display text-lg font-bold tracking-tight">{WEEKDAY_DAY_MONTH.format(d)}</span>
      <span className="text-xs text-muted-foreground">{time ?? YEAR.format(d)}</span>
    </div>
  );
}

function InfoRow({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <Icon name={icon} className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0">{children}</span>
    </li>
  );
}

/** The booking reference, which a front desk asks for; one press copies it. */
function Reference({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        });
      }}
      className="money inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs text-muted-foreground hover:bg-secondary"
      aria-label={copied ? `Reference ${value} copied` : `Copy reference ${value}`}
    >
      <Icon name={copied ? "check" : "copy"} className="size-3.5" />
      <span>
        Ref <b className="text-card-foreground">{value}</b>
      </span>
    </button>
  );
}

// ── Every other trip ─────────────────────────────────────────────────────────────────────────────────

function TripGrid({
  trips,
  places,
  onChanged,
}: {
  trips: GuestTrip[];
  places: Record<string, TripPlace | null | undefined>;
  onChanged?: () => void;
}) {
  if (trips.length === 0) return null;
  return (
    <ul className="m-0 mt-4 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
      {trips.map((trip) => (
        <li key={trip.id}>
          <TripCard trip={trip} place={places[trip.id]} onChanged={onChanged} />
        </li>
      ))}
    </ul>
  );
}

function TripCard({ trip, place, onChanged }: { trip: GuestTrip; place: TripPlace | null | undefined; onChanged?: () => void }) {
  const badge = STATUS_BADGE[trip.stage];
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-card border border-border bg-card">
      <Photo trip={trip} place={place} className="aspect-[16/9]" />
      <div className="flex grow flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold">
              {trip.propertySlug ? (
                <Link href={`/property/${trip.propertySlug}`} className="hover:underline">
                  {trip.propertyName}
                </Link>
              ) : (
                trip.propertyName
              )}
            </h3>
            <p className="truncate text-xs text-muted-foreground">
              {trip.roomTypeName}
              {trip.districtName ? ` · ${trip.districtName}` : ""}
            </p>
          </div>
          {/* Colour never carries this alone: the badge prints the word. */}
          <Badge variant={badge.variant}>{trip.stage === "upcoming" ? countdown(trip) : badge.label}</Badge>
        </div>
        <p className="text-sm">
          {formatStayDates(trip.checkIn, trip.checkOut)}
          <span className="text-muted-foreground">
            {" "}
            · {trip.nights} {trip.nights === 1 ? "night" : "nights"} · {trip.guests}{" "}
            {trip.guests === 1 ? "guest" : "guests"}
          </span>
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <span className="money text-sm font-semibold">{trip.grossRwf === null ? "—" : formatPrice(trip.grossRwf)}</span>
          <span className="grow" />
          {trip.paymentStatus === "refund_pending" ? (
            <Link href="/account/refunds" className="text-xs font-semibold underline">
              Refund on its way
            </Link>
          ) : null}
          {onChanged && isCancellableStatus(trip) ? <CancelBooking reference={trip.reference} onCancelled={onChanged} /> : null}
          <Button asChild size="sm" variant="outline">
            <Link href={`/receipt/${encodeURIComponent(trip.reference)}`}>Receipt</Link>
          </Button>
          {trip.stage === "past" && trip.propertySlug ? (
            <Button asChild size="sm">
              <Link href={`/property/${trip.propertySlug}`}>Book again</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/** The place's first photograph, or a quiet panel while it loads or when it has none. */
function Photo({
  trip,
  place,
  className,
  eager,
}: {
  trip: GuestTrip;
  place: TripPlace | null | undefined;
  className: string;
  eager?: boolean;
}) {
  if (place === undefined) return <Skeleton className={`w-full rounded-none ${className}`} />;
  if (!place?.photo) {
    return (
      <div className={`flex w-full items-center justify-center bg-secondary text-muted-foreground ${className}`}>
        <Icon name="building" className="size-8" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={place.photo}
      alt={`${trip.propertyName}`}
      loading={eager ? "eager" : "lazy"}
      className={`w-full bg-secondary object-cover ${className}`}
    />
  );
}

// ── Words and dates ──────────────────────────────────────────────────────────────────────────────────

/**
 * Worth offering the dialog at all. Only a booking still pending or confirmed can be cancelled; the
 * quote says whether THIS one can.
 */
function isCancellableStatus(trip: GuestTrip): boolean {
  return trip.status === "confirmed" || trip.status === "pending_approval";
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-card-foreground">{children}</dd>
    </div>
  );
}

/** Stage → the badge a guest reads: is this happening, has it happened, or is it off. */
const STATUS_BADGE: Record<GuestTrip["stage"], { label: string; variant: "success" | "accent" | "outline" | "danger" }> = {
  in_progress: { label: "You're there now", variant: "success" },
  upcoming: { label: "Upcoming", variant: "accent" },
  past: { label: "Stayed", variant: "outline" },
  cancelled: { label: "Cancelled", variant: "danger" },
};

/** Today in the property's own zone, `yyyy-mm-dd`. */
function todayIn(timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kigali" }).format(new Date());
  }
}

const dayNumber = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86_400_000;

/** "In 3 days", "Tomorrow", "Check-in today", "Night 2 of 3", "Check-out today". */
function countdown(trip: GuestTrip): string {
  const today = dayNumber(todayIn(trip.timezone));
  const from = dayNumber(trip.checkIn);
  const to = dayNumber(trip.checkOut);
  if (trip.stage === "in_progress" || (today >= from && today < to)) {
    if (today >= to) return "Check-out today";
    return `Night ${Math.min(trip.nights, today - from + 1)} of ${trip.nights}`;
  }
  if (today === to) return "Check-out today";
  const days = from - today;
  if (days <= 0) return "Check-in today";
  if (days === 1) return "Tomorrow";
  if (days < 14) return `In ${days} days`;
  if (days < 60) return `In ${Math.round(days / 7)} weeks`;
  return `In ${Math.round(days / 30)} months`;
}

/** "14:00:00" → "14:00". */
const hhmm = (t: string) => t.slice(0, 5);

/** A Rwandan number the property wrote ("0790070901", "+250 790…") as a WhatsApp link. */
function whatsappLink(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  const intl = digits.startsWith("250") ? digits : digits.startsWith("0") ? `250${digits.slice(1)}` : digits;
  return intl.length >= 11 ? `https://wa.me/${intl}` : null;
}

const WEEKDAY_DAY_MONTH = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });
const YEAR = new Intl.DateTimeFormat("en-GB", { year: "numeric" });
const DAY_MONTH = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const DAY_MONTH_YEAR = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

/**
 * `12 – 15 Oct 2026`, collapsing the month when both ends share one. Parsed at midday rather than
 * midnight so a western-hemisphere timezone never prints the day before.
 */
function formatStayDates(checkIn: string, checkOut: string): string {
  const from = new Date(`${checkIn}T12:00:00`);
  const to = new Date(`${checkOut}T12:00:00`);
  const sameMonth = from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth();
  return `${sameMonth ? from.getDate() : DAY_MONTH.format(from)} – ${DAY_MONTH_YEAR.format(to)}`;
}

function TripsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-wide flex-col gap-6 px-4 py-8 sm:px-6">
      <span className="sr-only" role="status">
        Getting your trips
      </span>
      <div>
        <Skeleton className="h-8 w-56 rounded" />
        <Skeleton className="mt-2 h-4 w-40 rounded" />
      </div>
      <div className="grid overflow-hidden rounded-card border border-border bg-card lg:grid-cols-[5fr_7fr]">
        <Skeleton className="aspect-[16/10] rounded-none lg:aspect-auto lg:min-h-[340px]" />
        <div className="flex flex-col gap-4 p-7">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-7 w-2/3 rounded" />
          <Skeleton className="h-20 rounded-card" />
          <Skeleton className="h-10 rounded" />
        </div>
      </div>
    </div>
  );
}
