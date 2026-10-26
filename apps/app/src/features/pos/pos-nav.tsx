"use client";

import { LinkButton } from "@injishi/ui";
import { POS_BOARDS, type PosBoard } from "./pos-boards";

const LINKS: { board: PosBoard; label: string; any: string[] }[] = [
  { board: "PosFloor", label: "Floor", any: ["pos.sell", "table.manage", "pos.checkout"] },
  { board: "PosStations", label: "Kitchen and bar", any: ["kitchen.work", "pos.sell"] },
  { board: "PosShift", label: "Shift", any: ["register.operate", "shift.review"] },
];

/** The live POS screens this person's permissions open, in the header of each. */
export function PosNav({ current, outletId, can }: { current: PosBoard; outletId: string; can: string[] }) {
  return (
    <nav aria-label="Point of sale" className="flex gap-1">
      {LINKS.filter((l) => l.board !== current && l.any.some((p) => can.includes(p))).map((l) => (
        <LinkButton key={l.board} href={`${POS_BOARDS[l.board].href}?outlet=${outletId}`} variant="ghost" size="sm">
          {l.label}
        </LinkButton>
      ))}
    </nav>
  );
}
