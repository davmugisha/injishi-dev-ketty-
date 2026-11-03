// Who may open which app (proto-ui, PLAN.md "Mock session"), as pure rules the app layouts and the
// start route share. Sample data mode guards nothing, so every screen opens from the launcher. Api mode
// keeps today's rules: the guest app is open to everyone but a signed in non-guest goes to their own
// app; the three staff apps need a signed in staff person who has passed the emailed step up; the
// resident, manager and desk apps need a signed in person. No React Native import: `node --test` runs it.

import type { DataMode } from "../lib/data-mode.ts";
import type { AppKey } from "./screens.ts";

const STAFF: readonly AppKey[] = ["housekeeper", "supervisor", "technician"];

/**
 * The app a signed in person's own home is in, by their persona (`@injishi/data` ids). The phone signs
 * in housekeepers, supervisors, technicians and guests today; the web preview's fixture sign in can be
 * anyone, so the people the new apps are for land in them too. Anyone else is a guest.
 */
export function personaApp(personaId: string): AppKey {
  switch (personaId) {
    case "housekeeper":
    case "supervisor":
    case "technician":
      return personaId;
    case "tenant":
      return "resident";
    case "owner":
    case "manager":
      return "manager";
    case "frontdesk":
      return "desk";
    default:
      return "guest";
  }
}

export interface GuardInput {
  mode: DataMode;
  /** The real session's status (`useSession().status`). */
  status: "loading" | "signed-in" | "signed-out" | "unreachable";
  /** The signed in person's persona id, or null when nobody is. */
  personaId: string | null;
  stepUpOwed: boolean;
}

export type GuardVerdict =
  /** Render the app. */
  | { kind: "open" }
  /** The stored session is still being read: render nothing yet. */
  | { kind: "wait" }
  /** Go elsewhere: the start route picks the person's own app or the welcome; or the step up. */
  | { kind: "redirect"; to: "/" | "/two-factor" };

const OPEN: GuardVerdict = { kind: "open" };

export function guardFor(app: AppKey, input: GuardInput): GuardVerdict {
  if (input.mode === "mock") return OPEN;
  if (input.status === "loading") return { kind: "wait" };
  const own = input.personaId ? personaApp(input.personaId) : null;
  if (app === "guest") return own && own !== "guest" ? { kind: "redirect", to: "/" } : OPEN;
  if (!own) return { kind: "redirect", to: "/" };
  if (STAFF.includes(app)) {
    // The emailed step up comes first, once per session (mobile spec 0003, AC-1).
    if (input.stepUpOwed) return { kind: "redirect", to: "/two-factor" };
    return STAFF.includes(own) ? OPEN : { kind: "redirect", to: "/" };
  }
  return OPEN;
}
