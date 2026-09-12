/**
 * Broker workspace demo data — Samuel Kayitare, Kigali region.
 *
 * A broker is a solo workspace: no org, no role picker, one person. The whole
 * surface turns on two mechanics — a *reveal* spends a metered contact unlock
 * and is logged forever, and a *placement fee* earns only when the lease it
 * produced goes active. Nothing pays out on an introduction alone.
 *
 * Content owner: mfp-demo.md § Broker workspace.
 */

import type { BrokerData } from "./types";

export function broker(): BrokerData {
  return {
    key: "broker",
    name: "Kigali region",
    // D1 is Green Hills' listed unit seen from the other side of the
    // marketplace — the same object the landlord toggles under Directory
    // listing.
    dir: [
      { id: "D1", type: "1 bedroom", loc: "Kacyiru", rent: 180000, caution: "1 month", landlord: "Green Hills Apartments", phone: "+250 788 123 456", revealed: false },
      { id: "D2", type: "Studio", loc: "Remera", rent: 120000, caution: "2 months", landlord: "Karisimbi Rentals", phone: "+250 788 234 567", revealed: false },
      { id: "D3", type: "2 bedroom", loc: "Kimihurura", rent: 250000, caution: "1 month", landlord: "Kimihurura Homes", phone: "+250 788 345 678", revealed: true },
      { id: "D4", type: "2 bedroom", loc: "Kacyiru", rent: 260000, caution: "2 months", landlord: "Ingoro Apartments", phone: "+250 788 456 789", revealed: false },
      { id: "D5", type: "Studio", loc: "Kicukiro", rent: 110000, caution: "1 month", landlord: "Gikondo Homes", phone: "+250 788 567 890", revealed: false },
      { id: "D6", type: "1 bedroom", loc: "Remera", rent: 170000, caution: "1 month", landlord: "Nyarutarama Living", phone: "+250 788 678 901", revealed: false },
    ],
    placements: [
      { tenant: "Emmanuel N.", unit: "Unit C1", landlord: "Ingoro Apartments", lease: "L-0160", fee: 95000, st: "awaiting" },
      { tenant: "Aline U.", unit: "Unit B4", landlord: "Kimihurura Homes", lease: "L-0155", fee: 120000, st: "disbursed" },
      { tenant: "Patrick H.", unit: "Studio", landlord: "Karisimbi Rentals", lease: "L-0149", fee: 75000, st: "disbursed" },
      // A revealed landlord with nothing behind it — the row that earns the
      // "reveal with no placement gets flagged" warning its meaning.
      { tenant: null, unit: null, landlord: "Gikondo Homes", lease: null, fee: null, st: "none" },
    ],
    ledger: [
      ["Placement fee — Emmanuel N. · Ingoro Apartments", "Earns when the lease activates", 95000, "pending"],
      ["Placement fee — Aline U. · Kimihurura Homes", "28 Jun · mobile money", 120000, "disbursed"],
      ["Placement fee — Patrick H. · Karisimbi Rentals", "15 May · mobile money", 75000, "disbursed"],
    ],
    reveals: 4,
  };
}
