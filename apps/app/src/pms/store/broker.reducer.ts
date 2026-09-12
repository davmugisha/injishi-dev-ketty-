import { withToast } from "./helpers";
import type { Action, State } from "./types";

/**
 * Broker: contact reveals and placements.
 *
 * Returns null for an action it does not own, so `reducer` in ../store.tsx can
 * try each slice in turn. Behaviour is the original switch verbatim — the cases
 * moved, nothing about them changed.
 */
export function brokerReducer(s: State, a: Action): State | null {
  switch (a.type) {
    case "revealContact": {
      const B = s.db.broker;
      const listing = B.dir.find((d) => d.id === a.id);
      if (!listing || listing.revealed) return s;
      if (B.reveals <= 0) {
        return withToast(s, "No reveals left this period — place a tenant to earn more.", "warn");
      }
      // A reveal is metered and logged. It cannot be taken back, which is the
      // whole protection landlords are given against contact harvesting.
      const next = {
        ...s,
        db: {
          ...s.db,
          broker: {
            ...B,
            reveals: B.reveals - 1,
            dir: B.dir.map((d) => (d.id === a.id ? { ...d, revealed: true } : d)),
          },
        },
      };
      return withToast(
        next,
        `Contact revealed — ${listing.landlord} · logged. ${B.reveals - 1} reveals left.`,
        "ok",
      );
    }

    case "startPlacement": {
      const B = s.db.broker;
      const listing = B.dir.find((d) => d.id === a.id);
      if (!listing) return s;
      if (B.placements.some((p) => p.landlord === listing.landlord && p.st === "progress")) {
        return withToast(s, `A placement with ${listing.landlord} is already in progress`, "warn");
      }
      const next = {
        ...s,
        db: {
          ...s.db,
          broker: {
            ...B,
            placements: [
              { tenant: null, unit: listing.type, landlord: listing.landlord, lease: null, fee: null, st: "progress" as const },
              ...B.placements.filter((p) => !(p.landlord === listing.landlord && p.st === "none")),
            ],
          },
        },
      };
      return withToast(next, `Placement started — ${listing.landlord} · ${listing.type}, ${listing.loc}`, "ok");
    }


    default:
      return null;
  }
}
