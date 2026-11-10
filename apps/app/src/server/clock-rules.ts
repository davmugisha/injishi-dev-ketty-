/**
 * Clock-in rules for HR's Attendance screen (058-time): how each branch's staff clock themselves
 * in, the entrance tablets that show the code phones scan, and who clocked in far from work this
 * month. Reads answer nothing rather than failing the screen when the person may not hold them.
 */

import type { BranchClockRule, ClockMode, ClockSetup, EntranceTablet, FarClockIn } from "@injishi/product-hr";
import { ApiError } from "./api";
import type { SourceContext } from "./sources/types";

export type { BranchClockRule, ClockMode, ClockSetup, EntranceTablet, FarClockIn };

const ops = (ctx: SourceContext) => ctx.ops("hospitality");

async function orEmpty<T>(read: Promise<T>, empty: T): Promise<T> {
  try {
    return await read;
  } catch (error) {
    if (error instanceof ApiError && (error.forbidden || error.notFound)) return empty;
    throw error;
  }
}

export async function readClockSetup(ctx: SourceContext): Promise<ClockSetup> {
  const [settings, kiosks, far] = await Promise.all([
    orEmpty(ops(ctx).get<{ clock: BranchClockRule[] }>("/api/v1/ops/attendance/policies"), { clock: [] }),
    orEmpty(ops(ctx).get<{ kiosks: EntranceTablet[] }>("/api/v1/ops/attendance/kiosks"), { kiosks: [] }),
    orEmpty(ops(ctx).get<{ people: FarClockIn[] }>("/api/v1/ops/attendance/far-clock-ins"), { people: [] }),
  ]);
  return {
    branches: settings.clock,
    tablets: kiosks.kiosks.filter((k) => k.status !== "revoked"),
    far: far.people,
  };
}

export async function saveClockRule(
  ctx: SourceContext,
  propertyId: string,
  rule: {
    clockMode: ClockMode;
    opensMinutesBefore: number | null;
    geofenceRadiusM: number;
    centre?: { lat: number; lng: number } | null;
  },
): Promise<void> {
  await ops(ctx).put(`/api/v1/ops/attendance/clock-settings/${encodeURIComponent(propertyId)}`, rule);
}

/** A new tablet, or a new code for one: the 8 digits are shown once, for ten minutes. */
export async function addTablet(
  ctx: SourceContext,
  propertyId: string,
  name: string,
): Promise<{ pairingCode: string; expiresAt: string }> {
  return ops(ctx).post("/api/v1/ops/attendance/kiosks", { propertyId, name });
}

export async function newTabletCode(
  ctx: SourceContext,
  id: string,
): Promise<{ pairingCode: string; expiresAt: string }> {
  return ops(ctx).post(`/api/v1/ops/attendance/kiosks/${encodeURIComponent(id)}/pairing-code`);
}

export async function removeTablet(ctx: SourceContext, id: string): Promise<void> {
  await ops(ctx).post(`/api/v1/ops/attendance/kiosks/${encodeURIComponent(id)}/revoke`);
}

/** A clock-in nobody vouched for: count it, or mark it not counted because the person was not at work. */
export async function countClockIn(ctx: SourceContext, recordId: string): Promise<void> {
  await ops(ctx).post(`/api/v1/ops/attendance/${encodeURIComponent(recordId)}/validate`);
}

export async function notCounted(ctx: SourceContext, recordId: string, note: string): Promise<void> {
  await ops(ctx).post(`/api/v1/ops/attendance/${encodeURIComponent(recordId)}/reject`, { note });
}
