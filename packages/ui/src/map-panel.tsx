"use client";

import { type PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./icon.tsx";
import { fitView, type LatLng, project, RWANDA_BOUNDS, tilesFor, unproject } from "./map.ts";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** A place on the map: one home, or a group of homes counted together. */
export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  /** What it is, for the tooltip and screen readers: "Gasabo, 4 homes". */
  label: string;
  /** Shown in the marker when several homes are counted together. */
  count?: number;
  /** The point stands for an area (a district centre), not an exact address. */
  approximate?: boolean;
}

export interface MapPanelProps {
  points: readonly MapPoint[];
  /** What the map shows, for screen readers ("Homes on the map"). */
  label: string;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** CSS height of the map. @default "24rem" */
  height?: string;
  className?: string;
}

const MIN_ZOOM = 6;
const MAX_ZOOM = 17;

/** Whether the app is in its dark theme (`data-theme="…-dark"` on the html element), following changes. */
function useDarkTheme(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const read = () => setDark(/dark/.test(root.dataset.theme ?? "") || root.classList.contains("dark"));
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme", "class"] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

/**
 * A map of places, drawn from OpenStreetMap's tiles with no map library (turned to night in the dark
 * theme). It opens fitted to the points (all of Rwanda when there are none); drag to
 * move, the buttons zoom and fit again. A point is a button named by its label (shown on hover); one standing for
 * an area (a district centre) is drawn hollow. The tiles are pictures: everything a person needs is also
 * in the list beside the map.
 */
export function MapPanel({ points, label, selectedId, onSelect, height = "24rem", className }: MapPanelProps) {
  const box = useRef<HTMLElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState<{ center: LatLng; zoom: number } | null>(null);
  const drag = useRef<{ x: number; y: number; center: LatLng; id: number } | null>(null);
  const dark = useDarkTheme();
  const key = useMemo(() => points.map((p) => `${p.id}:${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join("|"), [points]);

  // The box's size, kept current.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fit = useCallback(() => {
    if (size.width === 0 || size.height === 0) return;
    setView(fitView(points.length > 0 ? points : RWANDA_BOUNDS, size, { min: MIN_ZOOM, max: 12, padding: 48 }));
  }, [points, size]);

  // Fitted to the points whenever they change (a new filter), and once the box has a size.
  // biome-ignore lint/correctness/useExhaustiveDependencies: refit on a new set of points, not on every render
  useEffect(() => {
    // biome-ignore lint/suspicious/noFocusedTests: this is the map's own refit above, not a focused test (Jasmine's `fit`)
    fit();
  }, [key, size.width > 0 && size.height > 0]);

  const zoomBy = (step: number) =>
    setView((v) => (v ? { ...v, zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom + step)) } : v));

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!view || (event.target as HTMLElement).closest("[data-map-control]")) return;
    drag.current = { x: event.clientX, y: event.clientY, center: view.center, id: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId || !view) return;
    const origin = project(d.center, view.zoom);
    const center = unproject({ x: origin.x - (event.clientX - d.x), y: origin.y - (event.clientY - d.y) }, view.zoom);
    setView({ ...view, center });
  };
  const endDrag = () => {
    drag.current = null;
  };

  const tiles = view && size.width > 0 ? tilesFor(view.center, view.zoom, size) : [];
  const centerPx = view ? project(view.center, view.zoom) : { x: 0, y: 0 };

  return (
    <section
      ref={box}
      aria-label={label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={cx(
        "relative w-full touch-none overflow-hidden rounded-lg border border-border bg-default select-none",
        drag.current ? "cursor-grabbing" : "cursor-grab",
        className,
      )}
      style={{ height }}
    >
      {tiles.map((t) => (
        // biome-ignore lint/performance/noImgElement: map tiles are plain pictures from the tile server
        <img
          key={`${t.z}/${t.x}/${t.y}`}
          src={`https://tile.openstreetmap.org/${t.z}/${t.wrappedX}/${t.y}.png`}
          alt=""
          draggable={false}
          className={cx(
            "pointer-events-none absolute max-w-none",
            // OpenStreetMap draws one light style; the dark theme turns it to night.
            dark && "brightness-90 contrast-90 hue-rotate-180 invert",
          )}
          style={{ left: t.left, top: t.top, width: 256, height: 256 }}
        />
      ))}

      {view
        ? points.map((p) => {
            const px = project(p, view.zoom);
            const left = px.x - centerPx.x + size.width / 2;
            const top = px.y - centerPx.y + size.height / 2;
            if (left < -40 || top < -40 || left > size.width + 40 || top > size.height + 40) return null;
            const selected = p.id === selectedId;
            return (
              <button
                key={p.id}
                type="button"
                data-map-control
                title={p.label}
                aria-label={p.label}
                aria-pressed={selected}
                onClick={() => onSelect?.(p.id)}
                className={cx(
                  "absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xs font-semibold shadow-md tabular transition-transform focus-visible:outline-2 focus-visible:outline-focus motion-reduce:transition-none",
                  p.count && p.count > 1 ? "h-8 min-w-8 px-2" : "size-7",
                  selected
                    ? "z-10 scale-110 bg-accent text-accent-foreground ring-2 ring-background"
                    : p.approximate
                      ? "border-2 border-accent bg-background text-accent hover:scale-105"
                      : "bg-accent text-accent-foreground hover:scale-105",
                )}
                style={{ left, top }}
              >
                {p.count && p.count > 1 ? p.count : <Icon name="House" className="size-3.5" />}
              </button>
            );
          })
        : null}

      <div
        data-map-control
        className="absolute top-3 right-3 flex flex-col overflow-hidden rounded-md border border-border bg-background shadow-sm"
      >
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => zoomBy(1)}
          className="flex size-9 items-center justify-center hover:bg-default focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
        >
          <Icon name="Plus" />
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => zoomBy(-1)}
          className="flex size-9 items-center justify-center border-t border-border hover:bg-default focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
        >
          <Icon name="Minus" />
        </button>
        <button
          type="button"
          aria-label="Show every home"
          onClick={fit}
          className="flex size-9 items-center justify-center border-t border-border hover:bg-default focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
        >
          <Icon name="ArrowsExpand" />
        </button>
      </div>
      <span className="pointer-events-none absolute right-1.5 bottom-1 rounded bg-background/80 px-1.5 text-xs text-muted">
        © OpenStreetMap contributors
      </span>
    </section>
  );
}
