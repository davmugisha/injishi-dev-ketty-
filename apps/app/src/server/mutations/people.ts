/**
 * Writes for the people area (HR), through the API. Plain functions: the server actions in
 * features/people and the verify flows both call them, and every refusal is the API's (an ApiError).
 *
 * The HR officer keeps two employers' files, so a write about a record whose business the screen
 * does not name is tried in each business workspace the person holds: a record of the other business
 * answers 404 there (ADR-054), and the one that owns it does the work.
 */
import type { DeskEntry, RosterWeekId, ShiftLetter } from "@injishi/product-hr";
import { ApiError } from "../api";
import { addDays } from "../sources/people";
import { NoWorkspaceError, type ScopedApi, type SourceContext } from "../sources/types";

/** The shapes these writes take are the HR product's, the same ones its views send (ADR-074 stage 3). */
export type { DeskEntry, RosterWeekId, ShiftLetter };

function businesses(ctx: SourceContext): ScopedApi[] {
  const out: ScopedApi[] = [];
  for (const domain of ["hospitality", "residence"] as const) {
    try {
      const api = ctx.ops(domain);
      if (!out.some((a) => a.workspace.workspaceId === api.workspace.workspaceId)) out.push(api);
    } catch (error) {
      if (!(error instanceof NoWorkspaceError)) throw error;
    }
  }
  if (out.length === 0) throw new NoWorkspaceError("hospitality");
  return out;
}

/** Run a write in the business that owns the record: a 404 in one business moves on to the next. */
async function inOwningBusiness<T>(ctx: SourceContext, run: (api: ScopedApi) => Promise<T>): Promise<T> {
  let last: unknown = null;
  for (const api of businesses(ctx)) {
    try {
      return await run(api);
    } catch (error) {
      if (error instanceof ApiError && error.notFound) {
        last = error;
        continue;
      }
      throw error;
    }
  }
  throw last ?? new Error("Not found in any business.");
}

// ── Leave ───────────────────────────────────────────────────────────────────────────────────────

/**
 * HR decides a leave request at the step it waits at (`POST /ops/leave/requests/:id/approve|reject`).
 * A decline carries its reason, which the person and the line manager read.
 */
export async function decideLeave(
  ctx: SourceContext,
  id: string,
  decision: "approved" | "declined",
  reason?: string,
): Promise<void> {
  const note = (reason ?? "").trim();
  if (decision === "declined" && !note)
    throw new ApiError(422, "reason_required", "Add a reason before declining.", null);
  await inOwningBusiness(ctx, (api) =>
    api.post(`/api/v1/ops/leave/requests/${encodeURIComponent(id)}/${decision === "approved" ? "approve" : "reject"}`, {
      note: note || null,
    }),
  );
}

// ── Attendance ──────────────────────────────────────────────────────────────────────────────────

/**
 * HR decides a correction a line manager confirmed (`POST /ops/attendance-requests/:id/approve|reject`).
 * Approving writes a new record in place of the original, which is kept as superseded.
 */
export async function decideCorrection(
  ctx: SourceContext,
  id: string,
  decision: "approved" | "declined",
  note?: string,
): Promise<void> {
  await inOwningBusiness(ctx, (api) =>
    api.post(
      `/api/v1/ops/attendance-requests/${encodeURIComponent(id)}/${decision === "approved" ? "approve" : "reject"}`,
      {
        note: (note ?? "").trim() || null,
      },
    ),
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "15 Oct 2026", "15 October 2026" or "2026-10-15" → "2026-10-15"; null when it is not a date. */
function parseDay(text: string): string | null {
  const t = text.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})$/);
  if (!m) return null;
  const month = MONTHS.findIndex((x) => x.toLowerCase() === m[2].toLowerCase());
  if (month < 0) return null;
  const iso = `${m[3]}-${String(month + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return Number.isNaN(Date.parse(`${iso}T12:00:00Z`)) ? null : iso;
}

/** A Kigali wall-clock time on a day, as an ISO instant. */
function kigaliInstant(date: string, time: string): string | null {
  const m = time.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!m) return null;
  return new Date(`${date}T${m[1].padStart(2, "0")}:${m[2]}:00+02:00`).toISOString();
}

interface DayRecord {
  id: string;
  employee: { employeeId: string };
  status: "open" | "closed" | "superseded";
  autoClosed: boolean;
  validated: boolean;
}

/**
 * A desk entry, for when the kiosk or the phone could not record a clock:
 *
 * - a person with a record that day still open, or closed by the sweep and never put right, has it
 *   corrected (`POST /ops/attendance/:id/correct`): the original stays, superseded;
 * - anyone else is clocked in by the desk (`POST /ops/attendance/clock-in`, source supervisor) with
 *   the reason and justification on the record, and clocked out too when an out time is given.
 *
 * The API refuses a time more than 5 minutes ahead or 7 days back, a second open record, and a day
 * of approved leave; those refusals reach the person as they are.
 */
export async function saveDeskEntry(ctx: SourceContext, input: DeskEntry): Promise<{ recordId: string }> {
  const justification = input.justification.trim();
  if (justification.length < 3)
    throw new ApiError(422, "justification_required", "A justification is required for every desk entry.", null);
  const date = parseDay(input.date);
  if (!date) throw new ApiError(422, "bad_date", "Type the date as 15 Oct 2026.", null);
  const clockInAt = kigaliInstant(date, input.clockIn);
  if (!clockInAt) throw new ApiError(422, "bad_time", "Type the clock-in time as 06:00.", null);
  const clockOutAt = input.clockOut.trim() ? kigaliInstant(date, input.clockOut) : null;
  if (input.clockOut.trim() && !clockOutAt)
    throw new ApiError(422, "bad_time", "Type the clock-out time as 14:00.", null);
  let outAt = clockOutAt;
  // An out time before the in time is the next morning: a night shift.
  if (outAt && outAt <= clockInAt) outAt = new Date(Date.parse(outAt) + 86_400_000).toISOString();
  const note = `Desk entry · ${input.reason.trim()} · ${justification}`.slice(0, 300);

  return inOwningBusiness(ctx, async (api) => {
    // Its business answers the file; another answers 404, and the next one is tried.
    await api.get(`/api/v1/ops/employees/${encodeURIComponent(input.employee)}`);
    const records: DayRecord[] = [];
    for (let page = 1; page < 20; page++) {
      const body = await api.get<{ items: DayRecord[]; total: number }>("/api/v1/ops/attendance", {
        query: { f: JSON.stringify([["workDate", "eq", date]]), size: "100", page: String(page) },
      });
      records.push(...body.items);
      if (records.length >= body.total || body.items.length === 0) break;
    }
    const mine = records.filter((r) => r.employee.employeeId === input.employee && r.status !== "superseded");
    const unfinished = mine.find((r) => r.status === "open" || (r.autoClosed && !r.validated));
    if (unfinished) {
      if (!outAt) {
        throw new ApiError(
          409,
          "already_open",
          "They already have a clock-in that day. Give the clock-out time to put it right.",
          null,
        );
      }
      const corrected = await api.post<{ id: string }>(`/api/v1/ops/attendance/${unfinished.id}/correct`, {
        clockInAt,
        clockOutAt: outAt,
        note,
      });
      return { recordId: corrected.id };
    }
    const record = await api.post<{ id: string }>("/api/v1/ops/attendance/clock-in", {
      employeeId: input.employee,
      at: clockInAt,
      note,
    });
    if (outAt) await api.post(`/api/v1/ops/attendance/${record.id}/clock-out`, { at: outAt });
    return { recordId: record.id };
  });
}

// ── Offboarding ─────────────────────────────────────────────────────────────────────────────────

/** Tick an offboarding step, or take the tick back. An owner-only step is refused unless the caller manages the team. */
export async function setChecklistStep(ctx: SourceContext, id: string, done: boolean): Promise<void> {
  await inOwningBusiness(ctx, (api) => api.post(`/api/v1/ops/hr/checklist-items/${encodeURIComponent(id)}`, { done }));
}

// ── Roster ──────────────────────────────────────────────────────────────────────────────────────

interface Template {
  id: string;
  propertyId: string;
  name: string;
  startsAt: string;
  status: "active" | "archived";
}
interface Entry {
  id: string;
  employee: { employeeId: string };
  shiftTemplateId: string;
  propertyId: string;
  workDate: string;
  status: "scheduled" | "cancelled";
}
interface Branch {
  id: string;
  name: string;
  isHeadOffice?: boolean;
}

const letterOf = (startsAt: string): ShiftLetter => {
  const h = Number(startsAt.slice(0, 2));
  return h >= 21 || h < 4 ? "N" : h >= 12 ? "E" : "M";
};
const STANDARD: Record<Exclude<ShiftLetter, "O">, string> = { M: "morning", E: "evening", N: "night" };

/** The branch the roster screen works on (the head office) and the day a grid cell stands for. */
function rosterDay(
  ctx: SourceContext,
  week: RosterWeekId,
  dayIndex: number,
): { api: ScopedApi; branch: Branch; date: string } {
  if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 6)
    throw new ApiError(422, "bad_day", "That is not a day of the week shown.", null);
  const api = ctx.ops("hospitality");
  const branches = (api.workspace.branches ?? []) as Branch[];
  const branch = branches.find((b) => b.isHeadOffice) ?? branches[0];
  if (!branch) throw new ApiError(404, "no_branch", "This business has no branch to roster.", null);
  return { api, branch, date: addDays(ctx.today.iso, (week === "next" ? 7 : 0) + dayIndex) };
}

async function templateFor(api: ScopedApi, propertyId: string, letter: Exclude<ShiftLetter, "O">): Promise<Template> {
  const { templates } = await api.get<{ templates: Template[] }>("/api/v1/ops/shift-templates", {
    query: { propertyId },
  });
  const active = templates.filter((t) => t.status === "active" && t.propertyId === propertyId);
  const found =
    active.find((t) => t.name.toLowerCase() === STANDARD[letter]) ??
    active.filter((t) => letterOf(t.startsAt) === letter).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  if (!found) throw new ApiError(422, "no_template", `This branch has no ${STANDARD[letter]} shift to roster.`, null);
  return found;
}

/** The person's scheduled shifts on a day, at any branch of the business. */
async function shiftsOn(api: ScopedApi, employeeId: string, date: string): Promise<Entry[]> {
  const branches = (api.workspace.branches ?? []) as Branch[];
  const weeks = await Promise.all(
    branches.map((b) =>
      api.get<{ entries: Entry[] }>("/api/v1/ops/roster/week", { query: { propertyId: b.id, from: date } }),
    ),
  );
  return weeks
    .flatMap((w) => w.entries)
    .filter((e) => e.employee.employeeId === employeeId && e.workDate === date && e.status === "scheduled");
}

/**
 * Change one cell of the roster grid: the shift that day is cancelled and the new one rostered
 * (`POST /ops/roster/:id/cancel`, `POST /ops/roster`). In a published week the API publishes the new
 * shift at once and tells the person; in a draft week it waits for Publish. "O" is a day off.
 */
export async function setShift(
  ctx: SourceContext,
  input: { week: RosterWeekId; employeeId: string; dayIndex: number; shift: ShiftLetter; lent?: boolean },
): Promise<void> {
  const { api, branch, date } = rosterDay(ctx, input.week, input.dayIndex);
  const current = await shiftsOn(api, input.employeeId, date);
  // Lent shifts work at another branch of the business, the home branch keeps the person's file.
  const others = ((api.workspace.branches ?? []) as Branch[]).filter((b) => b.id !== branch.id);
  const at = input.lent ? others[0] : branch;
  if (!at) throw new ApiError(422, "no_branch", "There is no other branch to lend this shift to.", null);
  const template = input.shift === "O" ? null : await templateFor(api, at.id, input.shift);
  if (current.length === 1 && template && current[0].shiftTemplateId === template.id) return;
  for (const e of current) {
    await api.post(`/api/v1/ops/roster/${e.id}/cancel`, { reason: "Changed on the roster" });
  }
  if (template) {
    await api.post("/api/v1/ops/roster", {
      employeeId: input.employeeId,
      shiftTemplateId: template.id,
      workDate: date,
    });
  }
}

/** Lend a shift to the business's other branch, or bring it home: the same shift, at the other branch. */
export async function setLent(
  ctx: SourceContext,
  input: { week: RosterWeekId; employeeId: string; dayIndex: number; lent: boolean },
): Promise<void> {
  const { api, date } = rosterDay(ctx, input.week, input.dayIndex);
  const current = await shiftsOn(api, input.employeeId, date);
  if (current.length === 0) throw new ApiError(409, "day_off", "There is no shift that day to lend.", null);
  const { templates } = await api.get<{ templates: Template[] }>("/api/v1/ops/shift-templates");
  const was = templates.find((t) => t.id === current[0].shiftTemplateId);
  await setShift(ctx, { ...input, shift: was ? letterOf(was.startsAt) : "M", lent: input.lent });
}

/** Publish the roster branch's week (`POST /ops/roster/publish`): its drafts reach the staff app, each person told once. */
export async function publishWeek(ctx: SourceContext, week: RosterWeekId): Promise<void> {
  const { api, branch, date } = rosterDay(ctx, week, 0);
  await api.post("/api/v1/ops/roster/publish", { propertyId: branch.id, from: date, to: addDays(date, 6) });
}

/** Approve or refuse a swap both colleagues agreed to (`POST /ops/shift-requests/:id/approve|reject`). */
export async function decideSwap(ctx: SourceContext, id: string, decision: "approved" | "declined"): Promise<void> {
  await inOwningBusiness(ctx, (api) =>
    api.post(`/api/v1/ops/shift-requests/${encodeURIComponent(id)}/${decision === "approved" ? "approve" : "reject"}`, {
      note: null,
    }),
  );
}
