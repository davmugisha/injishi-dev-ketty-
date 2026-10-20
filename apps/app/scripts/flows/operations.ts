/**
 * The operations floor on the API: the housekeeping board (add, assign, clean, inspect, fail, remind),
 * maintenance (a work order with a room block from request to release, signals acted on and
 * dismissed) and the lost and found register (intake to return, two-person disposal), with the same
 * mutations the screens call and the same live sources they read. Each flow ends with the refusals
 * the platform makes on purpose.
 */
import type {
  CleaningTask,
  ConditionSignal,
  FoundItem,
  HousekeepingEscalation,
  HousekeepingRoom,
  HousekeepingStaff,
  RoomHistory,
  SignalReview,
  WorkOrder,
} from "@injishi/data/fixtures/operations";
import * as ops from "../../src/server/mutations/operations";
import { advanceHousekeepingTask } from "../../src/server/mutations/platform";
import { forgetOperations, sources } from "../../src/server/sources/operations";
import type { SourceContext } from "../../src/server/sources/types";
import type { Flow } from "./types";

/** A live collection as the screen would read it now (never a read from before the last write). */
async function read<T>(ctx: SourceContext, name: keyof typeof sources): Promise<T[]> {
  forgetOperations(ctx);
  return (await sources[name].list(ctx)) as T[];
}

const kigaliStamp = (at: Date) => {
  const day = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Kigali",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(at);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Kigali",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(at);
  return `${day}, ${time}`;
};

export const flows: Flow[] = [
  {
    name: "housekeeping: a task is added, assigned, cleaned, refused to its cleaner, and passed by the manager",
    async run({ as, check, refused, step }) {
      const manager = await as("manager");
      const jeanne = await as("housekeeper");
      const staff = await read<HousekeepingStaff>(manager, "operations.housekeepingStaff");
      const vestine = staff.find((s) => s.name === "Vestine Mukarugwiza");
      const jeanneId = jeanne.account?.user.id;
      check(vestine && jeanneId, "today's sheet lacks Vestine or Jeanne");

      const id = await ops.addCleaningTask(manager, {
        room: "103",
        kind: "Checkout",
        assignee: vestine.id,
        due: "By 16:00",
        minutes: 30,
      });
      let task = (await read<CleaningTask>(manager, "operations.cleaningTasks")).find((t) => t.id === id);
      check(
        task?.column === "todo" && task.assignee === vestine.id && task.due === "By 16:00" && task.minutes === 30,
        `the new task reads ${JSON.stringify(task)}`,
      );
      check(!task.auto, "a task added by hand reads as created by a rule");
      step(`manager added a checkout clean for 103 on Vestine's list (${id})`);

      await ops.assignCleaningTask(manager, id, jeanneId);
      task = (await read<CleaningTask>(manager, "operations.cleaningTasks")).find((t) => t.id === id);
      check(task?.assignee === jeanneId, `after Assign the task reads ${JSON.stringify(task)}`);
      step("manager reassigned it to Jeanne");

      await advanceHousekeepingTask(jeanne, id, "in_progress");
      await advanceHousekeepingTask(jeanne, id, "done");
      task = (await read<CleaningTask>(manager, "operations.cleaningTasks")).find((t) => t.id === id);
      check(
        task?.column === "clean" && /^Cleaned \d{2}:\d{2}/.test(task.due),
        `after the clean: ${JSON.stringify(task)}`,
      );
      let room = (await read<HousekeepingRoom>(manager, "operations.rooms")).find((r) => r.id === "103");
      check(
        room?.status === "clean" && room.note === "Wait insp.",
        `room 103 after the clean: ${JSON.stringify(room)}`,
      );
      step("Jeanne cleaned it on her phone: Clean, waiting for inspection");

      // The Inspection Gate: the cleaner cannot pass her own room.
      await refused(403, () => ops.inspectCleaningTask(jeanne, id, "pass"), "Jeanne passing a room she cleaned");

      await ops.inspectCleaningTask(manager, id, "pass");
      task = (await read<CleaningTask>(manager, "operations.cleaningTasks")).find((t) => t.id === id);
      check(
        task?.column === "insp" && /^Passed \d{2}:\d{2} · Aline Uwase$/.test(task.due),
        `after Pass: ${JSON.stringify(task)}`,
      );
      room = (await read<HousekeepingRoom>(manager, "operations.rooms")).find((r) => r.id === "103");
      check(room?.status === "inspected", `room 103 after Pass: ${JSON.stringify(room)}`);
      const history = (await read<RoomHistory>(manager, "operations.roomHistory")).find((h) => h.id === "103");
      check(
        history?.events[0]?.what === "Clean → Inspected" && history.events[0].who.startsWith("Aline Uwase · "),
        `room 103's history: ${JSON.stringify(history)}`,
      );
      step("manager passed it: Inspected, and the room's history says who and when");

      await refused(409, () => ops.inspectCleaningTask(manager, id, "pass"), "inspecting a room twice");
    },
  },
  {
    name: "housekeeping: a failed inspection reopens the room as a re-clean; escalations resolve by their act",
    async run({ as, check, refused, step }) {
      const manager = await as("manager");
      const jeanne = await as("housekeeper");
      const jeanneId = jeanne.account?.user.id;
      check(jeanneId, "Jeanne has no account");
      const id = await ops.addCleaningTask(manager, {
        room: "104",
        kind: "Deep clean",
        assignee: jeanneId,
        due: "By 17:00",
      });
      await advanceHousekeepingTask(jeanne, id, "in_progress");
      await advanceHousekeepingTask(jeanne, id, "done");
      await ops.inspectCleaningTask(manager, id, "fail", "Bathroom not finished");
      const tasks = await read<CleaningTask>(manager, "operations.cleaningTasks");
      check(!tasks.some((t) => t.id === id), "the failed clean is still on the board");
      const reclean = tasks.find((t) => t.room === "104" && t.kind === "Re-clean");
      check(
        reclean?.column === "todo" && reclean.assignee === jeanneId && reclean.due.endsWith("· Bathroom not finished"),
        `the re-clean reads ${JSON.stringify(reclean)}`,
      );
      const room = (await read<HousekeepingRoom>(manager, "operations.rooms")).find((r) => r.id === "104");
      check(room?.status === "dirty" && room.note === "Re-clean", `room 104 after Fail: ${JSON.stringify(room)}`);
      step("manager failed 104 with a reason: back in To do as a Re-clean for Jeanne, room Dirty");
      await refused(409, () => ops.inspectCleaningTask(manager, id, "fail", "again"), "failing the same clean twice");

      // Escalations: the board shows one per task; each resolves by what it asked for.
      let escalations = await read<HousekeepingEscalation>(manager, "operations.housekeepingEscalations");
      const reassign = escalations.find((e) => e.action === "reassign");
      const remind = escalations.find((e) => e.action === "remind");
      check(reassign && remind, `the board's escalations: ${JSON.stringify(escalations)}`);
      const frontdesk = await as("frontdesk");
      await refused(403, () => ops.remindEscalation(frontdesk, remind.id), "the front desk reminding the supervisor");
      await ops.remindEscalation(manager, remind.id);
      escalations = await read<HousekeepingEscalation>(manager, "operations.housekeepingEscalations");
      const reminded = escalations.find((e) => e.id === remind.id);
      check(reminded && reminded.cta === reminded.doneCta, `after Remind: ${JSON.stringify(reminded)}`);
      step(`reminded: the button now reads "${reminded.cta}"`);

      const staff = await read<HousekeepingStaff>(manager, "operations.housekeepingStaff");
      const odette = staff.find((s) => s.name === "Odette Uwamahoro");
      check(odette, "Odette is not on today's sheet");
      // 204 is one of Jeanne's seven tasks (platform.mjs), whose seed does not reset its assignee, so the
      // flow gives it back to Jeanne whatever happens: the next seed must find her board as it was.
      try {
        await ops.assignCleaningTask(manager, reassign.task, odette.id);
        escalations = await read<HousekeepingEscalation>(manager, "operations.housekeepingEscalations");
        check(!escalations.some((e) => e.action === "reassign"), "the reassign escalation outlived the reassignment");
        step("204 reassigned to Odette: its escalation is resolved");

        // A task can only go to someone who can do it.
        const finance = await as("finance");
        const financeId = finance.account?.user.id;
        check(financeId, "finance has no account");
        await refused(
          422,
          () => ops.assignCleaningTask(manager, reassign.task, financeId),
          "assigning a clean to the accountant",
        );
        await refused(
          403,
          () => ops.assignCleaningTask(jeanne, reassign.task, jeanneId),
          "a housekeeper assigning work",
        );
        await refused(403, () => read(finance, "operations.cleaningTasks"), "finance reading the board");
        step(
          "refused: the accountant as assignee (422), a housekeeper assigning (403), finance reading the board (403)",
        );
      } finally {
        await ops.assignCleaningTask(manager, reassign.task, jeanneId);
      }
    },
  },
  {
    name: "maintenance: a work order asks for a block, the manager approves, and the room comes back only after repair and inspection",
    async run({ as, check, refused, step }) {
      const manager = await as("manager");
      const tech = await as("technician");
      const supervisor = await as("supervisor");
      const ref = await ops.createWorkOrder(manager, {
        asset: "Room 106",
        title: "Shower drain slow",
        details: "Water stands in the shower tray; the drain needs clearing.",
        severity: "High",
        owner: "Jean-Paul Niyonsaba",
        requestBlock: true,
      });
      let order = (await read<WorkOrder>(manager, "operations.workOrders")).find((w) => w.id === ref);
      check(
        order?.owner === "Jean-Paul Niyonsaba" && order.block === "requested" && order.severity === "High",
        `the new order reads ${JSON.stringify(order)}`,
      );
      check(
        order.decision && order.pending?.what === "Waiting for your decision",
        "a requested block offers no decision",
      );
      step(`manager raised ${ref} on Room 106 with a block request`);

      await refused(403, () => ops.decideRoomBlock(tech, ref, "approve"), "the technician approving his own block");
      await ops.decideRoomBlock(manager, ref, "approve");
      order = (await read<WorkOrder>(manager, "operations.workOrders")).find((w) => w.id === ref);
      check(
        order?.block === "active" && order.blockText.endsWith("until released"),
        `after approval: ${JSON.stringify(order?.blockText)}`,
      );
      let room = (await read<HousekeepingRoom>(manager, "operations.rooms")).find((r) => r.id === "106");
      check(room?.status === "ooo" && room.note === ref, `room 106 after approval: ${JSON.stringify(room)}`);
      step("approved: the room is out of order on the housekeeping board");

      await refused(409, () => ops.releaseRoom(manager, ref), "releasing before the repair is closed");
      await ops.addWorkOrderNote(tech, ref, "Trap cleared, testing the flow.");
      order = (await read<WorkOrder>(manager, "operations.workOrders")).find((w) => w.id === ref);
      check(
        order?.timeline.some(
          (e) => e.what === "Trap cleared, testing the flow." && e.who.startsWith("Note · Jean-Paul"),
        ),
        "the technician's note is not on the timeline",
      );

      // The repair closes on the technician's phone (the residence and hotel ticket route).
      const { workOrders } = await manager
        .ops()
        .get<{ workOrders: { id: string; reference: string; roomId: string }[] }>("/api/v1/ops/work-orders");
      const raw = workOrders.find((w) => w.reference === ref);
      check(raw, `${ref} is not on the API's list`);
      await tech
        .ops()
        .post(`/api/v1/ops/tickets/${raw.id}/advance`, { to: "resolved", note: "Drain cleared and tested." });
      await refused(409, () => ops.releaseRoom(manager, ref), "releasing before housekeeping inspects");
      await supervisor.ops().post(`/api/v1/ops/rooms/${raw.roomId}/housekeeping`, { housekeeping: "inspected" });
      await ops.releaseRoom(manager, ref);
      order = (await read<WorkOrder>(manager, "operations.workOrders")).find((w) => w.id === ref);
      check(
        order?.block === "none" && order.blockText.startsWith("Released"),
        `after release: ${JSON.stringify(order)}`,
      );
      room = (await read<HousekeepingRoom>(manager, "operations.rooms")).find((r) => r.id === "106");
      check(room?.status === "inspected", `room 106 after release: ${JSON.stringify(room)}`);
      step("repair closed, room inspected, released: back on sale and Ready");

      // A declined block leaves the room on sale.
      const declined = await ops.createWorkOrder(tech, {
        asset: "Room 108",
        title: "Loose towel rail",
        severity: "Low",
        owner: null,
        requestBlock: true,
      });
      await ops.decideRoomBlock(manager, declined, "decline");
      const d = (await read<WorkOrder>(manager, "operations.workOrders")).find((w) => w.id === declined);
      check(
        d?.block === "declined" && d.suggestedOwner === "Jean-Paul Niyonsaba",
        `the declined order: ${JSON.stringify(d)}`,
      );
      await ops.assignWorkOrder(manager, declined, "Jean-Paul Niyonsaba");
      const assigned = (await read<WorkOrder>(manager, "operations.workOrders")).find((w) => w.id === declined);
      check(
        assigned?.owner === "Jean-Paul Niyonsaba" && assigned.status === "Assigned",
        `after Assign: ${JSON.stringify(assigned)}`,
      );
      step(`${declined}: block declined, assigned to the usual technician`);

      await refused(
        422,
        () =>
          ops.createWorkOrder(manager, {
            asset: "The moon",
            title: "x",
            severity: "Low",
            owner: null,
            requestBlock: false,
          }),
        "an order about a place the property does not have",
      );
      const finance = await as("finance");
      await refused(403, () => read(finance, "operations.workOrders"), "finance reading the work orders");
    },
  },
  {
    name: "maintenance: a condition signal is acted on, another dismissed with a reason",
    async run({ as, check, refused, step }) {
      const manager = await as("manager");
      const signals = await read<ConditionSignal>(manager, "operations.conditionSignals");
      const ac = signals.find((s) => s.rule === "AC-02");
      const wh = signals.find((s) => s.rule === "WH-01");
      check(ac && wh, `open signals: ${signals.map((s) => s.rule).join(", ")}`);
      const ref = await ops.actOnSignal(manager, ac.id);
      check(ref, "acting on a signal made no work order");
      const order = (await read<WorkOrder>(manager, "operations.workOrders")).find((w) => w.id === ref);
      check(
        order?.title === "AC compressor check" && order.asset === "Room 305",
        `the order from the signal: ${JSON.stringify(order)}`,
      );
      await ops.dismissSignal(manager, wh.id, "Sensor fault");
      const open = await read<ConditionSignal>(manager, "operations.conditionSignals");
      check(open.length === signals.length - 2, "reviewed signals are still open");
      const reviews = await read<SignalReview>(manager, "operations.signalReviews");
      check(
        reviews.some((r) => r.outcome === "Work order" && r.note.startsWith(`${ref} created by Aline Uwase`)) &&
          reviews.some((r) => r.outcome === "Dismissed" && r.note.endsWith(": Sensor fault")),
        `reviews: ${JSON.stringify(reviews)}`,
      );
      step(`AC-02 became ${ref}; WH-01 dismissed as a sensor fault; both are in "Reviewed this month"`);
      await refused(409, () => ops.dismissSignal(manager, wh.id, "again"), "reviewing a signal twice");
    },
  },
  {
    name: "lost and found: intake, claim and return; disposal needs a second person",
    async run({ as, check, refused, step }) {
      const manager = await as("manager");
      const frontdesk = await as("frontdesk");
      const ref = await ops.logFoundItem(manager, {
        description: "Blue silk scarf",
        category: "Clothing",
        valuable: false,
        area: "Room 309",
        spot: "Wardrobe",
        foundAt: kigaliStamp(new Date(Date.now() - 60 * 60_000)),
        foundBy: "Emmanuel Nsengimana",
        custodian: "Beatrice Mukandori",
        storage: "Store room L-2",
      });
      let item = (await read<FoundItem>(manager, "operations.foundItems")).find((i) => i.id === ref);
      check(
        item?.status === "stored" && item.where === "Room 309 · Wardrobe" && item.custodian === "Beatrice Mukandori",
        `the new item reads ${JSON.stringify(item)}`,
      );
      // The screen keeps no photos, so the custody log must not claim any.
      check(
        !item.custody.some((c) => /photo/i.test(`${c.what} ${c.who}`)),
        `the intake claims photos nobody kept: ${JSON.stringify(item.custody)}`,
      );
      step(`manager logged ${ref}, with no photo claimed on its custody log`);
      check(
        !item.custody.some((c) => /tag printed/i.test(c.what)),
        `the custody log claims a printed tag: ${JSON.stringify(item.custody)}`,
      );

      // The form's own defaults: the signed-in person found it and holds it (never a sample custodian).
      const me = manager.persona?.name ?? "";
      const mine = await ops.logFoundItem(manager, {
        description: "Black umbrella",
        category: "Accessories",
        valuable: false,
        area: "Lobby",
        foundAt: kigaliStamp(new Date(Date.now() - 30 * 60_000)),
        foundBy: me,
        custodian: me,
        storage: "Store room",
      });
      const logged = (await read<FoundItem>(manager, "operations.foundItems")).find((i) => i.id === mine);
      check(
        logged?.custodian === me && logged.foundBy === me,
        `the signed-in person as finder and custodian: ${JSON.stringify(logged)}`,
      );
      step(`with the form's defaults, ${me} found ${mine} and is its custodian`);
      let unknownRefused = false;
      try {
        await ops.logFoundItem(manager, {
          description: "Grey scarf",
          category: "Clothing",
          valuable: false,
          area: "Lobby",
          foundAt: kigaliStamp(new Date(Date.now() - 20 * 60_000)),
          foundBy: me,
          custodian: "Someone Not On The Register",
        });
      } catch (error) {
        unknownRefused = error instanceof ops.OperationsInputError;
      }
      check(unknownRefused, "a custodian nobody on the register is called was not refused");
      step("a custodian who is neither the signed-in person nor on the register is refused before any write");

      await ops.openFoundItemClaim(frontdesk, ref, {
        claimant: "Amina Uwase",
        statement: "a blue silk scarf with a fringe",
      });
      item = (await read<FoundItem>(manager, "operations.foundItems")).find((i) => i.id === ref);
      check(
        item?.status === "claim" && item.claim?.booking === "no booking" && item.claim.matched === false,
        `after the claim: ${JSON.stringify(item?.claim)}`,
      );
      await ops.releaseFoundItem(frontdesk, ref, "person");
      item = (await read<FoundItem>(manager, "operations.foundItems")).find((i) => i.id === ref);
      check(
        item?.status === "returned" && item.storage.startsWith("Returned ") && item.custodian === "None",
        `after release: ${JSON.stringify(item)}`,
      );
      step("the desk opened a claim and handed it back: Returned, custody closed");
      await refused(409, () => ops.releaseFoundItem(frontdesk, ref, "person"), "returning an item twice");

      // Disposal: only after retention, and never approved by whoever proposed it.
      await refused(
        409,
        () => ops.proposeFoundItemDisposal(manager, "LF-26-039", "donate"),
        "disposing of an item still in retention",
      );
      const old = await ops.logFoundItem(manager, {
        description: "Plastic water bottle",
        category: "Other",
        valuable: false,
        area: "Lobby",
        foundAt: kigaliStamp(new Date(Date.now() - 100 * 86_400_000)),
        foundBy: "Eric Habimana",
      });
      await ops.proposeFoundItemDisposal(manager, old, "recycle it");
      await refused(403, () => ops.approveFoundItemDisposal(manager, old), "the proposer approving their own disposal");
      await ops.approveFoundItemDisposal(frontdesk, old);
      const disposed = (await read<FoundItem>(manager, "operations.foundItems")).find((i) => i.id === old);
      check(disposed?.status === "disposed", `after a second person approved: ${JSON.stringify(disposed)}`);
      step(`${old} disposed: proposed by Aline, approved by Eric`);

      await ops.keepFoundItem(manager, "LF-26-021", 30, "the guest may still return");
      const kept = (await read<FoundItem>(manager, "operations.foundItems")).find((i) => i.id === "LF-26-021");
      check(
        kept?.status === "stored" && kept.retention?.startsWith("Retention extended to"),
        `after Keep: ${JSON.stringify(kept)}`,
      );
      step("LF-26-021 kept 30 more days: the pending disposal is withdrawn");

      const finance = await as("finance");
      const jeanne = await as("housekeeper");
      await refused(403, () => read(finance, "operations.foundItems"), "finance reading the register");
      await refused(403, () => read(jeanne, "operations.foundItems"), "a housekeeper reading the register");
    },
  },
];
