"use client";

/**
 * Where the property is, dropped on a map (0118) instead of copied out of Google Maps as two numbers. A tap
 * or click puts the pin there and it can be dragged to the gate; the point is kept as "latitude, longitude",
 * the same text the setup form always sent, so the paste still works for anyone who has the numbers.
 *
 * The broker's map style (OpenFreeMap, keyless) and the worker it is served from, held to Rwanda's bounds:
 * the API refuses a point outside the country anyway.
 */
import "maplibre-gl/dist/maplibre-gl.css";

import { getVersion, type StyleSpecification, setWorkerUrl } from "maplibre-gl";
import { useEffect, useState } from "react";
import { Map as MapView, Marker } from "react-map-gl/maplibre";
import { loadMapStyle } from "@/features/broker/map-style";

setWorkerUrl(`/vendor/maplibre-gl/${getVersion()}/maplibre-gl-worker.mjs`);

const RWANDA = { longitude: 30.0605, latitude: -1.9536, zoom: 7.4 } as const;
const RWANDA_BOUNDS: [number, number, number, number] = [27.6, -3.7, 32.0, -0.2];

/** "-1.9441, 30.0880" → the pin; anything else is no pin yet. */
export function parsePoint(text: string): { latitude: number; longitude: number } | null {
  const m = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(text);
  return m ? { latitude: Number(m[1]), longitude: Number(m[2]) } : null;
}

const pointText = (latitude: number, longitude: number) => `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

export function MapPinPicker({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const [style, setStyle] = useState<StyleSpecification | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    loadMapStyle("light")
      .then((s) => live && setStyle(s))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);
  const pin = parsePoint(value);
  if (failed) {
    return <p className="m-0 text-[13px] text-muted">The map did not load. Paste the point below instead.</p>;
  }
  if (!style) {
    return <div className="h-[280px] w-full animate-pulse rounded-xl bg-default" aria-hidden="true" />;
  }
  return (
    <div className="h-[280px] w-full overflow-hidden rounded-xl border border-separator">
      <MapView
        initialViewState={pin ? { ...pin, zoom: 15 } : RWANDA}
        mapStyle={style}
        maxBounds={RWANDA_BOUNDS}
        cursor="crosshair"
        onClick={(e) => onChange(pointText(e.lngLat.lat, e.lngLat.lng))}
        attributionControl={{ compact: true }}
      >
        {pin ? (
          <Marker
            latitude={pin.latitude}
            longitude={pin.longitude}
            draggable
            onDragEnd={(e) => onChange(pointText(e.lngLat.lat, e.lngLat.lng))}
          />
        ) : null}
      </MapView>
    </div>
  );
}
