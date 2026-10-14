"use client";

import {
  ArrowRight,
  Briefcase,
  Building2,
  Car,
  Check,
  ChevronRight,
  Footprints,
  House,
  Landmark,
  Leaf,
  MapPin,
  Mountain,
  PawPrint,
  Sailboat,
  Sunset,
  Tent,
  TreePalm,
  Trees,
  UtensilsCrossed,
  Waves,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@injishi/utils";
import { LazyJourneyMap } from "@/components/home/lazy-journey-map";
import { StayThumb } from "@/components/home/stay-thumb";
import { ArtDirectedImage } from "@/components/shared/art-directed-image";
import {
  formatHours,
  type DistrictPlace,
  type PlaceMark,
  type TagIcon,
} from "@/data/journeys";
import type { Listing } from "@/data/listings";
import { ACCOMMODATION_CLASS_LABEL } from "@injishi/contracts";
import { formatRateNumber, shortBasis } from "@/lib/price";

export interface GlancePlace {
  place: DistrictPlace;
  count: number;
  href: string;
  /** The district's best few stays, for the detail panel. */
  stays: Listing[];
}

const MARK_ICON: Readonly<Record<PlaceMark, LucideIcon>> = {
  city: Building2,
  volcano: Mountain,
  lake: Waves,
  island: TreePalm,
  forest: Trees,
  savannah: PawPrint,
};

const TAG_ICON: Readonly<Record<TagIcon, LucideIcon>> = {
  culture: Landmark,
  food: UtensilsCrossed,
  business: Briefcase,
  trek: Footprints,
  volcano: Mountain,
  nature: Leaf,
  beach: Waves,
  boat: Sailboat,
  sunset: Sunset,
  island: TreePalm,
  quiet: Leaf,
  forest: Trees,
  lake: Waves,
  wildlife: PawPrint,
  camping: Tent,
};

/**
 * "Rwanda at a glance": a map card and a district card, side by side.
 *
 * Pick a district from the pills or the map. The map draws the road from
 * Kigali with the drive time on it and drops a pin on the district; the card
 * beside it shows the place — photograph, province, what it is best for —
 * and its top stays, each a link. The travel facts (drive times, "best for")
 * are editorial (`data/journeys.ts`); the counts and stays are live.
 */
export function RwandaAtAGlance({ places }: { places: GlancePlace[] }) {
  const busiest = places.reduce<GlancePlace | undefined>(
    (best, entry) => (!best || entry.count > best.count ? entry : best),
    undefined,
  );
  const [picked, setPicked] = useState<string | null>(null);
  const kigali = places.find((entry) => entry.place.slug === "kigali")?.place;
  const focused = places.find((entry) => entry.place.slug === picked) ?? busiest;
  if (!focused) return null;
  const total = places.reduce((sum, entry) => sum + entry.count, 0);
  const drive =
    focused.place.hoursFromKigali > 0
      ? `${formatHours(focused.place.hoursFromKigali)} from Kigali`
      : "Where you land";

  return (
    <section className="section-y container flex flex-col gap-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h2 className="text-2xl font-normal leading-[1.2] text-foreground lg:text-display-sm">
              Rwanda <span className="font-bold">at a glance</span>
            </h2>
            <p className="text-sm text-muted-foreground">
              Explore {total} stays across Rwanda · Drive times from Kigali
            </p>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="District"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] xl:mx-0 xl:px-0 [&::-webkit-scrollbar]:hidden"
        >
          {places.map(({ place, count }) => {
            const on = focused.place.slug === place.slug;
            return (
              <button
                key={place.slug}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setPicked(place.slug)}
                className={cn(
                  "flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold ring-1 transition-colors duration-quick focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  on
                    ? "bg-accent text-accent-foreground ring-accent"
                    : "bg-card text-foreground ring-border hover:bg-surface-secondary",
                )}
              >
                {on ? <Check className="size-4" strokeWidth={2.6} aria-hidden /> : null}
                {place.name}
                <span className={cn("ml-1 text-xs font-medium", on ? "opacity-80" : "text-muted-foreground")}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        {/* ------------------------------------------------------------ map */}
        <LazyJourneyMap
          className="aspect-[4/3] overflow-hidden rounded-card ring-1 ring-border lg:aspect-auto lg:min-h-[30rem]"
          fit="country"
          onPick={setPicked}
          points={places.map(({ place, count }) => ({
            id: place.slug,
            latitude: place.latitude,
            longitude: place.longitude,
            label: place.name,
            kind: "place" as const,
            icon: MARK_ICON[place.mark],
            count,
            active: place.slug === focused.place.slug,
          }))}
          legs={
            kigali && focused.place.hoursFromKigali > 0
              ? [
                  {
                    from: [kigali.longitude, kigali.latitude],
                    to: [focused.place.longitude, focused.place.latitude],
                    hours: focused.place.hoursFromKigali,
                  },
                ]
              : []
          }
        />

        {/* ------------------------------------------------- district card */}
        <div key={focused.place.slug} className="flex flex-col overflow-hidden rounded-card bg-card ring-1 ring-border">
          <div className="relative aspect-[5/2] overflow-hidden bg-surface-secondary">
            <ArtDirectedImage
              stem={focused.place.image.stem}
              alt={focused.place.image.alt}
              sizes="(max-width: 1024px) 100vw, 50vw"
              width={1200}
              height={600}
              pictureClassName="block h-full w-full"
              className="animate-drift h-full w-full"
            />
            <span className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs font-bold text-foreground shadow-control">
              <Car className="size-3.5 text-accent-text" strokeWidth={2.4} aria-hidden />
              {drive}
            </span>
            <span className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs font-bold text-foreground shadow-control">
              <House className="size-3.5 text-accent-text" strokeWidth={2.4} aria-hidden />
              {focused.count} {focused.count === 1 ? "stay" : "stays"}
            </span>
          </div>

          <div className="flex flex-1 flex-col gap-4 p-5 lg:p-6">
            <div className="animate-fade-up flex flex-col gap-4 opacity-0 [animation-fill-mode:forwards] sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 flex-col">
                <h3 className="text-2xl font-bold leading-tight text-foreground lg:text-3xl">
                  {focused.place.name}
                </h3>
                <p className="text-sm text-muted-foreground">{focused.place.known}</p>
              </div>
              <div className="flex flex-col gap-1.5 sm:items-end">
                <span className="text-2xs font-semibold uppercase tracking-[0.12em] text-accent-text">
                  Best for
                </span>
                <div className="flex flex-wrap gap-1.5 sm:justify-end">
                  {focused.place.bestFor.map(({ label, icon }) => {
                    const Icon = TAG_ICON[icon];
                    return (
                      <span
                        key={label}
                        className="flex items-center gap-1 rounded-full bg-surface-secondary px-2.5 py-1 text-xs font-medium text-foreground"
                      >
                        <Icon className="size-3.5 text-accent-text" strokeWidth={2.2} aria-hidden />
                        {label}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border pb-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <MapPin className="size-4" aria-hidden />
                {focused.place.province}
              </span>
              <span className="flex items-center gap-1.5">
                <Car className="size-4" aria-hidden />
                {drive}
              </span>
              <span className="flex items-center gap-1.5">
                <House className="size-4" aria-hidden />
                {focused.count} {focused.count === 1 ? "stay" : "stays"}
              </span>
            </div>

            <h4 className="text-lg font-bold text-foreground">Top stays in {focused.place.name}</h4>

            <ul className="flex flex-col gap-2">
              {focused.stays.map((stay, index) => {
                const rate = formatRateNumber(stay.nightlyRateRwf);
                return (
                  <li
                    key={stay.slug}
                    className="animate-fade-up group relative flex items-center gap-3 rounded-[1rem] p-2 opacity-0 ring-1 ring-border transition-colors duration-quick [animation-fill-mode:forwards] hover:bg-surface-secondary"
                    style={{ animationDelay: `${120 + index * 80}ms` }}
                  >
                    <span className="h-14 w-20 shrink-0 overflow-hidden rounded-[0.75rem] bg-surface-secondary">
                      <StayThumb image={stay.image} sizes="80px" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <Link
                        href={`/property/${stay.slug}`}
                        className="truncate text-sm font-bold text-foreground after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {stay.nameLead}
                        {stay.nameRest ? ` ${stay.nameRest}` : ""}
                      </Link>
                      <span className="truncate text-xs text-muted-foreground">
                        {stay.location} · {ACCOMMODATION_CLASS_LABEL[stay.kind]}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <b className={cn("text-sm font-bold", rate ? "text-foreground" : "text-accent-text")}>
                        {rate ? `${rate} RWF` : "Price on request"}
                      </b>
                      <span className="rounded-full bg-surface-secondary px-2 py-0.5 text-2xs text-muted-foreground">
                        {shortBasis(stay.priceBasis)}
                      </span>
                    </span>
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground transition-transform duration-quick group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </li>
                );
              })}
            </ul>

            <Link
              href={focused.href}
              className="mt-auto inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-3.5 text-sm font-semibold text-accent-foreground transition-opacity duration-quick hover:opacity-90"
            >
              Explore all {focused.count} {focused.count === 1 ? "stay" : "stays"}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
