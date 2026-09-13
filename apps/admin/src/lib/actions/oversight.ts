"use server";

import {
  AdminActionRequest,
  AdminOversightGrant,
  CreateOversightGrantRequest,
  Uuid,
} from "@injishi/contracts";

import { apiDelete, apiPost, type ResponseSchema } from "@/lib/api/server";

import { badInput, outcomeOf, type WriteOutcome, type WriteSpec } from "./outcome";

/**
 * Officer appointments (ADR-049, AC-G1) — `POST` and `DELETE
 * /api/v1/admin/users/:userId/oversight`.
 *
 * Nothing could appoint a government officer from the console before this: the
 * directory's grant editor ended in "isn't built yet", and MINALOC or PSF could
 * only be staffed by a seed script. Both routes are `admin.user.role.grant`,
 * which only `super_admin` holds.
 *
 * **Single signer, by decision.** ADR-012 asked for a second `super_admin` on
 * role grants and `needsSecondSigner` is implemented by nothing; ADR-049 records
 * that an oversight appointment ships as a single signer action and names the
 * exposure (no other staff role holds the permission at all). The admin grant
 * and the staff role changes the same dialog shows still wait for the second
 * signer and still say so.
 *
 * The platform refuses an appointment that overlaps the opposing role in the
 * same region, or that lands inside a business the person works for. Those
 * refusals arrive as the platform's own sentence (see `outcomeOf`).
 */

const BASE = "/api/v1/admin/users";

const GRANT: WriteSpec<AdminOversightGrant> = {
  what: "the appointment",
  permission: "admin.user.role.grant",
  success: (g) =>
    `Appointed: ${g.governmentTitle ?? "officer"} at ${g.governmentBodyCode}${g.scopeLabel ? `, ${g.scopeLabel}` : ""}. It opens their oversight console now, and your reason is on the audit trail.`,
};

const REVOKE: WriteSpec<null> = {
  what: "revoking the appointment",
  permission: "admin.user.role.grant",
  success: () =>
    "Appointment revoked. Their console refuses them from the next request, the decisions they already took keep the title they held, and your reason is on the audit trail.",
};

/** A `204` answers nothing, and nothing is exactly what it is expected to answer. */
const NoContent: ResponseSchema<null> = {
  safeParse: (value) => (value === null ? { success: true, data: null } : { success: false }),
};

export interface AppointOfficerInput {
  oversightRole: string;
  governmentBodyCode: string;
  governmentTitle: string;
  scopeLevel: string;
  provinceId: number | null;
  districtId: number | null;
}

/** Appoint a person as a government officer. P: `admin.user.role.grant`. */
export async function appointOfficer(
  userId: string,
  input: AppointOfficerInput,
  reason: string,
): Promise<WriteOutcome<AdminOversightGrant>> {
  const grant = CreateOversightGrantRequest.safeParse({
    ...input,
    provinceId: input.scopeLevel === "province" ? input.provinceId : null,
    districtId: input.scopeLevel === "district" ? input.districtId : null,
  });
  const why = AdminActionRequest.safeParse({ reason });
  if (!Uuid.safeParse(userId).success || !grant.success || !why.success) return badInput(GRANT);
  const result = await apiPost(`${BASE}/${userId}/oversight`, AdminOversightGrant, {
    ...grant.data,
    ...why.data,
  });
  return outcomeOf(result, GRANT);
}

/** Revoke one live appointment. P: `admin.user.role.grant`. */
export async function revokeAppointment(
  userId: string,
  assignmentId: string,
  reason: string,
): Promise<WriteOutcome<null>> {
  const why = AdminActionRequest.safeParse({ reason });
  if (!Uuid.safeParse(userId).success || !Uuid.safeParse(assignmentId).success || !why.success) {
    return badInput(REVOKE);
  }
  const result = await apiDelete(`${BASE}/${userId}/oversight/${assignmentId}`, NoContent, {
    reason: why.data.reason,
  });
  return outcomeOf(result, REVOKE);
}
