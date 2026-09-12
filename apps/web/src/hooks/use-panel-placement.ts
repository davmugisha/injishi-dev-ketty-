"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Whether a panel anchored to `ref` should hang below it or above it.
 *
 * The hero pill sits near the bottom of a full-height hero, so a 400px panel
 * opened downward lands under the fold — the guest types, the list appears
 * off screen, and nothing looks like it happened. Measuring at open time keeps
 * the panel wherever it actually fits rather than assuming.
 */
export function usePanelPlacement(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  estimatedHeight: number,
): "top" | "bottom" {
  const [placement, setPlacement] = useState<"top" | "bottom">("bottom");

  useEffect(() => {
    if (!open) return;

    const measure = () => {
      const anchor = ref.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom;
      const above = rect.top;
      // Only lift when there is genuinely less room below, so the default
      // stays the conventional direction on pages where the bar sits high.
      setPlacement(below < estimatedHeight && above > below ? "top" : "bottom");
    };

    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [ref, open, estimatedHeight]);

  return placement;
}
