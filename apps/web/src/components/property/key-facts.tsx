import { ACCOMMODATION_CLASS_LABEL } from "@injishi/contracts";
import { BedDouble, Building2, type LucideIcon, Star, Users, Wallet } from "lucide-react";
import type { PropertyDetail } from "@/data/properties";
import { bookingUnit } from "@/lib/booking-unit";
import { isPerPerson } from "@/lib/rate-basis";

/**
 * The at-a-glance strip under a property's description: one fact per tile,
 * a short value with an icon and a small caption, read from the property's
 * structured fields.
 *
 * It replaced the first three rows of the specifications list printed as
 * cards, which put whatever prose sat in those rows into a tile ("1 bedroom ·
 * sleeps 2 · priced per person"). Here each idea gets its own tile and its
 * own word, and the long form stays in the specifications list below.
 */
export function KeyFacts({ property }: { property: PropertyDetail }) {
  const unit = bookingUnit(
    property.kind,
    `${property.cardName.lead} ${property.cardName.rest}`,
  ).one;
  const per = property.rooms ? `per ${unit}` : "whole place";
  const [basisHead, ...basisRest] = property.price.basis.split(",").map((s) => s.trim());
  const basis = isPerPerson(property.price.basis)
    ? { value: "Per person", caption: basisRest.join(", ") || "per night" }
    : {
        value: basisHead ? basisHead[0]!.toUpperCase() + basisHead.slice(1) : "On request",
        caption: basisRest.join(", ") || "price basis",
      };

  const facts: { icon: LucideIcon; value: string; caption: string }[] = [
    { icon: Building2, value: ACCOMMODATION_CLASS_LABEL[property.kind], caption: "Type" },
    ...(property.starClass
      ? [{ icon: Star, value: `${property.starClass}-star`, caption: "Class" }]
      : []),
    {
      icon: Users,
      value: `Sleeps ${property.maxGuests}`,
      caption: per,
    },
    {
      icon: BedDouble,
      value: `${property.bedrooms} ${property.bedrooms === 1 ? "bedroom" : "bedrooms"}`,
      caption: per,
    },
    { icon: Wallet, value: basis.value, caption: basis.caption },
  ];

  return (
    <ul aria-label="Key facts" className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {facts.map(({ icon: Icon, value, caption }) => (
        <li
          key={caption + value}
          className="flex items-center gap-3 rounded-card bg-card p-3.5 ring-1 ring-border"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-accent-text">
            <Icon className="size-4" strokeWidth={2} aria-hidden />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-bold text-foreground">{value}</span>
            <span className="truncate text-xs text-muted-foreground">{caption}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
