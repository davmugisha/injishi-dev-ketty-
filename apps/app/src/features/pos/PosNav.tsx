"use client";

import { LinkButton } from "@injishi/ui";

type Board = "PosFloor" | "PosTill" | "PosStations" | "PosShift";

const LINKS: { board: Board; label: string; href: (outletId: string) => string; any: string[] }[] = [
  { board: "PosFloor", label: "Floor", href: (o) => `/pos/floor?outlet=${o}`, any: ["pos.sell", "table.manage", "pos.checkout"] },
  { board: "PosStations", label: "Kitchen and bar", href: (o) => `/pos/stations?outlet=${o}`, any: ["kitchen.work", "pos.sell"] },
  { board: "PosShift", label: "Shift", href: (o) => `/pos/shift?outlet=${o}`, any: ["register.operate", "shift.review"] },
];

/** The live POS screens this person's permissions open, in the header of each. */
export function PosNav({ current, outletId, can }: { current: Board; outletId: string; can: string[] }) {
  return (
    <nav aria-label="Point of sale" className="flex gap-1">
      {LINKS.filter((l) => l.board !== current && l.any.some((p) => can.includes(p))).map((l) => (
        <LinkButton key={l.board} href={l.href(outletId)} variant="ghost" size="sm">
          {l.label}
        </LinkButton>
      ))}
    </nav>
  );
}
