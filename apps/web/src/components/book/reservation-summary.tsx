import Link from "next/link";
import type { BookablePropertySummary } from "@injishi/contracts";
import { Separator } from "@injishi/ui";
import { formatPrice } from "@injishi/utils";
import type { QuotePreview } from "@/lib/booking";
import { cancellationCopy } from "@/lib/booking";
import { propertyHref, type BookingSelection } from "@/lib/search-params";
import { guestSummary } from "@/lib/stay-search";

/**
 * The right-hand rail of checkout: the stay this booking is for, and its
 * money, restated so the guest never has to scroll up to remember what they
 * are paying for.
 *
 * ## Everything here now comes from the API
 *
 * This rail used to take a `PropertyDetail` out of `data/properties.ts` and
 * read four fields off it, which is what put 130 KB of curated fixtures into
 * the checkout's client bundle and what made a property without a hand-written
 * fixture row unbookable. It takes `BookablePropertySummary` now — the property
 * as `GET /api/v1/bookable/:roomTypeId` joins it — so the name beside the price
 * is the name in the database.
 *
 * Two things went with the fixture, and both should have gone earlier.
 *
 * The REVIEW COUNT came from `demoCommerceFor(...)`, a file whose own header
 * says its values must never be quoted to a guest. It was a number derived from
 * a hash of the slug, printed as a fact about a real business, on the screen
 * where somebody decides whether to pay. There is no review system yet, so
 * there is no count.
 *
 * The THUMBNAIL was a local asset keyed by the fixture's `cardImage.stem`. The
 * API returns an object key, and there is no public read URL for one yet — only
 * `StoragePort.signedUrl`, which no public route exposes. Rendering a broken
 * image is worse than rendering none, so the tile is typographic until that
 * route exists. The district under the name carries the "which one is this"
 * job in the meantime, and carries it better than a 64px photograph did.
 */
export function ReservationSummary({
  property,
  selection,
  quote,
  cancellationTier,
  nonRefundable,
}: {
  property: BookablePropertySummary;
  selection: BookingSelection;
  quote: QuotePreview;
  cancellationTier: Parameters<typeof cancellationCopy>[0];
  nonRefundable: boolean;
}) {
  /*
   * The back link uses the slug from the URL, not the one from the API.
   *
   * They are the same string in every ordinary case. Where they differ — a
   * property renamed since the guest opened the page — the URL's slug is the
   * page they actually came from, and sending someone "back" to a page they
   * have never seen is not back.
   */
  const backHref = propertyHref(selection.propertySlug, selection.intent);

  return (
    <div className="flex flex-col gap-4 lg:sticky lg:top-8 lg:max-h-[calc(100dvh-4rem)] lg:self-start lg:overflow-y-auto lg:scrollbar">
      <section className="rounded-card border border-input bg-card p-6">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="flex size-16 shrink-0 items-center justify-center rounded-card bg-surface-secondary text-xl font-semibold text-page-fg"
          >
            {property.name.trim().charAt(0).toUpperCase()}
          </span>

          <div className="min-w-0">
            <h2 className="text-sm font-semibold leading-snug text-page-fg">
              {property.name}
            </h2>
            {property.districtName ? (
              <p className="mt-1 text-sm text-page-fg-70">{property.districtName}</p>
            ) : null}
          </div>
        </div>

        <Separator className="my-6" />

        <h3 className="text-sm font-semibold text-page-fg">
          {nonRefundable ? "Non-refundable rate" : "Cancellation"}
        </h3>
        <p className="mt-1 text-sm text-page-fg-70">
          {cancellationCopy(cancellationTier, nonRefundable)}{" "}
          <Link href="/legal/terms" className="underline underline-offset-4">
            Full policy
          </Link>
        </p>

        <Separator className="my-6" />

        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-page-fg">Dates</h3>
          <Link
            href={backHref}
            className="rounded-full border border-input px-3 py-1 text-xs font-medium text-page-fg hover:bg-surface-secondary"
          >
            Change<span className="sr-only"> your dates</span>
          </Link>
        </div>
        <p className="mt-1 text-sm text-page-fg-70">
          {formatDateSpan(selection.intent.checkIn, selection.intent.checkOut)}
        </p>
        {property.checkInTime || property.checkOutTime ? (
          <p className="mt-1 text-xs text-page-fg-70">
            {property.checkInTime ? `Check in from ${trimTime(property.checkInTime)}` : null}
            {property.checkInTime && property.checkOutTime ? " · " : null}
            {property.checkOutTime ? `out by ${trimTime(property.checkOutTime)}` : null}
          </p>
        ) : null}

        <Separator className="my-6" />

        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-page-fg">Guests</h3>
          <Link
            href={backHref}
            className="rounded-full border border-input px-3 py-1 text-xs font-medium text-page-fg hover:bg-surface-secondary"
          >
            Change<span className="sr-only"> the number of guests</span>
          </Link>
        </div>
        <p className="mt-1 text-sm text-page-fg-70">{guestSummary(selection.intent.guests)}</p>

        <Separator className="my-6" />

        <h3 className="mb-3 text-sm font-semibold text-page-fg">Price details</h3>
        <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
          {quote.lines.map((line) => (
            <li key={line.label} className="flex items-center justify-between gap-4">
              <span className="text-page-fg-70">{line.label}</span>
              <span className="text-page-fg">
                {line.amountRwf < 0 ? "-" : ""}
                {formatPrice(Math.abs(line.amountRwf))}
              </span>
            </li>
          ))}
        </ul>

        <Separator className="my-6" />

        <div className="flex items-center justify-between gap-4">
          <b className="text-sm text-page-fg">
            Total <span className="font-normal text-page-fg-70">RWF</span>
          </b>
          <b className="text-sm text-page-fg">{formatPrice(quote.grossRwf)}</b>
        </div>
        {/*
          `PriceBreakdownLink` stood here: a component that took the quote,
          renamed it `_quote`, ignored it, and printed a sentence about itself.
          It read like a control and was not one. The lines it promised are the
          list directly above, so the honest version is one line of reassurance
          with nothing behind it to press.
        */}
        <p className="mt-2 text-xs text-page-fg-70">
          Every line is shown above. Nothing is rolled up, and there is no charge
          after this one.
        </p>
      </section>
    </div>
  );
}

const LONG_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatDateSpan(checkIn: string, checkOut: string): string {
  const from = LONG_DATE.format(new Date(`${checkIn}T00:00:00`));
  const to = LONG_DATE.format(new Date(`${checkOut}T00:00:00`));
  return `${from} – ${to}`;
}

/** Postgres `time` comes back as `14:00:00`; a guest reads `14:00`. */
function trimTime(value: string): string {
  return value.slice(0, 5);
}
