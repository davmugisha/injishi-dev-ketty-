import { fmt } from "../lib/format";
import { authorize, updateResidence, withToast } from "./helpers";
import type { Action, State } from "./types";

/**
 * Landlord residence: rent, leases, units, deposits.
 *
 * Returns null for an action it does not own, so `reducer` in ../store.tsx can
 * try each slice in turn. Behaviour is the original switch verbatim — the cases
 * moved, nothing about them changed.
 */
export function residenceReducer(s: State, a: Action): State | null {
  switch (a.type) {
    case "recordRent": {
      const denied = authorize(s, "rent.record");
      if (denied) return denied;
      const l = s.db.residence.leases.find((x) => x.id === a.id);
      if (!l) return s;
      const next = updateResidence(s, (p) => ({
        ...p,
        leases: p.leases.map((x) => (x.id === a.id ? { ...x, pay: "paid" as const, payLine: "Paid today" } : x)),
      }));
      return withToast(next, `Payment recorded — ${fmt(l.rent)} · ${l.unit} · July rent`, "ok");
    }

    case "advanceLease": {
      const denied = authorize(s, "lease.advance");
      if (denied) return denied;
      const l = s.db.residence.leases.find((x) => x.id === a.id);
      if (!l) return s;
      const steps: Record<string, [typeof l.st, string]> = {
        draft: ["awaiting", `Sent for signature — ${l.tenant} signs on their phone`],
        awaiting: ["active", `Lease active — ${l.unit} · ${l.tenant} moves in ${l.start}`],
        ending: ["ended", `Move-out started — deposit ${fmt(l.rent)} queued for return review`],
      };
      const nx = steps[l.st];
      if (!nx) return s;

      const next = updateResidence(s, (p) => ({
        ...p,
        leases: p.leases.map((x) =>
          x.id === a.id
            ? {
                ...x,
                st: nx[0],
                pay: nx[0] === "active" ? ("due" as const) : x.pay,
                payLine: nx[0] === "active" ? `First rent due ${x.start}` : x.payLine,
                depReturned: nx[0] === "ended" ? false : x.depReturned,
              }
            : x,
        ),
      }));
      return withToast(next, nx[1], "ok");
    }

    case "setUnitRent": {
      const denied = authorize(s, "unit.manage");
      if (denied) return denied;
      const next = updateResidence(s, (p) => ({
        ...p,
        units: p.units.map((u) => (u.id === a.unit ? { ...u, rent: a.rent } : u)),
      }));
      // An active lease keeps its signed rent; the change lands on the next one.
      return withToast(next, `${a.unit} — new rent ${fmt(a.rent)} / month, from the next lease`, "ok");
    }

    case "toggleListing": {
      const denied = authorize(s, "listing.manage");
      if (denied) return denied;
      const on = s.db.residence.dirListed.includes(a.unit);
      const next = updateResidence(s, (p) => ({
        ...p,
        dirListed: on ? p.dirListed.filter((u) => u !== a.unit) : [...p.dirListed, a.unit],
      }));
      return withToast(
        next,
        on
          ? `Unlisted — brokers no longer see ${a.unit}`
          : `Listed — registered brokers in Kigali can see ${a.unit} now. Your contact stays hidden until revealed.`,
        on ? "info" : "ok",
      );
    }

    case "addDeduction": {
      const denied = authorize(s, "deposit.return");
      if (denied) return denied;
      // Every deduction carries a reason, because the tenant reads it.
      return {
        ...s,
        deductions: { ...s.deductions, [a.leaseId]: [...(s.deductions[a.leaseId] ?? []), [a.label, a.amount]] },
      };
    }

    case "returnDeposit": {
      const denied = authorize(s, "deposit.return");
      if (denied) return denied;
      const l = s.db.residence.leases.find((x) => x.id === a.leaseId);
      if (!l) return s;
      const deducted = (s.deductions[a.leaseId] ?? []).reduce((acc, d) => acc + d[1], 0);
      const net = Math.max(0, l.rent - deducted);
      const next = updateResidence(s, (p) => ({
        ...p,
        leases: p.leases.map((x) => (x.id === a.leaseId ? { ...x, depReturned: true } : x)),
      }));
      return withToast(
        next,
        `Deposit returned — ${fmt(net)} to ${l.tenant} by mobile money${deducted ? ` · ${fmt(deducted)} deducted` : ""}`,
        "ok",
      );
    }


    default:
      return null;
  }
}
