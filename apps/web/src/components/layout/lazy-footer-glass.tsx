"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const FooterGlass = dynamic(
  () => import("@/components/layout/footer-glass").then((m) => m.FooterGlass),
  { ssr: false },
);

/**
 * `FooterGlass`, fetched only when the footer is about to be seen.
 *
 * The shader already paints once and stops (`speed={0}`), so it cost nothing
 * after first paint, but its WebGL library was still downloaded and parsed with
 * every page, at the bottom of pages most phone visitors never scroll to. The
 * panel is a solid accent colour without it, so until the footer comes within
 * a screen of the viewport, that is all it is (2026-10-21).
 */
export function LazyFooterGlass() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
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
    <div ref={ref} className="size-full">
      {near ? <FooterGlass /> : null}
    </div>
  );
}
