import { authorize, updateHost } from "./helpers";
import type { Action, State } from "./types";

/**
 * What you offer: amenities and shared facilities.
 *
 * Returns null for an action it does not own, so `reducer` in ../store.tsx can
 * try each slice in turn. Behaviour is the original switch verbatim — the cases
 * moved, nothing about them changed.
 */
export function offerReducer(s: State, a: Action): State | null {
  switch (a.type) {
    case "toggleAmenity": {
      const denied = authorize(s, "amenity.manage");
      if (denied) return denied;
      if (a.scope === "prop") {
        return updateHost(s, (p) => ({
          ...p,
          propAmen: p.propAmen.includes(a.code) ? p.propAmen.filter((c) => c !== a.code) : [...p.propAmen, a.code],
        }));
      }
      return updateHost(s, (p) => ({
        ...p,
        roomTypes: p.roomTypes.map((t) =>
          t.key === a.typeKey
            ? { ...t, amen: t.amen.includes(a.code) ? t.amen.filter((c) => c !== a.code) : [...t.amen, a.code] }
            : t,
        ),
      }));
    }

    case "toggleShared": {
      const denied = authorize(s, "amenity.manage");
      if (denied) return denied;
      return updateHost(s, (p) => ({
        ...p,
        shared: p.shared.includes(a.label) ? p.shared.filter((x) => x !== a.label) : [...p.shared, a.label],
      }));
    }


    default:
      return null;
  }
}
