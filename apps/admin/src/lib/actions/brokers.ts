"use server";

import { revalidatePath } from "next/cache";

import {
  AdminActionRequest,
  AdminBrokerStatusChange,
  Uuid,
} from "@injishi/contracts";

import { apiPost } from "@/lib/api/server";

import { badInput, outcomeOf, type WriteOutcome, type WriteSpec } from "./outcome";

/**
 * Broker writes (F-A05) — `POST /api/v1/admin/brokers/:brokerId/*`.
 *
 * A Server Action for the reason every console write is one: the session
 * cookie belongs to the API origin, so only a server-side call carries it.
 * Input is checked against the API's own contract first, so a short reason is
 * reported as a short reason rather than as a platform that did not answer.
 *
 * There is one broker write. Reinstating a broker has no route, so that button
 * still says it is not built.
 */

const BASE = "/api/v1/admin/brokers";

const SUSPEND: WriteSpec<AdminBrokerStatusChange> = {
  what: "the broker suspension",
  // The route declares `admin.broker.approve` because no `admin.broker.suspend`
  // exists; a refusal has to name the power the API actually checks.
  permission: "admin.broker.approve",
  success: () => "Broker suspended, and your reason is on the audit trail.",
};

/** Suspend an active broker. P: `admin.broker.approve`. */
export async function suspendBroker(
  brokerId: string,
  reason: string,
): Promise<WriteOutcome<AdminBrokerStatusChange>> {
  const body = AdminActionRequest.safeParse({ reason });
  if (!Uuid.safeParse(brokerId).success || !body.success) return badInput(SUSPEND);
  const result = await apiPost(`${BASE}/${brokerId}/suspend`, AdminBrokerStatusChange, body.data);
  if (result.ok) revalidatePath("/brokers");
  return outcomeOf(result, SUSPEND);
}
