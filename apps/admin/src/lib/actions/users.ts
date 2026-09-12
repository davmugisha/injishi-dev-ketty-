"use server";

import {
  AdminActionRequest,
  AdminClaimCodeReissued,
  AdminSessionsRevoked,
  Uuid,
} from "@injishi/contracts";

import { apiPost } from "@/lib/api/server";

import { badInput, outcomeOf, type WriteOutcome, type WriteSpec } from "./outcome";

/**
 * Users writes (F-A04) — `POST /api/v1/admin/users/*`.
 *
 * Server Actions, because the staffer's session cookie belongs to the API
 * origin and only a server-side call carries it. Input is checked against the
 * API's own contract first, so a short reason is reported as one.
 *
 * Role and grant changes are NOT here and must not be added as a reason plus a
 * POST: they need a second `super_admin` (ADR-012), so those controls still
 * say they are not built.
 */

const BASE = "/api/v1/admin/users";

const REVOKE: WriteSpec<AdminSessionsRevoked> = {
  what: "ending their sessions",
  permission: "admin.user.session.revoke",
  success: (r) =>
    r.revokedCount === 0
      ? "They held no live session, so there was nothing to end. The check is on the audit trail with your reason."
      : `Ended ${r.revokedCount} session${r.revokedCount === 1 ? "" : "s"}. Each is refused from its next request, and your reason is on the audit trail.`,
};

const REISSUE: WriteSpec<AdminClaimCodeReissued> = {
  what: "the new claim code",
  // The route borrows this power because no claim-code permission exists: a
  // claim code is a credential to somebody's record, as a session is.
  permission: "admin.user.session.revoke",
  success: (r) =>
    `New claim code ${r.claimCode}. The old code no longer works; give this one to the guest.`,
};

/** End every session a user holds. P: `admin.user.session.revoke`. */
export async function revokeUserSessions(
  userId: string,
  reason: string,
): Promise<WriteOutcome<AdminSessionsRevoked>> {
  const body = AdminActionRequest.safeParse({ reason });
  if (!Uuid.safeParse(userId).success || !body.success) return badInput(REVOKE);
  const result = await apiPost(`${BASE}/${userId}/revoke-sessions`, AdminSessionsRevoked, body.data);
  // Nothing on the directory shows a session, so there is nothing to re-read.
  return outcomeOf(result, REVOKE);
}

/** Give an unclaimed stay a new claim code. P: `admin.user.session.revoke`. */
export async function reissueClaimCode(
  stayId: string,
  reason: string,
): Promise<WriteOutcome<AdminClaimCodeReissued>> {
  const body = AdminActionRequest.safeParse({ reason });
  if (!Uuid.safeParse(stayId).success || !body.success) return badInput(REISSUE);
  const result = await apiPost(
    `${BASE}/stays/${stayId}/reissue-claim`,
    AdminClaimCodeReissued,
    body.data,
  );
  // NOT re-read, deliberately. Re-rendering `/users` re-reads the people
  // directory on the same page, and that read writes a `record_access_logs`
  // row for every person listed — a disclosure nobody asked for, logged as if
  // they had. The row shows the returned code instead.
  return outcomeOf(result, REISSUE);
}
