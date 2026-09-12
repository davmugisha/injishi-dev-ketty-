/**
 * The one live bill (folio) per stay — F-P03.
 *
 * Invariants this encodes (upgrade-PMS-prd.md, blueprint §4):
 *  - A stay has exactly one bill; every charge lands on it the moment it happens.
 *  - Every charge is tagged to a department, so it rolls up to departmental
 *    revenue (USALI) without a second posting.
 *  - Checkout settles the balance and issues exactly one tax invoice.
 *
 * The folio is DERIVED, never stored: it is the room nights charged so far plus
 * the charge log, minus payments. That is what makes "updates live" true — no
 * reconciliation step can drift from it.
 */

import type { HospitalityProperty, Reservation, Room } from "../data/types";
import { ds, fmt, nights as nightsLabel } from "./format";

export const VAT_RATE = 0.18;

export interface FolioLine {
  dept: string;
  label: string;
  sub: string;
  amt: number;
}

export interface FolioPayment {
  label: string;
  sub: string;
  amt: number;
}

export interface Folio {
  lines: FolioLine[];
  sub: number;
  vat: number;
  total: number;
  pays: FolioPayment[];
  paid: number;
  bal: number;
  room: Room | { type: string; rate: number };
  rate: number;
  /** Room nights billed so far — the whole stay once checked out. */
  charged: number;
}

const UNKNOWN_ROOM = { type: "Room", rate: 0 };

/**
 * Room nights to bill right now. An in-house guest is billed for the nights
 * they have actually slept (never fewer than 1, never more than booked); once
 * checked out the stay bills in full.
 */
function chargedNights(r: Reservation): number {
  if (r.status === "out") return r.nights;
  return Math.min(r.nights, Math.max(1, -r.start));
}

export function buildFolio(r: Reservation, P: HospitalityProperty): Folio {
  const room = P.rooms.find((x) => x.id === r.room) ?? UNKNOWN_ROOM;
  const rate = r.rateOv ?? room.rate;
  const charged = chargedNights(r);

  const lines: FolioLine[] = [
    {
      dept: "Rooms",
      label: `${room.type} · ${nightsLabel(charged)} × ${fmt(rate)}`,
      sub: `${ds(r.start)} → ${ds(r.start + r.nights)}`,
      amt: charged * rate,
    },
  ];

  // Seeded history, then anything posted during this session.
  const ex = P.extras[r.guest] ?? { lines: [], pay: [] };
  ex.lines.forEach(([dept, label, day, amt]) => lines.push({ dept, label, sub: ds(day), amt }));
  (r.xLines ?? []).forEach(([dept, label, amt]) => lines.push({ dept, label, sub: "Today", amt }));

  const sub = lines.reduce((a, l) => a + l.amt, 0);
  const vat = Math.round(sub * VAT_RATE);
  const total = sub + vat;

  const pays: FolioPayment[] = [
    ...ex.pay.map(([label, day, amt]) => ({ label, sub: ds(day), amt })),
    ...(r.xPay ?? []).map(([label, amt]) => ({ label, sub: "Today", amt })),
  ];
  const paid = pays.reduce((a, p) => a + p.amt, 0);

  return { lines, sub, vat, total, pays, paid, bal: total - paid, room, rate, charged };
}

/** Charges grouped for the statement — Rooms first, then each department. */
export function groupByDepartment(folio: Folio, departments: string[]) {
  return ["Rooms", ...departments]
    .map((dept) => ({ dept, lines: folio.lines.filter((l) => l.dept === dept) }))
    .filter((g) => g.lines.length > 0);
}

/** A reservation that occupies inventory (declined/pending never do). */
export function isLive(r: Reservation): boolean {
  return r.status !== "pending" && r.status !== "declined";
}

/**
 * The overlapping reservation blocking a placement, if any. Half-open interval:
 * a stay ending on day 5 and one starting day 5 do not conflict — the room
 * turns over that morning.
 */
export function findConflict(
  P: HospitalityProperty,
  room: string,
  start: number,
  nights: number,
  exceptId?: string,
): Reservation | undefined {
  return P.res.find(
    (o) =>
      o.id !== exceptId &&
      o.room === room &&
      isLive(o) &&
      start < o.start + o.nights &&
      o.start < start + nights,
  );
}
