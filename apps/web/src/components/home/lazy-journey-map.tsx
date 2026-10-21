"use client";

import { Map as MapIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { cn } from "@injishi/utils";
import type { JourneyLeg, JourneyPoint } from "@/components/home/journey-map";

const JourneyMap = dynamic(() => import("@/components/home/journey-map").then((m) => m.JourneyMap), {
  ssr: false,
  loading: () => <div className="absolute inset-0 animate-pulse bg-surface-secondary" aria-hidden />,
});

/**
 * Whether this visitor should be asked before the map loads: a touch screen,
 * which on this market is a phone on mobile data, or a browser that says the
 * person is saving data. The map is ~200 KB of script and several hundred KB
 * of tiles, the heaviest thing on the home page after the old hero video.
 */
function askFirst(): boolean {
  if (typeof window === "undefined") return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return true;
  return window.matchMedia?.("(pointer: coarse)").matches ?? false;
}

/**
 * `JourneyMap`, mounted only when it is wanted. Until then it is a quiet
 * placeholder of the same size, so the page does not shift.
 *
 * On a phone, or with Save-Data on, the placeholder carries a "Show the map"
 * button and nothing loads until it is pressed. Elsewhere the map mounts once
 * its box is actually on screen. It used to mount when the box came within a
 * whole screen of the viewport, and the trip planner sits directly under a
 * full-height hero, so every visit fetched the map and its tiles during the
 * first load, before the visitor had scrolled at all (measured 2026-10-21).
 */
export function LazyJourneyMap({
  className,
  ...props
}: {
  points: JourneyPoint[];
  legs?: JourneyLeg[];
  fit?: "country" | "points";
  onPick?: (id: string) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<"waiting" | "ask" | "shown">("waiting");

  useEffect(() => {
    if (askFirst()) {
      setMode("ask");
      return;
    }
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setMode("shown");
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setMode("shown");
          observer.disconnect();
        }
      },
      { rootMargin: "0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn("relative", className)}>
      {mode === "shown" ? (
        <JourneyMap {...props} className="absolute inset-0" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-secondary">
          {mode === "ask" ? (
            <button
              type="button"
              onClick={() => setMode("shown")}
              className="inline-flex items-center gap-2 rounded-full bg-card px-5 py-3 text-sm font-semibold text-foreground shadow-control ring-1 ring-border transition-colors duration-quick hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MapIcon className="size-4" aria-hidden />
              Show the map
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
