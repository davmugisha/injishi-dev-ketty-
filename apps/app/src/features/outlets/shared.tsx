"use client";

import { formatNumber, formatRwf } from "@injishi/ui";
import { type ReactNode, useState } from "react";
import { UNSAFE_PortalProvider } from "react-aria";
import type { Selection } from "react-aria-components";

/** "RWF 14,000" (whole francs). */
export const money = (n: number) => formatRwf(Math.round(n));

/** "+500", "+1,000" for an option surcharge. */
export const plus = (n: number) => `+${formatNumber(n)}`;

/** The single key of a React Aria selection, or null. */
export function firstKey(keys: Selection): string | null {
  if (keys === "all") return null;
  const [k] = [...keys];
  return k === undefined ? null : String(k);
}

const HOST =
  "pointer-events-none absolute inset-0 z-50 overflow-hidden [transform:translateZ(0)] [&>*]:pointer-events-auto";

/**
 * Overlays scoped to one region of a screen (artifact: the POS scrim covers the body under the header, which stays
 * readable). Render it inside a `relative` container; dialogs and toasts given as children stay within it.
 */
export function RegionOverlays({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return (
    <>
      <div ref={setHost} data-overlay-host="" className={HOST} />
      <UNSAFE_PortalProvider getContainer={() => host}>{children}</UNSAFE_PortalProvider>
    </>
  );
}
