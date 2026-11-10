"use server";

import { screenHref } from "@injishi/data";
import type { EmployeeAccessView } from "@injishi/data/fixtures/people";
import type { EmployeePersonalView } from "@injishi/product-hr";
import { revalidatePath } from "next/cache";
import { requirePersona } from "@/lib/session";
import { ApiError, ApiUnreachableError } from "@/server/api";
import { workspaceFor } from "@/server/auth";
import { requestContext } from "@/server/data";
import {
  decideDocument,
  documentLink,
  type EmployeeDocumentView,
  readDocuments,
  requestDocument,
} from "@/server/mutations/employee-documents";
import {
  acceptSwapFor as acceptSwapForApi,
  archiveRotation,
  assignRotation,
  cancelLeave as cancelLeaveApi,
  clockOutAtDesk,
  createRotation as createRotationApi,
  type DeskEntry,
  decideCorrection as decideCorrectionApi,
  decideExtraDays as decideExtraDaysApi,
  decideLeave as decideLeaveApi,
  decideSwap as decideSwapApi,
  endRotation,
  publishWeek as publishWeekApi,
  type RosterWeekId,
  type ShiftLetter,
  saveCover as saveCoverApi,
  saveDeskEntry as saveDeskEntryApi,
  setChecklistStep,
  setLent as setLentApi,
  setShift as setShiftApi,
} from "@/server/mutations/people";
import {
  type AccessInput,
  cancelAccess,
  giveAccess,
  type NewEmployeeInput,
  type Registered,
  readAccess,
  readPersonal,
  registerEmployee,
  StaffInputError,
} from "@/server/mutations/staff-access";
import { rememberRosterBranch } from "@/server/roster-branch";
import { addDays } from "@/server/sources/people";
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

/**
 * HR cancels leave already approved: the days go back on the balance and pay is put right on the next run.
 * The person reads the reason on Me.
 */
export async function cancelLeave(id: string, reason: string): Promise<ActionResult> {
  await requirePersona("Leave");
  const ctx = await requestContext();
  const result = await attempt(() => cancelLeaveApi(ctx, id, reason));
  revalidatePath(screenHref("Leave"));
  revalidatePath(screenHref("PeopleHome"));
  revalidatePath(screenHref("Roster"));
  revalidatePath(screenHref("MyHr"));
  return result;
}

/** HR decides days someone asked for on top of what a kind of leave gives; approving adds them to the balance. */
export async function decideExtraDays(
  id: string,
  decision: "approved" | "declined",
  reason?: string,
): Promise<ActionResult> {
  await requirePersona("Leave");
  const ctx = await requestContext();
  const result = await attempt(() => decideExtraDaysApi(ctx, id, decision, reason));
  revalidatePath(screenHref("Leave"));
  revalidatePath(screenHref("PeopleHome"));
  revalidatePath(screenHref("MyHr"));
  return result;
}

/** HR approves a document someone handed in, or sends it back with the reason. */
export async function decideEmployeeDocument(
  documentId: string,
  decision: "approved" | "declined",
  reason?: string,
): Promise<ActionResult> {
  await requirePersona("Employees");
  const ctx = await requestContext();
  const result = await attempt(() => decideDocument(ctx, documentId, decision, reason));
  revalidatePath(screenHref("Employees"));
  revalidatePath(screenHref("PeopleHome"));
  return result;
}

/** Ask a person for a document: it waits on Me and the phone for them to send. */
export async function requestEmployeeDocument(
  employeeId: string,
  input: { title: string; note: string; dueOn: string },
): Promise<ActionResult> {
  await requirePersona("Employees");
  const ctx = await requestContext();
  const result = await attempt(() => requestDocument(ctx, employeeId, input));
  revalidatePath(screenHref("Employees"));
  revalidatePath(screenHref("MyHr"));
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
  revalidatePath(screenHref("PeopleHome"));
  revalidatePath(screenHref("MyHr"));
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

/** Clock out someone still on shift, from their Attendance row. */
export async function clockOutFromDesk(input: {
  recordId: string;
  date: string;
  time: string;
  clockedInAt?: string;
}): Promise<ActionResult> {
  await requirePersona("Attendance");
  const ctx = await requestContext();
  const result = await attempt(() => clockOutAtDesk(ctx, input));
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

/** Work on another branch's roster. Only a branch of this business is taken. */
export async function pickRosterBranch(id: string): Promise<ActionResult> {
  await requirePersona("Roster");
  const ctx = await requestContext();
  const branches = (ctx.account ? workspaceFor(ctx.account, "hospitality")?.branches : []) ?? [];
  if (!(branches as { id: string }[]).some((b) => b.id === id))
    return { ok: false, error: "That branch is not in this business." };
  await rememberRosterBranch(id);
  revalidatePath(screenHref("Roster"));
  return { ok: true };
}

/** Say yes for a colleague with no login, so their swap can be decided. */
export async function acceptSwapForColleague(id: string): Promise<ActionResult> {
  await requirePersona("Roster");
  const ctx = await requestContext();
  const result = await attempt(() => acceptSwapForApi(ctx, id));
  revalidatePath(screenHref("Roster"));
  return result;
}

/** Set a team's minimum cover from the roster. */
export async function saveRosterCover(input: {
  teamId: string;
  shifts: ShiftLetter[];
  minByWeekday: number[];
}): Promise<ActionResult> {
  await requirePersona("Roster");
  const ctx = await requestContext();
  const result = await attempt(() => saveCoverApi(ctx, input));
  revalidatePath(screenHref("Roster"));
  revalidatePath(screenHref("PeopleHome"));
  return result;
}

/** Make a new rotation from the roster. */
export async function createRotation(input: {
  name: string;
  steps: ShiftLetter[];
  rule: "every_n_days" | "weekly" | "monthly";
  ruleValue: number;
}): Promise<ActionResult> {
  await requirePersona("Roster");
  const ctx = await requestContext();
  const result = await attempt(() => createRotationApi(ctx, input));
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

// ── New employees and their logins (HR onboarding) ─────────────────────────────────────────────────

/** A refusal in words the person can act on; anything else is a fault and is thrown. */
function refusal(error: unknown): { ok: false; error: string } {
  if (error instanceof ApiError || error instanceof StaffInputError) return { ok: false, error: error.message };
  if (error instanceof ApiUnreachableError)
    return { ok: false, error: "The Injishi service did not answer. Try again." };
  throw error;
}

function revalidatePeople() {
  revalidatePath(screenHref("Employees"));
  revalidatePath(screenHref("PeopleHome"));
  revalidatePath(screenHref("TeamRoles"));
}

export type RegisterResult = { ok: true; registered: Registered } | { ok: false; error: string };

/**
 * Put a person on file with everything HR keeps about them: the file, its details, contract, pay
 * account, kiosk PIN and login. A refused file is the whole answer; a later part refused is reported
 * beside the file that was written.
 */
export async function registerNewEmployee(input: NewEmployeeInput): Promise<RegisterResult> {
  await requirePersona("Employees");
  const ctx = await requestContext();
  try {
    const registered = await registerEmployee(ctx, input);
    revalidatePeople();
    if (input.candidateId) revalidatePath(screenHref("Talent"));
    return { ok: true, registered };
  } catch (error) {
    return refusal(error);
  }
}

export type AccessResult = { ok: true; access: EmployeeAccessView } | { ok: false; error: string };

/** Where a file's login stands, for its Access tab. */
export async function loadEmployeeAccess(employeeId: string): Promise<AccessResult> {
  await requirePersona("Employees");
  const ctx = await requestContext();
  try {
    return { ok: true, access: await readAccess(ctx, employeeId) };
  } catch (error) {
    return refusal(error);
  }
}

/** A file's personal details, for its Personal tab. */
export async function loadEmployeePersonal(
  employeeId: string,
): Promise<{ ok: true; personal: EmployeePersonalView } | { ok: false; error: string }> {
  await requirePersona("Employees");
  const ctx = await requestContext();
  try {
    return { ok: true, personal: await readPersonal(ctx, employeeId) };
  } catch (error) {
    return refusal(error);
  }
}

/** What a file holds, for its Documents tab. */
export async function loadEmployeeDocuments(
  employeeId: string,
): Promise<{ ok: true; documents: EmployeeDocumentView[] } | { ok: false; error: string }> {
  await requirePersona("Employees");
  const ctx = await requestContext();
  try {
    return { ok: true, documents: await readDocuments(ctx, employeeId) };
  } catch (error) {
    return refusal(error);
  }
}

/** A short-lived link to one document's file; the API logs the read. */
export async function openEmployeeDocument(
  documentId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requirePersona("Employees");
  const ctx = await requestContext();
  try {
    return { ok: true, url: await documentLink(ctx, documentId) };
  } catch (error) {
    return refusal(error);
  }
}

/** Give a file its login: sent at once, or asked of the owner for a role that reaches money or people. */
export async function giveEmployeeAccess(
  employeeId: string,
  input: AccessInput,
): Promise<(AccessResult & { ok: true; outcome: "invited" | "requested" }) | { ok: false; error: string }> {
  await requirePersona("Employees");
  const ctx = await requestContext();
  try {
    const result = await giveAccess(ctx, employeeId, input);
    revalidatePeople();
    return { ok: true, outcome: result.outcome, access: result.access };
  } catch (error) {
    return refusal(error);
  }
}

/** Take back an open invitation, or a request still with the owner. */
export async function cancelEmployeeAccess(employeeId: string): Promise<AccessResult> {
  await requirePersona("Employees");
  const ctx = await requestContext();
  try {
    const access = await cancelAccess(ctx, employeeId);
    revalidatePeople();
    return { ok: true, access };
  } catch (error) {
    return refusal(error);
  }
}

/** The later of two ISO days. */
const laterDay = (a: string, b: string) => (a > b ? a : b);

/**
 * Put a person on a rotation from a day. Someone on another rotation is taken off it the day
 * before, as a person is on one rotation at a time.
 */
export async function addToRotation(input: {
  employeeId: string;
  patternId: string;
  startsOn: string;
  startStep: number;
  moveFrom?: { assignmentId: string; startsOn: string };
}): Promise<ActionResult> {
  await requirePersona("Roster");
  const ctx = await requestContext();
  const result = await attempt(async () => {
    const from = input.moveFrom;
    if (from) await endRotation(ctx, from.assignmentId, laterDay(from.startsOn, addDays(input.startsOn, -1)));
    await assignRotation(ctx, {
      employeeId: input.employeeId,
      patternId: input.patternId,
      startsOn: input.startsOn,
      startStep: input.startStep,
    });
  });
  revalidatePath(screenHref("Roster"));
  return result;
}

/** Take a person off a rotation after a day: their drafts after it are cancelled. */
export async function takeOffRotation(assignmentId: string, endsOn: string): Promise<ActionResult> {
  await requirePersona("Roster");
  const ctx = await requestContext();
  const result = await attempt(() => endRotation(ctx, assignmentId, endsOn));
  revalidatePath(screenHref("Roster"));
  return result;
}

/** Stop a rotation: everyone on it comes off after a day, then its patterns are archived. */
export async function stopRotation(
  patternIds: string[],
  people: { assignmentId: string; startsOn: string }[],
  lastDay: string,
): Promise<ActionResult> {
  await requirePersona("Roster");
  const ctx = await requestContext();
  const result = await attempt(async () => {
    for (const p of people) await endRotation(ctx, p.assignmentId, laterDay(p.startsOn, lastDay));
    for (const id of patternIds) await archiveRotation(ctx, id);
  });
  revalidatePath(screenHref("Roster"));
  return result;
}
