"use client";

import { useEffect, useState } from "react";

/**
 * Whether the page has scrolled past `threshold`.
 *
 * Drives the header's resting → scrolled transition. The prototype did this by
 * swapping class lists on the DOM from a scroll listener; the state lives in
 * React now and the classes are chosen during render.
 */
export function useScrolled(threshold = 24): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return scrolled;
}
