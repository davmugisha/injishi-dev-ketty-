"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { cn } from "@injishi/utils";
import type { JourneyLeg, JourneyPoint } from "@/components/home/journey-map";

const JourneyMap = dynamic(() => import("@/components/home/journey-map").then((m) => m.JourneyMap), {
  ssr: false,
  loading: () => <div className="absolute inset-0 animate-pulse bg-surface-secondary" aria-hidden />,
});

/**
 * `JourneyMap`, mounted only once its box comes within a screen of the
 * viewport. Until then it is a quiet placeholder of the same size, so the
 * page does not shift and the ~200 KB map is never fetched for a visitor who
 * stops at the hero.
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
  const [near, setNear] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn("relative", className)}>
      {near ? (
        <JourneyMap {...props} className="absolute inset-0" />
      ) : (
        <div className="absolute inset-0 bg-surface-secondary" aria-hidden />
      )}
    </div>
  );
}
