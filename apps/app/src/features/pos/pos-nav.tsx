"use client";

import { LinkButton } from "@injishi/ui";
import { POS_BOARDS, type PosBoard } from "./pos-boards";

/** Each screen and the permissions any one of which opens it (the API still decides every call). */
const LINKS: { board: PosBoard; label: string; any: string[] }[] = [
  { board: "PosDashboard", label: "Dashboard", any: ["shift.review", "money.view"] },
  { board: "PosFloor", label: "Floor", any: ["pos.sell", "table.manage", "pos.checkout"] },
  { board: "PosStations", label: "Kitchen and bar", any: ["kitchen.work", "pos.sell"] },
  { board: "PosShift", label: "Shift", any: ["register.operate", "shift.review"] },
  { board: "PosMenu", label: "Menu", any: ["pos.sell", "table.manage", "pos.checkout", "kitchen.work", "shift.review"] },
  { board: "PosStock", label: "Stock", any: ["stock.manage", "shift.review"] },
  { board: "PosReports", label: "Reports", any: ["shift.review", "money.view"] },
];

/** The live POS screens this person's permissions open, in the header of each. */
export function PosNav({ current, outletId, can }: { current: PosBoard; outletId: string; can: string[] }) {
  return (
    <nav aria-label="Point of sale" className="flex flex-wrap gap-1">
      {LINKS.filter((l) => l.board !== current && l.any.some((p) => can.includes(p))).map((l) => (
        <LinkButton
          key={l.board}
          href={`${POS_BOARDS[l.board].href}${outletId ? `?outlet=${outletId}` : ""}`}
          variant="ghost"
          size="sm"
        >
          {l.label}
        </LinkButton>
      ))}
    </nav>
  );
}
