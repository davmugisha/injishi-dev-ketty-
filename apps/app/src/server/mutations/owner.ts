/**
 * Writes for the owner area, through the API. Plain functions: the server actions in features/owner and
 * the verify scripts both call them. Each one names the business it acts in (`x-workspace-id`); the API's
 * WorkspaceGuard decides whether the person may, and its refusal travels back unchanged.
 */
import type { ReportsPropertyId, ReportsTab, TeamRolesRoleId } from "@injishi/data/fixtures/owner";
import type { Workspace } from "../auth";
import { branchKey, ORG_ROLE_OF, propertiesOf } from "../sources/owner";
import type { SourceContext } from "../sources/types";

/**
 * Every business workspace the person holds, hotel first. Writes pick their target from these and let the
 * API decide: a person without the permission is refused there (403), never guessed at here.
 */
function businesses(ctx: SourceContext): Workspace[] {
  const order = (w: Workspace) => (w.domain === "hospitality" ? 0 : w.domain === "residence" ? 1 : 2);
  return (ctx.account?.workspaces ?? []).filter((w) => w.kind === "business").sort((a, b) => order(a) - order(b));
}

/** The hotel business, where the role presets and the Reports views live. */
function hotel(ctx: SourceContext): Workspace {
  const ws = businesses(ctx).find((w) => w.domain === "hospitality") ?? businesses(ctx)[0];
  if (!ws) throw new OwnerRefusal("This account works at no business.");
  return ws;
}

/** A request the screen can word for the person, refused before it reaches the API. */
export class OwnerRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OwnerRefusal";
  }
}

function scoped(ctx: SourceContext, ws: Workspace) {
  const o = { workspaceId: ws.workspaceId };
  return {
    get: <T>(path: string) => ctx.api.get<T>(path, o),
    post: <T>(path: string, body?: unknown) => ctx.api.post<T>(path, body, o),
    put: <T>(path: string, body?: unknown) => ctx.api.put<T>(path, body, o),
    patch: <T>(path: string, body?: unknown) => ctx.api.patch<T>(path, body, o),
  };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Which business a set of scope rows falls in, and the branches it names there. A member belongs to one
 * legal entity's team: scope rows of two businesses cannot be granted in one act, and an outlet row
 * (`ter`) cannot be granted at all, because membership scope is per branch (ADR-054).
 */
async function grantTarget(
  ctx: SourceContext,
  scopeIds: string[],
): Promise<{ ws: Workspace; branchIds: string[] | null }> {
  if (scopeIds.length === 0) throw new OwnerRefusal("Choose at least one property.");
  const branches = await Promise.all(
    businesses(ctx).map(async (ws) => ({ ws, properties: await propertiesOf(ctx, ws) })),
  );
  const owners = new Map<string, { ws: Workspace; id: string }>();
  for (const { ws, properties } of branches) for (const p of properties) owners.set(branchKey(p), { ws, id: p.id });
  const unknown = scopeIds.filter((s) => !owners.has(s));
  if (unknown.length > 0) {
    throw new OwnerRefusal(
      "Access is granted per property. Outlet-only access is not available yet: choose the property the outlet belongs to.",
    );
  }
  const hits = scopeIds.map((s) => owners.get(s) as { ws: Workspace; id: string });
  const ws = hits[0].ws;
  if (hits.some((h) => h.ws.workspaceId !== ws.workspaceId)) {
    throw new OwnerRefusal(
      "Those properties belong to two legal entities. Each keeps its own team: invite or grant one business at a time.",
    );
  }
  const all = branches.find((b) => b.ws.workspaceId === ws.workspaceId)?.properties ?? [];
  const ids = [...new Set(hits.map((h) => h.id))];
  // Every branch of the business is "all", which also covers branches added later.
  return { ws, branchIds: ids.length === all.length ? null : ids };
}

function orgRoleOf(role: TeamRolesRoleId): string {
  const orgRole = ORG_ROLE_OF[role];
  if (!orgRole) throw new OwnerRefusal("That role is still being defined and cannot be granted yet.");
  if (orgRole === "owner") throw new OwnerRefusal("Ownership moves only through an ownership transfer.");
  return orgRole;
}

/** Invite somebody by email into a staff role at the properties chosen. The API mails the link. */
export async function inviteMember(
  ctx: SourceContext,
  input: { name: string; contact: string; role: TeamRolesRoleId; scopeIds: string[] },
): Promise<{ id: string }> {
  const email = input.contact.trim().toLowerCase();
  if (!EMAIL.test(email)) {
    throw new OwnerRefusal("Invitations go by email: enter the person's email address, not a phone number.");
  }
  const orgRole = orgRoleOf(input.role);
  const { ws, branchIds } = await grantTarget(ctx, input.scopeIds);
  const created = await scoped(ctx, ws).post<{ id: string }>("/api/v1/ops/team/invitations", {
    name: input.name.trim() || undefined,
    email,
    orgRole,
    branchIds,
  });
  return { id: `invite:${created.id}` };
}

/** Cancel an invitation nobody has accepted. `memberId` is the Team screen's "invite:<id>". */
export async function cancelInvitation(ctx: SourceContext, memberId: string): Promise<void> {
  const id = memberId.replace(/^invite:/, "");
  for (const ws of businesses(ctx)) {
    const { invitations } = await scoped(ctx, ws).get<{ invitations: { id: string }[] }>(
      "/api/v1/ops/team/invitations",
    );
    if (invitations.some((i) => i.id === id)) {
      await scoped(ctx, ws).post(`/api/v1/ops/team/invitations/${encodeURIComponent(id)}/revoke`);
      return;
    }
  }
  throw new OwnerRefusal("That invitation is not open any more.");
}

/**
 * Change a member's role and the properties they cover. The role change and the branch limit are two
 * audited writes on the API (`PATCH /ops/team/:userId/role`, `PUT /ops/team/:userId/branches`); each is
 * sent only when it changes something.
 */
export async function changeMember(
  ctx: SourceContext,
  userId: string,
  input: { role: TeamRolesRoleId; scopeIds: string[] },
): Promise<void> {
  const orgRole = orgRoleOf(input.role);
  const { ws, branchIds } = await grantTarget(ctx, input.scopeIds);
  const api = scoped(ctx, ws);
  const { members } = await api.get<{
    members: { userId: string; orgRole: string; status: string; branchIds: string[] | null }[];
  }>("/api/v1/ops/team");
  const member = members.find((m) => m.userId === userId && m.status === "active");
  if (!member) {
    throw new OwnerRefusal(
      `This person is not on the team of ${ws.orgName ?? "that business"}: invite them there instead.`,
    );
  }
  if (member.orgRole !== orgRole) {
    await api.patch(`/api/v1/ops/team/${encodeURIComponent(userId)}/role`, { orgRole });
  }
  const same =
    (member.branchIds === null && branchIds === null) ||
    (member.branchIds !== null &&
      branchIds !== null &&
      member.branchIds.length === branchIds.length &&
      member.branchIds.every((b) => branchIds.includes(b)));
  if (!same) await api.put(`/api/v1/ops/team/${encodeURIComponent(userId)}/branches`, { branchIds });
}

/**
 * Save the role presets: for each staff role whose permissions differ from what the business holds now,
 * send the WHOLE set it should hold (ADR-055); the API works out the departures from the default. The
 * owner's row and a role the platform does not have are never sent.
 */
export async function saveRolePresets(
  ctx: SourceContext,
  presets: Partial<Record<TeamRolesRoleId, string[]>>,
): Promise<{ saved: string[] }> {
  const api = scoped(ctx, hotel(ctx));
  const { roles } = await api.get<{ roles: { orgRole: string; customisable: boolean; permissions: string[] }[] }>(
    "/api/v1/ops/roles",
  );
  const saved: string[] = [];
  for (const [roleId, permissions] of Object.entries(presets) as [TeamRolesRoleId, string[]][]) {
    const orgRole = ORG_ROLE_OF[roleId];
    const current = roles.find((r) => r.orgRole === orgRole);
    if (!orgRole || !current?.customisable) continue;
    const wanted = [...new Set(permissions)].sort();
    const have = [...current.permissions].sort();
    if (wanted.length === have.length && wanted.every((p, i) => p === have[i])) continue;
    await api.put(`/api/v1/ops/roles/${orgRole}`, { permissions: wanted });
    saved.push(orgRole);
  }
  return { saved };
}

const TAB_NAME: Record<ReportsTab, string> = { perf: "Performance", fin: "Financial", res: "Residence" };

/** Save the Reports screen's tab and branch as a named view of the owner's own (`owner.reports`). */
export async function saveReportView(
  ctx: SourceContext,
  input: { tab: ReportsTab; property: ReportsPropertyId; propertyLabel: string },
): Promise<{ id: string; name: string }> {
  const name = `${TAB_NAME[input.tab] ?? "Report"} · ${input.propertyLabel}`.slice(0, 60);
  const view = await scoped(ctx, hotel(ctx)).post<{ id: string; name: string }>("/api/v1/ops/list-views", {
    listKey: "owner.reports",
    name,
    config: {
      filters: [
        { field: "tab", op: "eq", value: input.tab },
        { field: "property", op: "eq", value: input.property },
      ],
    },
  });
  return { id: view.id, name: view.name };
}
