import type { TeamRolesMember, TeamRolesRole } from "@injishi/data/fixtures/owner";
import type { TransferEligible } from "@/server/ownership-transfer";

/**
 * Business ownership, in plain words, and who could receive it. Display only: the API alone decides who may ask
 * (the owner's own membership), who may receive (an active, identity-verified member) and when it happens (when that
 * member accepts). Nothing here grants or refuses anything.
 */

/** What the owner of the business can do, for someone who runs a bar or a restaurant. */
export const OWNER_PRIVILEGES: readonly { title: string; text: string }[] = [
  { title: "Full access", text: "Every screen and every permission, in every branch of the business." },
  { title: "Plan and billing", text: "The Injishi plan, the invoices and how the business pays for them." },
  { title: "The team", text: "Manages everyone's access and permissions, managers included." },
  {
    title: "The final say",
    text: "Nobody can remove the owner. Only the owner can hand the business to someone else.",
  },
];

/** What happens, in order, when ownership is transferred. */
export const TRANSFER_STEPS: readonly string[] = [
  "You choose a team member and the role you keep. Nothing changes yet.",
  "They receive an email and accept on their own screen, after confirming it is them with a code.",
  "The moment they accept, they become the owner and you take the role you chose. You can cancel until then.",
];

/** What a transfer never touches. */
export const TRANSFER_KEEPS =
  "Sales, bills, payments, shifts, staff, menus and history all stay exactly as they are. Only who owns the business changes.";

/** A team member who can receive ownership: the API's answer, with what the team list knows about them. */
export interface OwnershipCandidate {
  userId: string;
  name: string;
  initials: string;
  contact: string;
  roleName: string;
  scope: string;
  avatarTone: TeamRolesMember["avatarTone"] | null;
}

/** A team member who cannot receive ownership yet, and why, in words the owner can act on. */
export interface NotYetCandidate {
  userId: string;
  name: string;
  reason: string;
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";

/**
 * The people the owner may choose: exactly the API's eligible list (active and identity-verified), in its order,
 * completed with the team list's email, role and branches when the member is on it (a member's id is their user id).
 */
export function transferCandidates(
  eligible: readonly TransferEligible[],
  members: readonly TeamRolesMember[],
  roleName: (id: TeamRolesMember["role"]) => string,
): OwnershipCandidate[] {
  return eligible.map((e) => {
    const m = members.find((x) => x.id === e.userId);
    return {
      userId: e.userId,
      name: e.name,
      initials: m?.initials ?? initialsOf(e.name),
      contact: m?.contact ?? "",
      roleName: m ? roleName(m.role) : e.roleLabel,
      scope: m?.scope ?? "",
      avatarTone: m?.avatarTone ?? null,
    };
  });
}

/**
 * The other people on the team, and why ownership cannot go to them yet. Revoked members and the owner are left
 * out. The API stays the judge: this only explains what its eligible list already says.
 */
export function notYetCandidates(
  eligible: readonly TransferEligible[],
  members: readonly TeamRolesMember[],
): NotYetCandidate[] {
  const ok = new Set(eligible.map((e) => e.userId));
  const out: NotYetCandidate[] = [];
  for (const m of members) {
    if (ok.has(m.id) || m.role === "owner" || m.status === "revoked") continue;
    const reason =
      m.status === "invited" || m.status === "pending"
        ? "Has not accepted the invitation yet."
        : "Has not completed identity verification yet (an identity document is needed). They do this from their own account.";
    out.push({ userId: m.id, name: m.name, reason });
  }
  return out;
}

/** The roles the owner may keep after the transfer, each with what it cannot do. */
export function afterRoleChoices(
  roles: readonly TeamRolesRole[],
): { id: TeamRolesRole["id"]; name: string; cannot: string }[] {
  return roles
    .filter((r) => r.invitable && !r.proposed && r.id !== "staff" && r.id !== "owner")
    .map((r) => ({ id: r.id, name: r.name, cannot: r.cannot }));
}

/** "6 days left", "1 day left", "less than a day left" (whole days, rounded down). */
export function timeLeft(expiresAt: string, now: number): string {
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return "expired";
  const days = Math.floor(ms / 86_400_000);
  if (days < 1) return "less than a day left";
  return `${days} day${days === 1 ? "" : "s"} left`;
}

/** A date as the team reads it in Kigali: "Fri 27 Nov". */
export function kigaliDay(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Kigali",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}
