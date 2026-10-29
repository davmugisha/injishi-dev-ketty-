"use client";

import { BedDouble, CalendarCheck, CalendarDays, Check, ChevronDown, Flag, type LucideIcon, Users } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { bedsLine, nightlyRateFor, type RoomBed, type RoomTypeSummary } from "@injishi/contracts";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@injishi/web-ui";
import { formatPrice, nightsBetween, pluralize } from "@injishi/utils";
import { BookingGuestPicker } from "@/components/property/booking-guest-picker";
import { BOOKING_ANCHOR, useChosenRoom } from "@/components/property/chosen-room";
import { StayDatePicker } from "@/components/search/stay-date-picker";
import { computeQuote } from "@/lib/booking";
import {
  billableGuests,
  bookHref,
  isDated,
  parseIntent,
  toParamDate,
  type GuestCounts,
  type StayIntent,
} from "@/lib/search-params";
import { fromIntent, guestSummary, toDateRange } from "@/lib/stay-search";
import {
  fetchBookingCalendar,
  rangeProblem,
  type BookingCalendar,
} from "@/data/availability";
import {
  fetchPropertyRooms,
  fitsParty,
  largestParty,
  roomToSell,
  type PropertyRooms,
} from "@/data/property-rooms";
import { retryWhileFailed, type ApiResult } from "@/lib/api";

/**
 * The booking widget.
 *
 * Everything it shows is a preview. The server re-derives every amount from
 * the room's own rate when the booking is created and ignores what the client
 * sends, so a drift here changes the quote, never the charge.
 *
 * **It opens on what the guest already said.** The dates and the party arrive
 * in the URL from the hero search and from the explore grid, and this card
 * seeds itself from them. It used to open empty on every visit and ask both
 * questions a second time, which is the defect the search contract in
 * `lib/search-params.ts` exists to close. `useSearchParams` keeps the property
 * page cacheable: the params are read in the browser, so the page needs no
 * `searchParams` prop and is not rendered per query string.
 *
 * The three controls sit inside one bordered box divided by hairlines rather
 * than as three separate boxes. That is not decoration: it is what makes the
 * dates and the party read as a single question the card is asking, and it is
 * the detail that separates a booking card from a stack of form fields.
 *
 * The primary action is never disabled. An undated card cannot price a stay,
 * but a greyed-out button reads as breakage; instead the button stays live and
 * opens the picker that unblocks it.
 */
/**
 * The two facts the card reads about a property, and no more: its slug
 * addresses the real rooms, and its guest ceiling is its largest room type.
 * Every rate it quotes is a room's, read from the API.
 */
interface BookingWidgetProperty {
  slug: string;
  maxGuests: number;
}

/**
 * How a room's price is counted, in a guest's words. A hotel room (one with a kind of room, 0117) is priced
 * per room; a villa or apartment is the whole place; anything else is per person.
 */
function perWords(room: Pick<RoomTypeSummary, "priceBasis" | "roomCategory">): string {
  if (room.priceBasis !== "per_unit") return "per person, per night";
  return room.roomCategory ? "per room, per night" : "per night, whole place";
}

export function BookingWidget({ property }: { property: BookingWidgetProperty }) {
  const params = useSearchParams();
  const arrived = useMemo(() => parseIntent(params), [params]);

  // The URL seeds the card; edits after that belong to the card. A related
  // stay carries the same intent forward, so a remount lands on the same
  // answer rather than resetting the guest to nothing.
  const [range, setRange] = useState<DateRange | undefined>(() =>
    toDateRange(fromIntent(arrived)),
  );
  const [guests, setGuests] = useState<GuestCounts>(() => arrived.guests);
  const [datesOpen, setDatesOpen] = useState(false);
  const [guestsOpen, setGuestsOpen] = useState(false);
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [chosenRoomId, chooseRoom] = useChosenRoom();

  const nights = range?.from && range?.to ? nightsBetween(range.from, range.to) : 0;

  /**
   * Carried, not offered.
   *
   * The card used to own a non-refundable checkbox. Whether that rate exists is
   * `nonrefundableEligible` on the ROOM TYPE (F-B05 Path A), and this card
   * never reads a room type, so it was offering a 10% discount on every
   * property. The server drops the flag for a room type that
   * is not eligible, so a guest could tick it, watch the total fall, and be
   * charged the full rate (ADR-014 AC-7).
   *
   * The choice moved to the checkout, which reads the real room type and knows
   * the real answer. The value is still read out of the URL and carried onward,
   * so a link that already carries it keeps working.
   */
  const nonRefundable = params.get("nonRefundable") === "1";

  /*
   * The real inventory behind this page, or the honest absence of it.
   *
   * Read in the browser rather than on the server so this page stays statically
   * generated — the same reason `useSearchParams` is used above. A 404 means
   * the API holds no public property at this slug; a failed read means we
   * could not ask, and the two are worded apart below.
   *
   * `attempt` is the retry: bumping it re-runs the read without a reload, so a
   * guest who met a blip keeps the dates and party they had already chosen.
   */
  const [rooms, setRooms] = useState<ApiResult<PropertyRooms> | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setRooms(null);
    void (async () => {
      // Retried before it is shown: a restart of the API lasts seconds, and a
      // guest who arrived with dates should see the rooms, not a button.
      const result = await retryWhileFailed(() => fetchPropertyRooms(property.slug));
      if (!cancelled) setRooms(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [property.slug, attempt]);

  const sellable = rooms?.status === "ok" ? rooms.data.sellable : [];
  /** The API answered and holds nothing a guest can buy here. */
  const notSold =
    (rooms?.status === "ok" && sellable.length === 0) ||
    (rooms?.status === "refused" && rooms.httpStatus === 404);
  /** We could not ask. Never worded as `notSold`. */
  const unreadable = rooms !== null && rooms.status !== "ok" && !notSold;

  const party = billableGuests(guests);
  /*
   * The room being sold: the one the guest chose, or the cheapest that fits.
   *
   * A chosen room that is too small for the party is NOT swapped for one that
   * fits. The guest asked for that room by name; quietly pricing another would
   * sell them something they did not pick. It is held as their choice and the
   * card says it is too small, so they decide which to change.
   */
  const { room: bookable, chosen, chosenTooSmall } = roomToSell(sellable, chosenRoomId, party);
  const bookableRoomTypeId = bookable?.id ?? null;
  /*
   * The picker's ceiling is what the rooms take once they are known, so a guest
   * cannot choose a party checkout will refuse. Until then it is the property's
   * own figure, which is all there is to go on.
   */
  const ceiling = largestParty(sellable);
  const maxGuests = sellable.length > 0 ? (ceiling ?? property.maxGuests) : property.maxGuests;
  // Infants are free but never more than the stay sleeps: a link carrying
  // five infants into a room for two is trimmed, the same ceiling the picker holds.
  useEffect(() => {
    if (guests.infants > maxGuests) setGuests((g) => ({ ...g, infants: maxGuests }));
  }, [guests.infants, maxGuests]);

  /** Rooms are on sale, but none sleeps this many. The guest can fix this one. */
  const partyTooLarge = sellable.length > 0 && bookable === null && !chosenTooSmall;

  /*
   * What is left to sell (ADR-047 wave E).
   *
   * Fetched once the room is known, so the calendar can grey out nights that
   * are already taken instead of pricing them and letting the API refuse the
   * booking at the last click. A failure leaves `calendar` null, which offers
   * every night: the server re-checks under a row lock at purchase, so an
   * optimistic calendar is safe and a pessimistic one loses bookings.
   */
  const [calendar, setCalendar] = useState<BookingCalendar | null>(null);
  useEffect(() => {
    if (!bookableRoomTypeId) {
      setCalendar(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const result = await fetchBookingCalendar(bookableRoomTypeId);
      if (!cancelled) setCalendar(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [bookableRoomTypeId]);

  /*
   * ONE rate, and it is the server's: the room the API will charge for. A
   * property with nothing on sale has no rate to quote, rather than a figure
   * from somewhere else that a charge would then disagree with — the exact
   * defect `lib/booking.ts` exists to prevent one layer down.
   */
  const quotedRoom = bookable ?? chosen ?? sellable[0] ?? null;
  const listRateRwf = quotedRoom?.nightlyRateRwf ?? null;
  // A room priced per room charges one guest its one guest price, when it has one: the server's rule.
  const quotedRateRwf =
    quotedRoom && listRateRwf !== null ? nightlyRateFor({ ...quotedRoom, nightlyRateRwf: listRateRwf }, party) : null;
  const quotedBasis = quotedRoom?.priceBasis ?? "per_person";
  /** The room the card names: the guest's choice, else the one it would sell. */
  const shownRoom = chosen ?? bookable;

  const quote = useMemo(
    () =>
      quotedRateRwf === null
        ? null
        : computeQuote({
            nightlyRateRwf: quotedRateRwf,
            nights,
            // Per person, adding a guest adds their nights; a villa or apartment is per night, whole.
            guests: party,
            nonRefundable,
            priceBasis: quotedBasis,
          }),
    [quotedRateRwf, nights, party, nonRefundable, quotedBasis],
  );

  /**
   * The checkout link, or null.
   *
   * `bookHref` takes a `DatedIntent`, so the type system refuses a checkout URL
   * with no range in it. The old card hand-concatenated five parameters into a
   * template string and tested the two dates by eye at the call site.
   */
  const outgoing: StayIntent = {
    ...arrived,
    checkIn: toParamDate(range?.from),
    checkOut: range?.from ? toParamDate(range?.to) : null,
    guests,
  };
  /*
   * The server's own rules, asked BEFORE the guest commits to anything.
   *
   * `MAX_NIGHTS` and the minimum stay were enforced only at `POST /bookings`,
   * so a 120-night range or a two-night stay in a three-night-minimum room was
   * accepted by this card, priced, carried through checkout, and refused at the
   * final press. The API still enforces every one of these — this only stops
   * the guest finding out last.
   */
  const dateProblem = isDated(outgoing)
    ? rangeProblem(outgoing.checkIn, outgoing.checkOut, calendar)
    : null;

  const checkoutHref =
    quote && bookableRoomTypeId && !dateProblem && isDated(outgoing)
      ? bookHref(property.slug, outgoing, {
          nonRefundable,
          // ONE id now, and it is the room's. The checkout resolves the
          // property from it server-side (`GET /api/v1/bookable/:roomTypeId`),
          // so a link can no longer name a room and a property that disagree —
          // and `data/demo-listing.ts`, which lent one seeded room to every
          // property, is deleted rather than switched off.
          roomTypeId: bookableRoomTypeId,
        })
      : null;

  return (
    <div className="flex h-max flex-col lg:sticky lg:top-24">
      <aside
        id={BOOKING_ANCHOR}
        // The same soft surface as the key-facts tiles beside it: a hairline
        // ring, no heavy border, one quiet shadow.
        className="flex flex-col rounded-card bg-card p-6 shadow-control ring-1 ring-border"
      >
        <h2 className="mb-5 text-xl font-semibold leading-tight text-page-fg">
          {quote ? (
            <>
              <span className="underline underline-offset-4">
                {formatPrice(quote.grossRwf)}
              </span>{" "}
              <span className="font-normal">for {pluralize(nights, "night")}</span>
            </>
          ) : (
            "Add dates for prices"
          )}
        </h2>

        {/* Three field tiles in the key-facts style: dates side by side,
            guests full width under them. */}
        <div className="flex flex-col gap-2">
          {/* Only where there is a choice to make: one room needs no picker. */}
          {sellable.length > 1 ? (
            <Popover open={roomsOpen} onOpenChange={setRoomsOpen}>
              <PopoverTrigger asChild>
                <FieldButton
                  icon={BedDouble}
                  label={chosen ? "Room" : "Room (best fit for your party)"}
                  value={shownRoom?.name ?? "Choose a room"}
                  muted={!shownRoom}
                  full
                  chevron={roomsOpen ? "up" : "down"}
                />
              </PopoverTrigger>
              <PopoverContent
                align="end"
                collisionPadding={16}
                className="max-h-[var(--radix-popover-content-available-height)] w-[min(22rem,calc(100vw-2rem))] scrollbar overflow-y-auto p-1.5"
              >
                <ul role="listbox" aria-label="Rooms" className="m-0 flex list-none flex-col gap-0.5 p-0">
                  <RoomOption
                    selected={chosen === null}
                    title="Best fit for your party"
                    detail="The cheapest room that sleeps everyone"
                    onPick={() => {
                      chooseRoom(null);
                      setRoomsOpen(false);
                    }}
                  />
                  {sellable.map((room) => (
                    <RoomOption
                      key={room.id}
                      selected={room.id === chosenRoomId}
                      title={room.name}
                      detail={[
                        room.capacity ? `Sleeps ${room.capacity}` : null,
                        room.beds?.length ? bedsLine(room.beds as RoomBed[]) : null,
                        room.nightlyRateRwf !== null
                          ? `${formatPrice(room.nightlyRateRwf)} ${perWords(room)}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      warning={fitsParty(room, party) ? undefined : `Too small for ${pluralize(party, "guest")}`}
                      onPick={() => {
                        chooseRoom(room.id);
                        setRoomsOpen(false);
                      }}
                    />
                  ))}
                </ul>
              </PopoverContent>
            </Popover>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <Popover open={datesOpen} onOpenChange={setDatesOpen}>
              <PopoverTrigger asChild>
                <FieldButton
                  icon={CalendarDays}
                  label="Check-in"
                  value={range?.from ? formatCell(range.from) : "Add date"}
                  muted={!range?.from}
                />
              </PopoverTrigger>
              {/*
                Radix does not shrink an over-tall panel on its own, so without
                a cap the calendar ran off the bottom of short viewports and the
                footer buttons were simply cut off. Capping to the space Radix
                measures, and padding the collision box, keeps it on screen.
              */}
              <PopoverContent
                align="end"
                collisionPadding={16}
                className="max-h-[var(--radix-popover-content-available-height)] w-auto scrollbar overflow-y-auto p-0"
              >
                <StayDatePicker
                  variant="booking"
                  calendar={calendar}
                  range={range}
                  onChange={setRange}
                  onDone={() => setDatesOpen(false)}
                  doneLabel="Close"
                />
              </PopoverContent>
            </Popover>

            <FieldButton
              icon={CalendarCheck}
              label="Checkout"
              value={range?.to ? formatCell(range.to) : "Add date"}
              muted={!range?.to}
              onClick={() => setDatesOpen(true)}
            />
          </div>

          <Popover open={guestsOpen} onOpenChange={setGuestsOpen}>
            <PopoverTrigger asChild>
              <FieldButton
                icon={Users}
                label="Guests"
                value={guestSummary(guests)}
                full
                chevron={guestsOpen ? "up" : "down"}
              />
            </PopoverTrigger>
            <PopoverContent
              align="end"
              collisionPadding={16}
              className="max-h-[var(--radix-popover-content-available-height)] w-auto scrollbar overflow-y-auto p-0"
            >
              <BookingGuestPicker
                guests={guests}
                onChange={setGuests}
                onClose={() => setGuestsOpen(false)}
                maxGuests={maxGuests}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/*
          The fields run straight into the button. The rate option used to sit
          between them, which broke the one path the card exists to offer and
          asked a pricing question before there were any dates to price.
        */}
        {/*
          The label used to read "Request to book" on every property. That is
          a booking MODE, it is a per-room-type fact
          (F-B03), and nothing here knows it: a property whose rooms are
          instant_book was being told its guest would wait for a host who
          never has to answer. Where the mode is unknown the wording promises
          nothing and describes only what the button does (ADR-014 call 7 and
          AC-10). The checkout, which reads the real room type, is where the
          mode is finally named.
        */}
        {/*
          The states are kept apart because they are different problems, and
          most of them are the guest's to fix: dates, a party no room sleeps, a
          read that failed. Each of those keeps a live button that fixes it — a
          greyed-out button reads as breakage. Only a property the API really
          holds nothing to sell for gets a sentence instead of a button, and an
          outage is never worded as that: it used to be, so a blip in the API
          told a guest the property was closed.
        */}
        {/* The reason a chosen range or party cannot be booked, where the guest chose it. */}
        {dateProblem ? (
          <p role="alert" className="mt-4 text-sm text-danger-text">
            {dateProblem}
          </p>
        ) : chosenTooSmall && chosen ? (
          <p role="alert" className="mt-4 text-sm text-danger-text">
            The {chosen.name} sleeps {pluralize(chosen.capacity ?? 0, "guest")}, not counting
            infants. Choose another room, or fewer guests.
          </p>
        ) : partyTooLarge ? (
          <p role="alert" className="mt-4 text-sm text-danger-text">
            No room here sleeps {party}. The largest takes {pluralize(maxGuests, "guest")},
            not counting infants.
          </p>
        ) : unreadable ? (
          <p role="alert" className="mt-4 text-sm text-danger-text">
            We couldn&apos;t load the rooms for this stay just now. Your dates and
            guests are kept.
          </p>
        ) : null}

        {checkoutHref ? (
          <Button asChild size="lg" className="mt-4 h-12 w-full rounded-full text-base font-bold">
            <Link href={checkoutHref}>Review this stay</Link>
          </Button>
        ) : dateProblem ? (
          <Button
            size="lg"
            className="mt-4 h-12 w-full rounded-full text-base font-bold"
            onClick={() => setDatesOpen(true)}
          >
            Pick different dates
          </Button>
        ) : chosenTooSmall ? (
          <Button
            size="lg"
            className="mt-4 h-12 w-full rounded-full text-base font-bold"
            onClick={() => setRoomsOpen(true)}
          >
            Choose another room
          </Button>
        ) : partyTooLarge ? (
          <Button
            size="lg"
            className="mt-4 h-12 w-full rounded-full text-base font-bold"
            onClick={() => setGuestsOpen(true)}
          >
            Change guests
          </Button>
        ) : unreadable ? (
          <Button
            size="lg"
            className="mt-4 h-12 w-full rounded-full text-base font-bold"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Try again
          </Button>
        ) : notSold ? (
          <p className="mt-4 rounded-card bg-surface-secondary p-3 text-center text-sm text-page-fg">
            This stay can&apos;t be booked online right now.{" "}
            <Link href="/support" className="underline underline-offset-4">
              Ask us about it
            </Link>
          </p>
        ) : (
          <Button
            size="lg"
            className="mt-4 h-12 w-full rounded-full text-base font-bold"
            onClick={() => setDatesOpen(true)}
          >
            Book Now
          </Button>
        )}

        {/* Escrow copy only when a stay can actually be booked — not beside "can't be booked". */}
        {notSold ? null : (
          <p className="mt-4 text-center text-sm text-page-fg-70">
            You will not be charged yet. Payment is held in escrow until check-in.
          </p>
        )}

        {quote ? (
          <>
            <ul className="m-0 mt-4 flex list-none flex-col gap-3 p-0 text-base">
              {quote.lines.map((line) => (
                <li key={line.label} className="flex items-start justify-between gap-4">
                  <span className="text-page-fg underline underline-offset-4">
                    {line.label}
                  </span>
                  <span className="shrink-0 text-page-fg">
                    {line.amountRwf < 0 ? "-" : ""}
                    {formatPrice(Math.abs(line.amountRwf))}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex items-center justify-between border-t border-input pt-4">
              <b className="text-base text-page-fg">Total</b>
              <b className="text-base text-page-fg">{formatPrice(quote.grossRwf)}</b>
            </div>
          </>
        ) : null}
      </aside>

      <Link
        href="/support"
        className="mt-5 flex items-center justify-center gap-2 text-sm text-page-fg-70 underline underline-offset-4 transition-colors hover:text-page-fg"
      >
        <Flag width={14} height={14} strokeWidth={1.3} aria-hidden />
        Report this listing
      </Link>
    </div>
  );
}

/**
 * The card, before the browser has read the URL.
 *
 * A `Suspense` fallback rather than a spinner: the widget is 420px of sticky
 * column, and collapsing it to nothing while the params resolve moves every
 * paragraph beside it. The shape is the shape of the loaded card.
 */
export function BookingWidgetSkeleton() {
  return (
    <div className="flex h-max flex-col lg:sticky lg:top-24" aria-hidden>
      <div className="flex flex-col gap-4 rounded-card bg-card p-6 ring-1 ring-border">
        <div className="h-7 w-2/3 animate-pulse rounded bg-surface-secondary" />
        <div className="h-[136px] animate-pulse rounded-card bg-surface-secondary" />
        <div className="h-12 animate-pulse rounded-full bg-surface-secondary" />
        <div className="mx-auto h-4 w-4/5 animate-pulse rounded bg-surface-secondary" />
      </div>
    </div>
  );
}

/** "14/8/2026" - the numeric form the reference prints in its date cells. */
function formatCell(date: Date): string {
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}


/** One row of the Room picker: a name, what it sleeps and costs, a tick when chosen. */
function RoomOption({
  selected,
  title,
  detail,
  warning,
  onPick,
}: {
  selected: boolean;
  title: string;
  detail: string;
  /** Said under the row when the party does not fit; the row stays pickable. */
  warning?: string;
  onPick: () => void;
}) {
  return (
    <li role="option" aria-selected={selected}>
      <button
        type="button"
        onClick={onPick}
        className="flex w-full items-start gap-2.5 rounded-card px-3 py-2.5 text-left transition-colors hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center text-accent-text">
          {selected ? <Check className="size-4" strokeWidth={2.6} aria-hidden /> : null}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold text-page-fg">{title}</span>
          <span className="block text-xs text-page-fg-70">{detail}</span>
          {warning ? <span className="block text-xs text-danger-text">{warning}</span> : null}
        </span>
      </button>
    </li>
  );
}
function FieldButton({
  icon: Icon,
  label,
  value,
  muted = false,
  full = false,
  chevron,
  onClick,
  ...rest
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  muted?: boolean;
  full?: boolean;
  chevron?: "up" | "down";
  onClick?: () => void;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button
      variant="ghost"
      shape="square"
      onClick={onClick}
      /* `--button-bg`, not a `bg-*` class. HeroUI's `.button--*` rules declare
         `background-color: var(--button-bg)` unlayered, and unlayered beats
         Tailwind's `@layer utilities`, so a colour class here never lands. */
      className={`${full ? "w-full" : "w-full min-w-0"} h-auto justify-between gap-2.5 rounded-card p-3 text-left font-normal ring-1 ring-border [--button-bg:var(--card)] [--button-bg-hover:var(--surface-secondary)]`}
      {...rest}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-accent-text">
          <Icon className="size-4" strokeWidth={2} aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block text-xs text-page-fg-70">{label}</span>
          <span
            className={`block truncate text-sm font-bold ${muted ? "text-page-fg-70" : "text-page-fg"}`}
          >
            {value}
          </span>
        </span>
      </span>

      {chevron ? (
        <ChevronDown
          width={16}
          height={16}
          strokeWidth={2}
          aria-hidden
          className={`shrink-0 text-page-fg-70 transition-transform ${chevron === "up" ? "rotate-180" : ""}`}
        />
      ) : null}
    </Button>
  );
}
