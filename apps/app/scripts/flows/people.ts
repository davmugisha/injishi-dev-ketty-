/**
 * The HR officer's day on the API, with the mutations the People screens call and the live sources
 * they read: leave decided at the HR step, clock corrections decided, desk entries, offboarding steps,
 * and the roster (a shift changed, a week published, a swap approved and refused).
 *
 * Each flow makes its own records (a leave request, a correction, a swap) or puts back what it moved,
 * so it can run again on the same database; `seed-interface.mjs` converges the rest away. Every read-back
 * uses a fresh context, as a new page request would. Refusals: finance holds no HR permission (403), and
 * the owner-only offboarding step refuses HR (403).
 */
import type {
  AttendanceException,
  ClockCorrection,
  ClockRecord,
  DeskEmployee,
  Employee,
  LeaveRequest,
  OffboardingTask,
  RosterStaff,
  RosterWeek,
  ShiftSwap,
} from "@injishi/data/fixtures/people";
import { clock } from "../../src/server/format";
import {
  decideCorrection,
  decideLeave,
  decideSwap,
  publishWeek,
  saveDeskEntry,
  setChecklistStep,
  setShift,
} from "../../src/server/mutations/people";
import { addDays, sources } from "../../src/server/sources/people";
import type { SourceContext } from "../../src/server/sources/types";
import type { Flow, FlowHelpers } from "./types";

type Docs<T> = Promise<T[]>;
const read = <T>(ctx: SourceContext, name: keyof typeof sources) => sources[name].list(ctx) as Docs<T>;

async function employeeNamed(ctx: SourceContext, name: string): Promise<Employee> {
  const e = (await read<Employee>(ctx, "people.employees")).find((x) => x.name === name);
  if (!e) throw new Error(`${name} is not in the directory`);
  return e;
}

/** File a leave request for someone on a free stretch of days, a few months out (retried past an overlap). */
async function fileLeave(
  hr: SourceContext,
  employeeId: string,
  typeCode: string,
  { check }: Pick<FlowHelpers, "check">,
): Promise<{ id: string; startsOn: string }> {
  const { types } = await hr.ops().get<{ types: { id: string; code: string }[] }>("/api/v1/ops/leave/types");
  const type = types.find((t) => t.code === typeCode);
  check(type, `no ${typeCode} leave type`);
  for (let tries = 0; tries < 40; tries++) {
    // One day later each try, not one week: when today + 60 is a Saturday, the same weekday a week later is
    // a weekend again, every time (the flow failed on Tuesdays).
    const startsOn = addDays(hr.today.iso, 60 + tries);
    try {
      const created = await hr.ops().post<{ id: string }>("/api/v1/ops/leave/requests", {
        employeeId,
        leaveTypeId: type.id,
        startsOn,
        endsOn: addDays(startsOn, 1),
        reason: "Flow check",
      });
      return { id: created.id, startsOn };
    } catch (error) {
      // 409: those days are already on leave. 422: they hold no working day (a weekend the person is not
      // rostered on, or a public holiday such as 25 December). Either way, try the next day.
      const { status, message } = error as { status?: number; message?: string };
      const noWorkingDay = status === 422 && /no working day/i.test(message ?? "");
      if (status !== 409 && !noWorkingDay) throw error;
    }
  }
  throw new Error("no free working days found for a leave request");
}

export const flows: Flow[] = [
  {
    name: "leave: the line manager approves, HR approves the second step; another is declined with a reason",
    async run({ as, check, refused, step }) {
      const hr = await as("hr");
      const manager = await as("manager");
      const divine = await employeeNamed(hr, "Divine Uwamahoro");

      const a = await fileLeave(hr, divine.id, "unpaid", { check });
      // Step one is the line manager's: the general manager decides it on the API, as a manager would.
      await manager.ops().post(`/api/v1/ops/leave/requests/${a.id}/approve`, { note: "Cover arranged" });
      let list = await read<LeaveRequest>(await as("hr"), "people.leaveRequests");
      const waiting = list.find((r) => r.id === a.id);
      check(waiting?.step === "hr", `after the line manager, the request reads ${JSON.stringify(waiting)}`);
      check(
        waiting.lm === "Aline Uwase" && /^Approved /.test(waiting.lmNote),
        `the line manager step reads ${waiting.lm} / ${waiting.lmNote}`,
      );
      step(`Divine's unpaid leave is at the HR step (${waiting.dates})`);

      await refused(403, async () => decideLeave(await as("finance"), a.id, "approved"), "finance deciding leave");
      await decideLeave(hr, a.id, "approved");
      list = await read<LeaveRequest>(await as("hr"), "people.leaveRequests");
      const approved = list.find((r) => r.id === a.id);
      check(
        approved?.step === "approved" && /^Approved by Diane Ingabire/.test(approved.by ?? ""),
        `approved reads ${JSON.stringify(approved)}`,
      );
      step(`HR approved it: "${approved.by}"`);
      await refused(409, () => decideLeave(hr, a.id, "approved"), "approving it twice");

      const b = await fileLeave(hr, divine.id, "unpaid", { check });
      await manager.ops().post(`/api/v1/ops/leave/requests/${b.id}/approve`, { note: null });
      await refused(422, () => decideLeave(hr, b.id, "declined", "  "), "declining with no reason");
      await decideLeave(hr, b.id, "declined", "The front desk is short that week");
      list = await read<LeaveRequest>(await as("hr"), "people.leaveRequests");
      const declined = list.find((r) => r.id === b.id);
      check(
        declined?.step === "declined" && declined.hrReason === "The front desk is short that week",
        `declined reads ${JSON.stringify(declined)}`,
      );
      step("the second was declined with its reason");

      // Leave the days where they were: the approved one is cancelled (a reversal on the ledger).
      await hr.ops().post(`/api/v1/ops/leave/requests/${a.id}/cancel`, { note: "Flow check done" });
    },
  },

  {
    name: "attendance: a correction for a missing record is approved, another declined",
    async run({ as, check, refused, step }) {
      const hr = await as("hr");
      const liliane = await employeeNamed(hr, "Liliane Umutoni");
      const days = Array.from({ length: 6 }, (_, i) => addDays(hr.today.iso, -(i + 2)));
      // A free hour on a past day: a correction may not overlap a record already on file.
      const taken = new Map<string, { clockInAt: string; clockOutAt: string | null }[]>();
      for (const d of days) {
        const page = await hr.ops().get<{
          items: { employee: { employeeId: string }; clockInAt: string; clockOutAt: string | null; status: string }[];
        }>("/api/v1/ops/attendance", { query: { f: JSON.stringify([["workDate", "eq", d]]), size: "100" } });
        taken.set(
          d,
          page.items.filter((r) => r.employee.employeeId === liliane.id && r.status !== "superseded"),
        );
      }
      const slots: { day: string; hour: number }[] = [];
      for (const d of days) {
        for (let h = 1; h < 22; h++) {
          const from = Date.parse(`${d}T${String(h).padStart(2, "0")}:00:00+02:00`);
          const busy = (taken.get(d) ?? []).some(
            (r) =>
              Date.parse(r.clockInAt) < from + 3_600_000 && (r.clockOutAt ? Date.parse(r.clockOutAt) : Infinity) > from,
          );
          if (!busy) slots.push({ day: d, hour: h });
        }
      }
      check(slots.length >= 2, "no free hour for Liliane in the last week");
      const ask = async (slot: { day: string; hour: number }) => {
        const at = (h: number) => new Date(`${slot.day}T${String(h).padStart(2, "0")}:00:00+02:00`).toISOString();
        return hr.ops().post<{ id: string }>("/api/v1/ops/attendance-requests", {
          employeeId: liliane.id,
          workDate: slot.day,
          clockInAt: at(slot.hour),
          clockOutAt: new Date(Date.parse(at(slot.hour)) + 50 * 60_000).toISOString(),
          reason: "Worked a cover hour the kiosk did not record",
        });
      };
      const one = await ask(slots[0]);
      let list = await read<ClockCorrection>(await as("hr"), "people.corrections");
      check(list.find((c) => c.id === one.id)?.state === "pending", "the new correction is not waiting for HR");
      await refused(
        403,
        async () => decideCorrection(await as("finance"), one.id, "approved"),
        "finance deciding a correction",
      );
      await decideCorrection(hr, one.id, "approved");
      list = await read<ClockCorrection>(await as("hr"), "people.corrections");
      const approved = list.find((c) => c.id === one.id);
      check(
        approved?.state === "approved" && /^Approved by Diane Ingabire/.test(approved.outcome ?? ""),
        `approved reads ${JSON.stringify(approved)}`,
      );
      step(`approved: ${approved.outcome}`);

      const two = await ask(slots[1]);
      await decideCorrection(hr, two.id, "declined", "No one confirmed this hour");
      list = await read<ClockCorrection>(await as("hr"), "people.corrections");
      const declined = list.find((c) => c.id === two.id);
      check(
        declined?.state === "declined" && declined.hrNote === "No one confirmed this hour",
        `declined reads ${JSON.stringify(declined)}`,
      );
      step("the second was declined with its note");
      await refused(409, () => decideCorrection(hr, two.id, "approved"), "deciding a declined correction");
    },
  },

  {
    name: "attendance: a desk entry clocks an absent person in, a second is refused, an out time closes it",
    async run({ as, check, refused, step }) {
      const hr = await as("hr");
      const damascene = await employeeNamed(hr, "Damascene Tuyisenge");
      const now = Date.now();
      const inAt = clock(new Date(now - 15 * 60_000));
      const outAt = clock(new Date(now - 60_000));
      const entry = {
        employee: damascene.id,
        date: hr.today.iso,
        clockIn: inAt,
        clockOut: "",
        reason: "Kiosk or phone unavailable",
        justification: "Theogene saw him arrive; the lodge kiosk was offline",
      };
      await refused(403, async () => saveDeskEntry(await as("finance"), entry), "finance making a desk entry");
      await saveDeskEntry(hr, entry);
      const after = await as("hr");
      const records = await read<ClockRecord>(after, "people.clockRecords");
      const mine = records.filter((r) => r.name === "Damascene Tuyisenge" && r.day === "today");
      check(
        mine.some((r) => r.source === "desk" && r.clockIn === inAt),
        `Damascene's records read ${JSON.stringify(mine)}`,
      );
      const exceptions = await read<AttendanceException>(after, "people.attendanceExceptions");
      check(
        !exceptions.some((x) => x.kind === "absent" && x.title.startsWith("Damascene")),
        "Damascene is still absent",
      );
      const desk = await read<DeskEmployee>(after, "people.deskEmployees");
      // Desk entry lists everyone on staff: once clocked in he moves from "Needs a record" to "Everyone else".
      check(
        !desk.some((d) => d.name === "Damascene Tuyisenge" && d.due !== false),
        "Damascene still needs a desk entry",
      );
      step(`desk entry: Damascene in at ${inAt}, no longer absent`);

      await refused(409, () => saveDeskEntry(hr, entry), "a second clock-in while one is open");
      await saveDeskEntry(hr, { ...entry, clockOut: outAt });
      const closed = (await read<ClockRecord>(await as("hr"), "people.clockRecords")).filter(
        (r) => r.name === "Damascene Tuyisenge" && r.day === "today" && r.clockIn === inAt,
      );
      check(
        closed.some((r) => /^Complete /.test(r.status)),
        `after the out time, his record reads ${JSON.stringify(closed)}`,
      );
      step(`an out time at ${outAt} put the record right: ${closed[0]?.status}`);
    },
  },

  {
    name: "employees: an offboarding step is ticked and unticked; the owner-only step refuses HR",
    async run({ as, check, refused, step }) {
      const hr = await as("hr");
      const tasks = await read<OffboardingTask>(hr, "people.offboarding");
      const open = tasks.find((t) => !t.ownerOnly && !t.done);
      const owners = tasks.find((t) => t.ownerOnly);
      check(open && owners, `the offboarding list reads ${JSON.stringify(tasks)}`);
      await setChecklistStep(hr, open.id, true);
      let now = await read<OffboardingTask>(await as("hr"), "people.offboarding");
      check(now.find((t) => t.id === open.id)?.done === true, `"${open.title}" is not ticked`);
      step(`ticked "${open.title}"`);
      // One checklist for HR: ticking what is ticked changes nothing and is not an error.
      await setChecklistStep(hr, open.id, true);
      now = await read<OffboardingTask>(await as("hr"), "people.offboarding");
      check(now.find((t) => t.id === open.id)?.done === true, `a second tick of "${open.title}" undid it`);
      await setChecklistStep(hr, open.id, false);
      now = await read<OffboardingTask>(await as("hr"), "people.offboarding");
      check(now.find((t) => t.id === open.id)?.done === false, `"${open.title}" is still ticked`);
      step("and took the tick back");

      await refused(403, () => setChecklistStep(hr, owners.id, true), "HR ticking the owner's step");
      await refused(403, async () => setChecklistStep(await as("finance"), open.id, true), "finance ticking a step");
      const owner = await as("owner");
      await setChecklistStep(owner, owners.id, true);
      now = await read<OffboardingTask>(await as("hr"), "people.offboarding");
      check(now.find((t) => t.id === owners.id)?.done === true, "the owner's tick did not land");
      await setChecklistStep(owner, owners.id, false);
      step(`the owner ticked "${owners.title}" (HR was refused), then took it back`);

      // What the desk sees of a colleague is a name and a job title: the team read carries no grade for it.
      type Teams = { placements: { employeeId: string; grade: string | null; probationEndsOn: string | null }[] };
      const forHr = await (await as("hr")).ops().get<Teams>("/api/v1/ops/hr/teams");
      const forDesk = await (await as("frontdesk")).ops().get<Teams>("/api/v1/ops/hr/teams");
      check(
        forHr.placements.some((p) => p.grade),
        "HR reads no grades on the team list",
      );
      check(
        forDesk.placements.length > 0 &&
          forDesk.placements.every((p) => p.grade === null && p.probationEndsOn === null),
        "the front desk reads grades or probation ends on the team list",
      );
      await refused(
        403,
        async () => (await as("finance")).ops().get("/api/v1/ops/hr/teams"),
        "finance reading the teams",
      );
      step("the desk reads teams without grades; finance cannot read them");
    },
  },

  {
    name: "roster: a shift is changed in next week's draft, the week is published, the shift put back",
    async run({ as, check, refused, step }) {
      const hr = await as("hr");
      const staff = await read<RosterStaff>(hr, "people.rosterStaff");
      const divine = staff.find((s) => s.name === "Divine Uwamahoro");
      check(divine, "Divine is not on the roster");
      const d = 1;
      const was = divine.shifts.next[d] as "M" | "E" | "N" | "O";
      const to = was === "E" ? "M" : "E";
      await refused(
        403,
        async () => setShift(await as("finance"), { week: "next", employeeId: divine.id, dayIndex: d, shift: to }),
        "finance changing the roster",
      );
      await setShift(hr, { week: "next", employeeId: divine.id, dayIndex: d, shift: to });
      let now = (await read<RosterStaff>(await as("hr"), "people.rosterStaff")).find((s) => s.id === divine.id);
      check(now?.shifts.next[d] === to, `next week reads ${now?.shifts.next}, expected ${to} on day ${d}`);
      step(`Divine's ${to === "E" ? "evening" : "morning"} on day ${d} of next week is on the roster`);

      await publishWeek(hr, "next");
      const weeks = await read<RosterWeek>(await as("hr"), "people.rosterWeeks");
      const next = weeks.find((w) => w.id === "next");
      check(next?.status === "published" && next.publishedAt, `next week reads ${JSON.stringify(next)}`);
      step(`next week published (${next.label})`);

      await setShift(hr, { week: "next", employeeId: divine.id, dayIndex: d, shift: was });
      now = (await read<RosterStaff>(await as("hr"), "people.rosterStaff")).find((s) => s.id === divine.id);
      check(now?.shifts.next[d] === was, `after putting it back, next week reads ${now?.shifts.next}`);
      step(`and put back to ${was}`);
    },
  },

  {
    name: "roster: a swap both colleagues agreed is approved, another refused",
    async run({ as, check, refused, step }) {
      const hr = await as("hr");
      const staff = await read<RosterStaff>(hr, "people.rosterStaff");
      const ange = staff.find((s) => s.name === "Ange Mutoni");
      const divine = staff.find((s) => s.name === "Divine Uwamahoro");
      check(ange && divine, "Ange or Divine is not on the roster");
      const day = 6;
      const date = addDays(hr.today.iso, day);
      const swapOn = async () => {
        const created = await hr.ops().post<{ id: string }>("/api/v1/ops/shift-requests", {
          kind: "swap",
          employeeId: ange.id,
          swapEmployeeId: divine.id,
          from: date,
          to: date,
          reason: "Flow check: they agreed to trade the day",
        });
        // Divine has no account: the office records her yes, as the colleague would in the staff app.
        await hr.ops().post(`/api/v1/ops/shift-requests/${created.id}/accept-for-colleague`, {});
        return created.id;
      };
      const id = await swapOn();
      const listed = (await read<ShiftSwap>(await as("hr"), "people.shiftSwaps")).find((w) => w.id === id);
      check(
        listed?.day === day && listed.a === ange.id && listed.b === divine.id,
        `the swap reads ${JSON.stringify(listed)}`,
      );
      await refused(403, async () => decideSwap(await as("finance"), id, "approved"), "finance deciding a swap");
      await decideSwap(hr, id, "approved");
      const after = await read<RosterStaff>(await as("hr"), "people.rosterStaff");
      const a2 = after.find((s) => s.id === ange.id);
      const d2 = after.find((s) => s.id === divine.id);
      check(
        a2?.shifts.this[day] === divine.shifts.this[day] && d2?.shifts.this[day] === ange.shifts.this[day],
        `after the swap Ange reads ${a2?.shifts.this}, Divine ${d2?.shifts.this}`,
      );
      check(
        !(await read<ShiftSwap>(await as("hr"), "people.shiftSwaps")).some((w) => w.id === id),
        "an approved swap is still waiting",
      );
      step(`approved: Ange and Divine traded day ${day}`);

      const second = await swapOn();
      await decideSwap(hr, second, "declined");
      const kept = await read<RosterStaff>(await as("hr"), "people.rosterStaff");
      check(
        kept.find((s) => s.id === ange.id)?.shifts.this[day] === a2?.shifts.this[day],
        "a refused swap moved a shift",
      );
      step("the second swap was refused and nothing moved");
      await refused(409, () => decideSwap(hr, second, "approved"), "deciding a refused swap");
      // Trade the day back, so the week is as the flow found it.
      const back = await swapOn();
      await decideSwap(hr, back, "approved");
    },
  },
];
