"use client";

import { apiFetch } from "@/lib/api";
import { HOME } from "@/lib/app-nav";
import { safeRedirect } from "@/lib/redirect";

/**
 * Where a signed-in person goes first (F-S02, role routing).
 *
 * One sign-in screen serves guests, operators and officers, so the moment
 * after the email code is the one place their paths part. This module asks the
 * API what the person holds and answers with a URL. It decides nothing about
 * access: `WorkspaceGuard` and `OversightGuard` refuse on the server, and the
 * operator zone's own gate refuses again. This only picks the door.
 *
 * THE STEP-UP COMES FIRST. A person whose role requires it is sent to the code
 * screen before any destination, whatever the `redirect` parameter said. The
 * destination travels along and is honoured once the code is accepted. There is
 * nothing to enrol, so there is one screen rather than two.
 *
 * PLATFORM STAFF OPEN THE ADMIN CONSOLE. A staffer who holds no business
 * workspace and no oversight console used to land on the marketplace's
 * `/trips`, because nothing here asked `/me/staff`. The console is another
 * origin (`NEXT_PUBLIC_ADMIN_URL`) and the one `safeRedirect` already allows,
 * so the destination is still an allowlisted url; admin's own `StaffGuard`
 * decides what they may do there.
 */

export interface TwoFactorStatus {
  required: boolean;
  verified: boolean;
}

interface WorkspaceRow {
  workspaceId: string | null;
  kind: "business" | "broker" | "personal" | string;
}

interface WorkspacesResponse {
  workspaces?: WorkspaceRow[];
  activeWorkspaceId?: string | null;
  twoFactor?: TwoFactorStatus;
}

interface OversightResponse {
  consoles?: unknown[];
  twoFactor?: TwoFactorStatus;
}

interface StaffResponse {
  isStaff?: boolean;
  twoFactor?: TwoFactorStatus;
}

export type Access =
  | { status: "anonymous" }
  | { status: "unreachable" }
  | {
      status: "resolved";
      twoFactor: TwoFactorStatus;
      /** Operator workspaces (business or broker), in the API's order. */
      operatorWorkspaceIds: string[];
      activeWorkspaceId: string | null;
      holdsConsole: boolean;
      /** `GET /api/v1/me/staff` said this is platform staff. */
      isStaff: boolean;
    };

/** Every root the operator zone serves under the web origin. */
export const OPERATOR_ZONE_PREFIXES = ["/w", "/oversight", "/host", "/landlord", "/broker"];

export function isOperatorZonePath(pathname: string): boolean {
  return OPERATOR_ZONE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export async function fetchAccess(): Promise<Access> {
  const [ws, ov, staff] = await Promise.all([
    apiFetch<WorkspacesResponse>("/api/v1/me/workspaces"),
    apiFetch<OversightResponse>("/api/v1/me/oversight"),
    apiFetch<StaffResponse>("/api/v1/me/staff"),
  ]);
  if (ws.status === "unauthenticated" || ov.status === "unauthenticated") {
    return { status: "anonymous" };
  }
  if (ws.status !== "ok" || ov.status !== "ok") return { status: "unreachable" };

  const rows = ws.data.workspaces ?? [];
  const operatorWorkspaceIds = rows
    .filter((w) => (w.kind === "business" || w.kind === "broker") && w.workspaceId)
    .map((w) => w.workspaceId as string);
  const holdsConsole = (ov.data.consoles ?? []).length > 0;
  const base = ws.data.twoFactor ??
    ov.data.twoFactor ?? {
      required: operatorWorkspaceIds.length > 0 || holdsConsole,
      verified: false,
    };
  // Staff is a bonus question, not a gate: when `/me/staff` fails the person
  // is simply not routed to the console, and the rules below run as they did.
  const isStaff = staff.status === "ok" && staff.data.isStaff === true;
  const staffFactor = isStaff && staff.status === "ok" ? staff.data.twoFactor : undefined;
  // The console asks for the same session step-up; owing it there is owing it
  // here, so the code is asked for once, before the console, not after.
  const twoFactor: TwoFactorStatus = staffFactor
    ? {
        required: base.required || staffFactor.required,
        verified: base.verified || staffFactor.verified,
      }
    : base;

  return {
    status: "resolved",
    twoFactor,
    operatorWorkspaceIds,
    activeWorkspaceId: ws.data.activeWorkspaceId ?? null,
    holdsConsole,
    isStaff,
  };
}

/**
 * The screen to open, given what the person holds and where they asked to go.
 *
 * Rules, in order:
 *  1. Step-up outstanding: enter the emailed code. The requested destination
 *     is carried through and honoured afterwards.
 *  2. An explicit, allowlisted `redirect` wins. It is where the person was
 *     bounced from, and a guard on that route still has the final say.
 *  3. Otherwise by role: an officer opens the oversight console; an operator
 *     opens the workspace they were last in, else the first they hold;
 *     platform staff open the admin console; a guest opens the marketplace
 *     home.
 */
export function resolveDestination(
  access: Extract<Access, { status: "resolved" }>,
  requested: string | null,
): string {
  const explicit = requested ? safeRedirect(requested) : null;
  const afterFactor = explicit && explicit !== HOME ? explicit : null;

  if (access.twoFactor.required && !access.twoFactor.verified) {
    return twoFactorUrl(afterFactor ?? "/start");
  }

  if (afterFactor) return afterFactor;

  if (access.holdsConsole) return "/oversight";

  if (access.operatorWorkspaceIds.length > 0) {
    const lastUsed =
      access.activeWorkspaceId &&
      access.operatorWorkspaceIds.includes(access.activeWorkspaceId)
        ? access.activeWorkspaceId
        : access.operatorWorkspaceIds[0];
    return `/w/${lastUsed}`;
  }

  if (access.isStaff) {
    const admin = adminConsoleUrl();
    if (admin) return admin;
  }

  return HOME;
}

/**
 * The admin console's front door, or null when this build names none.
 *
 * Read from `NEXT_PUBLIC_ADMIN_URL` and passed through `safeRedirect`, so it
 * can only ever be an origin the allowlist already trusts. Production's env
 * file sets it EMPTY on purpose (no console is deployed there), and an empty
 * value is null here: a staffer then lands on the home screen rather than on a
 * localhost default.
 */
export function adminConsoleUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_ADMIN_URL;
  if (!raw) return null;
  let url: string;
  try {
    url = new URL("/", raw).toString();
  } catch {
    return null;
  }
  const safe = safeRedirect(url);
  return safe === url ? safe : null;
}

export function twoFactorUrl(returnTo: string): string {
  const params = new URLSearchParams({ redirect: returnTo });
  return `/two-factor/verify?${params.toString()}`;
}
