"use server";

import { screenHref } from "@injishi/data";
import type { ClockCorrection, ClockRecord, DeskEmployee, LeaveRequest } from "@injishi/data/fixtures/people";
import { getDocument, saveDocument, updateDocument } from "@injishi/db";
import { revalidatePath } from "next/cache";
import { requirePersona } from "@/lib/session";

/**
 * HR decides a leave request the line manager has already approved (People · home and Leave).
 * Declining needs a reason, which is sent to the employee and the line manager.
 */
export async function decideLeave(id: string, decision: "approved" | "declined", reason?: string): Promise<void> {
  await requirePersona("Leave");
  const request = await getDocument<LeaveRequest>("people.leaveRequests", id);
  if (request?.step !== "hr" || request.hrDecision) return;
  const why = (reason ?? "").trim();
  if (decision === "declined" && !why) return;
  await updateDocument<LeaveRequest>("people.leaveRequests", id, {
    hrDecision: decision,
    hrReason: decision === "declined" ? why : null,
  });
  revalidatePath(screenHref("Leave"));
  revalidatePath(screenHref("PeopleHome"));
}

/** HR approves or declines a clock correction a line manager has confirmed. The original record is kept. */
export async function decideCorrection(id: string, decision: "approved" | "declined", note?: string): Promise<void> {
  const persona = await requirePersona("Attendance");
  const correction = await getDocument<ClockCorrection>("people.corrections", id);
  if (correction?.state !== "pending") return;
  const first = correction.name.split(" ")[0];
  await updateDocument<ClockCorrection>("people.corrections", id, {
    state: decision,
    hrNote: (note ?? "").trim() || null,
    outcome:
      decision === "approved"
        ? `Correction entry added by ${persona.name}. The original clock record is kept.`
        : `Declined by ${persona.name}. The reason was sent to ${first} and the line manager.`,
  });
  revalidatePath(screenHref("Attendance"));
}

export interface DeskEntryInput {
  employee: string;
  date: string;
  clockIn: string;
  clockOut: string;
  reason: string;
  justification: string;
}

/** Desk entry for when the kiosk or phone could not record a clock. A justification is required. */
export async function saveDeskEntry(input: DeskEntryInput): Promise<{ ok: boolean; name?: string }> {
  const persona = await requirePersona("Attendance");
  const justification = input.justification.trim();
  const employee = await getDocument<DeskEmployee>("people.deskEmployees", input.employee);
  if (!employee || !justification) return { ok: false };
  const now = new Date();
  await saveDocument<ClockRecord>("people.clockRecords", {
    id: `desk-${now.getTime()}`,
    day: "today",
    name: employee.name,
    dept: employee.dept,
    property: employee.property,
    shift: employee.shift,
    clockIn: input.clockIn.trim() || "06:00",
    source: "desk",
    sourceNote: `By ${persona.name} · justification on file`,
    clockOut: input.clockOut.trim() || "—",
    status: "Awaiting manager",
    tone: "info",
    addedAt: now.toISOString(),
    date: input.date.trim(),
    reason: input.reason,
    justification,
  });
  revalidatePath(screenHref("Attendance"));
  return { ok: true, name: employee.name };
}
