"use server";

import { screenHref } from "@injishi/data";
import { revalidatePath } from "next/cache";
import { requirePersona } from "@/lib/session";
import { ApiError, ApiUnreachableError } from "@/server/api";
import * as clock from "@/server/clock-rules";
import { requestContext } from "@/server/data";
import { NoWorkspaceError } from "@/server/sources/types";

export type ClockActionResult = { ok: true } | { ok: false; error: string };
export type TabletCodeResult = { ok: true; code: string; expiresAt: string } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Run an Attendance write as the person, refresh the screen, and answer a refusal or an outage in words. */
async function act<T>(
  run: (ctx: Awaited<ReturnType<typeof requestContext>>) => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    await requirePersona("Attendance");
    const value = await run(await requestContext());
    return { ok: true, value };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    if (error instanceof ApiUnreachableError) {
      return { ok: false, error: "The Injishi service did not answer. Try again." };
    }
    if (error instanceof NoWorkspaceError) return { ok: false, error: error.message };
    throw error;
  } finally {
    revalidatePath(screenHref("Attendance"));
  }
}

const done = <T>(r: { ok: true; value: T } | { ok: false; error: string }): ClockActionResult =>
  r.ok ? { ok: true } : { ok: false, error: r.error };

export async function saveClockRuleAction(
  propertyId: string,
  rule: {
    clockMode: clock.ClockMode;
    opensMinutesBefore: number | null;
    geofenceRadiusM: number;
    centre?: { lat: number; lng: number } | null;
  },
): Promise<ClockActionResult> {
  if (!UUID.test(propertyId)) return { ok: false, error: "Pick a branch." };
  if (!["anywhere", "at_work", "entrance"].includes(rule.clockMode))
    return { ok: false, error: "Pick how staff clock in." };
  const radius = Math.round(rule.geofenceRadiusM);
  if (!(radius >= 25 && radius <= 2000)) return { ok: false, error: "The distance is 25 to 2,000 metres." };
  return done(await act((ctx) => clock.saveClockRule(ctx, propertyId, { ...rule, geofenceRadiusM: radius })));
}

export async function addTabletAction(propertyId: string, name: string): Promise<TabletCodeResult> {
  if (!UUID.test(propertyId)) return { ok: false, error: "Pick a branch." };
  const named = name.trim() || "Staff entrance";
  const r = await act((ctx) => clock.addTablet(ctx, propertyId, named.slice(0, 80)));
  return r.ok ? { ok: true, code: r.value.pairingCode, expiresAt: r.value.expiresAt } : r;
}

export async function newTabletCodeAction(id: string): Promise<TabletCodeResult> {
  if (!UUID.test(id)) return { ok: false, error: "That tablet is not on this list." };
  const r = await act((ctx) => clock.newTabletCode(ctx, id));
  return r.ok ? { ok: true, code: r.value.pairingCode, expiresAt: r.value.expiresAt } : r;
}

export async function removeTabletAction(id: string): Promise<ClockActionResult> {
  if (!UUID.test(id)) return { ok: false, error: "That tablet is not on this list." };
  return done(await act((ctx) => clock.removeTablet(ctx, id)));
}

/** HR checked a clock-in nobody vouched for: count it, or not, because the person was not at work. */
export async function checkClockInAction(
  recordId: string,
  decision: { count: true } | { count: false; note: string },
): Promise<ClockActionResult> {
  if (!UUID.test(recordId)) return { ok: false, error: "That clock-in is not on this list." };
  if (decision.count) return done(await act((ctx) => clock.countClockIn(ctx, recordId)));
  const note = decision.note.trim();
  if (note.length < 3) return { ok: false, error: "Say why it does not count." };
  return done(await act((ctx) => clock.notCounted(ctx, recordId, note)));
}
