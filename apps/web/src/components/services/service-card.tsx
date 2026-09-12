import { Users } from "lucide-react";
import Link from "next/link";
import { cn } from "@injishi/utils";
import { ServiceKindPlate } from "@/components/services/service-kind-mark";
import {
  SERVICE_KIND_TAG,
  type ServiceListing,
} from "@/data/service-listings";
import { formatRwf } from "@/lib/money";

/**
 * The grid tile for a chargeable service.
 *
 * It answers the four questions a buyer actually arrives with, in the order
 * they arrive in: what is it, whose is it, what does it cost, and how many
 * people does it take. A stay card can leave capacity out because "sleeps 4" is
 * implied by the bedroom count; a hall cannot, because the whole decision is
 * whether the room fits the wedding.
 *
 * THE PRICE CARRIES ITS UNIT, always. `RWF 3,200,000` beside `RWF 3,000` is
 * meaningless until one says "per day" and the other "per vehicle, per night" —
 * this grid puts a convention hall and a parking bay in the same row, which is
 * a far wider spread than the explore grid ever shows, and the unit is the only
 * thing that makes the two comparable. Same reasoning as `shortBasis` on the
 * listing card, one product over.
 *
 * The panel sits UNDER the photograph rather than over it, following the
 * listing card: ink on a themed panel reaches contrast where white over
 * unpredictable photography does not.
 */
export function ServiceCard({
  service,
  className,
}: {
  service: ServiceListing;
  className?: string;
}) {
  return (
    <Link
      href={`/services/${service.slug}`}
      className={cn(
        "group flex h-full w-full flex-col overflow-hidden rounded-card border border-border bg-card transition-colors hover:border-accent-brand",
        className,
      )}
    >
      <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden">
        <picture className="block h-full w-full">
          <source
            type="image/avif"
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
            srcSet={`/assets/${service.gallery[0].stem}.avif`}
          />
          {/* Art-directed <picture>: next/image emits one format and cannot
              express the AVIF/JPEG source pair these exports ship as. */}
          <img
            src={`/assets/${service.gallery[0].stem}.jpg`}
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
            width={430}
            height={269}
            alt={service.gallery[0].alt}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
          />
        </picture>

        <div className="absolute bottom-3 left-3">
          <ServiceKindPlate kind={service.kind} label={SERVICE_KIND_TAG[service.kind]} />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-sans text-lg font-bold leading-[1.25] text-page-fg">
          {service.name}
        </h3>
        <p className="mt-1 truncate text-sm text-page-fg-70">{service.propertyName}</p>

        <p className="mt-3 text-sm text-page-fg-70">{service.blurb}</p>

        <div className="mt-4 flex items-start gap-2 text-sm text-page-fg-70">
          <Users className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} aria-hidden />
          <span>{service.capacity}</span>
        </div>

        <div className="mt-auto flex flex-wrap items-baseline gap-x-2 pt-5">
          <b className="text-xl font-bold text-page-fg">{formatRwf(service.priceRwf)}</b>
          <span className="text-sm text-page-fg-70">{service.priceUnit}</span>
        </div>
      </div>
    </Link>
  );
}
