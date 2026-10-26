"use client";

/**
 * The homes on a map, drawn the way the booking Explore map is: the same branded
 * OpenFreeMap style (`map-style.ts`), Rwanda's bounds, and pins that group as
 * you zoom out. A group is a dark bubble with how many homes it holds and zooms
 * in on click; a single building is a white pill with its lowest rent, and
 * clicking it opens that home.
 */

import "maplibre-gl/dist/maplibre-gl.css";

import type { BrokerHome } from "@injishi/contracts";
import { getVersion, setWorkerUrl, type StyleSpecification } from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Map, Marker, type MapRef } from "react-map-gl/maplibre";
import { twMerge } from "tailwind-merge";

import { loadMapStyle } from "./map-style";

const cn = (...parts: Array<string | false | null | undefined>) => twMerge(...parts.filter(Boolean));

// MapLibre looks for its worker beside its own bundle; Next packs that into
// `/_next/static/chunks/` where no worker exists. `scripts/copy-maplibre-worker.mjs`
// publishes it under public/vendor before dev and build.
setWorkerUrl(`/vendor/maplibre-gl/${getVersion()}/maplibre-gl-worker.mjs`);

const RWANDA = { longitude: 30.0605, latitude: -1.9536, zoom: 7.4 } as const;
const RWANDA_BOUNDS: [number, number, number, number] = [27.6, -3.7, 32.0, -0.2];

const short = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M` : `${Math.round(n / 1000)}K`;

interface Building {
  key: string;
  latitude: number;
  longitude: number;
  homes: BrokerHome[];
}

function buildingKey(h: BrokerHome): string {
  return `${h.propertyName}:${h.latitude}:${h.longitude}`;
}

export function HomesMap({
  homes,
  hovered,
  onPick,
}: {
  homes: BrokerHome[];
  /** The unit a card under the pointer belongs to, raised on the map. */
  hovered: string | null;
  onPick: (unitId: string) => void;
}) {
  const ref = useRef<MapRef>(null);
  const [style, setStyle] = useState<StyleSpecification | string | null>(null);
  const [zoom, setZoom] = useState<number>(RWANDA.zoom);

  useEffect(() => {
    let live = true;
    loadMapStyle("light")
      .then((s) => live && setStyle(s))
      .catch(() => live && setStyle("https://tiles.openfreemap.org/styles/liberty"));
    return () => {
      live = false;
    };
  }, []);

  const buildings = useMemo(() => {
    const by = new globalThis.Map<string, Building>();
    for (const h of homes) {
      if (h.latitude === null || h.longitude === null) continue;
      const key = buildingKey(h);
      const b = by.get(key) ?? {
        key,
        latitude: h.latitude,
        longitude: h.longitude,
        homes: [],
      };
      b.homes.push(h);
      by.set(key, b);
    }
    return [...by.values()];
  }, [homes]);

  // Buildings close together at this zoom share one bubble, as on Explore.
  const groups = useMemo(() => {
    const cell = 0.9 / 2 ** Math.max(0, zoom - 7);
    const by = new globalThis.Map<string, Building[]>();
    for (const b of buildings) {
      const k = `${Math.round(b.latitude / cell)}:${Math.round(b.longitude / cell)}`;
      by.set(k, [...(by.get(k) ?? []), b]);
    }
    return [...by.entries()].map(([key, members]) => ({
      key,
      members,
      latitude: members.reduce((a, m) => a + m.latitude, 0) / members.length,
      longitude: members.reduce((a, m) => a + m.longitude, 0) / members.length,
      count: members.reduce((a, m) => a + m.homes.length, 0),
    }));
  }, [buildings, zoom]);

  const isHovered = (b: Building) => b.homes.some((h) => h.unitId === hovered);

  // A new result set, or the map just loaded: fit the camera to it.
  const fit = useCallback(() => {
    const map = ref.current;
    if (!map || buildings.length === 0) return;
    const lats = buildings.map((b) => b.latitude);
    const lngs = buildings.map((b) => b.longitude);
    map.fitBounds(
      [
        [Math.min(...lngs) - 0.01, Math.min(...lats) - 0.01],
        [Math.max(...lngs) + 0.01, Math.max(...lats) + 0.01],
      ],
      { padding: 60, duration: 500, maxZoom: 14 },
    );
  }, [buildings]);
  useEffect(fit, [fit]);

  if (!style) return <div className="size-full animate-pulse bg-foreground/5" />;

  return (
    <Map
      ref={ref}
      initialViewState={RWANDA}
      mapStyle={style}
      minZoom={6.5}
      maxZoom={17}
      maxBounds={RWANDA_BOUNDS}
      dragRotate={false}
      touchPitch={false}
      onLoad={fit}
      onMoveEnd={(e) => setZoom(e.viewState.zoom)}
      style={{ width: "100%", height: "100%" }}
    >
      {groups.map((g) =>
        g.members.length > 1 ? (
          <Marker
            key={g.key}
            longitude={g.longitude}
            latitude={g.latitude}
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              const lats = g.members.map((m) => m.latitude);
              const lngs = g.members.map((m) => m.longitude);
              ref.current?.fitBounds(
                [
                  [Math.min(...lngs), Math.min(...lats)],
                  [Math.max(...lngs), Math.max(...lats)],
                ],
                { padding: 80, duration: 500, maxZoom: 15 },
              );
            }}
          >
            <button
              type="button"
              aria-label={`${g.count} homes here. Zoom in`}
              className={cn(
                "flex size-10 items-center justify-center rounded-full border-2 border-background bg-foreground text-sm font-bold text-background shadow-lg",
                g.members.some(isHovered) && "scale-110",
              )}
            >
              {g.count}
            </button>
          </Marker>
        ) : (
          <Marker
            key={g.key}
            longitude={g.longitude}
            latitude={g.latitude}
            anchor="bottom"
            style={{ zIndex: isHovered(g.members[0]) ? 3 : 1 }}
          >
            {(() => {
              const b = g.members[0];
              const rents = b.homes.map((h) => h.rentRwf);
              const on = isHovered(b);
              return (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPick(b.homes[0].unitId);
                  }}
                  aria-label={`${b.homes[0].propertyName}, ${b.homes.length} homes`}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-bold shadow-md transition-transform",
                    on
                      ? "scale-110 border-foreground bg-foreground text-background"
                      : "border-black/10 bg-white text-black hover:scale-105",
                  )}
                >
                  {rents.length ? `RWF ${short(Math.min(...rents))}` : b.homes[0].propertyName}
                  {b.homes.length > 1 ? (
                    <span className={on ? "text-white/70" : "text-black/50"}> · {b.homes.length}</span>
                  ) : null}
                </button>
              );
            })()}
          </Marker>
        ),
      )}
    </Map>
  );
}
