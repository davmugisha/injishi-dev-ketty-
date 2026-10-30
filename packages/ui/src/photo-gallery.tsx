"use client";

import { type KeyboardEvent, type PointerEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { Icon } from "./icon.tsx";
import { swipeStep, wrapIndex, ZOOM_SCALE, zoomOrigin } from "./zoom.ts";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** A photo the gallery shows. */
export interface GalleryPhoto {
  url: string;
  /** What it shows ("Kitchen"), when known. */
  alt?: string;
}

export interface PhotoGalleryProps {
  photos: readonly GalleryPhoto[];
  /** What the photos are of, for screen readers: "Unit A-01". */
  label: string;
  /** Shown instead when there are no photos (an `EmptyBlock` with a next step). */
  empty?: ReactNode;
  className?: string;
}

/** A finger that moved less than this was a tap. */
const TAP_SLOP = 10;

interface Touch {
  pointerId: number;
  x: number;
  y: number;
  moved: boolean;
}

/**
 * A large photo with its thumbnails, as a shop shows a product. With a mouse, pointing at the photo
 * enlarges it where the pointer is and the enlarged part follows the pointer. On a touch screen, a tap
 * zooms in where it lands and a finger then moves around the photo; another tap zooms out, and at rest a
 * swipe goes to the next photo. The arrows, the thumbnails and the arrow keys pick the photo; the counter
 * says which ("3 of 8"). Enter zooms the focused photo in and out from the keyboard.
 */
export function PhotoGallery({ photos, label, empty, className }: PhotoGalleryProps) {
  const [index, setIndex] = useState(0);
  /** Where the photo is enlarged around, in percent; null at rest. */
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const touch = useRef<Touch | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  const count = photos.length;
  const current = Math.min(index, Math.max(0, count - 1));
  const photo = photos[current];

  // The thumbnail of the photo shown stays in view in the strip.
  useEffect(() => {
    strip.current?.children[current]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [current]);

  if (!photo) return empty ?? null;

  const go = (step: number) => {
    if (count < 2) return;
    setZoom(null);
    setIndex(wrapIndex(current, step, count));
  };
  const pick = (k: number) => {
    setZoom(null);
    setIndex(k);
  };

  const at = (event: PointerEvent<HTMLElement>) =>
    zoomOrigin(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch" || (event.target as HTMLElement).closest("[data-gallery-arrow]")) return;
    touch.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    if (zoom) event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") {
      // A mouse or a pen: the enlarged part follows the pointer (not over the arrows).
      if ((event.target as HTMLElement).closest("[data-gallery-arrow]")) setZoom(null);
      else setZoom(at(event));
      return;
    }
    const t = touch.current;
    if (!t || t.pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - t.x, event.clientY - t.y) > TAP_SLOP) t.moved = true;
    // Zoomed: the finger moves around the photo.
    if (zoom) setZoom(at(event));
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const t = touch.current;
    if (event.pointerType !== "touch" || !t || t.pointerId !== event.pointerId) return;
    touch.current = null;
    if (!t.moved) {
      setZoom(zoom ? null : at(event));
      return;
    }
    if (!zoom) go(swipeStep(event.clientX - t.x, event.clientY - t.y));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowRight") go(1);
    else if (event.key === "ArrowLeft") go(-1);
    else if (event.key === "Escape" && zoom) setZoom(null);
    else return;
    event.preventDefault();
    event.stopPropagation();
  };

  const name = photo.alt ? `${photo.alt}, photo ${current + 1} of ${count}` : `Photo ${current + 1} of ${count}`;

  return (
    <div className={cx("flex min-w-0 flex-col gap-2", className)}>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          touch.current = null;
        }}
        onPointerLeave={(event) => {
          if (event.pointerType !== "touch") setZoom(null);
        }}
        data-zoomed={zoom ? "" : undefined}
        className={cx(
          "group/zoom relative aspect-4/3 w-full overflow-hidden rounded-lg bg-default select-none",
          zoom ? "cursor-zoom-out touch-none" : "cursor-zoom-in touch-pan-y",
        )}
      >
        <button
          type="button"
          aria-label={`${label}: ${name}. ${zoom ? "Zoomed in." : "Press to zoom in."}`}
          aria-pressed={Boolean(zoom)}
          onKeyDown={onKeyDown}
          onClick={(event) => {
            // Only the keyboard (a pointer zooms by pointing or tapping, above).
            if (event.detail === 0) setZoom(zoom ? null : { x: 50, y: 50 });
          }}
          className="block size-full cursor-[inherit] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
        >
          {/* biome-ignore lint/performance/noImgElement: signed, short-lived URLs */}
          <img
            key={photo.url}
            src={photo.url}
            alt={name}
            draggable={false}
            className="size-full object-cover transition-transform duration-150 ease-out select-none motion-reduce:transition-none"
            style={
              zoom
                ? { transform: `scale(${ZOOM_SCALE})`, transformOrigin: `${zoom.x}% ${zoom.y}%` }
                : { transformOrigin: "50% 50%" }
            }
          />
        </button>
        <span
          aria-live="polite"
          className="pointer-events-none absolute right-3 bottom-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white tabular"
        >
          {current + 1} of {count}
        </span>
        {zoom ? null : (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white opacity-100 transition-opacity group-hover/zoom:opacity-0 motion-reduce:transition-none"
          >
            <Icon name="Magnifier" className="size-3.5" />
            <span className="pointer-coarse:hidden">Point to zoom</span>
            <span className="hidden pointer-coarse:inline">Tap to zoom</span>
          </span>
        )}
        {count > 1 ? (
          <>
            <button
              type="button"
              data-gallery-arrow
              aria-label="Previous photo"
              onClick={() => go(-1)}
              className="absolute top-1/2 left-3 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-black shadow-md transition-opacity group-hover/zoom:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-focus motion-reduce:transition-none pointer-fine:opacity-0"
            >
              <Icon name="ChevronLeft" />
            </button>
            <button
              type="button"
              data-gallery-arrow
              aria-label="Next photo"
              onClick={() => go(1)}
              className="absolute top-1/2 right-3 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-black shadow-md transition-opacity group-hover/zoom:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-focus motion-reduce:transition-none pointer-fine:opacity-0"
            >
              <Icon name="ChevronRight" />
            </button>
          </>
        ) : null}
      </div>
      {count > 1 ? (
        <div ref={strip} className="flex gap-2 overflow-x-auto p-0.5 pb-1">
          {photos.map((p, k) => (
            <button
              key={p.url}
              type="button"
              aria-label={`Show photo ${k + 1}${p.alt ? `, ${p.alt}` : ""}`}
              aria-current={k === current ? "true" : undefined}
              onClick={() => pick(k)}
              className={cx(
                "relative aspect-4/3 w-16 shrink-0 overflow-hidden rounded-md ring-offset-2 ring-offset-background transition-opacity focus-visible:outline-2 focus-visible:outline-focus motion-reduce:transition-none sm:w-20",
                k === current ? "ring-2 ring-accent" : "opacity-70 hover:opacity-100",
              )}
            >
              {/* biome-ignore lint/performance/noImgElement: signed, short-lived URLs */}
              <img src={p.url} alt="" draggable={false} className="size-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
