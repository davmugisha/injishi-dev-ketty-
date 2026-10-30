/**
 * Live sources for the owner area: API responses presented as the owner fixture document types.
 *
 * The owner holds two business workspaces (a hotel company and a residence company). Screens that list
 * the whole business (Team, Policies, Licences) read every business workspace the person holds the
 * route's permission in; screens about nights and rates (Reports) read the hospitality one.
 */
import type {
  ComplianceLicence,
  ComplianceMembership,
  ReportsKpi,
  ReportsMeasureId,
  ReportsNumberFormat,
  ReportsProperty,
  ReportsPropertyId,
  ReportsSavedView,
  ReportsTab,
  SettingsPoliciesProperty,
  TeamRolesInviteDraft,
  TeamRolesMember,
  TeamRolesMemberStatus,
  TeamRolesPermissionArea,
  TeamRolesRole,
  TeamRolesRoleId,
  TeamRolesScope,
  Tone,
} from "@injishi/data/fixtures/owner";
import type { RequestOptions } from "../api";
import type { Workspace } from "../auth";
import { clock, dayMonth, dayMonthYear, kigaliDate } from "../format";
import { defineSources, type SourceContext } from "./types";

// ── API shapes (as @injishi/contracts defines them) ─────────────────────────────────────────────────────

type OrgRole = "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper";

/** GET /api/v1/inventory/properties (OperatorPropertySummary, the fields read here). */
export interface ApiProperty {
  id: string;
  name: string;
  address: { districtName: string | null; sectorName: string | null };
  sellableRoomCount: number;
  isHeadOffice: boolean;
  branchCode: string | null;
  archivedAt: string | null;
}

/** GET /api/v1/ops/team (OperatorTeamMember). */
interface ApiMember {
  userId: string;
  name: string | null;
  email: string | null;
  orgRole: OrgRole;
  status: string;
  joinedAt: string;
  branchIds: string[] | null;
  lastActiveAt: string | null;
  removedAt: string | null;
  identityVerified: boolean;
}

/** GET /api/v1/ops/team/invitations (OperatorStaffInvitation). */
interface ApiInvitation {
  id: string;
  email: string;
  orgRole: OrgRole;
  status: "sent" | "accepted" | "revoked" | "expired";
  expiresAt: string;
  createdAt: string;
  branchIds: string[] | null;
  name: string | null;
}

/** GET /api/v1/ops/roles (OperatorRoleList). */
interface ApiRoles {
  roles: {
    orgRole: OrgRole;
    label: string;
    customisable: boolean;
    basePermissions: string[];
    permissions: string[];
    lockedPermissions: string[];
    memberCount: number;
  }[];
  areas: { area: string; label: string; permissions: { permission: string; label: string }[] }[];
}

/** GET /api/v1/ops/reports/performance (OperatorPerformance). */
interface ApiPerformanceWindow {
  from: string;
  to: string;
  branches: {
    propertyId: string;
    name: string;
    branchCode: string | null;
    availableNights: number;
    soldNights: number;
    roomRevenueRwf: number;
  }[];
}
interface ApiPerformance extends ApiPerformanceWindow {
  lastYear: ApiPerformanceWindow;
}

/** GET /api/v1/ops/list-views?listKey=owner.reports (SavedViewList). */
interface ApiSavedView {
  id: string;
  name: string;
  isDefault: boolean;
  mine: boolean;
  updatedAt: string;
  config: { filters: { field: string; op: string; value?: unknown }[] };
}

/** GET /api/v1/ops/certificates (OperatorCertificateList). */
interface ApiCertificates {
  legalName: string;
  tin: string | null;
  chamberOfTourismMember: boolean;
  certificates: {
    id: string;
    kind:
      | "rdb_grade"
      | "tourism_license"
      | "tax_clearance"
      | "fire_safety"
      | "health_inspection"
      | "other"
      | "rdb_certificate"
      | "psf_certificate"
      | "land_title"
      | "franchise_agreement";
    kindOther: string | null;
    propertyId: string | null;
    propertyName: string | null;
    certificateNumber: string | null;
    issuedBy: string | null;
    issuedOn: string | null;
    expiresOn: string | null;
    status: "requested" | "on_file";
    followUp: string | null;
    fileName: string | null;
    verifiedAt: string | null;
    createdAt: string;
  }[];
}

// ── Shared reads ──────────────────────────────────────────────────────────────────────────────────────

/** Calls scoped to one business workspace the person holds (WorkspaceGuard reads `x-workspace-id`). */
export function inWorkspace(ctx: SourceContext, ws: Workspace) {
  const with_ = (o?: Omit<RequestOptions, "method" | "body" | "workspaceId">) => ({
    ...o,
    workspaceId: ws.workspaceId,
  });
  return {
    get: <T>(path: string, o?: Omit<RequestOptions, "method" | "body" | "workspaceId">) =>
      ctx.api.get<T>(path, with_(o)),
  };
}

/** The person's business workspaces whose grant carries this permission, hospitality first. */
export function businessesWith(ctx: SourceContext, permission: string): Workspace[] {
  const order = (w: Workspace) => (w.domain === "hospitality" ? 0 : w.domain === "residence" ? 1 : 2);
  return (ctx.account?.workspaces ?? [])
    .filter((w) => w.kind === "business" && w.permissions.includes(permission))
    .sort((a, b) => order(a) - order(b));
}

/** Every live branch of a workspace, head office first. */
export async function propertiesOf(ctx: SourceContext, ws: Workspace): Promise<ApiProperty[]> {
  const { properties } = await inWorkspace(ctx, ws).get<{ properties: ApiProperty[] }>("/api/v1/inventory/properties");
  return properties
    .filter((p) => !p.archivedAt)
    .sort((a, b) => Number(b.isHeadOffice) - Number(a.isHeadOffice) || a.name.localeCompare(b.name));
}

/** The id a screen uses for a branch: its code in lower case ("isg"), else its uuid. */
export function branchKey(p: Pick<ApiProperty, "id" | "branchCode">): string {
  return p.branchCode ? p.branchCode.toLowerCase() : p.id;
}

/**
 * Who a business screen is about, for its eyebrow: the business or businesses the person works for, as the
 * API names them ("Isangano Hotels Ltd", or both of an owner's companies). Never a prototype's group name.
 */
export function businessNames(
  ctx: SourceContext,
  only: { domain?: "hospitality" | "residence"; permission?: string } = {},
): string {
  const order = (w: Workspace) => (w.domain === "hospitality" ? 0 : w.domain === "residence" ? 1 : 2);
  const names = (ctx.account?.workspaces ?? [])
    .filter(
      (w) =>
        w.kind === "business" &&
        (!only.domain || w.domain === only.domain) &&
        (!only.permission || w.permissions.includes(only.permission)),
    )
    .sort((a, b) => order(a) - order(b))
    .map((w) => w.orgName?.trim() || w.label)
    .filter(Boolean);
  const unique = [...new Set(names)];
  return unique.length > 0 ? unique.join(" and ") : "Your business";
}

/**
 * The Team screen's scope picker, from live data: each business the person manages the team of (a heading),
 * and its live branches (the rows a grant names, keyed as members' scopes are). Outlets are not offered:
 * membership scope is per branch (ADR-054), and another merchant keeps its own team.
 */
export async function teamScopes(ctx: SourceContext): Promise<TeamRolesScope[]> {
  const reads = await Promise.all(
    businessesWith(ctx, "team.manage").map(async (ws) => ({ ws, properties: await propertiesOf(ctx, ws) })),
  );
  return reads.flatMap(({ ws, properties }): TeamRolesScope[] => {
    const unit = ws.domain === "residence" ? "units" : "rooms";
    return [
      {
        id: `entity:${ws.orgId ?? ws.workspaceId}`,
        kind: "entity",
        label: ws.orgName?.trim() || ws.label,
        description: `Legal entity · ${properties.length} ${properties.length === 1 ? "property" : "properties"} · keeps its own team`,
        level: 0,
      },
      ...properties.map(
        (p): TeamRolesScope => ({
          id: branchKey(p),
          kind: "property",
          label: p.name,
          description: [p.address.districtName, `${p.sellableRoomCount} ${unit}`, p.isHeadOffice ? "head office" : null]
            .filter(Boolean)
            .join(" · "),
          level: 1,
        }),
      ),
    ];
  });
}

/**
 * Which members have an employee file, read from People itself (`GET /ops/employees`, `people.view`): the
 * emails on active files of every business the person manages the team of. Null when People cannot be read
 * here, so the screen says it did not look rather than asserting a link.
 */
export async function employeeFileEmails(ctx: SourceContext): Promise<string[] | null> {
  const businesses = businessesWith(ctx, "team.manage");
  if (businesses.length === 0 || businesses.some((ws) => !ws.permissions.includes("people.view"))) return null;
  const lists = await Promise.all(
    businesses.map(async (ws) => {
      const out: { email: string | null; status: string }[] = [];
      for (let page = 1; page < 50; page++) {
        const body = await inWorkspace(ctx, ws).get<{
          items: { email: string | null; status: string }[];
          total: number;
        }>("/api/v1/ops/employees", { query: { size: "100", page: String(page) } });
        out.push(...body.items);
        if (out.length >= body.total || body.items.length === 0) break;
      }
      return out;
    }),
  );
  return [
    ...new Set(
      lists
        .flat()
        .filter((e) => e.status === "active" && e.email)
        .map((e) => (e.email as string).trim().toLowerCase()),
    ),
  ];
}

/** "Didier Mugenzi" → "DM". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase() || "?";
}

/** "999100001" → "999 100 001". */
export function spacedTin(tin: string): string {
  return tin.replace(/\D/g, "").replace(/(\d{3})(?=\d)/g, "$1 ");
}

/** Whole days from Kigali today to a date (negative when it has passed). */
export function daysUntil(ctx: SourceContext, iso: string): number {
  return Math.round((Date.parse(`${iso}T12:00:00Z`) - ctx.today.noon.getTime()) / 86_400_000);
}

// ── Team and roles ────────────────────────────────────────────────────────────────────────────────────

/** The platform's org roles as the screen's role ids. `store` has no platform role yet. */
const ROLE_ID: Record<OrgRole, TeamRolesRoleId> = {
  owner: "owner",
  manager: "manager",
  receptionist: "frontdesk",
  finance: "finance",
  hr: "hr",
  housekeeper: "staff",
};
export const ORG_ROLE_OF: Partial<Record<TeamRolesRoleId, OrgRole>> = Object.fromEntries(
  Object.entries(ROLE_ID).map(([org, id]) => [id, org as OrgRole]),
);

const ROLE_ORDER: TeamRolesRoleId[] = ["owner", "manager", "finance", "hr", "frontdesk", "staff", "store"];
const STATUS_ORDER: TeamRolesMemberStatus[] = ["active", "pending", "invited", "revoked"];

/** "Now", "Today 09:58", "Yesterday 22:40", "11 Oct 16:20". */
function lastActive(ctx: SourceContext, iso: string | null): string {
  if (!iso) return "Never signed in";
  if (ctx.now.getTime() - Date.parse(iso) < 5 * 60_000) return "Now";
  const day = kigaliDate(iso);
  const yesterday = new Date(ctx.today.noon.getTime() - 86_400_000).toISOString().slice(0, 10);
  const when = day === ctx.today.iso ? "Today" : day === yesterday ? "Yesterday" : dayMonth(day);
  return `${when} ${clock(iso)}`;
}

interface Branch {
  key: string;
  name: string;
}

/**
 * Members of every business the person manages the team of (`team.manage`): the sign-ins, the open
 * invitations and the people whose access was removed. One person who works in both businesses (the
 * owner) is one row covering both.
 */
async function teamMembers(ctx: SourceContext): Promise<TeamRolesMember[]> {
  const businesses = businessesWith(ctx, "team.manage");
  const reads = await Promise.all(
    businesses.map(async (ws) => {
      const api = inWorkspace(ctx, ws);
      const [{ members }, { invitations }, properties] = await Promise.all([
        api.get<{ members: ApiMember[] }>("/api/v1/ops/team"),
        api.get<{ invitations: ApiInvitation[] }>("/api/v1/ops/team/invitations"),
        propertiesOf(ctx, ws),
      ]);
      return {
        ws,
        members,
        invitations,
        branches: properties.map((p) => ({ id: p.id, key: branchKey(p), name: p.name })),
      };
    }),
  );
  const everyBranch = reads.flatMap((r) => r.branches);
  const scopeOf = (ids: string[], all: boolean, orgName: string | null): { scope: string; scopeIds: string[] } => {
    if (ids.length === everyBranch.length) return { scope: "All properties", scopeIds: ids };
    if (all) return { scope: `All of ${orgName ?? "the business"}`, scopeIds: ids };
    const names = everyBranch.filter((b) => ids.includes(b.key)).map((b: Branch) => b.name);
    return { scope: names.join(", "), scopeIds: ids };
  };

  const byPerson = new Map<string, TeamRolesMember & { keys: Set<string>; orgNames: string[]; every: boolean }>();
  const invited: TeamRolesMember[] = [];
  for (const { ws, members, invitations, branches } of reads) {
    const keysFor = (ids: string[] | null) =>
      ids === null ? branches.map((b) => b.key) : branches.filter((b) => ids.includes(b.id)).map((b) => b.key);
    for (const m of members) {
      const status: TeamRolesMemberStatus = m.status === "active" && !m.removedAt ? "active" : "revoked";
      const name = m.name?.trim() || m.email?.split("@")[0] || "Unnamed member";
      const prior = byPerson.get(m.userId);
      if (prior && prior.status === "active" && status === "active") {
        // Active in two businesses: keep the stronger role, cover both.
        for (const k of keysFor(m.branchIds)) prior.keys.add(k);
        prior.orgNames.push(ws.orgName ?? "");
        prior.every = prior.every && m.branchIds === null;
        if (ROLE_ORDER.indexOf(ROLE_ID[m.orgRole]) < ROLE_ORDER.indexOf(prior.role)) prior.role = ROLE_ID[m.orgRole];
        continue;
      }
      if (prior && prior.status === "active") continue;
      byPerson.set(m.userId, {
        id: m.userId,
        initials: initials(name),
        name,
        contact: m.email ?? "",
        role: ROLE_ID[m.orgRole],
        scope: "",
        scopeIds: [],
        status,
        lastActive:
          status === "revoked"
            ? `Access removed ${m.removedAt ? dayMonth(m.removedAt) : ""}`.trim()
            : lastActive(ctx, m.lastActiveAt),
        signIn: status === "active" ? "Email code" : "—",
        avatarTone: m.orgRole === "owner" ? "accent" : "default",
        identityVerified: m.identityVerified,
        keys: new Set(keysFor(m.branchIds)),
        orgNames: [ws.orgName ?? ""],
        every: m.branchIds === null,
      });
    }
    for (const i of invitations) {
      if (i.status === "accepted") continue;
      const open = i.status === "sent";
      // A cancelled or lapsed invitation is listed for a month, so the owner sees what became of it, then
      // drops off the screen (it stays on the API's record).
      if (!open && ctx.now.getTime() - Date.parse(i.expiresAt) > 30 * 86_400_000) continue;
      const name = i.name?.trim() || i.email.split("@")[0];
      const keys = keysFor(i.branchIds);
      invited.push({
        // An invitation is not a person yet: its id says so, and the actions read it back.
        id: `invite:${i.id}`,
        initials: initials(name),
        name,
        contact: i.email,
        role: ROLE_ID[i.orgRole],
        ...scopeOf(keys, i.branchIds === null, ws.orgName),
        status: open ? "invited" : "revoked",
        lastActive: open
          ? `Invited ${dayMonth(i.createdAt)} · link expires ${dayMonth(i.expiresAt)}`
          : i.status === "expired"
            ? `Invite expired ${dayMonth(i.expiresAt)} · never accepted`
            : `Invite cancelled · sent ${dayMonth(i.createdAt)}`,
        signIn: "—",
        avatarTone: open ? "accent" : "default",
        identityVerified: false,
      });
    }
  }
  const people: TeamRolesMember[] = [...byPerson.values()].map(({ keys, orgNames, every, ...m }) => {
    const ids = [...keys];
    return { ...m, ...scopeOf(ids, every && orgNames.length === 1, orgNames[0] ?? null) };
  });
  return [...people, ...invited].sort(
    (a, b) =>
      STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
      ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) ||
      a.name.localeCompare(b.name),
  );
}

/** The workspace the role presets are read from and saved to: the first business the person manages. */
function rolesWorkspace(ctx: SourceContext): Workspace | null {
  return businessesWith(ctx, "team.manage")[0] ?? null;
}

async function roleList(ctx: SourceContext): Promise<ApiRoles | null> {
  const ws = rolesWorkspace(ctx);
  return ws ? inWorkspace(ctx, ws).get<ApiRoles>("/api/v1/ops/roles") : null;
}

/** What a role cannot do, read off the permissions it lacks, most consequential first. */
const NOTABLE: { permission: string; words: string }[] = [
  { permission: "team.manage", words: "manage the team" },
  { permission: "money.view", words: "see the money" },
  { permission: "payroll.run", words: "confirm the pay run" },
  { permission: "people.manage", words: "open staff files" },
  { permission: "listing.manage", words: "change rates and listings" },
  { permission: "reservation.approve", words: "take reservations" },
  { permission: "message.send", words: "reply to guests" },
];

function cannot(permissions: string[]): string {
  const missing = NOTABLE.filter((n) => !permissions.includes(n.permission)).map((n) => n.words);
  if (missing.length === 0) return "";
  const list = missing.slice(0, 3);
  const words = list.length > 1 ? `${list.slice(0, -1).join(", ")} or ${list.at(-1)}` : list[0];
  return `Cannot ${words}.`;
}

/** The storekeeper the interface draws has no platform role yet (world.mjs ROLE_GAPS): shown, not grantable. */
const STOREKEEPER: TeamRolesRole = {
  id: "store",
  name: "Storekeeper",
  proposed: true,
  beingDefined: true,
  inMatrix: false,
  invitable: false,
  permissions: [],
  extraPermissions: [],
  cannot: "Not a platform role yet: stock and purchasing are not built, so the preset is still being defined.",
};

// ── Reports ──────────────────────────────────────────────────────────────────────────────────────────

const RWF: ReportsNumberFormat = { style: "currency", currency: "RWF" };
const RWF_MILLIONS: ReportsNumberFormat = {
  style: "currency",
  currency: "RWF",
  notation: "compact",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
};

/** Month to date, tonight included, against the same dates a year earlier. */
async function monthToDate(ctx: SourceContext): Promise<ApiPerformance | null> {
  const ws = businessesWith(ctx, "money.view").find((w) => w.domain === "hospitality");
  if (!ws) return null;
  const from = `${ctx.today.iso.slice(0, 8)}01`;
  const to = new Date(ctx.today.noon.getTime() + 86_400_000).toISOString().slice(0, 10);
  return inWorkspace(ctx, ws).get<ApiPerformance>("/api/v1/ops/reports/performance", { query: { from, to } });
}

interface Totals {
  available: number;
  sold: number;
  revenue: number;
}

function totalsOf(w: ApiPerformanceWindow, key: string | null): Totals {
  const rows =
    key === null
      ? w.branches
      : w.branches.filter((b) => branchKey({ id: b.propertyId, branchCode: b.branchCode }) === key);
  return {
    available: rows.reduce((s, b) => s + b.availableNights, 0),
    sold: rows.reduce((s, b) => s + b.soldNights, 0),
    revenue: rows.reduce((s, b) => s + b.roomRevenueRwf, 0),
  };
}

const ratio = (a: number, b: number) => (b > 0 ? a / b : 0);

/** "4.2%" and its direction: the change against last year, or "new" when last year had none. */
function pctChange(now: number, before: number): { trend: string; trendDirection: "up" | "down" } {
  if (before === 0) return { trend: now === 0 ? "0%" : "new", trendDirection: "up" };
  const change = ((now - before) / before) * 100;
  return { trend: `${Math.abs(change).toFixed(1)}%`, trendDirection: change < 0 ? "down" : "up" };
}

function kpisFor(id: ReportsPropertyId, now: Totals, before: Totals): ReportsKpi[] {
  const occ = ratio(now.sold, now.available);
  const occBefore = ratio(before.sold, before.available);
  const pts = Math.round((occ - occBefore) * 100);
  const adr = Math.round(ratio(now.revenue, now.sold));
  const revpar = Math.round(ratio(now.revenue, now.available));
  const base = (measure: ReportsMeasureId) => ({ id: `${id}-${measure}`, property: id, measure });
  return [
    {
      ...base("occ"),
      label: "Occupancy",
      value: Math.round(occ * 100) / 100,
      format: { style: "percent" },
      trend: `${Math.abs(pts)} ${Math.abs(pts) === 1 ? "pt" : "pts"}`,
      trendDirection: pts < 0 ? "down" : "up",
      foot: `${now.sold} of ${now.available} room nights`,
      board: "Reservations",
    },
    {
      ...base("adr"),
      label: "ADR",
      value: adr,
      format: RWF,
      ...pctChange(adr, Math.round(ratio(before.revenue, before.sold))),
      foot: "Room revenue per night sold",
      board: "Reservations",
    },
    {
      ...base("revpar"),
      label: "RevPAR",
      value: revpar,
      format: RWF,
      ...pctChange(revpar, Math.round(ratio(before.revenue, before.available))),
      foot: "Room revenue per night available",
      board: "Reservations",
    },
    {
      ...base("nights"),
      label: "Room nights sold",
      value: now.sold,
      format: { style: "decimal" },
      trend: String(Math.abs(now.sold - before.sold)),
      trendDirection: now.sold < before.sold ? "down" : "up",
      foot: "Open the stays",
      board: "Reservations",
    },
    {
      ...base("rev"),
      label: "Room revenue",
      value: now.revenue,
      format: RWF_MILLIONS,
      ...pctChange(now.revenue, before.revenue),
      foot: "Posted room charges",
      board: "Folios",
    },
  ];
}

const TABS: ReportsTab[] = ["perf", "fin", "res"];

// ── Licences ─────────────────────────────────────────────────────────────────────────────────────────

/** A document is "expiring" this many days before its expiry: time to file the renewal. */
export const EXPIRING_WITHIN_DAYS = 45;

const KIND_NAME: Record<ApiCertificates["certificates"][number]["kind"], string> = {
  tourism_license: "Tourism operating licence",
  rdb_grade: "Accommodation class",
  tax_clearance: "Tax clearance",
  fire_safety: "Fire safety certificate",
  health_inspection: "Health inspection",
  other: "Other document",
  rdb_certificate: "RDB certificate",
  psf_certificate: "PSF certificate",
  land_title: "Land title",
  franchise_agreement: "Franchise agreement",
};

/** Every business's documents, each with the business it belongs to. */
export async function certificatesOf(ctx: SourceContext): Promise<ApiCertificates[]> {
  const seen = new Set<string>();
  const businesses = [...businessesWith(ctx, "listing.manage"), ...businessesWith(ctx, "money.view")].filter((w) => {
    if (seen.has(w.workspaceId)) return false;
    seen.add(w.workspaceId);
    return true;
  });
  return Promise.all(businesses.map((ws) => inWorkspace(ctx, ws).get<ApiCertificates>("/api/v1/ops/certificates")));
}

export function licenceDocs(ctx: SourceContext, lists: ApiCertificates[]): ComplianceLicence[] {
  return lists.flatMap((list) =>
    list.certificates.map((c): ComplianceLicence => {
      const name = c.kindOther ?? KIND_NAME[c.kind];
      const isGrade = c.kind === "rdb_grade" || /grade/i.test(c.kindOther ?? "");
      const left = c.expiresOn ? daysUntil(ctx, c.expiresOn) : null;
      const follow = c.followUp ? ` · ${c.followUp}` : "";
      let status: string;
      let tone: Tone;
      let leftText: string;
      if (c.status === "requested") {
        status = "Requested";
        tone = "default";
        leftText = `Requested ${dayMonth(c.createdAt)}`;
      } else if (isGrade) {
        status = c.followUp ? "Follow-up" : "Current";
        tone = c.followUp ? "warning" : "success";
        leftText = c.issuedOn ? `Graded ${dayMonthYear(c.issuedOn)}` : "Grade on file";
      } else if (left === null) {
        status = c.followUp ? "Follow-up" : "On file";
        tone = c.followUp ? "warning" : "default";
        leftText = c.issuedOn ? `Registered ${c.issuedOn.slice(0, 4)}` : "On file";
      } else if (left < 0) {
        status = "Expired";
        tone = "danger";
        leftText = `Expired ${-left} days ago${follow}`;
      } else {
        status = left <= EXPIRING_WITHIN_DAYS ? "Expiring" : c.followUp ? "Follow-up" : "Current";
        tone = status === "Current" ? "success" : "warning";
        leftText = `${left} days${follow}`;
      }
      const monthYear = (iso: string) => dayMonthYear(iso).split(" ").slice(1).join(" ");
      return {
        id: c.id,
        name,
        holder: c.propertyName ?? `${list.legalName}${list.tin ? ` · TIN ${spacedTin(list.tin)}` : ""}`,
        issuer: c.issuedBy ?? "—",
        ref: c.certificateNumber ?? "—",
        expiry:
          c.status === "requested" || !c.expiresOn
            ? c.status === "requested"
              ? "—"
              : "No expiry"
            : isGrade
              ? `Review ${monthYear(c.expiresOn)}`
              : dayMonthYear(c.expiresOn),
        left: leftText,
        file: c.fileName ?? "No copy on file",
        status,
        tone,
      };
    }),
  );
}

/** GET /api/v1/orgs/:orgId/psf-membership (PsfMembershipOverview, the fields read here). */
interface ApiPsf {
  current: { membershipNumber: string; tierName: string | null; expiresOn: string | null } | null;
  open: { status: string; requestedTierName: string; submittedAt: string; stage: string } | null;
  history: { status: string; decidedAt: string | null }[];
}

/** The PSF membership of the person's hotel business, or null when they hold none they may read. */
export async function psfOf(ctx: SourceContext): Promise<ApiPsf | null> {
  const ws = businessesWith(ctx, "team.manage").find((w) => w.domain === "hospitality");
  return ws?.orgId ? ctx.api.get<ApiPsf>(`/api/v1/orgs/${ws.orgId}/psf-membership`) : null;
}

/** PSF from its own application record; the Chamber from what the business declared at registration. */
function memberships(psf: ApiPsf | null, hotel: ApiCertificates | undefined): ComplianceMembership[] {
  const entity = hotel?.legalName ?? "The business";
  const psfRow: ComplianceMembership = psf?.current
    ? {
        id: "psf",
        icon: "Briefcase",
        name: "Private Sector Federation (PSF)",
        detail: `${entity} · membership ${psf.current.membershipNumber}${psf.current.tierName ? ` · ${psf.current.tierName}` : ""}${psf.current.expiresOn ? ` · renews ${dayMonthYear(psf.current.expiresOn)}` : ""}`,
        status: "Member",
        tone: "success",
        action: "View",
        board: "Compliance",
      }
    : psf?.open
      ? {
          id: "psf",
          icon: "Briefcase",
          name: "Private Sector Federation (PSF)",
          detail: `${entity} · ${psf.open.requestedTierName} · sent ${dayMonth(psf.open.submittedAt)}. The fee is invoiced by PSF only after approval.`,
          status: psf.open.stage === "with_psf" ? "Sent · awaiting PSF decision" : "Sent · waiting for the TIN check",
          tone: "info",
          action: "View",
          board: "Compliance",
        }
      : {
          id: "psf",
          icon: "Briefcase",
          name: "Private Sector Federation (PSF)",
          detail: `${entity} · no application on file${psf?.history[0]?.status === "declined" ? " · the last one was declined" : ""}`,
          status: "Not a member",
          tone: "default",
          action: "Apply",
          board: "Compliance",
        };
  const chamber: ComplianceMembership = hotel?.chamberOfTourismMember
    ? {
        id: "chamber-of-tourism",
        icon: "FileText",
        name: "Rwanda Chamber of Tourism",
        detail: `${entity} declared membership at registration · no certificate on file`,
        status: "Declared member",
        tone: "success",
        action: "View",
        board: "Compliance",
      }
    : {
        id: "chamber-of-tourism",
        icon: "FileText",
        name: "Rwanda Chamber of Tourism",
        detail: `${entity} declared no membership at registration`,
        status: "Not a member",
        tone: "default",
        action: "Continue",
        board: "Compliance",
      };
  return [psfRow, chamber];
}

// ── Sources ──────────────────────────────────────────────────────────────────────────────────────────

export const sources = defineSources({
  "owner.teamRolesMembers": {
    naturalKey: "name",
    list: (ctx): Promise<TeamRolesMember[]> => teamMembers(ctx),
  },

  "owner.teamRolesRoles": {
    naturalKey: "id",
    async list(ctx): Promise<TeamRolesRole[]> {
      const list = await roleList(ctx);
      if (!list) return [];
      const roles = list.roles
        .map(
          (r): TeamRolesRole => ({
            id: ROLE_ID[r.orgRole],
            name: r.label,
            proposed: false,
            beingDefined: false,
            inMatrix: true,
            invitable: r.orgRole !== "owner",
            permissions: r.permissions,
            extraPermissions: [],
            cannot: r.orgRole === "owner" ? "" : cannot(r.permissions),
          }),
        )
        .sort((a, b) => ROLE_ORDER.indexOf(a.id) - ROLE_ORDER.indexOf(b.id));
      return [...roles, STOREKEEPER];
    },
  },

  "owner.teamRolesPermissionAreas": {
    naturalKey: "id",
    async list(ctx): Promise<TeamRolesPermissionArea[]> {
      const list = await roleList(ctx);
      return (list?.areas ?? []).map((a) => ({
        id: a.area,
        label: a.label,
        permissions: a.permissions.map((p) => ({
          key: p.permission,
          description: p.label.charAt(0).toUpperCase() + p.label.slice(1),
        })),
        proposedSplit: [],
        // People and payroll opens first: it is where the owner-only powers sit.
        defaultOpen: a.area === "people",
      }));
    },
  },

  "owner.teamRolesInvite": {
    naturalKey: "id",
    async list(ctx): Promise<TeamRolesInviteDraft[]> {
      // An invitation link lives seven days (one single use, 7 day rule for every org_invitations row,
      // architecture-schema.md; staffInvitationExpiresAt on the API). The API offers no other lifetime,
      // so the form offers none.
      const expires = new Date(ctx.now.getTime() + 7 * 86_400_000);
      const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Kigali", weekday: "short" }).format(expires);
      return [
        {
          id: "draft",
          name: "",
          contact: "",
          role: "frontdesk",
          scope: [],
          expiry: "7d",
          expiries: [
            {
              id: "7d",
              label: "7 days",
              expiresOn: `${weekday} ${dayMonth(expires)}`,
              expiresShort: dayMonth(expires),
            },
          ],
          expiresAt: clock(expires),
          // The step-up code goes by email (POST /me/two-factor/send answers the masked address), never to a
          // phone; a persona's sample phone is no one's.
          verifyPhone: "",
        },
      ];
    },
  },

  "owner.reportsProperties": {
    naturalKey: "id",
    async list(ctx): Promise<ReportsProperty[]> {
      const mtd = await monthToDate(ctx);
      if (!mtd) return [];
      const all = totalsOf(mtd, null);
      const allOcc = ratio(all.sold, all.available);
      const allAdr = ratio(all.revenue, all.sold);
      return [
        { id: "all", label: "All branches", title: "All Branches", occFactor: 1, adrFactor: 1 },
        ...mtd.branches.map((b): ReportsProperty => {
          const key = branchKey({ id: b.propertyId, branchCode: b.branchCode });
          const t = totalsOf(mtd, key);
          const short = b.name.split(/\s+/)[0] ?? b.name;
          // The daily trend is drawn for the whole business; a branch's chart scales it by how this
          // branch has run against the whole this month, which is what these two ratios are.
          return {
            id: key as ReportsPropertyId,
            label: short,
            title: short,
            occFactor: allOcc > 0 ? Math.round((ratio(t.sold, t.available) / allOcc) * 100) / 100 : 1,
            adrFactor: allAdr > 0 ? Math.round((ratio(t.revenue, t.sold) / allAdr) * 100) / 100 : 1,
          };
        }),
      ];
    },
  },

  "owner.reportsKpis": {
    naturalKey: "id",
    async list(ctx): Promise<ReportsKpi[]> {
      const mtd = await monthToDate(ctx);
      if (!mtd) return [];
      const keys = mtd.branches.map((b) => branchKey({ id: b.propertyId, branchCode: b.branchCode }));
      return [
        ...kpisFor("all", totalsOf(mtd, null), totalsOf(mtd.lastYear, null)),
        ...keys.flatMap((k) => kpisFor(k as ReportsPropertyId, totalsOf(mtd, k), totalsOf(mtd.lastYear, k))),
      ];
    },
  },

  "owner.reportsSavedViews": {
    naturalKey: "label",
    async list(ctx): Promise<ReportsSavedView[]> {
      const ws = businessesWith(ctx, "money.view").find((w) => w.domain === "hospitality");
      if (!ws) return [];
      const { views } = await inWorkspace(ctx, ws).get<{ views: ApiSavedView[] }>("/api/v1/ops/list-views", {
        query: { listKey: "owner.reports" },
      });
      const filter = (v: ApiSavedView, field: string) => v.config.filters.find((f) => f.field === field)?.value;
      return views
        .filter((v) => v.mine)
        .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.updatedAt.localeCompare(b.updatedAt))
        .map((v) => {
          const tab = String(filter(v, "tab") ?? "perf") as ReportsTab;
          return {
            id: v.id,
            label: v.name,
            tab: TABS.includes(tab) ? tab : "perf",
            property: String(filter(v, "property") ?? "all") as ReportsPropertyId,
          };
        });
    },
  },

  "owner.settingsPoliciesProperties": {
    naturalKey: "name",
    async list(ctx): Promise<SettingsPoliciesProperty[]> {
      const businesses = businessesWith(ctx, "listing.manage");
      const lists = await Promise.all(businesses.map((ws) => propertiesOf(ctx, ws)));
      return lists.flat().map((p) => ({ id: branchKey(p), name: p.name }));
    },
  },

  "owner.complianceMemberships": {
    naturalKey: "id",
    async list(ctx): Promise<ComplianceMembership[]> {
      const [psf, lists] = await Promise.all([psfOf(ctx), certificatesOf(ctx)]);
      return memberships(psf, lists[0]);
    },
  },

  "owner.complianceLicences": {
    naturalKey: "ref",
    async list(ctx): Promise<ComplianceLicence[]> {
      return licenceDocs(ctx, await certificatesOf(ctx));
    },
  },
});
