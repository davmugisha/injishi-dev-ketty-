import { Grid3x3 } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import type { RoomTypeSummary } from "@injishi/contracts";
import { formatPrice, pluralize } from "@injishi/utils";
import {
  BookingWidget,
  BookingWidgetSkeleton,
} from "@/components/property/booking-widget";
import { PropertyFacilities } from "@/components/property/property-facilities";
import {
  ChooseRoomButton,
  ChooseRoomButtonFallback,
} from "@/components/property/choose-room-button";
import { SectionHeading } from "@/components/shared/section-heading";
import { isSellable } from "@/data/property-rooms";
import type { PublicProperty } from "@/data/public-property";

/**
 * A published property the API holds, rendered from its database fields only
 * (ADR-053, owner ruling of 2026-09-13).
 *
 * Every property page is this one: the database is the only source (a curated
 * catalogue of fictional stays used to have its own page, removed 2026-10-08).
 * It has no guest score, property type or specifications, because the database
 * holds none of them, and it does not render those sections empty or borrow
 * plausible values. What it shows is what the owner authored in the operator
 * app: the name, district, description, check in and out times, house rules,
 * amenities, photographs and every room type with its price.
 *
 * Photographs are the API's photo route URLs, plain `<img>` rather than
 * `next/image`: the optimiser would fetch and cache the signed target itself,
 * which would keep serving a suspended property's pictures from the cache after
 * the route has started refusing them.
 */
export function DatabaseProperty({ property, slug }: { property: PublicProperty; slug: string }) {
  const rooms = property.roomTypes.filter((room) => room.domain === "hospitality");
  // A bar or coffee shop lists a menu and is not booked (owner decision, 2026-10-29).
  const menu = rooms.length > 0 && rooms.every((room) => room.priceBasis === "per_item");
  const cheapest = rooms.find((room) => room.nightlyRateRwf !== null) ?? null;
  const facts = [
    property.districtName,
    rooms.length > 0 ? pluralize(rooms.length, menu ? "item" : "room type") : null,
    cheapest?.nightlyRateRwf != null
      ? `from ${formatPrice(cheapest.nightlyRateRwf)} ${PRICE_PERIOD[cheapest.priceBasis]}`
      : null,
  ].filter((fact): fact is string => Boolean(fact));
  // The card's guest ceiling: nobody books more people than the largest room sleeps.
  const maxGuests = Math.max(1, ...rooms.map((room) => room.capacity ?? 1));

  return (
    <div className="flex flex-col items-center bg-background">
      <div className="container flex flex-col gap-4 pt-24 lg:pt-28">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold leading-tight text-page-fg sm:text-3xl">
            {property.name}
          </h1>
          {facts.length > 0 ? (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-page-fg-70">
              {facts.map((fact, i) => (
                <span key={fact} className="flex items-center gap-2">
                  {fact}
                  {i < facts.length - 1 ? <span aria-hidden>·</span> : null}
                </span>
              ))}
            </p>
          ) : null}
        </div>
        <PhotoMosaic name={property.name} photos={property.photos} slug={slug} />
      </div>

      <div className="section-y container grid grid-cols-1 gap-10 lg:grid-cols-[1fr_380px] lg:gap-16">
        <div className="flex flex-col gap-14">
          {property.description ? (
            <section className="flex flex-col gap-4">
              <SectionHeading lead="About this " emphasis={menu ? "place" : "stay"} className="mb-2" />
              {paragraphs(property.description).map((paragraph) => (
                <p key={paragraph.slice(0, 40)} className="max-w-read text-page-fg-70">
                  {paragraph}
                </p>
              ))}
            </section>
          ) : null}

          <section>
            <SectionHeading lead={menu ? "Menu" : "Rooms"} className="mb-6" />
            {rooms.length > 0 ? (
              <ul className="m-0 flex list-none flex-col p-0">
                {rooms.map((room) => (
                  <RoomRow key={room.id} room={room} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-page-fg-70">No rooms are listed here yet.</p>
            )}
          </section>

          {property.checkInTime || property.checkOutTime ? (
            <section>
              <SectionHeading lead="Arriving and leaving" className="mb-6" />
              <dl className="grid grid-cols-2 gap-x-8">
                {property.checkInTime ? (
                  <div className="flex flex-col gap-1 border-b border-input py-3">
                    <dt className="text-sm text-page-fg-70">Check-in from</dt>
                    <dd className="m-0 text-base font-medium text-page-fg">
                      {clockTime(property.checkInTime)}
                    </dd>
                  </div>
                ) : null}
                {property.checkOutTime ? (
                  <div className="flex flex-col gap-1 border-b border-input py-3">
                    <dt className="text-sm text-page-fg-70">Check-out by</dt>
                    <dd className="m-0 text-base font-medium text-page-fg">
                      {clockTime(property.checkOutTime)}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </section>
          ) : null}

          <PropertyFacilities facilities={property.facilities} />

          {property.houseRules ? (
            <section className="flex flex-col gap-4">
              <SectionHeading lead="House rules" className="mb-2" />
              {paragraphs(property.houseRules).map((paragraph) => (
                <p key={paragraph.slice(0, 40)} className="max-w-read text-page-fg-70">
                  {paragraph}
                </p>
              ))}
            </section>
          ) : null}
        </div>

        {/* It reads the real rooms by slug in the browser, so a property that stops being public stops
            being sellable on the next load, whatever this page's cache holds. A venue has no booking card:
            customers walk in, so the card says where and when instead. */}
        {menu ? (
          <VisitCard property={property} />
        ) : (
          <Suspense fallback={<BookingWidgetSkeleton />}>
            <BookingWidget property={{ slug, maxGuests }} />
          </Suspense>
        )}
      </div>
    </div>
  );
}

/** How a listed price is counted, in the words beside it. */
const PRICE_PERIOD: Record<RoomTypeSummary["priceBasis"], string> = {
  per_person: "per person, per night",
  per_unit: "per night, whole place",
  per_item: "each",
};

/** In place of the booking card on a bar's or coffee shop's page: nothing to book, so where to find it. */
function VisitCard({ property }: { property: PublicProperty }) {
  return (
    <aside className="flex h-fit flex-col gap-3 rounded-card border border-input p-6">
      <h2 className="text-lg font-semibold text-page-fg">Visit</h2>
      <p className="text-sm text-page-fg-70">
        No booking needed. The prices on this page are what you pay when you order.
      </p>
      {property.districtName ? <p className="text-sm text-page-fg">{property.districtName}</p> : null}
      <Link href="/support" className="text-sm underline underline-offset-4">
        Ask us about this place
      </Link>
    </aside>
  );
}

function RoomRow({ room }: { room: RoomTypeSummary }) {
  const details = [
    room.capacity && room.priceBasis !== "per_item" ? `Sleeps ${room.capacity}` : null,
    room.bookingMode === "instant_book"
      ? "Instant booking"
      : room.bookingMode === "request_to_book"
        ? "Confirmed by the host"
        : null,
    room.minStay && room.minStay > 1 ? `${room.minStay} night minimum` : null,
  ].filter((detail): detail is string => Boolean(detail));

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-input py-4">
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-base font-medium text-page-fg">{room.name}</span>
        {details.length > 0 ? (
          <span className="text-sm text-page-fg-70">{details.join(" · ")}</span>
        ) : null}
      </span>
      <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-base text-page-fg">
          {room.nightlyRateRwf !== null ? (
            <>
              <b className="font-semibold">{formatPrice(room.nightlyRateRwf)}</b>{" "}
              <span className="text-sm text-page-fg-70">{PRICE_PERIOD[room.priceBasis]}</span>
            </>
          ) : (
            <span className="text-sm text-page-fg-70">Price on request</span>
          )}
        </span>
        {/* Only a room the card can sell can be chosen for it. Suspense
            because the button reads the address, as the card does. */}
        {isSellable(room) ? (
          <Suspense fallback={<ChooseRoomButtonFallback />}>
            <ChooseRoomButton roomTypeId={room.id} roomName={room.name} />
          </Suspense>
        ) : null}
      </span>
    </li>
  );
}

/**
 * The photographs: one large frame and up to four beside it on a wide screen,
 * one swipeable strip on a phone. Only the outer corners are rounded, so five
 * photographs read as one picture rather than five.
 */
function PhotoMosaic({ name, photos, slug }: { name: string; photos: string[]; slug: string }) {
  if (photos.length === 0) return null;
  const galleryHref = `/property/${slug}/gallery`;
  const frames = photos.slice(0, 5);

  return (
    <section id="photos" className="relative">
      <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto rounded-card md:hidden">
        {photos.map((src, index) => (
          <Link key={src} href={galleryHref} className="block w-full shrink-0 snap-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- a photo route URL; see the component note */}
            <img
              src={src}
              alt={`${name}, photo ${index + 1} of ${photos.length}`}
              width={960}
              height={720}
              loading={index === 0 ? "eager" : "lazy"}
              className="aspect-[4/3] w-full object-cover"
            />
          </Link>
        ))}
      </div>

      <div
        className={
          frames.length === 1
            ? "hidden aspect-[2/1] overflow-hidden rounded-card md:block"
            : "hidden aspect-[2/1] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-card md:grid"
        }
      >
        {frames.map((src, index) => (
          <Link
            key={src}
            href={galleryHref}
            className={`group relative block overflow-hidden ${tileSpan(index, frames.length)}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a photo route URL; see the component note */}
            <img
              src={src}
              alt={`${name}, photo ${index + 1} of ${photos.length}`}
              width={1120}
              height={560}
              loading={index === 0 ? "eager" : "lazy"}
              fetchPriority={index === 0 ? "high" : "auto"}
              className="h-full w-full object-cover transition-[filter] duration-quick group-hover:brightness-90"
            />
          </Link>
        ))}
      </div>

      <Link
        href={galleryHref}
        className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded border border-input bg-card px-4 py-2 text-sm font-medium text-card-foreground shadow-sm md:bottom-6 md:right-6"
      >
        <Grid3x3 width={14} height={14} aria-hidden />
        {photos.length === 1 ? "Show the photo" : `Show all ${photos.length} photos`}
      </Link>
    </section>
  );
}

/**
 * How much of the four by two grid one tile takes, so no count of photographs
 * leaves an empty cell: the first is always the large half, and whatever is left
 * shares the other half evenly.
 */
function tileSpan(index: number, count: number): string {
  if (count === 1) return "h-full";
  if (index === 0 || count === 2) return "col-span-2 row-span-2";
  if (count === 3) return "col-span-2";
  if (count === 4 && index === 3) return "col-span-2";
  return "";
}

/** Blank lines separate paragraphs the way the operator typed them. */
function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** `14:00:00` → `14:00`. The column is a bare `time`, and seconds mean nothing to a guest. */
function clockTime(value: string): string {
  return value.slice(0, 5);
}
