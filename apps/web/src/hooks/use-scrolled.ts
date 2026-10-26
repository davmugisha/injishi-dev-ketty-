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
    const onScroll = () => {
      const top = Math.max(
        window.scrollY,
        document.documentElement.scrollTop,
        document.body.scrollTop,
      );
      setScrolled(top > threshold);
    };
    onScroll();
    // Capture so a nested scroller (a page that clips overflow) still settles
    // the bar. Scroll does not bubble.
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", onScroll, { capture: true });
  }, [threshold]);

  return scrolled;
}
