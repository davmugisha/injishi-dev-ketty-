"use server";

import { requirePersona } from "@/lib/session";
import { type RegistrationEvent, registrationTimeline } from "@/server/admin/registrations";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A registration's audit trail, for the side panel. */
export async function loadRegistrationTimeline(
  orgId: string,
): Promise<{ ok: true; value: RegistrationEvent[] } | { ok: false; error: string }> {
  await requirePersona("AdminBusinesses");
  if (!UUID.test(orgId)) return { ok: false, error: "That business was not found." };
  try {
    return { ok: true, value: await registrationTimeline(orgId) };
  } catch {
    return { ok: false, error: "The history could not be loaded. Try again." };
  }
}
