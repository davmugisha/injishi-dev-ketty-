"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import {
  ChevronRight,
  LocateFixed,
  Map as MapIcon,
  MapPin,
  Minus,
  Plus,
  ShieldCheck,
} from "lucide-react";
import {
  getVersion,
  setWorkerUrl,
  type Map as MaplibreMap,
  type StyleSpecification,
} from "maplibre-gl";
import { useTheme } from "next-themes";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Map, Marker, Popup, type MapRef } from "react-map-gl/maplibre";
import { cn } from "@injishi/utils";
import { loadMapStyle, type MapTheme } from "@/components/explore/explore-map-style";
import { NoPhoto } from "@/components/stays/no-photo";
import { SaveStayButton } from "@/components/stays/save-stay-button";
import type { Listing } from "@/data/listings";
import { partyPrice } from "@/lib/party-price";
import { formatRateNumber, NO_RATE, shortBasis } from "@/lib/price";
import { EMPTY_INTENT, propertyHref, type StayIntent } from "@/lib/search-params";
import { ratingLabel } from "@/lib/rating";

/**
 * The Explore map (split view).
 *
 * - Every result with public coordinates gets a photo pin with its price;
 *   pins that would overlap on screen merge into a count pin that zooms in.
 * - Hovering a card highlights its pin (panning only when the pin is
 *   off-screen); hovering a pin highlights the card.
 * - Clicking a pin swaps it for a location marker and opens a preview card;
 *   clicking the map or pressing Escape closes it.
 * - "Search as I move the map" hands the visible bounds to the shell, which
 *   narrows the list to the stays inside them.
 *
 * Everything is drawn in the marketplace theme: ink pills, accent for the
 * active state, and a basemap recoloured to match (`explore-map-style.ts`).
 * If the basemap style cannot be fetched (firewall, outage), the map falls
 * back to desaturated OSM raster rather than going blank.
 *
 * Bundle: `maplibre-gl` is ~200 KB gz; this component is imported dynamically
 * from `explore-shell.tsx` so a guest who never toggles the map never pays.
 */

// MapLibre resolves its worker next to its own module URL, which webpack has
// moved; without a worker the map never loads. `scripts/copy-maplibre-worker.mjs`
// puts it in public/ under the installed version, before dev and build.
setWorkerUrl(`/vendor/maplibre-gl/${getVersion()}/maplibre-gl-worker.mjs`);

// Kigali city centre; the initial view when there is nothing to fit.
const RWANDA_FALLBACK = { longitude: 30.0605, latitude: -1.9536, zoom: 7.4 } as const;

// Rwanda plus a margin, so a guest can't drag the map off to Kinshasa.
const RWANDA_MAX_BOUNDS: [number, number, number, number] = [27.6, -3.7, 32.0, -0.2];

const RASTER_FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm", paint: { "raster-saturation": -0.6 } }],
};

export type PlottedListing = Listing & { latitude: number; longitude: number };

/**
 * West, south, east, north — the visible map, for "search as I move". The
 * shell imports this as a type only; a value import would pull maplibre-gl
 * into the main bundle and undo the dynamic import.
 */
export type MapBounds = [number, number, number, number];

type PinGroup =
  | { kind: "single"; listing: PlottedListing }
  | {
      kind: "cluster";
      key: string;
      members: PlottedListing[];
      longitude: number;
      latitude: number;
    };

// A pin is a 48 px photo with a tail, anchored at the tail's tip, and a price
// pill to its right: about 110 × 58 px, starting 24 px left of the tip.
const PIN_PHOTO_PX = 48;
const OVERLAP_X_PX = 96;
const OVERLAP_Y_PX = 54;

/**
 * Greedy screen-space grouping. Fine for the size of an Explore result set
 * (tens to low hundreds); recomputed on move-end only, never per frame.
 */
function groupPins(map: MaplibreMap, pins: PlottedListing[]): PinGroup[] {
  const projected = pins.map((listing) => ({
    listing,
    point: map.project([listing.longitude, listing.latitude]),
  }));
  const taken = new Array<boolean>(projected.length).fill(false);
  const groups: PinGroup[] = [];

  for (let i = 0; i < projected.length; i++) {
    if (taken[i]) continue;
    taken[i] = true;
    const anchor = projected[i]!;
    const members = [anchor.listing];
    for (let j = i + 1; j < projected.length; j++) {
      if (taken[j]) continue;
      const other = projected[j]!;
      if (
        Math.abs(other.point.x - anchor.point.x) < OVERLAP_X_PX &&
        Math.abs(other.point.y - anchor.point.y) < OVERLAP_Y_PX
      ) {
        taken[j] = true;
        members.push(other.listing);
      }
    }
    if (members.length === 1) {
      groups.push({ kind: "single", listing: anchor.listing });
    } else {
      groups.push({
        kind: "cluster",
        key: `cluster:${members.map((m) => m.slug).sort().join("|")}`,
        members,
        longitude: members.reduce((sum, m) => sum + m.longitude, 0) / members.length,
        latitude: members.reduce((sum, m) => sum + m.latitude, 0) / members.length,
      });
    }
  }
  return groups;
}

function boundsOf(pins: PlottedListing[]): [[number, number], [number, number]] {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const p of pins) {
    if (p.longitude < minLng) minLng = p.longitude;
    if (p.longitude > maxLng) maxLng = p.longitude;
    if (p.latitude < minLat) minLat = p.latitude;
    if (p.latitude > maxLat) maxLat = p.latitude;
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

// Room for the header and switch above, the fold below, and pins growing up-right.
const FIT_PADDING = { top: 170, bottom: 72, left: 56, right: 120 };

const photoOf = (listing: Listing): string | null =>
  listing.image ? (listing.image.src ?? `/assets/${listing.image.stem}.jpg`) : null;

export function ExploreMap({
  listings,
  hoveredSlug,
  selectedSlug,
  onHover,
  onSelect,
  searchArea,
  onSearchAreaChange,
  onBoundsChange,
  areaCount,
  intent,
  className,
}: {
  listings: Listing[];
  hoveredSlug: string | null;
  selectedSlug: string | null;
  onHover: (slug: string | null) => void;
  onSelect: (slug: string | null) => void;
  /** Whether the list is narrowed to the visible map area. */
  searchArea: boolean;
  onSearchAreaChange: (on: boolean) => void;
  /** Called after every camera move with the visible bounds. */
  onBoundsChange: (bounds: MapBounds) => void;
  /** Stays inside the visible area, when `searchArea` is on. */
  areaCount: number;
  intent?: StayIntent;
  className?: string;
}) {
  const padding = FIT_PADDING;
  const mapRef = useRef<MapRef | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [groups, setGroups] = useState<PinGroup[]>([]);
  // Pins whose preview the guest has already opened read as "seen".
  const [viewed, setViewed] = useState<ReadonlySet<string>>(() => new Set());

  const { resolvedTheme } = useTheme();
  const theme: MapTheme = resolvedTheme === "dark" ? "dark" : "light";
  const [styles, setStyles] = useState<Partial<Record<MapTheme, StyleSpecification>>>({});
  const [styleFailed, setStyleFailed] = useState(false);
  useEffect(() => {
    if (styles[theme]) return;
    let cancelled = false;
    loadMapStyle(theme).then(
      (style) => !cancelled && setStyles((prev) => ({ ...prev, [theme]: style })),
      () => !cancelled && setStyleFailed(true),
    );
    return () => {
      cancelled = true;
    };
  }, [theme, styles]);
  const mapStyle = styleFailed ? RASTER_FALLBACK_STYLE : (styles[theme] ?? null);

  const plotted = useMemo(
    () =>
      listings.filter(
        (l): l is PlottedListing => l.latitude !== null && l.longitude !== null,
      ),
    [listings],
  );

  const reportView = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    setGroups(groupPins(map, plotted));
    const b = map.getBounds();
    onBoundsChange([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
  }, [plotted, onBoundsChange]);

  const fitAll = useCallback(
    (duration = 500) => {
      const map = mapRef.current;
      if (!map || plotted.length === 0) return;
      if (plotted.length === 1) {
        const only = plotted[0]!;
        map.easeTo({ center: [only.longitude, only.latitude], zoom: 13, duration });
        return;
      }
      map.fitBounds(boundsOf(plotted), { padding, duration, maxZoom: 13 });
    },
    [plotted, padding],
  );

  // A new result set: fit to it, and regroup straight away in case the
  // camera does not move (fitBounds to the same box fires no move-end).
  // While "search as I move" is on, the guest owns the camera: refitting
  // would move the very area they asked to search.
  const searchAreaRef = useRef(searchArea);
  searchAreaRef.current = searchArea;
  useEffect(() => {
    if (!loaded) return;
    if (!searchAreaRef.current) fitAll();
    reportView();
  }, [loaded, fitAll, reportView]);

  // Card hover: highlight in place, and pan only when the pin is off-screen.
  // Re-centring on every hover made the whole map lurch as the cursor moved
  // down the list.
  useEffect(() => {
    if (!hoveredSlug || !loaded) return;
    const match = plotted.find((p) => p.slug === hoveredSlug);
    const map = mapRef.current;
    if (!match || !map) return;
    if (!map.getBounds().contains([match.longitude, match.latitude])) {
      map.easeTo({ center: [match.longitude, match.latitude], duration: 350 });
    }
  }, [hoveredSlug, loaded, plotted]);

  // Escape closes the preview.
  useEffect(() => {
    if (!selectedSlug) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onSelect(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedSlug, onSelect]);

  // MapLibre only requests tiles for the currently sized viewport. When the
  // map mounts inside a container that was 0-sized moments earlier (dynamic
  // import + toggle-on), no request ever fires and only the background paint
  // remains visible. Force a resize once loaded, and again if the window
  // resizes below us.
  //
  // It runs on the first style event as well as on `load`: `load` waits for
  // every initial tile, which on a slow link is tens of seconds, and the pins
  // only need the camera. They show at once; the basemap fills in under them.
  const handleLoad = useCallback(() => {
    mapRef.current?.resize();
    setLoaded(true);
  }, []);
  useEffect(() => {
    const onWindowResize = () => mapRef.current?.resize();
    window.addEventListener("resize", onWindowResize);
    return () => window.removeEventListener("resize", onWindowResize);
  }, []);

  const select = useCallback(
    (listing: PlottedListing) => {
      onSelect(listing.slug);
      setViewed((prev) => (prev.has(listing.slug) ? prev : new Set(prev).add(listing.slug)));
      // The preview opens ~400 px above the pin. If that would run off the
      // top or a side, ease the pin down into the lower middle of the map.
      const map = mapRef.current;
      if (!map) return;
      const point = map.project([listing.longitude, listing.latitude]);
      const { clientWidth, clientHeight } = map.getContainer();
      if (point.y < 440 || point.x < 170 || point.x > clientWidth - 170) {
        map.easeTo({
          center: [listing.longitude, listing.latitude],
          offset: [0, Math.min(210, clientHeight / 2 - 60)],
          duration: 400,
        });
      }
    },
    [onSelect],
  );

  const zoomIntoCluster = useCallback(
    (members: PlottedListing[]) => {
      mapRef.current?.fitBounds(boundsOf(members), { padding, duration: 500, maxZoom: 15 });
    },
    [padding],
  );

  const popupListing = useMemo(
    () =>
      selectedSlug ? (plotted.find((p) => p.slug === selectedSlug) ?? null) : null,
    [selectedSlug, plotted],
  );

  return (
    <div
      className={cn(
        "explore-map relative isolate h-full w-full overflow-hidden rounded-card bg-surface-secondary shadow-control ring-1 ring-border",
        className,
      )}
    >
      {mapStyle ? (
        <Map
          ref={mapRef}
          initialViewState={RWANDA_FALLBACK}
          mapStyle={mapStyle}
          minZoom={6.5}
          maxZoom={17}
          maxBounds={RWANDA_MAX_BOUNDS}
          dragRotate={false}
          touchPitch={false}
          onLoad={handleLoad}
          onStyleData={loaded ? undefined : handleLoad}
          onError={() => {
            // Only a style that never loaded falls back; a stray tile error on
            // a working map is MapLibre's to retry.
            if (!styleFailed && !mapRef.current?.getMap().isStyleLoaded()) setStyleFailed(true);
          }}
          onMoveEnd={reportView}
          onClick={() => onSelect(null)}
          onMouseLeave={() => onHover(null)}
          attributionControl={{ compact: true }}
        >
          {groups.map((group) => {
            if (group.kind === "cluster") {
              return (
                <Marker
                  key={group.key}
                  longitude={group.longitude}
                  latitude={group.latitude}
                  anchor="bottom-left"
                  offset={[-PIN_PHOTO_PX / 2, 0]}
                  style={{ zIndex: 1 }}
                  onClick={(event) => {
                    // Stops MapLibre's own click, which would close the preview.
                    event.originalEvent.stopPropagation();
                    zoomIntoCluster(group.members);
                  }}
                >
                  <ClusterPin
                    members={group.members}
                    highlighted={group.members.some(
                      (m) => m.slug === hoveredSlug || m.slug === selectedSlug,
                    )}
                  />
                </Marker>
              );
            }
            const { listing } = group;
            if (listing.slug === selectedSlug) {
              return (
                <Marker
                  key={listing.slug}
                  longitude={listing.longitude}
                  latitude={listing.latitude}
                  anchor="bottom"
                  style={{ zIndex: 3 }}
                  onClick={(event) => event.originalEvent.stopPropagation()}
                >
                  <SelectedPin />
                </Marker>
              );
            }
            return (
              <Marker
                key={listing.slug}
                longitude={listing.longitude}
                latitude={listing.latitude}
                anchor="bottom-left"
                offset={[-PIN_PHOTO_PX / 2, 0]}
                style={{ zIndex: hoveredSlug === listing.slug ? 2 : 1 }}
                onClick={(event) => {
                  event.originalEvent.stopPropagation();
                  select(listing);
                }}
              >
                <PhotoPin
                  listing={listing}
                  hovered={hoveredSlug === listing.slug}
                  viewed={viewed.has(listing.slug)}
                  onHover={onHover}
                />
              </Marker>
            );
          })}
          {popupListing ? (
            <Popup
              longitude={popupListing.longitude}
              latitude={popupListing.latitude}
              anchor="bottom"
              offset={58}
              closeButton={false}
              closeOnClick={false}
              className="explore-map-popup"
              maxWidth="none"
              // Markers carry z-index 1–3 for hover order; the preview sits
              // above all of them or neighbouring pins paint across the card.
              style={{ zIndex: 10 }}
            >
              <PinPreview listing={popupListing} intent={intent} />
            </Popup>
          ) : null}
        </Map>
      ) : (
        <MapLoading />
      )}

      {/* A soft wash under the header and the switch so they read on any
          basemap colour without a hard box across the top of the map. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-background/80 via-background/30 to-transparent",
          "h-36",
        )}
      />

      {plotted.length > 0 ? (
        // The header and the area switch stack top-left: the map's bottom
        // edge sits below the fold until the page scrolls, so anything
        // pinned to the bottom would start out of sight.
        <div className="pointer-events-none absolute left-3 right-16 top-3 z-20 flex flex-col items-start gap-2">
          {/* The switch alone, as the busy-page review asked: the count and
              the approximate-pin note it sat under repeated the list's own
              title and each preview's "Approximate area" chip. Under the
              switch it still says how many stays are in view. */}
          {searchArea ? (
            <span className="pointer-events-auto rounded-full bg-card/95 px-3 py-1 text-xs font-bold text-foreground shadow-control ring-1 ring-border backdrop-blur-md">
              {areaCount} {areaCount === 1 ? "stay" : "stays"} in this area
            </span>
          ) : null}
          <SearchAreaSwitch checked={searchArea} onChange={onSearchAreaChange} />
        </div>
      ) : null}

      <MapControls
        onZoomIn={() => mapRef.current?.zoomIn({ duration: 250 })}
        onZoomOut={() => mapRef.current?.zoomOut({ duration: 250 })}
        onFitAll={plotted.length > 0 ? () => fitAll() : undefined}
      />

      {plotted.length === 0 && mapStyle ? <EmptyMapOverlay listingCount={listings.length} /> : null}

      {/* MapLibre's vendor CSS styles the popup and attribution tightly; bring
          both in line with the design system without touching it globally.
          The keyframes give pins and the preview a short settle-in. */}
      <style jsx global>{`
        .explore-map-popup .maplibregl-popup-content {
          padding: 0;
          border-radius: 20px;
          overflow: hidden;
          box-shadow:
            0 1px 2px rgba(4, 35, 48, 0.08),
            0 18px 44px rgba(4, 35, 48, 0.22);
          background: var(--card);
          animation: explore-map-rise 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
          transform-origin: bottom center;
        }
        .explore-map-popup.maplibregl-popup-anchor-bottom .maplibregl-popup-tip {
          border-top-color: var(--card);
          border-width: 9px;
        }
        .explore-map .maplibregl-ctrl-attrib {
          font-size: 10px;
          background: color-mix(in srgb, var(--card) 85%, transparent);
          color: var(--muted-foreground);
          border-radius: 999px;
        }
        .explore-map .maplibregl-ctrl-attrib a {
          color: inherit;
        }
        .explore-map .maplibregl-ctrl-bottom-right {
          z-index: 20;
        }
        .explore-map-pin-in {
          animation: explore-map-pop 260ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }
        @keyframes explore-map-pop {
          from {
            opacity: 0;
            transform: translateY(6px) scale(0.7);
          }
        }
        @keyframes explore-map-rise {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.97);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .explore-map-pin-in,
          .explore-map-popup .maplibregl-popup-content {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

/** "Search as I move the map": a switch under the map header. */
function SearchAreaSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "pointer-events-auto flex h-9 items-center gap-2 rounded-full py-1 pl-1 pr-3.5 text-xs font-bold shadow-control ring-1 backdrop-blur-md transition-colors duration-quick",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        checked
          ? "bg-foreground text-background ring-foreground"
          : "bg-card/90 text-foreground ring-border hover:bg-card",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "relative flex h-7 w-11 items-center rounded-full p-0.5 transition-colors duration-quick",
          checked ? "bg-accent" : "bg-surface-secondary ring-1 ring-inset ring-border",
        )}
      >
        <span
          className={cn(
            "size-6 rounded-full bg-card shadow-control transition-transform duration-quick ease-settle",
            checked ? "translate-x-4" : "translate-x-0",
          )}
        />
      </span>
      Search as I move the map
    </button>
  );
}

function MapLoading() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-surface-secondary">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <span className="flex size-12 animate-pulse items-center justify-center rounded-full bg-card shadow-control">
          <MapIcon className="size-5" strokeWidth={2} aria-hidden />
        </span>
        <span className="text-xs font-medium">Loading the map…</span>
      </div>
    </div>
  );
}

/** 486,000 → "486K"; 1,250,000 → "1.25M". */
function shortenRate(rwf: number): string {
  if (rwf >= 1_000_000) {
    const m = rwf / 1_000_000;
    return `${(Math.round(m * 100) / 100).toString().replace(/\.?0+$/, "")}M`;
  }
  if (rwf >= 1000) return `${Math.round(rwf / 1000)}K`;
  return String(rwf);
}

/**
 * The shared pin shape: a round badge on a card-coloured teardrop whose tip is
 * the coordinate (with a small accent dot just above it), and, for a single
 * stay, a price pill tucked behind its right edge. Ink at rest, accent when
 * active — the same pair the marketplace's buttons use.
 */
function PinShape({
  badge,
  label,
  active,
  muted,
}: {
  badge: ReactNode;
  label?: ReactNode;
  active: boolean;
  muted?: boolean;
}) {
  return (
    <span className="explore-map-pin-in block">
      <span
        className={cn(
          "flex origin-bottom-left items-start transition-transform duration-quick ease-settle",
          active ? "scale-110" : "group-hover/pin:scale-105",
        )}
      >
        <span className="relative z-10 flex w-12 flex-col items-center drop-shadow-[0_3px_6px_rgba(4,35,48,0.3)]">
          <span
            className={cn(
              "relative size-12 overflow-hidden rounded-full border-[3px] bg-surface-secondary transition-colors duration-quick",
              active ? "border-accent" : "border-card",
            )}
          >
            {badge}
          </span>
          <span
            aria-hidden
            className={cn(
              "-mt-1 h-0 w-0 border-x-[9px] border-t-[12px] border-x-transparent transition-colors duration-quick",
              active ? "border-t-accent" : "border-t-card",
            )}
          />
          <span
            aria-hidden
            className={cn(
              "absolute bottom-1.5 size-1.5 rounded-full",
              active ? "bg-card" : "bg-accent",
            )}
          />
        </span>
        {label != null ? (
          <span
            className={cn(
              "-ml-3 mt-2.5 flex h-7 items-center whitespace-nowrap rounded-full pl-4 pr-3 text-sm font-bold tabular-nums tracking-tight shadow-control transition-colors duration-quick",
              active ? "bg-accent text-accent-foreground" : "bg-foreground text-background",
              muted && !active && "opacity-70",
            )}
          >
            {label}
          </span>
        ) : null}
      </span>
    </span>
  );
}

function PhotoPin({
  listing,
  hovered,
  viewed,
  onHover,
}: {
  listing: PlottedListing;
  hovered: boolean;
  viewed: boolean;
  onHover: (slug: string | null) => void;
}) {
  const rate = listing.nightlyRateRwf;
  const fullLabel =
    rate == null ? NO_RATE : `RWF ${formatRateNumber(rate)} ${shortBasis(listing.priceBasis)}`;

  // Selection is the Marker's onClick (it has to stop MapLibre's own click);
  // the button is here for focus, Enter/Space and the accessible name.
  return (
    <button
      type="button"
      onMouseEnter={() => onHover(listing.slug)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(listing.slug)}
      onBlur={() => onHover(null)}
      aria-label={`${listing.nameLead} ${listing.nameRest} · ${fullLabel}`}
      className="group/pin block cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <PinShape
        active={hovered}
        muted={viewed}
        badge={<PinPhoto listing={listing} />}
        label={rate == null ? "Enquire" : shortenRate(rate)}
      />
    </button>
  );
}

/**
 * Stays too close together to show apart: the count alone, on the same
 * teardrop. No price — a single figure for a group could only be a "from"
 * price, and that needed a word to explain itself. Click zooms in.
 */
function ClusterPin({
  members,
  highlighted,
}: {
  members: PlottedListing[];
  highlighted: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={`${members.length} stays here. Zoom in`}
      className="group/pin block cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <PinShape
        active={highlighted}
        badge={
          <span
            className={cn(
              "flex size-full items-center justify-center text-base font-bold transition-colors duration-quick",
              highlighted ? "bg-accent text-accent-foreground" : "bg-foreground text-background",
            )}
          >
            {members.length}
          </span>
        }
      />
    </button>
  );
}

/** The selected stay's marker: a solid accent location pin over a soft glow. */
function SelectedPin() {
  return (
    <span className="relative flex w-10 flex-col items-center" aria-hidden>
      <span className="absolute -bottom-5 size-16 animate-pulse rounded-full bg-accent/35 blur-md" />
      <span className="absolute -bottom-1.5 size-5 rounded-full bg-accent/50 blur-[2px]" />
      <svg
        viewBox="0 0 40 48"
        className="relative size-12 text-accent drop-shadow-[0_4px_8px_rgba(4,35,48,0.35)]"
      >
        <path
          fill="currentColor"
          stroke="var(--card)"
          strokeWidth="2.5"
          d="M20 46s-15-13.6-15-26a15 15 0 0 1 30 0c0 12.4-15 26-15 26Z"
        />
        <circle cx="20" cy="20" r="5.5" fill="var(--card)" />
      </svg>
    </span>
  );
}

function MapControls({
  onZoomIn,
  onZoomOut,
  onFitAll,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitAll?: () => void;
}) {
  const button =
    "flex size-10 items-center justify-center text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";
  const surface = "overflow-hidden rounded-card bg-card/90 shadow-control ring-1 ring-border backdrop-blur-md";
  return (
    <div className="absolute right-3 top-3 z-20 flex flex-col gap-2">
      <div className={cn("flex flex-col", surface)}>
        <button type="button" onClick={onZoomIn} aria-label="Zoom in" title="Zoom in" className={button}>
          <Plus className="size-4" strokeWidth={2.4} aria-hidden />
        </button>
        <span aria-hidden className="mx-2.5 h-px bg-border" />
        <button type="button" onClick={onZoomOut} aria-label="Zoom out" title="Zoom out" className={button}>
          <Minus className="size-4" strokeWidth={2.4} aria-hidden />
        </button>
      </div>
      {onFitAll ? (
        <div className={surface}>
          <button
            type="button"
            onClick={onFitAll}
            aria-label="Show all stays"
            title="Show all stays"
            className={button}
          >
            <LocateFixed className="size-4" strokeWidth={2.2} aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * `unoptimized` on every stay photo: an uploaded one is the API's photo route,
 * on a host `next.config` does not list, and the optimiser would also keep
 * serving it after the property stops being public.
 */
function PinPhoto({ listing }: { listing: Listing }) {
  const src = photoOf(listing);
  return src ? (
    <Image src={src} alt="" fill sizes="48px" unoptimized className="object-cover" />
  ) : (
    <NoPhoto compact />
  );
}

function PinPreview({ listing, intent }: { listing: PlottedListing; intent?: StayIntent }) {
  const href = intent ? propertyHref(listing.slug, intent) : `/property/${listing.slug}`;
  const party = partyPrice(listing.nightlyRateRwf, listing.priceBasis, intent ?? EMPTY_INTENT);

  return (
    <div className="group/card relative w-[300px] bg-card p-2 text-foreground">
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-card bg-surface-secondary">
        {listing.image ? (
          <Image
            src={photoOf(listing)!}
            // The API's photo route: see `PinPhoto`.
            unoptimized
            alt={listing.image.alt}
            fill
            sizes="300px"
            className="object-cover transition-transform duration-travel ease-settle group-hover/card:scale-105"
          />
        ) : (
          <NoPhoto />
        )}
        {/* Lifted above the stretched link so a save never navigates. */}
        <div className="absolute right-2.5 top-2.5 z-10">
          <SaveStayButton slug={listing.slug} size="sm" />
        </div>
        <span className="absolute bottom-2.5 left-2.5 flex items-center gap-1 rounded-full bg-card/95 px-2.5 py-1 text-xs font-bold text-foreground shadow-control backdrop-blur">
          <ShieldCheck className="size-3.5 text-accent-text" strokeWidth={2.5} aria-hidden />
          Verified
        </span>
      </div>

      <div className="flex flex-col gap-2 px-2 pb-1 pt-3">
        <h3 className="text-base font-bold leading-tight text-foreground">
          <Link
            href={href}
            // Stretched link: a click anywhere on the card opens the stay.
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {listing.nameLead}
            {listing.nameRest ? ` ${listing.nameRest}` : ""}
          </Link>
        </h3>

        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
          <span className="truncate">{listing.location}</span>
          {listing.locationApproximate ? (
            <span className="shrink-0 rounded-full bg-surface-secondary px-2 py-0.5 text-2xs font-semibold">
              Approximate area
            </span>
          ) : null}
        </p>

        {listing.rating ? (
          <div className="flex items-center gap-2">
            <span className="flex h-7 shrink-0 items-center rounded-full bg-accent px-2.5 text-xs font-bold text-accent-foreground">
              {listing.rating.score.toFixed(1)}
            </span>
            <span className="truncate text-xs">
              <b className="font-bold text-accent-text">{ratingLabel(listing.rating)}</b>
            </span>
          </div>
        ) : null}

        <div className="mt-1 flex items-center justify-between border-t border-separator pt-3">
          <p className="text-base font-bold text-foreground">
            {listing.nightlyRateRwf != null ? (
              <>
                {formatRateNumber(listing.nightlyRateRwf)} RWF{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  {shortBasis(listing.priceBasis)}
                </span>
                {party ? (
                  <span className="block text-xs font-normal text-muted-foreground">
                    {party.label}: <b className="font-bold text-foreground">{party.amount}</b>
                  </span>
                ) : null}
              </>
            ) : (
              NO_RATE
            )}
          </p>
          <span
            aria-hidden
            className="flex size-9 items-center justify-center rounded-full bg-foreground text-background transition-colors duration-quick group-hover/card:bg-accent group-hover/card:text-accent-foreground"
          >
            <ChevronRight className="size-4" strokeWidth={2.6} />
          </span>
        </div>
      </div>
    </div>
  );
}

/** Overlay for the "nothing to plot" case: a visible message beats a blank. */
function EmptyMapOverlay({ listingCount }: { listingCount: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-6">
      <div className="pointer-events-auto flex max-w-tile flex-col items-center gap-2 rounded-card bg-card/95 p-5 text-center shadow-control ring-1 ring-border backdrop-blur-md">
        <span className="flex size-10 items-center justify-center rounded-full bg-surface-secondary">
          <MapPin className="size-5 text-muted-foreground" strokeWidth={1.8} aria-hidden />
        </span>
        <p className="text-sm font-bold text-foreground">
          {listingCount === 0 ? "No results to map" : "No locations yet"}
        </p>
        <p className="text-xs text-muted-foreground">
          {listingCount === 0
            ? "Widen the filters to see stays on the map."
            : "These stays have not published a map location yet."}
        </p>
      </div>
    </div>
  );
}
