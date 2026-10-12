"use client";

import { ArrowRight, Binoculars, Building2, Car, MapPin, Moon, Mountain, Waves, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Fragment, useState } from "react";
import { cn } from "@injishi/utils";
import type { JourneyLeg } from "@/components/home/journey-map";
import { LazyJourneyMap } from "@/components/home/lazy-journey-map";
import { StayThumb } from "@/components/home/stay-thumb";
import { ArtDirectedImage } from "@/components/shared/art-directed-image";
import { SectionHeading } from "@/components/shared/section-heading";
import type { Listing } from "@/data/listings";
import { formatHours, type TripRoute } from "@/data/journeys";
import type { DistrictSlug } from "@/data/search-options";
import { formatRateNumber, NO_RATE, shortBasis } from "@/lib/price";
import { EMPTY_INTENT, exploreHref } from "@/lib/search-params";

/**
 * "Plan by trip": a route, not a list of places.
 *
 * Pick a kind of trip and the band draws it twice: on a small map of Rwanda,
 * where the road traces itself from stop to stop, and as a timeline of stops
 * with the nights at each, the hours between them and bookable stays under
 * every one. Hovering a stop lights its pin. The routes and road times are
 * editorial (`data/journeys.ts`); the stays are the live inventory.
 */
export function TripPlanner({
  routes,
  staysByDistrict,
}: {
  routes: TripRoute[];
  staysByDistrict: Partial<Record<DistrictSlug, Listing[]>>;
}) {
  const [routeId, setRouteId] = useState(routes[0]?.id);
  const [hovered, setHovered] = useState<number | null>(null);
  const route = routes.find((candidate) => candidate.id === routeId) ?? routes[0];
  if (!route) return null;

  const nights = route.stops.reduce((sum, stop) => sum + stop.nights, 0);
  const road = route.stops.reduce((sum, stop) => sum + (stop.driveHours ?? 0), 0);
  const first = route.stops[0];
  // A route that starts away from Kigali still has to get there.
  const approach = first && first.driveHours !== null ? first.driveHours : null;

  return (
    <section className="section-y container flex flex-col gap-8">
      <SectionHeading
        lead="Plan "
        emphasis="by trip"
        lede="Pick the trip. We lay out the stops, the nights and the road between them."
      />

      <div
        role="tablist"
        aria-label="Trip"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {routes.map((candidate) => {
          const selected = candidate.id === route.id;
          return (
            <button
              key={candidate.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => {
                setRouteId(candidate.id);
                setHovered(null);
              }}
              className={cn(
                "h-10 shrink-0 rounded-full px-4 text-sm font-semibold ring-1 transition-colors duration-quick focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "bg-foreground text-background ring-foreground"
                  : "bg-card text-foreground ring-border hover:bg-surface-secondary",
              )}
            >
              <span className="flex items-center gap-2">
                {(() => {
                  const Icon = ROUTE_ICON[candidate.id];
                  return Icon ? <Icon className="size-4" strokeWidth={2} aria-hidden /> : null;
                })()}
                {candidate.label}
              </span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        aria-label={route.label}
        className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10"
      >
        <RouteCard route={route} nights={nights} road={road} hovered={hovered} />

        {/* `key`, so a new route replays the entrance rather than swapping
            text inside cards that are already on screen. */}
        <ol key={route.id} className="flex flex-col">
          {approach !== null ? (
            <DriveLeg hours={approach} label={`from Kigali to ${first?.name}`} />
          ) : null}
          {route.stops.map((stop, index) => (
            <Fragment key={`${route.id}-${index}`}>
              {index > 0 && stop.driveHours !== null ? (
                <DriveLeg hours={stop.driveHours} label="on the road" />
              ) : null}
              <li
                onPointerEnter={() => setHovered(index)}
                onPointerLeave={() => setHovered(null)}
                className={cn(
                  "animate-fade-up flex flex-col gap-4 rounded-card bg-card p-3 opacity-0 ring-1 transition-shadow duration-quick [animation-fill-mode:forwards] sm:flex-row",
                  hovered === index ? "shadow-control ring-foreground/30" : "ring-border",
                )}
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <div className="relative aspect-[16/10] shrink-0 overflow-hidden rounded-[1rem] sm:aspect-auto sm:w-44 lg:w-52">
                  <ArtDirectedImage
                    stem={stop.image.stem}
                    alt={stop.image.alt}
                    sizes="(max-width: 640px) 90vw, 208px"
                    width={416}
                    height={312}
                    pictureClassName="block h-full w-full"
                    className="h-full w-full sm:absolute sm:inset-0"
                  />
                  <span className="absolute left-2 top-2 flex size-7 items-center justify-center rounded-full bg-card text-xs font-bold text-foreground shadow-control">
                    {index + 1}
                  </span>
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-2 py-1 sm:pr-2">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xl font-bold leading-tight text-foreground">{stop.name}</h3>
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-foreground">
                      <Moon className="size-3.5" strokeWidth={2.2} aria-hidden />
                      {stop.nights} {stop.nights === 1 ? "night" : "nights"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{stop.why}</p>
                  <StopStays stays={staysByDistrict[stop.district] ?? []} />
                  <Link
                    href={exploreHref({ ...EMPTY_INTENT, districts: [stop.district] })}
                    className="group/link mt-auto flex w-max items-center gap-1 text-sm font-semibold text-foreground hover:text-accent-text"
                  >
                    All stays near {stop.name}
                    <ArrowRight
                      className="size-3.5 transition-transform duration-quick group-hover/link:translate-x-0.5"
                      aria-hidden
                    />
                  </Link>
                </div>
              </li>
            </Fragment>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** A mark for each trip chip; a route without one shows its label alone. */
const ROUTE_ICON: Readonly<Record<string, LucideIcon>> = {
  gorillas: Mountain,
  lake: Waves,
  city: Building2,
  safari: Binoculars,
};

/** Where every trip lands: [latitude, longitude]. */
const KIGALI_AT = [-1.9536, 30.0605] as const;

/** The segment colours of the night-by-night bar, in stop order. */
const SEGMENT = [
  "bg-accent text-accent-foreground",
  "bg-accent/25 text-foreground",
  "bg-surface-secondary text-foreground ring-1 ring-border",
] as const;

/** The route card: the trip's photograph and name, night by night, then the map. */
function RouteCard({
  route,
  nights,
  road,
  hovered,
}: {
  route: TripRoute;
  nights: number;
  road: number;
  hovered: number | null;
}) {
  // A route that starts elsewhere still begins in Kigali, where guests land.
  const startsAway = route.stops[0]?.driveHours !== null;
  const legs: JourneyLeg[] = route.stops.flatMap((stop, index) => {
    const previous = index === 0 ? (startsAway ? KIGALI_AT : null) : route.stops[index - 1]?.at;
    if (!previous || stop.driveHours === null) return [];
    return [
      {
        from: [previous[1], previous[0]] as [number, number],
        to: [stop.at[1], stop.at[0]] as [number, number],
        hours: stop.driveHours,
      },
    ];
  });

  return (
    <div className="flex flex-col overflow-hidden rounded-card bg-card text-foreground ring-1 ring-border lg:sticky lg:top-28">
      {/* The trip's cover, chosen not to repeat a stop photograph below. */}
      <div className="relative aspect-[16/8] overflow-hidden bg-surface-secondary">
        <ArtDirectedImage
          key={route.id}
          stem={route.image.stem}
          alt={route.image.alt}
          sizes="(max-width: 1024px) 100vw, 40vw"
          width={960}
          height={480}
          pictureClassName="block h-full w-full"
          className="animate-drift h-full w-full"
        />
        <span className="absolute left-4 top-4 rounded-full bg-card px-3 py-1 text-2xs font-bold uppercase tracking-[0.16em] text-accent-text shadow-control">
          Your route
        </span>
      </div>

      {/* The title plate overlaps the photograph rather than sitting on a
          fade over it: the photo stays bright and the type stays legible. */}
      <div
        key={`plate-${route.id}`}
        className="animate-fade-up relative mx-4 -mt-12 flex flex-col gap-2 rounded-[1.25rem] bg-card p-4 opacity-0 shadow-control ring-1 ring-border [animation-fill-mode:forwards]"
      >
        <p className="text-2xl font-bold leading-tight">{route.label}</p>
        <p className="text-sm text-muted-foreground">{route.summary}</p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold">
          <span className="flex items-center gap-1.5">
            <Moon className="size-4 text-accent-text" strokeWidth={2.2} aria-hidden />
            {nights} nights
          </span>
          <span aria-hidden className="size-1 rounded-full bg-border" />
          <span className="flex items-center gap-1.5">
            <MapPin className="size-4 text-accent-text" strokeWidth={2.2} aria-hidden />
            {route.stops.length} {route.stops.length === 1 ? "stop" : "stops"}
          </span>
          <span aria-hidden className="size-1 rounded-full bg-border" />
          <span className="flex items-center gap-1.5">
            <Car className="size-4 text-accent-text" strokeWidth={2.2} aria-hidden />
            {formatHours(road)} typical drive
          </span>
        </p>
      </div>

      {/* Night by night: each stop as wide as the nights spent there, the
          drives between them as chips. */}
      <div className="flex flex-col gap-2 px-4 pb-4 pt-5">
        <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Night by night
        </p>
        <ol key={`bar-${route.id}`} className="flex items-stretch gap-1">
          {route.stops.map((stop, index) => (
            <Fragment key={`${route.id}-bar-${index}`}>
              {index > 0 && stop.driveHours !== null ? (
                <li
                  aria-label={`${formatHours(stop.driveHours)} drive`}
                  className="animate-fade-up flex shrink-0 flex-col items-center justify-center gap-0.5 px-1 text-2xs font-bold text-muted-foreground opacity-0 [animation-fill-mode:forwards]"
                  style={{ animationDelay: `${index * 140 + 60}ms` }}
                >
                  <Car className="size-3.5" strokeWidth={2.4} aria-hidden />
                  {formatHours(stop.driveHours)}
                </li>
              ) : null}
              <li
                style={{ flexGrow: stop.nights, flexBasis: 0, animationDelay: `${index * 140}ms` }}
                className={cn(
                  "animate-fade-up flex min-w-0 flex-col justify-center rounded-[0.875rem] px-3 py-2 opacity-0 transition-shadow duration-quick [animation-fill-mode:forwards]",
                  SEGMENT[index % SEGMENT.length],
                  hovered === index && "ring-2 ring-foreground ring-offset-2 ring-offset-card",
                )}
              >
                <span className="truncate text-sm font-bold">
                  {index + 1}. {stop.name}
                </span>
                <span className="truncate text-2xs font-semibold opacity-80">
                  {stop.nights} {stop.nights === 1 ? "night" : "nights"}
                </span>
              </li>
            </Fragment>
          ))}
        </ol>
      </div>

      <LazyJourneyMap
        className="aspect-[4/3] border-t border-border"
        fit="points"
        points={[
          ...(startsAway
            ? [
                {
                  id: "kigali-start",
                  latitude: KIGALI_AT[0],
                  longitude: KIGALI_AT[1],
                  label: "Kigali",
                  kind: "place" as const,
                  icon: Building2,
                },
              ]
            : []),
          ...route.stops.map((stop, index) => ({
            id: `${route.id}-${index}`,
            latitude: stop.at[0],
            longitude: stop.at[1],
            label: stop.name,
            kind: "stop" as const,
            index: index + 1,
            active: hovered === index,
          })),
        ]}
        legs={legs}
      />
      
    </div>
  );
}

function DriveLeg({ hours, label }: { hours: number; label: string }) {
  return (
    <li aria-label={`${formatHours(hours)} ${label}`} className="flex items-center gap-3 py-1.5 pl-8">
      <span aria-hidden className="h-8 w-0 border-l-2 border-dashed border-border" />
      <span className="flex items-center gap-1.5 rounded-full bg-surface-secondary px-3 py-1 text-xs font-semibold text-foreground">
        <Car className="size-3.5" strokeWidth={2} aria-hidden />
        {formatHours(hours)} {label}
      </span>
    </li>
  );
}

function StopStays({ stays }: { stays: Listing[] }) {
  if (stays.length === 0) {
    return <p className="text-sm text-muted-foreground">No stays listed here yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-1">
      {stays.map((stay) => {
        const rate = formatRateNumber(stay.nightlyRateRwf);
        return (
          <li
            key={stay.slug}
            className="relative -mx-1.5 flex items-center gap-3 rounded-[0.875rem] p-1.5 transition-colors duration-quick hover:bg-surface-secondary"
          >
            <span className="size-10 shrink-0 overflow-hidden rounded-[0.625rem] bg-surface-secondary">
              <StayThumb image={stay.image} sizes="40px" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <Link
                href={`/property/${stay.slug}`}
                className="truncate text-sm font-semibold text-foreground after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {stay.nameLead}
                {stay.nameRest ? ` ${stay.nameRest}` : ""}
              </Link>
              <span className="truncate text-xs text-muted-foreground">
                {rate ? (
                  <>
                    <b className="font-semibold text-foreground">{rate} RWF</b>{" "}
                    {shortBasis(stay.priceBasis)}
                  </>
                ) : (
                  NO_RATE
                )}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
