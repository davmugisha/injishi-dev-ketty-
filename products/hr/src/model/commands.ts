/**
 * The commands HR's views send, and the shapes they send. The app supplies every one of them as a server
 * action and hands them in through `HrProvider` (`./web`); a view never knows how a command reaches the API.
 */

/** What a command answers: done, or the API's refusal in words the screen can show. */
export type Done = { ok: true } | { ok: false; error: string };

/** A command that hands back a value once it is done. */
export type DoneWith<T> = { ok: true; value: T } | { ok: false; error: string };

/** Desk entry for when the kiosk or phone could not record a clock. A justification is required. */
export interface DeskEntry {
  /** The employee (file) id. */
  employee: string;
  /** "15 Oct 2026" or "2026-10-15". */
  date: string;
  /** "06:00". */
  clockIn: string;
  /** "14:00", or empty while they are still on shift. */
  clockOut: string;
  reason: string;
  justification: string;
}

/** The roster week a command acts on. */
export type RosterWeekId = "this" | "next";

/** One roster cell: morning, evening, night, or off. */
export type ShiftLetter = "M" | "E" | "N" | "O";

/** A person's own leave request, from the staff phone. */
export interface LeaveAsk {
  leaveTypeId: string;
  from: string;
  to: string;
  reason?: string;
}

/** Every command an HR view may send. */
export interface HrActions {
  decideLeave(id: string, decision: "approved" | "declined", reason?: string): Promise<Done>;
  decideCorrection(id: string, decision: "approved" | "declined", note?: string): Promise<Done>;
  saveDeskEntry(input: DeskEntry): Promise<Done & { name?: string }>;
  setOffboardingStep(id: string, done: boolean): Promise<Done>;
  setRosterShift(week: RosterWeekId, employeeId: string, dayIndex: number, shift: ShiftLetter): Promise<Done>;
  setRosterLent(week: RosterWeekId, employeeId: string, dayIndex: number, lent: boolean): Promise<Done>;
  publishRosterWeek(week: RosterWeekId): Promise<Done>;
  decideShiftSwap(id: string, decision: "approved" | "declined"): Promise<Done>;
  askLeaveAction(input: LeaveAsk): Promise<DoneWith<string>>;
  cancelRequestAction(requestId: string): Promise<DoneWith<undefined>>;
  signOut(): Promise<void>;
}
