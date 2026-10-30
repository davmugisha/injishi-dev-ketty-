"use server";

import { screenHref } from "@injishi/data";
import { revalidatePath } from "next/cache";
import { requirePersona } from "@/lib/session";
import { ApiError, ApiUnreachableError } from "@/server/api";
import { requestContext } from "@/server/data";
import {
  type DeskEntry,
  decideCorrection as decideCorrectionApi,
  decideLeave as decideLeaveApi,
  decideSwap as decideSwapApi,
  publishWeek as publishWeekApi,
  type RosterWeekId,
  type ShiftLetter,
  saveDeskEntry as saveDeskEntryApi,
  setChecklistStep,
  setLent as setLentApi,
  setShift as setShiftApi,
} from "@/server/mutations/people";
import { NoWorkspaceError } from "@/server/sources/types";

/** What a people action answers: done, or the API's refusal in words the screen can show. */
export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Runs a write and answers in words for a toast: the API's refusal, an API that did not answer, or a person
 * with no business workspace. Anything else (a sign-in redirect) is rethrown for Next to handle.
 */
async function attempt(run: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await run();
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, error: error.forbidden ? `Not allowed: ${error.message}` : error.message };
    }
    if (error instanceof ApiUnreachableError) {
      return { ok: false, error: "The Injishi service did not answer. Try again." };
    }
    if (error instanceof NoWorkspaceError) return { ok: false, error: error.message };
    throw error;
  }
}

/**
 * HR decides a leave request the line manager has already approved (People · home and Leave), on
 * the API: approving writes the ledger and takes the person off their shifts; declining needs a
 * reason, which the person and the line manager read.
 */
export async function decideLeave(
  id: string,
  decision: "approved" | "declined",
  reason?: string,
): Promise<ActionResult> {
  await requirePersona("Leave");
  const ctx = await requestContext();
  const result = await attempt(() => decideLeaveApi(ctx, id, decision, reason));
  revalidatePath(screenHref("Leave"));
  revalidatePath(screenHref("PeopleHome"));
  revalidatePath(screenHref("Roster"));
  return result;
}

/** HR approves or declines a clock correction a line manager has confirmed. The original record is kept. */
export async function decideCorrection(
  id: string,
  decision: "approved" | "declined",
  note?: string,
): Promise<ActionResult> {
  await requirePersona("Attendance");
  const ctx = await requestContext();
  const result = await attempt(() => decideCorrectionApi(ctx, id, decision, note));
  revalidatePath(screenHref("Attendance"));
  return result;
}

type DeskEntryInput = DeskEntry;

/** Desk entry for when the kiosk or phone could not record a clock. A justification is required. */
export async function saveDeskEntry(input: DeskEntryInput): Promise<ActionResult & { name?: string }> {
  await requirePersona("Attendance");
  const ctx = await requestContext();
  const result = await attempt(() => saveDeskEntryApi(ctx, input));
  revalidatePath(screenHref("Attendance"));
  revalidatePath(screenHref("PeopleHome"));
  return result;
}

/** Tick or untick an offboarding step on the Employees screen. */
export async function setOffboardingStep(id: string, done: boolean): Promise<ActionResult> {
  await requirePersona("Employees");
  const ctx = await requestContext();
  const result = await attempt(() => setChecklistStep(ctx, id, done));
  revalidatePath(screenHref("Employees"));
  revalidatePath(screenHref("PeopleHome"));
  return result;
}

/** Change one cell of the roster grid (a shift, or a day off). */
export async function setRosterShift(
  week: RosterWeekId,
  employeeId: string,
  dayIndex: number,
  shift: ShiftLetter,
): Promise<ActionResult> {
  await requirePersona("Roster");
  const ctx = await requestContext();
  const result = await attempt(() => setShiftApi(ctx, { week, employeeId, dayIndex, shift }));
  revalidatePath(screenHref("Roster"));
  revalidatePath(screenHref("PeopleHome"));
  return result;
}

/** Lend one shift to the business's other branch, or bring it home. */
export async function setRosterLent(
  week: RosterWeekId,
  employeeId: string,
  dayIndex: number,
  lent: boolean,
): Promise<ActionResult> {
  await requirePersona("Roster");
  const ctx = await requestContext();
  const result = await attempt(() => setLentApi(ctx, { week, employeeId, dayIndex, lent }));
  revalidatePath(screenHref("Roster"));
  return result;
}

/** Publish a week of the roster: its drafts reach the staff app. */
export async function publishRosterWeek(week: RosterWeekId): Promise<ActionResult> {
  await requirePersona("Roster");
  const ctx = await requestContext();
  const result = await attempt(() => publishWeekApi(ctx, week));
  revalidatePath(screenHref("Roster"));
  return result;
}

/** Approve or decline a shift swap both colleagues agreed to. */
export async function decideShiftSwap(id: string, decision: "approved" | "declined"): Promise<ActionResult> {
  await requirePersona("Roster");
  const ctx = await requestContext();
  const result = await attempt(() => decideSwapApi(ctx, id, decision));
  revalidatePath(screenHref("Roster"));
  revalidatePath(screenHref("PeopleHome"));
  return result;
}
