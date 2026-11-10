import { POS_BOARDS, type PosBoard } from "./pos-boards";

/** Each screen and the permissions any one of which opens it (the API still decides every call). */
const LINKS: { board: PosBoard; label: string; any: string[] }[] = [
  { board: "PosDashboard", label: "Dashboard", any: ["shift.review", "money.view"] },
  { board: "PosFloor", label: "Floor", any: ["pos.sell", "table.manage", "pos.checkout"] },
  { board: "PosStations", label: "Kitchen and bar", any: ["kitchen.work", "pos.sell"] },
  { board: "PosShift", label: "Shift", any: ["register.operate", "shift.review"] },
  { board: "PosMenu", label: "Menu", any: ["pos.sell", "pos.checkout", "menu.manage"] },
  { board: "PosCustomers", label: "Customers", any: ["customer.view", "customer.manage"] },
  { board: "PosStock", label: "Stock", any: ["stock.manage", "shift.review"] },
  { board: "PosReports", label: "Reports", any: ["shift.review", "money.view"] },
  { board: "PosSetup", label: "Setup", any: ["outlet.manage"] },
];

/** The other POS screens this person's permissions open, with where each one goes. */
export function posNavLinks(
  current: PosBoard,
  outletId: string,
  can: string[],
): { board: PosBoard; label: string; href: string }[] {
  return LINKS.filter((l) => l.board !== current && l.any.some((p) => can.includes(p))).map((l) => ({
    board: l.board,
    label: l.label,
    href: `${POS_BOARDS[l.board].href}${outletId ? `?outlet=${outletId}` : ""}`,
  }));
}
