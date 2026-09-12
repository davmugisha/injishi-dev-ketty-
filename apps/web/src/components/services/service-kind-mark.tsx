import { CircleParking, Landmark, Tent, Trees, Waves } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ServiceKind } from "@/data/service-listings";

/**
 * The mark that stands for each kind of sellable service.
 *
 * It lives here and not in `data/service-listings.ts` because a `LucideIcon` is
 * a React component, and putting one in the fixture would drag React into a
 * file the property page imports for its prices. The LABEL is in the data file;
 * only the glyph is here, and the two are keyed by the same union so a sixth
 * kind cannot be added without giving it both.
 */
const KIND_ICON: Record<ServiceKind, LucideIcon> = {
  pool: Waves,
  hall: Landmark,
  tents: Tent,
  outdoor: Trees,
  parking: CircleParking,
};

/**
 * A kind glyph with its label, on a plate that can sit on a photograph.
 *
 * White plate rather than a scrim, for the same reason the listing card uses
 * one: this sits on unpredictable photography and has to hold its contrast
 * whatever the frame behind it turns out to be. `text-accent-ink` holds one
 * value in both themes, which is what a fixed light plate needs.
 */
export function ServiceKindPlate({
  kind,
  label,
}: {
  kind: ServiceKind;
  label: string;
}) {
  const Icon = KIND_ICON[kind];
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-2xs font-bold uppercase tracking-widest text-accent-ink">
      <Icon className="size-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
      {label}
    </span>
  );
}

/** The same glyph, unplated, for use in body text on the page background. */
export function ServiceKindIcon({
  kind,
  className,
}: {
  kind: ServiceKind;
  className?: string;
}) {
  const Icon = KIND_ICON[kind];
  return <Icon className={className} strokeWidth={1.8} aria-hidden />;
}
