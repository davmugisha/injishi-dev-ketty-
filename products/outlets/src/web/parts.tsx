"use client";

import { Chip } from "@heroui/react";
import { formatRwf, Icon, type IconKey, toneColor } from "@injishi/ui";
import type { OrderSource, OutletTone } from "../model/outlets.ts";

/*
 * What Outlets' screens (the kitchen display, the order board, the guest's QR order) draw beside each other.
 * They shared `./shared` with POS's screens until ADR-074 stage 5; POS keeps that file until it moves.
 */

/** "RWF 14,000" (whole francs). */
export const money = (n: number) => formatRwf(Math.round(n));

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
