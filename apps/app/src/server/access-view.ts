/**
 * A staff file's login in the screen's words (HR onboarding): the API's access shapes, and how
 * the new employee form, the file's Access tab and the owner's Team screen word them. Shared by
 * the people source and the access writes, so both say "Front office / Receptionist · every
 * branch" the same way.
 */
import type {
  AccessOptionsView,
  AccessRequestView,
  AccessRoleId,
  EmployeeAccessView,
} from "@injishi/data/fixtures/people";

// ── The API's shapes (`@injishi/contracts` staff-access) ─────────────────────────────────────────

export interface ApiAccessOptions {
  roles: {
    orgRole: AccessRoleId;
    label: string;
    summary: string;
    areas: { area: string; label: string; permissions: { permission: string; label: string }[] }[];
    needsOwner: boolean;
  }[];
  branches: { id: string; name: string }[];
  canGrant: boolean;
  grantsEveryRole: boolean;
}

export interface ApiAccessRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  jobTitle: string | null;
  email: string;
  orgRole: string;
  branchIds: string[] | null;
  status: "pending" | "approved" | "declined" | "cancelled";
  note: string | null;
  requestedAt: string;
  requestedByName: string | null;
  decidedAt: string | null;
  decidedByName: string | null;
  decisionNote: string | null;
}

export interface ApiEmployeeAccess extends ApiAccessOptions {
  employeeId: string;
  state: EmployeeAccessView["state"];
  member: { email: string | null; orgRole: string; branchIds: string[] | null; lastActiveAt: string | null } | null;
  invitation: {
    id: string;
    email: string;
    orgRole: string;
    branchIds: string[] | null;
    sentAt: string;
    expiresAt: string;
  } | null;
  request: ApiAccessRequest | null;
}

// ── Words ───────────────────────────────────────────────────────────────────────────────────────

export const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  receptionist: "Front office / Receptionist",
  finance: "Finance",
  hr: "HR",
  housekeeper: "Housekeeper",
};

const roleWords = (role: string) => ROLE_LABEL[role] ?? role;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "18 Oct", in Kigali. */
function shortDay(iso: string): string {
  const d = new Date(Date.parse(iso) + 2 * 3_600_000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "Every branch", or the names of the ones a login covers. */
function branchWords(ids: string[] | null, names: ReadonlyMap<string, string>): string {
  if (!ids) return "Every branch";
  const list = ids.map((id) => names.get(id) ?? "A retired branch");
  return list.length ? list.join(", ") : "No branch";
}

/** "Active 2 h ago", "Active 3 days ago", "Never signed in". */
function lastActiveWords(iso: string | null): string {
  if (!iso) return "Never signed in";
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (minutes < 60) return minutes <= 1 ? "Active just now" : `Active ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Active ${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "Active yesterday" : `Active ${days} days ago`;
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

// ── Views ───────────────────────────────────────────────────────────────────────────────────────

export function toOptionsView(o: ApiAccessOptions): AccessOptionsView {
  return {
    canGrant: o.canGrant,
    grantsEveryRole: o.grantsEveryRole,
    branches: o.branches,
    roles: o.roles.map((r) => ({
      id: r.orgRole,
      label: r.label,
      summary: r.summary,
      needsOwner: r.needsOwner,
      areas: r.areas.map((a) => ({ label: a.label, permissions: a.permissions.map((p) => p.label) })),
    })),
  };
}

export function toAccessView(a: ApiEmployeeAccess): EmployeeAccessView {
  const names = new Map(a.branches.map((b) => [b.id, b.name]));
  return {
    ...toOptionsView(a),
    employeeId: a.employeeId,
    state: a.state,
    member: a.member
      ? {
          email: a.member.email,
          role: roleWords(a.member.orgRole),
          branches: branchWords(a.member.branchIds, names),
          lastActive: lastActiveWords(a.member.lastActiveAt),
        }
      : null,
    invitation: a.invitation
      ? {
          email: a.invitation.email,
          role: roleWords(a.invitation.orgRole),
          branches: branchWords(a.invitation.branchIds, names),
          sent: shortDay(a.invitation.sentAt),
          expires: shortDay(a.invitation.expiresAt),
        }
      : null,
    request: a.request
      ? {
          status: a.request.status,
          email: a.request.email,
          role: roleWords(a.request.orgRole),
          branches: branchWords(a.request.branchIds, names),
          requested: `${a.request.requestedByName ?? "HR"} · ${shortDay(a.request.requestedAt)}`,
          decided: a.request.decidedAt
            ? `${a.request.decidedByName ?? "The owner"} · ${shortDay(a.request.decidedAt)}`
            : null,
          decisionNote: a.request.decisionNote,
        }
      : null,
  };
}

/** A request as the owner reads it on Team and roles. */
export function toRequestView(r: ApiAccessRequest, names: ReadonlyMap<string, string>): AccessRequestView {
  // A front-line login HR sent itself is "sent", never "approved": nobody but HR decided it.
  const sentByHr = r.status === "approved" && r.decidedByName !== null && r.decidedByName === r.requestedByName;
  const when = r.decidedAt ? ` · ${shortDay(r.decidedAt)}` : "";
  const outcome =
    r.status === "approved"
      ? sentByHr
        ? `Sent by ${r.decidedByName}${when}`
        : `Approved by ${r.decidedByName ?? "the owner"}${when}`
      : r.status === "declined"
        ? `Declined${r.decisionNote ? `: ${r.decisionNote}` : ""}`
        : r.status === "cancelled"
          ? "Withdrawn by HR"
          : null;
  return {
    id: r.id,
    employeeId: r.employeeId,
    name: r.employeeName,
    initials: initialsOf(r.employeeName),
    job: `${r.jobTitle ?? "No position"} · ${r.employeeNumber}`,
    email: r.email,
    role: roleWords(r.orgRole),
    branches: branchWords(r.branchIds, names),
    asked: `Asked by ${r.requestedByName ?? "HR"} · ${shortDay(r.requestedAt)}`,
    note: r.note,
    status: r.status,
    outcome,
  };
}
