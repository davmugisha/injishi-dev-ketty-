"use server";

import { requirePersona } from "@/lib/session";
import {
  decideStarGrade,
  type RegistrationEvent,
  registrationTimeline,
  type StarGradeState,
  starGradeOf,
} from "@/server/admin/registrations";
import { ApiError } from "@/server/api";

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

/** 0118: the star grade a business said, for the side panel. */
export async function loadStarGrade(
  orgId: string,
): Promise<{ ok: true; value: StarGradeState } | { ok: false; error: string }> {
  await requirePersona("AdminBusinesses");
  if (!UUID.test(orgId)) return { ok: false, error: "That business was not found." };
  try {
    return { ok: true, value: await starGradeOf(orgId) };
  } catch {
    return { ok: false, error: "The star grade could not be loaded." };
  }
}

/** 0118: confirm a star grade against the grading certificate, or withdraw it, with the reason. */
export async function decideStarGradeAction(
  orgId: string,
  confirm: boolean,
  reason: string,
): Promise<{ ok: true; value: StarGradeState } | { ok: false; error: string }> {
  await requirePersona("AdminBusinesses");
  if (!UUID.test(orgId)) return { ok: false, error: "That business was not found." };
  if (reason.trim().length < 4) return { ok: false, error: "Say why, in a few words." };
  try {
    return { ok: true, value: await decideStarGrade(orgId, confirm, reason.trim()) };
  } catch (error) {
    if (error instanceof ApiError)
      return { ok: false, error: error.forbidden ? "Your staff role cannot do this." : error.message };
    return { ok: false, error: "That did not go through. Try again." };
  }
}
