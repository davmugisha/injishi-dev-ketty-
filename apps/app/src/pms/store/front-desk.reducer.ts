import { buildFolio, findConflict } from "../lib/folio";
import { dateRange, fmt, nights as nightsLabel } from "../lib/format";
import { authorize, hostProperty, propertyKey, updateHost, updateResidence, withToast } from "./helpers";
import type { Action, State } from "./types";

/**
 * Hospitality front desk: reservations, rooms, tickets, orders, folio, menu.
 *
 * Returns null for an action it does not own, so `reducer` in ../store.tsx can
 * try each slice in turn.
 *
 * **This slice is the DEMO store.** Every case here mutates a client side
 * object and nothing survives a reload. Reservations, Room status and Rent roll
 * have already left it for the API; the rest follow in the waves ADR-035 D-f
 * lists, and this file shrinks as they go.
 *
 * The two money cases below used to call a payment gateway and a tax invoice
 * issuer that lived in the browser (ADR-035, D-e). They do not any more. On the
 * demo they mint an openly labelled demo reference, because a demo is meant to
 * feel live; everywhere else they refuse, because a browser must not be the
 * thing that decides a charge settled. The real path is `command()` to the API,
 * which owns the payment seam.
 */

/** A reference that says what it is. Demo only, never a provider's answer. */
function demoReference(prefix: string): string {
  return `DEMO-${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

/**
 * Refuse a money action unless the API says this is the demo (ADR-043, AC-22).
 *
 * Returns a refusal state, or null when the caller may proceed. "The demo" is
 * `GET /api/v1/platform` answering `demo`, never a switch in the browser: the
 * old Production/Demo pill started on demo in every build, so any production
 * operator could mint a fake settlement. Not knowing (the API has not answered,
 * or cannot be reached) refuses too. There is no production branch that
 * succeeds here on purpose: the honest fix is to finish the wave that puts this
 * screen on the API, not to fake a settlement.
 */
function refuseMoneyOutsideDemo(s: State): State | null {
  if (s.platform?.environment === "demo") return null;
  return withToast(
    s,
    "This screen is not connected to payments yet. Nothing was charged.",
    "bad",
  );
}
export function frontDeskReducer(s: State, a: Action): State | null {
  switch (a.type) {
    case "approve": {
      const denied = authorize(s, "reservation.approve");
      if (denied) return denied;
      const P = hostProperty(s);
      const r = P?.res.find((x) => x.id === a.id);
      if (!P || !r) return s;
      const next = updateHost(s, (p) => ({
        ...p,
        res: p.res.map((x) => (x.id === a.id ? { ...x, status: "confirmed" as const } : x)),
      }));
      return withToast(next, `Approved — ${r.guest} confirmed. Assign a room on the Room grid.`, "ok");
    }

    case "decline": {
      const denied = authorize(s, "reservation.approve");
      if (denied) return denied;
      const P = hostProperty(s);
      const r = P?.res.find((x) => x.id === a.id);
      if (!P || !r) return s;
      const next = updateHost(s, (p) => ({
        ...p,
        res: p.res.map((x) => (x.id === a.id ? { ...x, status: "declined" as const } : x)),
      }));
      return withToast(next, `Declined — ${r.guest}'s request was removed`, "info");
    }

    /*
     * `checkIn` IS GONE (ADR-035). The drawer sends
     * `POST /ops/stays/walk-in` or `POST /ops/stays/:bookingId/checkin` now, so
     * a reducer that put a guest in a room in the browser was a second answer
     * to a question the server already answers — and the one the server never
     * heard.
     */
    case "checkout": {
      const denied = authorize(s, "stay.checkout");
      if (denied) return denied;
      const P = hostProperty(s);
      const r = P?.res.find((x) => x.id === a.id);
      if (!P || !r) return s;
      const f = buildFolio(r, P);

      // Settling the balance and issuing the tax invoice are the API's job
      // (ADR-035, D-e). Off the demo this refuses rather than inventing a
      // settlement the guest was never charged for.
      const refused = refuseMoneyOutsideDemo(s);
      if (refused) return refused;

      const settlement: [string, number] | null =
        f.bal > 0 ? [`Card · settled at checkout · ${demoReference("CARD")}`, f.bal] : null;
      const invoice = `DEMO-INV-${P.invSeq + 1}`;

      // One checkout does four things at once: settles the balance, issues
      // exactly one tax invoice, flips the room to Needs cleaning, and puts a
      // task on the housekeeper's phone.
      const next = updateHost(s, (p) => ({
        ...p,
        invSeq: p.invSeq + 1,
        res: p.res.map((x) =>
          x.id === r.id
            ? {
                ...x,
                status: "out" as const,
                closed: true,
                invoice,
                nights: Math.max(1, -x.start),
                xPay: settlement ? [...(x.xPay ?? []), settlement] : x.xPay,
              }
            : x,
        ),
        rooms: p.rooms.map((rm) => (rm.id === r.room ? { ...rm, hk: "needs" as const } : rm)),
        tasks: [{ room: r.room ?? "", kind: "Checkout clean", ts: "Just now" }, ...p.tasks],
      }));

      return withToast(
        next,
        `Checked out — ${r.guest} · tax invoice ${invoice} issued · Room ${r.room} marked Needs cleaning`,
        "ok",
      );
    }

    case "moveReservation": {
      const denied = authorize(s, "reservation.assign");
      if (denied) return denied;
      const P = hostProperty(s);
      const r = P?.res.find((x) => x.id === a.id);
      if (!P || !r) return s;

      const clash = findConflict(P, a.room, a.start, a.nights, a.id);
      if (clash) {
        return withToast(
          s,
          `Can't place it there — Room ${a.room} is booked ${dateRange(clash.start, clash.nights)} by ${clash.guest}. Pick a free room.`,
          "bad",
        );
      }

      const next = updateHost(s, (p) => ({
        ...p,
        res: p.res.map((x) => (x.id === a.id ? { ...x, room: a.room, start: a.start, nights: a.nights } : x)),
      }));

      if (a.mode === "tray") return withToast(next, `Assigned — ${r.guest} · Room ${a.room}`, "ok");
      if (a.mode === "resize") {
        const tail = r.status === "inhouse" ? " · the bill follows the stay" : "";
        return withToast(next, `${r.guest} — now ${nightsLabel(a.nights)}${tail}`, "ok");
      }
      return withToast(next, `Moved — ${r.guest} · Room ${a.room}`, "ok");
    }

    case "unassignRoom": {
      const denied = authorize(s, "reservation.assign");
      if (denied) return denied;
      const P = hostProperty(s);
      const r = P?.res.find((x) => x.id === a.id);
      if (!P || !r) return s;
      const next = updateHost(s, (p) => ({
        ...p,
        res: p.res.map((x) => (x.id === a.id ? { ...x, room: null } : x)),
      }));
      return withToast(next, `Unassigned — ${r.guest} moved to the tray`, "info");
    }

    case "setHk": {
      const denied = authorize(s, "housekeeping.set");
      if (denied) return denied;
      return updateHost(s, (p) => ({
        ...p,
        rooms: p.rooms.map((rm) => (rm.id === a.room ? { ...rm, hk: a.hk } : rm)),
      }));
    }

    case "advanceTicket": {
      const denied = authorize(s, "ticket.advance");
      if (denied) return denied;
      const key = propertyKey(s);
      const P = key === "residence" ? s.db.residence : s.db[key];
      const t = P.tickets.find((x) => x.id === a.id);
      if (!t) return s;

      const fixer = key === "residence" ? s.db.residence.fixer : "Claude N.";
      const steps: Record<string, [typeof t.st, string]> = {
        open: ["assigned", `Assigned to ${fixer} — Maintenance`],
        assigned: ["progress", `Started — ${fixer} is on it`],
        // What the fault IS now. "Nice work" was the app patting an operator on
        // the head for pressing a button.
        progress: ["resolved", "Fixed and closed"],
      };
      const nx = steps[t.st];
      if (!nx) return s;

      const advance = <T extends { tickets: typeof P.tickets }>(p: T): T => ({
        ...p,
        tickets: p.tickets.map((x) => (x.id === a.id ? { ...x, st: nx[0], to: x.to ?? fixer } : x)),
      });
      const next =
        key === "residence" ? updateResidence(s, advance) : updateHost(s, advance);
      return withToast(next, `${nx[1]} · ${t.title}`, "ok");
    }

    case "advanceOrder": {
      const denied = authorize(s, "order.advance");
      if (denied) return denied;
      const P = hostProperty(s);
      const o = P?.orders.find((x) => x.id === a.id);
      if (!P || !o) return s;

      const steps: Record<string, [typeof o.st, string | null]> = {
        new: ["prep", `Accepted — ${o.dept} has it`],
        prep: ["way", `On the way — Room ${o.room}`],
        way: ["done", null],
      };
      const nx = steps[o.st];
      if (!nx) return s;

      let next = updateHost(s, (p) => ({
        ...p,
        orders: p.orders.map((x) => (x.id === a.id ? { ...x, st: nx[0] } : x)),
      }));

      if (nx[0] !== "done") return withToast(next, nx[1]!, "ok");

      // Delivered is the moment the charge posts to the guest's one bill,
      // tagged to the department that served it.
      const stay = P.res.find((x) => x.status === "inhouse" && x.room === o.room);
      if (!stay) return withToast(next, `Delivered — Room ${o.room}`, "ok");

      next = updateHost(next, (p) => ({
        ...p,
        res: p.res.map((x) =>
          x.id === stay.id
            ? { ...x, xLines: [...(x.xLines ?? []), [o.dept, o.items.join(", "), o.total] as [string, string, number]] }
            : x,
        ),
      }));
      return withToast(next, `Delivered — ${fmt(o.total)} added to Room ${o.room}'s bill`, "ok");
    }

    case "addCharge": {
      const denied = authorize(s, "folio.charge");
      if (denied) return denied;
      const next = updateHost(s, (p) => ({
        ...p,
        res: p.res.map((x) =>
          x.id === a.resId
            ? { ...x, xLines: [...(x.xLines ?? []), [a.dept, a.label, a.amount] as [string, string, number]] }
            : x,
        ),
      }));
      return withToast(next, `Charge added — ${fmt(a.amount)} · ${a.dept}`, "ok");
    }

    case "recordPayment": {
      const denied = authorize(s, "folio.payment");
      if (denied) return denied;
      // A payment is settled by the API, never here (ADR-035, D-e).
      const refused = refuseMoneyOutsideDemo(s);
      if (refused) return refused;

      const reference = demoReference(
        a.method === "Mobile money" ? "MOMO" : a.method === "Card" ? "CARD" : "CASH",
      );
      const label = `${a.method} · payment · ${reference}`;
      const next = updateHost(s, (p) => ({
        ...p,
        res: p.res.map((x) =>
          x.id === a.resId ? { ...x, xPay: [...(x.xPay ?? []), [label, a.amount] as [string, number]] } : x,
        ),
      }));
      return withToast(next, `Payment recorded — ${fmt(a.amount)} · ${a.method} · ${reference}`, "ok");
    }

    case "toggleMenuItem": {
      const denied = authorize(s, "menu.manage");
      if (denied) return denied;
      const P = hostProperty(s);
      const item = P?.menu[a.dept]?.[a.index];
      if (!P || !item) return s;
      const nowHidden = item[2];
      const next = updateHost(s, (p) => ({
        ...p,
        menu: {
          ...p.menu,
          [a.dept]: p.menu[a.dept].map((x, j) => (j === a.index ? [x[0], x[1], !x[2]] : x)),
        },
      }));
      return withToast(
        next,
        nowHidden ? `Hidden — guests can't order ${item[0]} for now` : `Available again — ${item[0]}`,
        "ok",
      );
    }

    case "addMenuItem": {
      const denied = authorize(s, "menu.manage");
      if (denied) return denied;
      const next = updateHost(s, (p) => ({
        ...p,
        menu: { ...p.menu, [a.dept]: [...(p.menu[a.dept] ?? []), [a.name, a.price, true]] },
      }));
      return withToast(next, `Added — ${a.name} · ${fmt(a.price)} · ${a.dept}`, "ok");
    }


    default:
      return null;
  }
}
