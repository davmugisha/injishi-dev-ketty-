import { ArrowUpRight, MapPin, Phone, Users } from "lucide-react";
import Link from "next/link";
import { Button, Separator } from "@injishi/ui";
import { ServiceKindIcon } from "@/components/services/service-kind-mark";
import { SERVICE_KIND_TAG, type ServiceListing } from "@/data/service-listings";
import { CONTACT } from "@/data/navigation";
import { formatRwf } from "@/lib/money";

/**
 * The rail beside a service: the price, the capacity, the property, the ask.
 *
 * It deliberately does NOT copy the stay booking widget. A stay is priced by
 * the night and totalled across a date range, so that widget's whole job is
 * arithmetic. A service is priced per person, per day, per event, per tent or
 * per vehicle — five different units in one catalogue — and the quantity that
 * multiplies each one is different too. Multiplying anything here would print a
 * confident total that no rate card behind it agrees with.
 *
 * So the ask is a real reservation channel rather than a simulated checkout.
 * The WhatsApp link carries the service, the property and the quoted rate into
 * the message, which is how these bookings are actually made in Kigali today,
 * and the phone number beside it is the same one `/support` publishes. Both
 * come from `CONTACT` in `data/navigation.ts` — the one place the site's
 * numbers are defined.
 */
export function ServiceBookingPanel({ service }: { service: ServiceListing }) {
  const enquiry = [
    `Hello Injishi — I would like to book ${service.name}`,
    `at ${service.propertyName}.`,
    `The rate listed is ${formatRwf(service.priceRwf)} ${service.priceUnit}.`,
  ].join(" ");

  return (
    <aside className="flex flex-col gap-5 rounded-card border border-border bg-card p-6 lg:sticky lg:top-24">
      <div>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <b className="text-display-sm font-bold text-page-fg">
            {formatRwf(service.priceRwf)}
          </b>
          <span className="text-sm text-page-fg-70">{service.priceUnit}</span>
        </div>
        <p className="mt-1 text-sm text-page-fg-70">
          Quoted in Rwandan francs, inclusive of VAT.
        </p>
      </div>

      <Separator />

      <dl className="m-0 flex flex-col gap-3">
        <Row label="Capacity" icon={<Users className="size-4 shrink-0" strokeWidth={1.8} aria-hidden />}>
          {service.capacity}
        </Row>
        <Row
          label="Service"
          icon={<ServiceKindIcon kind={service.kind} className="size-4 shrink-0" />}
        >
          {SERVICE_KIND_TAG[service.kind]}
        </Row>
        <Row label="Where" icon={<MapPin className="size-4 shrink-0" strokeWidth={1.8} aria-hidden />}>
          <Link
            href={`/property/${service.propertySlug}`}
            className="underline underline-offset-[4px]"
          >
            {service.propertyName}
          </Link>
        </Row>
      </dl>

      <Separator />

      <div className="flex flex-col gap-3">
        <Button asChild size="lg">
          <a
            href={`${CONTACT.whatsappHref}&text=${encodeURIComponent(enquiry)}`}
            target="_blank"
            rel="noreferrer"
          >
            Book on WhatsApp
            <ArrowUpRight className="size-4 shrink-0" strokeWidth={2} aria-hidden />
          </a>
        </Button>

        <Button asChild variant="outline" size="lg">
          <a href={CONTACT.phoneHref}>
            <Phone className="size-4 shrink-0" strokeWidth={2} aria-hidden />
            {CONTACT.phone}
          </a>
        </Button>

        <p className="text-sm text-page-fg-70">
          Our reservations team holds the date with the property and sends you the
          confirmation. Nothing is charged until the property confirms.
        </p>
      </div>
    </aside>
  );
}

function Row({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="flex items-center gap-2 text-sm text-page-fg-70">
        {icon}
        {label}
      </dt>
      <dd className="m-0 text-right text-sm font-medium text-page-fg">
        {children}
      </dd>
    </div>
  );
}
