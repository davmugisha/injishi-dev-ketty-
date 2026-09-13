import type {
  AdminUnclaimedStay,
  AdminUserMembership,
  AdminUserRow,
} from "@injishi/contracts";

import type {
  BadgeIntent,
  OrgMembership,
  OversightAssignment,
  UnclaimedStay,
  UserRow,
} from "@/lib/types";

import { EMPTY, date, detail, humanise } from "./format";

/**
 * Users (F-A04) — one person, as a row.
 *
 * The directory is the console's most sensitive screen, and the discipline that
 * follows from that runs through this whole file: it renders what the API sent
 * and refuses to fill in the rest. Two fields below are deliberately empty for
 * exactly that reason, and each says so where it happens.
 */

/* ---------- Email verification ---------- */

/**
 * Unverified email is amber, not red.
 *
 * A guest who has not clicked through is an ordinary state on a marketplace
 * anybody can browse, not an incident. Red here would make most of a healthy
 * directory look broken.
 */
function emailBadge(
  verified: boolean,
): { text: string; intent: BadgeIntent } | undefined {
  // Nothing shown for the ordinary case. A badge on every verified row is noise
  // that hides the handful of rows that are not.
  return verified ? undefined : { text: "unverified", intent: "warning" };
}

/* ---------- Memberships ---------- */

function presentMembership(m: AdminUserMembership): OrgMembership {
  return {
    org: m.orgName,
    domain: m.domain,
    orgRole: m.orgRole,
    ...(m.payoutLocked ? { payoutLocked: true } : {}),
  };
}

/**
 * The one-line summary of where this person works.
 *
 * Derived from the memberships already on the row — a restatement, not a new
 * fact — and it degrades honestly: somebody with no workspace gets an em dash
 * rather than "0 workspaces", because they are not a person with zero jobs,
 * they are a guest.
 */
function workspaceSummary(row: AdminUserRow): string {
  const parts: string[] = [];
  for (const m of row.memberships) {
    parts.push(`${m.orgName} (${humanise(m.orgRole)})`);
  }
  if (row.oversight) {
    parts.push(`${row.oversight.governmentBodyCode} oversight`);
  }
  if (row.staffRoles.length > 0) {
    parts.push(`platform staff: ${row.staffRoles.map(humanise).join(", ")}`);
  }
  return parts.length > 0 ? parts.join(" · ") : EMPTY;
}

function presentOversight(
  grant: NonNullable<AdminUserRow["oversight"]>,
): OversightAssignment {
  return {
    id: grant.id,
    role: grant.oversightRole,
    bodyCode: grant.governmentBodyCode,
    // The government's own free-text title. Absent is common — the grant is
    // real without it — so it falls back to the role rather than to a blank
    // that would read as a missing person.
    title: grant.governmentTitle ?? humanise(grant.oversightRole),
    scopeLevel: grant.scopeLevel,
    ...(grant.scopeLabel ? { scopeLabel: grant.scopeLabel } : {}),
  };
}

/**
 * One person in the directory.
 *
 * TWO FIELDS ARE LEFT EMPTY ON PURPOSE, and both would otherwise be the console
 * making something up about a person:
 *
 * - `signIn` stays `[]`. `AdminUserRow` carries no list of authentication
 *   methods — not "email OTP", not "Google" — and a staffer reading that column
 *   would take it as fact when diagnosing why somebody cannot get in. If the
 *   screen needs it, the contract has to carry it.
 * - `nationalIdMasked` and `phoneMasked` are rendered as they arrive. There is
 *   no unmasked variant anywhere in this console, and there must not be one:
 *   the platform lists people, it does not export their documents.
 */
export function presentUserRow(row: AdminUserRow): UserRow {
  const badge = emailBadge(row.emailVerified);
  return {
    // A person with no name yet is a real row — sign-up is email first — so the
    // email stands in rather than leaving a nameless line.
    name: row.name ?? row.email,
    email: row.email,
    ...(badge ? { emailBadge: badge } : {}),
    signIn: [],
    kyc: row.kyc,
    globalRoles: row.globalRoles,
    memberships: row.memberships.map(presentMembership),
    ...(row.staffRoles.length > 0 ? { staffRoles: row.staffRoles } : {}),
    ...(row.oversight ? { oversight: presentOversight(row.oversight) } : {}),
    workspaces: workspaceSummary(row),
    joined: date(row.createdAt),
    actions: userActions(row),
  };
}

/**
 * The affordances offered on a row.
 *
 * `assist-2fa` appears only where there is a second factor to assist with —
 * offering it to somebody who never enrolled is an action that cannot succeed,
 * and a support staffer will spend a call finding that out.
 */
function userActions(row: AdminUserRow): UserRow["actions"] {
  const actions: UserRow["actions"] = ["roles", "signout"];
  if (row.twoFactorEnrolled) actions.push("assist-2fa");
  return actions;
}

/* ---------- Unclaimed stays ---------- */

/**
 * A stay that never got attached to an identity.
 *
 * `identityState` is the whole point of the row, so it drives both the words
 * and the colour: `none` is red because nothing was captured and there is
 * nothing to reissue against; `captured` is amber — something exists, it just
 * was not verified; `verified` is settled and only waiting to be claimed.
 */
const IDENTITY_TONE: Readonly<
  Record<AdminUnclaimedStay["identityState"], "destructive" | undefined>
> = {
  none: "destructive",
  captured: undefined,
  verified: undefined,
};

export function presentUnclaimedStay(stay: AdminUnclaimedStay): UnclaimedStay {
  const tone = IDENTITY_TONE[stay.identityState];
  return {
    ref: stay.reference,
    title: stay.guestName ?? "Guest not named",
    meta: detail(stay.propertyName, `checked out ${date(stay.checkOutAt)}`),
    detail: `identity ${humanise(stay.identityState)}`,
    ...(tone ? { detailTone: tone } : {}),
    action: stayAction(stay),
  };
}

/**
 * Reissue is offered only where there is an identity to reissue a claim to.
 *
 * With `identityState: "none"` there is no captured identity on the stay, so a
 * claim link has nowhere to go; that row needs a person, not a button.
 */
function stayAction(stay: AdminUnclaimedStay): UnclaimedStay["action"] {
  if (stay.identityState === "none") {
    return {
      kind: "stub",
      label: "Open stay",
      stub: `Stay ${stay.reference} — no identity captured at check-in`,
    };
  }
  return { kind: "reissue" };
}
