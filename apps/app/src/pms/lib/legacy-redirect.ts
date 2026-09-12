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
 * @param rest everything after it, kept intact so a deep link stays deep
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
  const target = resolved.sameKind && tail.length > 0
    ? `${workspaceBase(resolved.workspaceId)}/${tail.join("/")}`
    : workspaceHome(kind, resolved.workspaceId);

  redirect(target);
}
