import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { API_BASE } from "../data/api";
import { toWorkspaceKey } from "../data/me";
import type { WorkspaceKey } from "../data/types";
import { preferredWorkspaceId, workspaceBase, workspaceHome } from "./nav";
import { signInUrl } from "./sign-in-url";

/**
 * The strangler shim for the old kind-prefixed paths (ADR-018, D-d, AC-4).
 *
 * `/host/today` used to be an address. It named a KIND, so an owner running
 * three hotels had one address for all three. It now resolves which hotel the
 * caller means and sends them to `/w/<id>/today`.
 *
 * A SHIM, NOT AN ALIAS. It exists to stop live links breaking on the day the
 * prefix changed, and it is meant to be deleted (D-h). Every hit writes one
 * line of structured JSON on `ia.shim.hit`, which is what makes "two weeks at
 * zero" a checkable trigger rather than a good intention. Nothing aggregates
 * logs in this project yet, so reading that log is an owned task.
 *
 * IT RUNS ON THE SERVER, because the log line has to reach stdout and because
 * the answer must be known before any HTML is produced. It carries the caller's
 * cookies to the API and asks the same question the browser would.
 *
 * IT GRANTS NOTHING. It resolves an address; `WorkspaceGuard` still refuses
 * every request behind it.
 */

/** Where to come back to after signing in, on this app's own public origin. */
// `||`, not `??`, for the reason middleware.ts gives: a deploy variable that
// exists with an empty value is SET, and `new URL(path, "")` throws on every
// shimmed request rather than sending anyone to the wrong place.
const SELF_URL = process.env.NEXT_PUBLIC_PMS_URL || "http://localhost:3002";

/** How long to wait for the API before giving up and letting the app ask. */
const SHIM_TIMEOUT_MS = 6_000;

/** The old first segment, and the workspace kind it used to name. */
export const LEGACY_SEGMENTS = {
  host: "host",
  landlord: "landlord",
  broker: "broker",
} as const satisfies Partial<Record<WorkspaceKey, string>>;

/**
 * `/personal/*` is deliberately NOT shimmed.
 *
 * Personal moved to `apps/web` (ADR-018, D-b), a different ORIGIN, and phase 4
 * of the migration plan has no shim on purpose: a redirect from the operator app
 * into the marketplace would keep this app in a flow it is leaving. A guest who
 * operates nothing has no reason to arrive here at all.
 */

export type LegacyKind = keyof typeof LEGACY_SEGMENTS;

interface WireWorkspace {
  workspaceId: string | null;
  kind: unknown;
  domain: unknown;
}

interface WireResponse {
  workspaces?: WireWorkspace[];
  activeWorkspaceId?: string | null;
}

type Resolution =
  | { outcome: "ok"; workspaceId: string; sameKind: boolean }
  | { outcome: "anonymous" }
  | { outcome: "nothing-held" }
  | { outcome: "unreachable" };

/**
 * One line per hit, on one stable event name.
 *
 * Structured JSON on stdout rather than a sentence, so the two week check is a
 * count of a field and not a grep somebody has to get right.
 */
function logHit(oldPath: string, resolvedWorkspaceId: string | null): void {
  console.log(
    JSON.stringify({
      event: "ia.shim.hit",
      oldPath,
      resolvedWorkspaceId,
      at: new Date().toISOString(),
    }),
  );
}

/**
 * Which workspace the caller means by this old prefix.
 *
 * Prefers a workspace of the kind the old path named, because `/landlord/leases`
 * sent to a hotel is a screen that hotel does not have. Only when they hold
 * none of that kind does it fall back to ranking across everything they hold,
 * and the caller drops the old tail in that case.
 */
async function resolveTarget(kind: LegacyKind): Promise<Resolution> {
  const cookie = (await headers()).get("cookie") ?? "";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SHIM_TIMEOUT_MS);

  let body: WireResponse;
  try {
    const res = await fetch(`${API_BASE}/api/v1/me/workspaces`, {
      headers: { cookie },
      cache: "no-store",
      signal: controller.signal,
    });
    // A dead cookie is a settled answer and the only one worth a sign-in.
    if (res.status === 401) return { outcome: "anonymous" };
    if (!res.ok) return { outcome: "unreachable" };
    body = (await res.json()) as WireResponse;
  } catch {
    // We learned nothing. That is not "signed out" and it is not "no access".
    return { outcome: "unreachable" };
  } finally {
    clearTimeout(timer);
  }

  const held = (body.workspaces ?? [])
    .map((w) => ({
      key: toWorkspaceKey({
        kind: w.kind as never,
        domain: w.domain as never,
      }),
      workspaceId: w.workspaceId,
    }))
    .filter(
      (w): w is { key: WorkspaceKey; workspaceId: string | null } =>
        w.key !== null,
    );

  const active = body.activeWorkspaceId ?? null;
  const sameKind = held.filter((w) => w.key === kind);

  /*
   * The kind filter comes FIRST here, and that does not contradict D-m.
   *
   * Inside `preferredWorkspaceId`, where you last worked outranks kind, because
   * a person signing in fresh has said nothing about which kind they want. An
   * old URL HAS said: `/landlord/leases` names a residence, so sending its
   * visitor to the hotel they were in yesterday would ignore the one piece of
   * intent the address carries. So the kind narrows the candidates and history
   * picks among them, which is exactly what these two calls do.
   *
   * The second call is the fallback for someone who holds none of that kind at
   * all. `redirectLegacyPath` drops the old tail in that case rather than
   * carrying `/leases` onto a hotel that has no such screen.
   */
  const preferred =
    preferredWorkspaceId(sameKind, active) ??
    preferredWorkspaceId(held, active);

  if (!preferred) return { outcome: "nothing-held" };
  return {
    outcome: "ok",
    workspaceId: preferred,
    sameKind: sameKind.some((w) => w.workspaceId === preferred),
  };
}

/**
 * Resolve an old path and leave. Never returns.
 *
 * @param kind the workspace kind the old first segment named
 * @param rest everything after it, renamed through `legacyScreenPath` so a
 *   deep link stays deep where its screen still exists
 */
export async function redirectLegacyPath(
  kind: LegacyKind,
  rest: string[] | undefined,
): Promise<never> {
  const tail = rest ?? [];
  const oldPath = `/${[LEGACY_SEGMENTS[kind], ...tail].join("/")}`;

  const resolved = await resolveTarget(kind);

  if (resolved.outcome === "anonymous") {
    logHit(oldPath, null);
    redirect(signInUrl(new URL(oldPath, SELF_URL).toString()));
  }

  if (resolved.outcome === "unreachable" || resolved.outcome === "nothing-held") {
    // Never into a workspace. `/` asks the API again from the browser, where
    // `WorkspaceBoundary` already words both answers: "we could not reach the
    // API" and "you are signed in and hold nothing yet". Sending a signed-in
    // person with no workspace to sign in would only loop them past a gate
    // their session already opens.
    logHit(oldPath, null);
    redirect("/");
  }

  logHit(oldPath, resolved.workspaceId);

  // The tail only survives when the destination is the same kind of workspace.
  // Carrying `/leases` onto a hotel would land on a screen that hotel's nav
  // does not grant, which reads as a refusal rather than as a moved address.
  // Even then it is RENAMED before it is joined, never copied: `/host/bills/x`
  // copied verbatim became `/w/<id>/bills/x`, and no such route exists.
  const screen = resolved.sameKind ? legacyScreenPath(kind, tail) : null;
  const target = screen
    ? `${workspaceBase(resolved.workspaceId)}${screen}`
    : workspaceHome(kind, resolved.workspaceId);

  redirect(target);
}

/**
 * Where each old screen segment lives now (ADR-018, move 5).
 *
 * Only segments that MOVED are listed. A segment that kept its name
 * (`reservations`, `leases`, `inbox`, …) passes through unchanged and is then
 * checked against `WORKSPACE_ROUTES` like everything else. The `from` column is
 * the pre-move route table in `Product-v1.0-MFP/mfp-fe.md` and the 2026-10-07
 * navigation; the `to` column is the route tree under
 * `src/app/w/[workspaceId]/`. A tail that is no screen at all lands on the
 * workspace's bare address, whose resolver opens this person's home
 * (`homeFor`, ADR-069 D-f), not the kind's.
 *
 * A value is a path of segments, so a rename can land inside a lens
 * (`revenue` → `finance/revenue`).
 */
const LEGACY_RENAMES: Readonly<Record<string, readonly string[]>> = {
  // Finance: four leaves became one route with four lenses. `bills` is the
  // default lens, so `/finance` IS the bills list and `bills/<id>` keeps its
  // record segment under it.
  bills: ["finance", "bills"],
  payouts: ["finance", "payouts"],
  invoices: ["finance", "invoices"],
  revenue: ["finance", "revenue"],
  // Landlord compliance: the portfolio half is the filings lens in Finance.
  compliance: ["finance", "filings"],
  // Calendar: one route, three views over what used to be three screens.
  grid: ["calendar"],
  availability: ["calendar"],
  // Inventory: the room-type catalogue and "what you offer".
  "rooms-rates": ["inventory"],
  offer: ["inventory", "amenities"],
  // Services: live orders is the default lens, the menu its own.
  orders: ["services"],
  menu: ["services", "menu"],
  // One inbox per workspace, whatever the old thread list was called.
  messages: ["inbox"],
  "tenant-messages": ["inbox"],
  cleaning: ["housekeeping"],
  tickets: ["maintenance"],
  // Team became Team & Departments, which Settings absorbed (the Navigation
  // board, 2026-10-07): Settings › Team & roles, with the team and its
  // invitations as lenses beside Roles. `people` itself is the People
  // destination now (ADR-069 D-f), so an old Team link does not land there.
  team: ["people", "roles"],
  // Settings absorbed Plan and billing.
  plan: ["settings", "plan"],
  // Today became the Dashboard (the Navigation board's renames).
  today: ["dashboard"],
};

/**
 * Where each screen that MOVED in the 2026-10-07 navigation now lives, for the
 * addresses inside a workspace (`/w/<id>/<old>`).
 *
 * Those addresses keep their pages: each is the lens or the screen the new
 * destination opens, so a bookmark or a handover note still opens the same
 * screen, and the sidebar lights the destination that holds it. This table
 * says which, and `home.test.mjs` holds the nav to it. Only the kind-prefixed
 * shim above REDIRECTS; an in-workspace address never needs to.
 */
export const MOVED_IN_WORKSPACE: Readonly<Record<string, { destination: string; lens?: string }>> = {
  today: { destination: "Dashboard" },
  inbox: { destination: "Messages" },
  inventory: { destination: "Rates & Inventory" },
  setup: { destination: "Rates & Inventory" },
  rooms: { destination: "Housekeeping", lens: "Room status" },
  housekeeping: { destination: "Housekeeping", lens: "Tasks" },
  maintenance: { destination: "Housekeeping", lens: "Maintenance" },
  staff: { destination: "People", lens: "Employees" },
  "people/roles": { destination: "Settings", lens: "Team & roles" },
  "people/invites": { destination: "Settings", lens: "Team & roles" },
  "people/departments": { destination: "Settings", lens: "Departments" },
  "psf-membership": { destination: "Settings", lens: "Memberships" },
  "settings/integrations": { destination: "Settings", lens: "Integrations" },
};

/**
 * Renames that depend on which KIND the old path named.
 *
 * `directory` meant opposite jobs: a landlord publishing units, and a broker
 * browsing them. The landlord's became Listing; the broker kept the word.
 */
const LEGACY_KIND_RENAMES: Readonly<
  Record<LegacyKind, Readonly<Record<string, readonly string[]>>>
> = {
  host: {},
  landlord: { directory: ["listing"] },
  broker: {},
};

/**
 * Every screen under `/w/<id>/`, as segment patterns. `*` is a dynamic
 * segment. `legacy-redirect.test.mjs` fails when this list and the route tree
 * on disk disagree, so a new or deleted screen cannot silently change where an
 * old link lands.
 */
export const WORKSPACE_ROUTES: readonly string[] = [
  "account",
  "calendar",
  // The Dashboard (was Today) and the four destinations of the 2026-10-07
  // navigation that have no screen yet, each a placeholder that says so.
  "dashboard",
  "directory",
  "earnings",
  "finance",
  "finance/bills/*",
  "finance/filings",
  "finance/invoices",
  "finance/payouts",
  "finance/revenue",
  "front-desk",
  "guests",
  "housekeeping",
  "inbox",
  "inbox/*",
  "inventory",
  "inventory/amenities",
  "inventory/rate-plans",
  "leases",
  "leases/*",
  "leases/*/caution",
  "leases/*/contract",
  "leases/*/filing",
  "leases/*/move-out",
  "leases/*/rent",
  "leases/*/visitors",
  "listing",
  "maintenance",
  "move-outs",
  // My work (ADR-058, 058-self-service): a person's own file, and its lenses.
  "my-work",
  "my-work/leave",
  "my-work/pay",
  "my-work/time",
  "night-audit",
  "people",
  "people/departments",
  "people/invites",
  "people/roles",
  "placements",
  "psf-membership",
  "rent-roll",
  "reports",
  "reservations",
  "reservations/*",
  "reservations/*/guests",
  "reservations/*/history",
  "reservations/*/messages",
  "reservations/*/payment",
  "rooms",
  "sales",
  "services",
  "services/departments",
  "services/menu",
  "services/outlets",
  "settings",
  "settings/branches",
  "settings/integrations",
  "settings/plan",
  "settings/policies",
  "setup",
  // Staff, the HR module (ADR-058): its lenses (058-time's among them), a
  // file with its tabs (058-people-file), and a pay run.
  "staff",
  "staff/*",
  "staff/*/contracts",
  "staff/*/discipline",
  "staff/*/documents",
  "staff/*/leave",
  "staff/*/notes",
  "staff/*/pay",
  "staff/*/work",
  "staff/announcements",
  "staff/attendance",
  "staff/attendance-requests",
  "staff/configuration",
  "staff/discipline",
  "staff/documents",
  "staff/kiosks",
  "staff/leave",
  "staff/leave/allocations",
  "staff/leave/balances",
  "staff/leave/restricted",
  "staff/leave/types",
  "staff/org-chart",
  "staff/payroll",
  "staff/payroll/*",
  "staff/payroll/adjustments",
  "staff/payroll/claims",
  "staff/payroll/components",
  "staff/payroll/contracts",
  "staff/payroll/loans",
  "staff/payroll/payslips",
  "staff/payroll/rules",
  "staff/payroll/settings",
  "staff/policies",
  "staff/roster",
  "staff/rotations",
  "staff/shift-requests",
  "staff/time-insights",
  "staff/time-settings",
  "stays/*",
  "stays/*/documents",
  "stays/*/folio",
  "stays/*/guests",
  "stays/*/notes",
  "today",
  "units",
];

function isWorkspaceRoute(segments: readonly string[]): boolean {
  return WORKSPACE_ROUTES.some((route) => {
    const pattern = route.split("/");
    return (
      pattern.length === segments.length &&
      pattern.every((part, i) => part === "*" || part === segments[i])
    );
  });
}

/**
 * The new screen path, inside a workspace, for an old kind-prefixed tail.
 *
 * Pure, so it can be tested without Next. The first segment is renamed through
 * the maps above; the result is then cut back to the LONGEST prefix that is a
 * real route, so `/host/bills` (no index page) lands on `/finance` and a deep
 * link past the end of a record lands on the record. `null` means no prefix is
 * a screen at all, and the caller sends the person to the workspace's home
 * rather than to a 404.
 *
 * @returns a path beginning with `/`, to append to `workspaceBase`, or `null`
 */
export function legacyScreenPath(
  kind: LegacyKind,
  tail: readonly string[],
): string | null {
  const parts = tail.filter((segment) => segment.length > 0);
  if (parts.length === 0) return null;

  const [head, ...rest] = parts;
  const renamed =
    LEGACY_KIND_RENAMES[kind][head] ?? LEGACY_RENAMES[head] ?? [head];
  const mapped = [...renamed, ...rest];

  for (let length = mapped.length; length > 0; length--) {
    const candidate = mapped.slice(0, length);
    if (isWorkspaceRoute(candidate)) {
      return `/${candidate.map((segment) => encodeURIComponent(segment)).join("/")}`;
    }
  }
  return null;
}
