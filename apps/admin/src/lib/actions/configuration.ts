"use server";

import { AdminRegistrationFee, AppendRegistrationFeeRequest } from "@injishi/contracts";

import { apiPost } from "@/lib/api/server";

import { badInput, outcomeOf, type WriteOutcome, type WriteSpec } from "./outcome";

/**
 * Append a registration fee (ADR-049, AC-R9) — `POST
 * /api/v1/admin/configuration/fees`.
 *
 * `admin.fee.edit`, which `finance` and `super_admin` hold. APPEND, never edit:
 * a new row with its own moment, so a registration already created keeps the
 * amount locked onto its invoice. A moment in the past is refused by the
 * platform, and that refusal is shown in its own words.
 */

const APPEND: WriteSpec<AdminRegistrationFee> = {
  what: "the new fee",
  permission: "admin.fee.edit",
  success: (fee) =>
    `Appended: the ${fee.businessType} registration fee becomes ${fee.amountRwf.toLocaleString("en-US")} ${fee.currency} from ${new Date(fee.effectiveFrom).toUTCString()}. Registrations already created keep their amount, and your reason is on the audit trail.`,
};

/**
 * `effectiveFrom` is an ISO moment the form built from the staffer's local
 * wall time, so the moment recorded is the moment the staffer meant; null means
 * "from now".
 */
export async function appendRegistrationFee(input: {
  businessType: string;
  amountRwf: number;
  effectiveFrom: string | null;
  reason: string;
}): Promise<WriteOutcome<AdminRegistrationFee>> {
  const body = AppendRegistrationFeeRequest.safeParse({
    businessType: input.businessType,
    amountRwf: input.amountRwf,
    reason: input.reason,
    ...(input.effectiveFrom ? { effectiveFrom: input.effectiveFrom } : {}),
  });
  if (!body.success) return badInput(APPEND);
  return outcomeOf(await apiPost("/api/v1/admin/configuration/fees", AdminRegistrationFee, body.data), APPEND);
}
