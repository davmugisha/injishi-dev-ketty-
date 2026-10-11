/**
 * What each of the six roles is FOR, in the owner's words (ADR-069 D-b).
 *
 * The one table Team, Invites and Roles read, so a role is described the same
 * way on the roster, in the invitation and in the editor. Before this each
 * screen kept its own map, and the three had drifted: the roster called the
 * manager "everything except Settings" while the editor said "runs the
 * property day to day".
 *
 * **WORDS ONLY, NEVER A DECISION.** Nothing here says what a role may do; the
 * server resolves that from the grant, and a business may move any permission
 * on any staff role (ADR-055). These lines describe the platform's DEFAULT job,
 * which is why the Roles editor shows them beside the live set rather than in
 * place of it. The role's NAME is `ORG_ROLE_LABEL` in `@injishi/contracts`,
 * never a string here: one fact, one owner.
 *
 * `everyDay` is the Roles board's "every day" row, cut to what each default set
 * can actually do today. The board's "refunds above the limit" became
 * "refunds" because no limit exists; finance's "resolves held receipts" and
 * "closes the cashier shift" are gone because no screen lists a held receipt
 * and the cashier shift close is an open decision (ADR-069, Not decided here).
 * A line that promised a screen nobody built would be the first thing an
 * accountant tried and could not find.
 */

import type { OrgRole } from "@injishi/contracts";

export interface RoleCopy {
  /** One line: the role's working day. Roles and Invites. */
  everyDay: string;
  /** A few words under the roster badge. Team. */
  short: string;
  /** The roster badge's colour. Always beside the role's name, never instead of it. */
  intent: "accent" | "info" | "neutral";
}

export const ROLE_COPY: Readonly<Record<OrgRole, RoleCopy>> = {
  owner: {
    everyDay:
      "Decides what waits for them: confirming the pay run, refunds, the EBM account and who joins the team.",
    short: "Everything, the team included",
    intent: "accent",
  },
  manager: {
    everyDay:
      "Runs the day and the shift: bookings, rooms, rates, outlets, the money, the roster and leave. Answers escalations.",
    short: "Runs the property, not the team or pay",
    intent: "accent",
  },
  receptionist: {
    everyDay: "Checks guests in and out, assigns rooms, takes payments and answers guest messages.",
    short: "Front desk and service orders",
    intent: "info",
  },
  finance: {
    everyDay:
      "Posts charges and payments, closes bills and signs their RRA receipts, keeps the EBM account and answers refund requests.",
    short: "The money, bills and RRA receipts",
    intent: "info",
  },
  hr: {
    everyDay:
      "Keeps staff files, watches attendance, decides leave, publishes the roster and drafts the pay run for the owner to confirm.",
    short: "Staff files, roster and leave; drafts pay",
    intent: "info",
  },
  housekeeper: {
    everyDay: "Works from a phone: cleans assigned rooms, sets their status and reports problems.",
    short: "Room status and maintenance",
    intent: "neutral",
  },
};

/**
 * Why the owner is never in the invitation picker, said where the owner looks
 * for it. Ownership passes through the owner claim, which checks an identity
 * document; an emailed link that made somebody an owner would be a way round it.
 */
export const OWNER_NOT_INVITABLE =
  "Not offered here. Ownership passes through the owner claim, which checks an identity document.";
