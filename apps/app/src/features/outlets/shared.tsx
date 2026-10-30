"use client";

import { Chip } from "@heroui/react";
import type { OrderSource, OutletTone } from "@injishi/data/fixtures/outlets";
import { formatNumber, formatRwf, Icon, type IconKey, toneColor } from "@injishi/ui";
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

const SOURCE: Record<OrderSource, { tone: OutletTone; icon: IconKey }> = {
  table: { tone: "default", icon: "LayoutCellsLarge" },
  room: { tone: "info", icon: "Key" },
  qr: { tone: "accent", icon: "QrCode" },
};

/** Where an order came from (artifact: table, room-service and QR chips with their icon). */
export function SourceChip({
  source,
  label,
  size = "md",
  className,
}: {
  source: OrderSource;
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const s = SOURCE[source];
  return (
    <Chip size={size} variant="soft" color={toneColor(s.tone)} className={className}>
      <Icon name={s.icon} className="size-3" />
      <Chip.Label>{label}</Chip.Label>
    </Chip>
  );
}
