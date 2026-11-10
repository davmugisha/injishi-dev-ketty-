"use server";

import type { HrFeature, HrFeatureList } from "@injishi/contracts";
import { requirePersona } from "@/lib/session";
import {
  decideStarGrade,
  hrFeaturesOf,
  type RegistrationEvent,
  registrationTimeline,
  type StarGradeState,
  setHrFeature,
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

/** A business's optional HR features, for its page. */
export async function loadHrFeatures(
  orgId: string,
): Promise<{ ok: true; value: HrFeatureList } | { ok: false; error: string }> {
  await requirePersona("AdminBusinesses");
  if (!UUID.test(orgId)) return { ok: false, error: "That business was not found." };
  try {
    return { ok: true, value: await hrFeaturesOf(orgId) };
  } catch (error) {
    if (error instanceof ApiError && error.forbidden)
      return { ok: false, error: "Your staff role cannot see HR features." };
    return { ok: false, error: "HR features could not be loaded." };
  }
}

/** Switch one of a business's HR features on or off. */
export async function setHrFeatureAction(
  orgId: string,
  feature: HrFeature,
  on: boolean,
): Promise<{ ok: true; value: HrFeatureList } | { ok: false; error: string }> {
  await requirePersona("AdminBusinesses");
  if (!UUID.test(orgId)) return { ok: false, error: "That business was not found." };
  try {
    return { ok: true, value: await setHrFeature(orgId, feature, on, "") };
  } catch (error) {
    if (error instanceof ApiError)
      return { ok: false, error: error.forbidden ? "Your staff role cannot change HR features." : error.message };
    return { ok: false, error: "That did not go through. Try again." };
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
