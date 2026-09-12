"use server";

import {
  AdminActionRequest,
  AdminOrgStatusChange,
  AdminTinRecheckResult,
  Uuid,
} from "@injishi/contracts";

import { apiPost } from "@/lib/api/server";

import { badInput, outcomeOf, type WriteOutcome, type WriteSpec } from "./outcome";

/**
 * Business writes (F-A03) — `POST /api/v1/admin/orgs/:orgId/*`.
 *
 * SERVER ACTIONS, because a write has to carry the staffer's own session and
 * that cookie belongs to the API origin: a `fetch` from the browser on this
 * console's origin would be anonymous. The button calls one of these; this
 * calls `apiPost`, which forwards the cookie.
 *
 * Each action validates its input against the same contract the API parses
 * before anything is sent. The API would refuse a two-letter reason with a
 * 400, and the console's client reads an unexplained 400 as "the platform did
 * not answer" — so catching it here is what lets the staffer be told the real
 * reason.
 *
 * NO `revalidatePath` HERE, on purpose. Re-rendering `/businesses` re-reads
 * the OBO register, and that read writes a `record_access_logs` row for every
 * intended owner listed — a disclosure the staffer did not ask for, logged as
 * if they had. So the caller decides: the business record refreshes itself
 * (re-reading only the lens that is open, as a reload would), and the review
 * queue marks the row it acted on from the confirmed response.
 */

const BASE = "/api/v1/admin/orgs";

const SUSPEND: WriteSpec<AdminOrgStatusChange> = {
  what: "the suspension",
  permission: "admin.business.suspend",
  success: () =>
    "Suspended. Its workspace holds no operating power until it is reinstated, and your reason is on the audit trail.",
};

const REINSTATE: WriteSpec<AdminOrgStatusChange> = {
  what: "the reinstatement",
  permission: "admin.business.reinstate",
  success: () =>
    "Reinstated. The business is active again, and your reason is on the audit trail.",
};

const TIN_RECHECK: WriteSpec<AdminTinRecheckResult> = {
  what: "the TIN re-check",
  permission: "admin.business.review",
  success: (r) => {
    // The adapter mode is named every time: a verdict from the mock must never
    // read as one from RRA.
    const source = r.adapterMode === "mock" ? "the mock RRA adapter" : "RRA";
    if (r.result === "verified") {
      return `TIN re-checked with ${source}: it passed, and the business moved on to TIN verified.`;
    }
    if (r.result === "failed") {
      return `TIN re-checked with ${source}: it failed, and the business is now rejected.`;
    }
    return `TIN re-check sent, but ${source} didn't answer. The business stays at submitted and the attempt is on the record.`;
  },
  // The write landed every time; only a pass is good news. A fail is a
  // verdict to take in, and a silent RRA is something still to chase.
  successTone: (r) =>
    r.result === "verified" ? "success" : r.result === "failed" ? "neutral" : "warning",
};

/** Suspend an active business. P: `admin.business.suspend`. */
export async function suspendOrg(
  orgId: string,
  reason: string,
): Promise<WriteOutcome<AdminOrgStatusChange>> {
  const body = AdminActionRequest.safeParse({ reason });
  if (!Uuid.safeParse(orgId).success || !body.success) return badInput(SUSPEND);
  const result = await apiPost(`${BASE}/${orgId}/suspend`, AdminOrgStatusChange, body.data);
  return outcomeOf(result, SUSPEND);
}

/** Reinstate a suspended business. P: `admin.business.reinstate`. */
export async function reinstateOrg(
  orgId: string,
  reason: string,
): Promise<WriteOutcome<AdminOrgStatusChange>> {
  const body = AdminActionRequest.safeParse({ reason });
  if (!Uuid.safeParse(orgId).success || !body.success) return badInput(REINSTATE);
  const result = await apiPost(`${BASE}/${orgId}/reinstate`, AdminOrgStatusChange, body.data);
  return outcomeOf(result, REINSTATE);
}

/** Run the RRA TIN check again for a business at `submitted`. P: `admin.business.review`. */
export async function recheckTin(
  orgId: string,
  reason: string,
): Promise<WriteOutcome<AdminTinRecheckResult>> {
  const body = AdminActionRequest.safeParse({ reason });
  if (!Uuid.safeParse(orgId).success || !body.success) return badInput(TIN_RECHECK);
  const result = await apiPost(`${BASE}/${orgId}/tin-recheck`, AdminTinRecheckResult, body.data);
  return outcomeOf(result, TIN_RECHECK);
}
