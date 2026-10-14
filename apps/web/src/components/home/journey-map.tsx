"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { Car, type LucideIcon } from "lucide-react";
import { getVersion, setWorkerUrl, type StyleSpecification } from "maplibre-gl";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";
import { Layer, Map, Marker, NavigationControl, Source, type MapRef } from "react-map-gl/maplibre";
import { cn } from "@injishi/utils";
import { loadMapStyle, type MapTheme } from "@/components/explore/explore-map-style";

// The worker sits in public/ under the installed version; see explore-map.tsx.
setWorkerUrl(`/vendor/maplibre-gl/${getVersion()}/maplibre-gl-worker.mjs`);

/** Rwanda plus a margin: the map can be nudged, never lost. */
const MAX_BOUNDS: [number, number, number, number] = [27.6, -3.7, 32.0, -0.2];
/** The whole country, edge to edge. */
const RWANDA_BOUNDS: [[number, number], [number, number]] = [
  [28.85, -2.85],
  [30.9, -1.05],
];

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

export interface JourneyPoint {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  /** "place": a pill with an icon and a count. "stop": a numbered pin. */
  kind: "place" | "stop";
  icon?: LucideIcon;
  /** Shown after the label on a place pill. */
  count?: number;
  /** The stop number on a stop pin. */
  index?: number;
  active?: boolean;
}

export interface JourneyLeg {
  from: [number, number];
  to: [number, number];
  /** Hours on the road; drawn as a badge at the middle of the leg. */
  hours?: number;
}

/** "2h", "2½h". */
function hoursLabel(hours: number): string {
  const whole = Math.floor(hours);
  return `${whole}${hours - whole >= 0.5 ? "½" : ""}h`;
}

/** A road that bows a little, sampled as a line: [lng, lat] pairs. */
function bow(from: [number, number], to: [number, number], samples = 48): [number, number][] {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const cx = (x1 + x2) / 2 - (y2 - y1) / 5;
  const cy = (y1 + y2) / 2 + (x2 - x1) / 5;
  return Array.from({ length: samples + 1 }, (_, step) => {
    const t = step / samples;
    const u = 1 - t;
    return [u * u * x1 + 2 * u * t * cx + t * t * x2, u * u * y1 + 2 * u * t * cy + t * t * y2];
  });
}

/**
 * A real map of Rwanda for the home page — the Explore basemap in the
 * Injishi palette, with place pills or numbered stops on it and roads that
 * draw themselves from one to the next.
 *
 * It is a picture first: scroll-zoom is off so the page scrolls straight
 * past it, while drag and the zoom buttons work for anyone who wants to look
 * closer. When the points change it glides to frame them (`fit`), then draws
 * the legs; a click on a place hands its id back (`onPick`).
 *
 * Load it through `LazyJourneyMap`, which mounts it only near the viewport:
 * maplibre is ~200 KB gz, and most visitors never scroll this far.
 */
export function JourneyMap({
  points,
  legs = [],
  fit = "country",
  onPick,
  className,
}: {
  points: JourneyPoint[];
  legs?: JourneyLeg[];
  /** Frame the whole country, or just the points. */
  fit?: "country" | "points";
  onPick?: (id: string) => void;
  className?: string;
}) {
  const mapRef = useRef<MapRef | null>(null);
  const [loaded, setLoaded] = useState(false);
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

  // The legs as one line, then drawn on: the source grows from nothing to
  // the whole route over ~1.4s. Reduced motion gets the whole line at once.
  const route = useMemo(() => legs.flatMap((leg) => bow(leg.from, leg.to)), [legs]);
  const [drawn, setDrawn] = useState(0);
  const routeKey = legs.map((leg) => `${leg.from}-${leg.to}`).join("|");
  useEffect(() => {
    if (!loaded || route.length === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDrawn(route.length);
      return;
    }
    setDrawn(0);
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1400);
      const eased = 1 - Math.pow(1 - t, 3);
      setDrawn(Math.max(2, Math.round(eased * route.length)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    // Wait for the camera to settle before the road starts.
    const delay = window.setTimeout(() => (frame = requestAnimationFrame(tick)), 500);
    return () => {
      window.clearTimeout(delay);
      cancelAnimationFrame(frame);
    };
    // `routeKey` stands in for `route`, which is a fresh array each render.
  }, [loaded, routeKey]);

  // Frame whatever is showing: a glide when the points change, a jump when
  // the box itself changes size (the card around it settling, a resize).
  const pointsKey = points.map((point) => point.id).join("|");
  const frame = (duration: number) => {
    const map = mapRef.current;
    if (!map) return;
    if (fit === "country" || points.length < 2) {
      map.fitBounds(RWANDA_BOUNDS, { padding: 28, duration });
      return;
    }
    const lngs = points.map((point) => point.longitude);
    const lats = points.map((point) => point.latitude);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: { top: 60, bottom: 80, left: 60, right: 110 }, duration, maxZoom: 9.5 },
    );
  };
  useEffect(() => {
    if (loaded) frame(900);
  }, [loaded, pointsKey, fit]);

  const line = useMemo(
    () => ({
      type: "Feature" as const,
      properties: {},
      geometry: { type: "LineString" as const, coordinates: route.slice(0, Math.max(drawn, 0)) },
    }),
    [route, drawn],
  );
  const finished = drawn >= route.length;

  return (
    <div className={cn("relative overflow-hidden bg-surface-secondary", className)}>
      {mapStyle ? (
        <Map
          ref={mapRef}
          initialViewState={{ bounds: RWANDA_BOUNDS, fitBoundsOptions: { padding: 32 } }}
          mapStyle={mapStyle}
          minZoom={6.5}
          maxZoom={13}
          maxBounds={MAX_BOUNDS}
          scrollZoom={false}
          dragRotate={false}
          touchPitch={false}
          onLoad={() => setLoaded(true)}
          onResize={() => frame(0)}
          onError={() => {
            if (!styleFailed && !mapRef.current?.getMap().isStyleLoaded()) setStyleFailed(true);
          }}
          attributionControl={{ compact: true }}
        >
          <NavigationControl position="bottom-right" showCompass={false} />

          {route.length > 1 ? (
            <Source id="journey-route" type="geojson" data={line}>
              {/* A white casing under the teal, so the road reads on any tile. */}
              <Layer
                id="journey-route-casing"
                type="line"
                layout={{ "line-cap": "round", "line-join": "round" }}
                paint={{ "line-color": "#ffffff", "line-width": 7, "line-opacity": 0.9 }}
              />
              <Layer
                id="journey-route-line"
                type="line"
                layout={{ "line-cap": "round", "line-join": "round" }}
                paint={{ "line-color": "#0e6f7c", "line-width": 3.5 }}
              />
            </Source>
          ) : null}

          {/* Drive-time badges, once the road has reached them. */}
          {finished
            ? legs.map((leg, index) => {
                if (!leg.hours) return null;
                const curve = bow(leg.from, leg.to, 2);
                const mid = curve[1];
                if (!mid) return null;
                return (
                  <Marker key={`leg-${index}-${routeKey}`} longitude={mid[0]} latitude={mid[1]} anchor="center">
                    <span className="animate-fade-up flex items-center gap-1 rounded-full bg-accent-text px-2.5 py-1 text-xs font-bold text-card opacity-0 shadow-control [animation-fill-mode:forwards]">
                      <Car className="size-3.5" strokeWidth={2.4} aria-hidden />
                      {hoursLabel(leg.hours)}
                    </span>
                  </Marker>
                );
              })
            : null}

          {points.map((point) =>
            point.kind === "stop" ? (
              <Marker key={point.id} longitude={point.longitude} latitude={point.latitude} anchor="center">
                <span className="flex items-center gap-1.5">
                  <span className="relative flex size-8 items-center justify-center">
                    <span className="animate-pin-pulse absolute inset-0 rounded-full bg-accent" aria-hidden />
                    <span className="relative flex size-8 items-center justify-center rounded-full bg-accent-text text-sm font-bold text-card ring-[3px] ring-card shadow-control">
                      {point.index}
                    </span>
                  </span>
                  <span className="rounded-full bg-card px-2.5 py-1 text-xs font-bold text-foreground shadow-control">
                    {point.label}
                  </span>
                </span>
              </Marker>
            ) : (
              <Marker
                key={point.id}
                longitude={point.longitude}
                latitude={point.latitude}
                anchor="center"
                style={{ zIndex: point.active ? 2 : 1 }}
              >
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onPick?.(point.id);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-xs font-bold shadow-control ring-1 transition-all duration-quick ease-settle hover:scale-105",
                    point.active
                      ? "scale-110 bg-accent-text text-card ring-accent-text"
                      : "bg-card text-foreground ring-border",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full",
                      point.active ? "bg-card text-accent-text" : "bg-accent text-accent-foreground",
                    )}
                  >
                    {point.icon ? <point.icon className="size-3.5" strokeWidth={2.4} aria-hidden /> : null}
                  </span>
                  {point.label}
                  {point.count !== undefined ? (
                    <span className={cn("font-medium", point.active ? "opacity-80" : "text-muted-foreground")}>
                      {point.count}
                    </span>
                  ) : null}
                </button>
              </Marker>
            ),
          )}
        </Map>
      ) : null}
      {!loaded ? (
        <div className="absolute inset-0 animate-pulse bg-surface-secondary" aria-hidden />
      ) : null}
    </div>
  );
}
