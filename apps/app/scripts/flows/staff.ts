/**
 * The staff phones on the API: a cleaner's room from start to clean (checklist, minibar, a found
 * item) and the supervisor's inspection of it, a failed check carrying a photo stored through
 * `POST /uploads`; a fault reported from the phone and worked by the technician (started, timed,
 * noted, fixed); a leave request asked and cancelled on the person's own file. The same mutations the phones' buttons call and the same live sources they read, ending with
 * the refusals the platform makes on purpose.
 */
import type { HousekeepingRoom } from "@injishi/data/fixtures/operations";
import type {
  CleaningRoom,
  FinishedRoom,
  FoundItem,
  InspectionRoom,
  MinibarItem,
  ProblemReport,
  StaffRequest,
  WorkOrder,
} from "@injishi/data/fixtures/staff";
import * as ops from "../../src/server/mutations/operations";
import * as staff from "../../src/server/mutations/staff";
import { forgetOperations, sources as opsSources } from "../../src/server/sources/operations";
import { forgetStaff, myFile, readPhone, sources } from "../../src/server/sources/staff";
import type { SourceContext } from "../../src/server/sources/types";
import type { Flow } from "./types";

/** A live collection as the phone would read it now (never a read from before the last write). */
async function read<T>(ctx: SourceContext, name: keyof typeof sources): Promise<T[]> {
  forgetStaff(ctx);
  forgetOperations(ctx);
  return (await sources[name].list(ctx)) as T[];
}

/** A few bytes sent as a JPEG: the upload route checks the declared type and size, never decodes the picture. */
const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64",
);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-12-01" as the leave form writes it, "1 Dec 2026". */
const formDate = (iso: string) =>
  `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const flows: Flow[] = [
  {
    name: "cleaner's room: started, ticked, minibar counted, an item logged, marked clean; the supervisor fails it with the checks",
    async run({ as, check, refused, step }) {
      const manager = await as("manager");
      const jeanne = await as("housekeeper");
      const beatrice = await as("supervisor");
      const jeanneId = jeanne.account?.user.id;
      check(jeanneId, "Jeanne has no account");

      // A room of her own for the flow, never one of the seeded seven.
      forgetOperations(manager);
      const rooms = (await opsSources["operations.rooms"].list(manager)) as HousekeepingRoom[];
      const room = rooms.find((r) => r.status === "inspected" && !["103", "104", "106", "108"].includes(r.id));
      check(room, "no inspected room is free for the flow");
      const taskId = await ops.addCleaningTask(manager, {
        room: room.id,
        kind: "Checkout",
        assignee: jeanneId,
        due: "By 15:30",
      });
      let mine = (await read<CleaningRoom>(jeanne, "staff.rooms")).find((r) => r.id === taskId);
      check(mine?.status === "waiting" && mine.no === room.id, `the new room on her phone: ${JSON.stringify(mine)}`);
      step(`manager gave Jeanne a checkout clean of ${room.id}; it waits on her phone`);

      await staff.moveRoomTask(jeanne, taskId, "in_progress");
      const phone = await readPhone(jeanne);
      const cleaning = phone.checklist.filter((i) => i.kind === "cleaning");
      check(cleaning.length > 2, "the property has no cleaning checklist");
      for (const item of cleaning.slice(0, 3)) await staff.setRoomCheck(jeanne, taskId, item.id, true);
      await staff.setRoomCheck(jeanne, taskId, cleaning[2]?.id as string, false);
      mine = (await read<CleaningRoom>(jeanne, "staff.rooms")).find((r) => r.id === taskId);
      check(
        mine?.status === "cleaning" &&
          mine.ticked.length === 2 &&
          mine.ticked.includes(cleaning[0]?.id as string) &&
          !mine.ticked.includes(cleaning[2]?.id as string),
        `after ticking three and unticking one: ${JSON.stringify(mine)}`,
      );
      step("started cleaning; ticked three steps and unticked one: two stay ticked");

      const water = phone.minibarItems[0];
      check(water, "the property stocks no minibar");
      await staff.sendMinibarCount(jeanne, taskId, [{ itemId: water.id, used: 2 }]);
      let minibar = (await read<MinibarItem>(jeanne, "staff.minibarItems")).find((m) => m.id === water.id);
      check(minibar?.used === 2, `the minibar after the count: ${JSON.stringify(minibar)}`);
      await staff.sendMinibarCount(jeanne, taskId, [{ itemId: water.id, used: 1 }]);
      minibar = (await read<MinibarItem>(jeanne, "staff.minibarItems")).find((m) => m.id === water.id);
      check(minibar?.used === 1, `sending again replaces the count: ${JSON.stringify(minibar)}`);
      step(`minibar counted (2 × ${water.label}), then corrected to 1: a report, never a charge`);

      const logged = await staff.logRoomFoundItem(jeanne, taskId, {
        description: "Grey umbrella, folded",
        spot: "wardrobe",
      });
      const ref = logged.reference;
      const found = (await read<FoundItem>(jeanne, "staff.foundItems")).find((f) => f.ref === ref);
      check(
        found?.name === "Grey umbrella" && found.room === room.id && found.spot === "wardrobe",
        `the logged item on her phone: ${JSON.stringify(found)}`,
      );
      // The phone names who to hand it to only from the register's answer, and her phone reads the same custodian.
      check(
        logged.custodianName === null || found.holder === logged.custodianName.split(" ")[0],
        `the custodian the register named (${logged.custodianName}) is not who her phone says to hand it to (${found.holder})`,
      );
      // The sheet starts empty: an item with nothing typed is refused before anything is sent.
      const blank = await staff.logRoomFoundItem(jeanne, taskId, { description: "  ", spot: "wardrobe" }).then(
        () => null,
        (error: unknown) => error,
      );
      check(blank instanceof staff.StaffInputError, `an item with no description was not refused: ${String(blank)}`);
      step(
        `found an umbrella in the wardrobe: ${ref} in the register, with her as finder, to hand to ${logged.custodianName ?? "nobody named"}`,
      );

      await staff.moveRoomTask(jeanne, taskId, "done");
      check(
        !(await read<CleaningRoom>(jeanne, "staff.rooms")).some((r) => r.id === taskId),
        "the clean room is still on her to-do list",
      );
      const finished = (await read<FinishedRoom>(jeanne, "staff.finishedRooms")).find((r) => r.id === taskId);
      check(
        finished?.state === "Clean" && finished.when.endsWith("waiting for inspection"),
        `finished: ${JSON.stringify(finished)}`,
      );
      step("marked clean: Finished, waiting for inspection");

      const queue = (await read<InspectionRoom>(beatrice, "staff.inspectionRooms")).find((r) => r.id === taskId);
      check(
        queue?.cleanedBy === "Jeanne Nyiraneza" && queue.skip?.includes(`${cleaning.length - 2} checks skipped`),
        `the supervisor's queue: ${JSON.stringify(queue)}`,
      );
      step("on Beatrice's phone with the skipped steps named");

      const checks = phone.checklist.filter((i) => i.kind === "inspection");
      const verdicts = checks.map((c, i) => ({ itemId: c.id, result: (i === 0 ? "fail" : "pass") as "pass" | "fail" }));

      // "Add a photo of the problem": stored by the API, named by the failed check. The same photo sent again
      // (a retry with the same attempt token) is the same object, never a copy.
      const token = crypto.randomUUID();
      const photo = new Blob([new Uint8Array(TINY_JPEG)], { type: "image/jpeg" });
      const uploaded = await staff.uploadPhoto(beatrice, photo, "basin.jpg", token);
      check(/^property_photo\//.test(uploaded.objectKey), `the photo was stored as ${uploaded.objectKey}`);
      const again = await staff.uploadPhoto(beatrice, photo, "basin.jpg", token);
      check(again.objectKey === uploaded.objectKey, "sending the same photo again made a second copy");
      step(`Beatrice photographed the failed check: stored as ${uploaded.objectKey}`);
      await refused(
        400,
        () => staff.inspectRoom(beatrice, taskId, { result: "pass", checks: verdicts }),
        "a pass with a failed check",
      );
      await refused(
        403,
        () => staff.inspectRoom(jeanne, taskId, { result: "pass", checks: [] }),
        "Jeanne inspecting her own room",
      );
      await staff.inspectRoom(beatrice, taskId, {
        result: "fail",
        reason: `${checks[0]?.label}. Wipe the basin again`,
        checks: verdicts.map((v, i) => (i === 0 ? { ...v, photoObjectKey: uploaded.objectKey } : v)),
      });
      check(
        !(await read<InspectionRoom>(beatrice, "staff.inspectionRooms")).some((r) => r.id === taskId),
        "the decided room is still in the queue",
      );
      const reclean = (await read<CleaningRoom>(jeanne, "staff.rooms")).find(
        (r) => r.no === room.id && r.kind === "Re-clean",
      );
      check(reclean?.status === "waiting", `the re-clean on Jeanne's phone: ${JSON.stringify(reclean)}`);
      forgetStaff(beatrice);
      const results = (await readPhone(beatrice)).checks.filter((c) => c.taskId === taskId && c.result !== "done");
      check(results.length === checks.length, `the inspection kept ${results.length} of ${checks.length} verdicts`);
      const failedCheck = results.find((c) => c.itemId === checks[0]?.id);
      check(
        failedCheck?.result === "fail" && failedCheck.photoObjectKey === uploaded.objectKey,
        `the failed check keeps its photo: ${JSON.stringify(failedCheck)}`,
      );
      step("Beatrice failed it with the checks and the photo: back on Jeanne's phone as a Re-clean");

      await refused(
        409,
        () => staff.inspectRoom(beatrice, taskId, { result: "fail", reason: "again", checks: [] }),
        "deciding the same inspection twice",
      );
      const finance = await as("finance");
      await refused(403, () => read(finance, "staff.rooms"), "finance reading the cleaners' phone");
      await refused(
        403,
        () => staff.setRoomCheck(finance, reclean.id, cleaning[0]?.id as string, true),
        "finance ticking a cleaning step",
      );
    },
  },
  {
    name: "a fault reported from the phone is started, timed, noted and fixed by the technician",
    async run({ as, check, refused, step }) {
      const jeanne = await as("housekeeper");
      const tech = await as("technician");
      const places = await read<{ label: string; isRoom: boolean }>(jeanne, "staff.reportPlaces");
      const corridor = places.find((p) => !p.isRoom);
      check(corridor, `no corridor among her places: ${JSON.stringify(places)}`);
      const ref = await staff.reportProblem(jeanne, {
        place: corridor.label,
        isRoom: false,
        category: "electrical",
        urgency: "today",
        description: "Ceiling light flickers by the linen room. Started this morning.",
        askBlock: false,
      });
      const report = (await read<ProblemReport>(jeanne, "staff.problemReports")).find((r) => r.ticket === ref);
      check(
        report?.place === corridor.label && report.category === "electrical" && report.urgency === "today",
        `her report: ${JSON.stringify(report)}`,
      );
      step(`Jeanne reported a flickering light in ${corridor.label}: ${ref}, high priority`);

      let order = (await read<WorkOrder>(tech, "staff.workOrders")).find((o) => o.ref === ref);
      check(order?.status === "new" && order.priority === "High", `on the technician's list: ${JSON.stringify(order)}`);
      // "Start work" (`/start`): his, and In progress, with no clock running until he starts the timer.
      await staff.startWorkOrder(tech, order.id);
      order = (await read<WorkOrder>(tech, "staff.workOrders")).find((o) => o.ref === ref);
      check(order?.status === "progress" && order.repair === null, `after Start work: ${JSON.stringify(order)}`);
      await staff.setWorkOrderTimer(tech, order.id, true);
      order = (await read<WorkOrder>(tech, "staff.workOrders")).find((o) => o.ref === ref);
      check(order?.status === "progress" && order.repair !== null, `after Start timer: ${JSON.stringify(order)}`);
      step("Jean-Paul pressed Start work (In progress), then started the timer: the clock running");

      await staff.noteWorkOrder(tech, order.id, "Starter is failing; replacing the tube and starter.");
      await staff.setWorkOrderTimer(tech, order.id, false);
      order = (await read<WorkOrder>(tech, "staff.workOrders")).find((o) => o.ref === ref);
      check(
        order?.repair === null &&
          order.log.length === 1 &&
          order.log[0]?.what === "Diagnosis" &&
          order.notes.some((n) => n.who === "You" && n.text.startsWith("Starter is failing")),
        `after the note and stopping the timer: ${JSON.stringify(order)}`,
      );
      step("noted the cause and stopped the clock: one diagnosis session logged");

      const finance = await as("finance");
      await refused(403, () => staff.noteWorkOrder(finance, order.id, "Paid?"), "finance writing on a work order");
      await staff.resolveWorkOrder(tech, order.id, {
        fix: "Replaced tube and starter. No flicker.",
        askRelease: false,
      });
      check(
        !(await read<WorkOrder>(tech, "staff.workOrders")).some((o) => o.ref === ref),
        "the fixed order is still on the open list",
      );
      check(
        !(await read<ProblemReport>(jeanne, "staff.problemReports")).some((r) => r.ticket === ref),
        "the fixed fault is still open on the reporter's phone",
      );
      step("marked fixed: off his list and off Jeanne's open reports");

      await refused(
        409,
        () => tech.ops().post(`/api/v1/ops/work-orders/${order.id}/resolve`, { fix: "again" }),
        "fixing the same order twice",
      );
      const { workOrders } = await tech
        .ops()
        .get<{ workOrders: { id: string; assignedContractor: string | null; status: string }[] }>(
          "/api/v1/ops/work-orders",
        );
      const contractors = workOrders.find((o) => o.assignedContractor && o.status !== "closed");
      check(contractors, "no contractor's order to refuse");
      await refused(
        403,
        () => tech.ops().post(`/api/v1/ops/work-orders/${contractors.id}/timer`, { running: true }),
        "timing a contractor's order",
      );
    },
  },
  {
    name: "leave asked and cancelled on her own file; another person's file is not there",
    async run({ as, check, refused, step }) {
      const jeanne = await as("housekeeper");
      const tech = await as("technician");
      const types = await read<{ id: string; label: string }>(jeanne, "staff.leaveTypes");
      const annual = types.find((t) => t.label === "Annual");
      check(annual, `her leave types: ${types.map((t) => t.label).join(", ")}`);

      // Two weekdays well ahead, clear of her open requests.
      let start = addDays(jeanne.today.iso, 45);
      while ([0, 6].includes(new Date(`${start}T12:00:00Z`).getUTCDay())) start = addDays(start, 1);
      const end = new Date(`${start}T12:00:00Z`).getUTCDay() === 5 ? start : addDays(start, 1);
      const id = await staff.askLeave(jeanne, {
        leaveTypeId: annual.id,
        from: formDate(start),
        to: formDate(end),
        reason: "Family visit in Huye",
      });
      let request = (await read<StaffRequest>(jeanne, "staff.requests")).find((r) => r.id === `leave:${id}`);
      check(
        request?.status === "manager" && request.sub === "Family visit in Huye" && request.steps.endsWith("to decide"),
        `the request on her phone: ${JSON.stringify(request)}`,
      );
      step(`Jeanne asked for annual leave ${start} to ${end}: with her line manager`);

      await refused(
        409,
        () => staff.askLeave(jeanne, { leaveTypeId: annual.id, from: formDate(start), to: formDate(end) }),
        "asking for the same days twice",
      );
      await staff.cancelRequest(jeanne, `leave:${id}`);
      request = (await read<StaffRequest>(jeanne, "staff.requests")).find((r) => r.id === `leave:${id}`);
      check(request?.status === "cancelled", `after Cancel: ${JSON.stringify(request)}`);
      step("cancelled it: the request stays in her list as Cancelled");
      await refused(409, () => staff.cancelRequest(jeanne, `leave:${id}`), "cancelling a request twice");

      const jp = await myFile(tech);
      await refused(
        404,
        () => jeanne.api.get(`/api/v1/me/work/${jp.employeeId}/leave/requests`),
        "reading a colleague's leave",
      );
      await refused(
        404,
        () => jeanne.api.get(`/api/v1/me/work/${jp.employeeId}/papers`),
        "reading a colleague's papers",
      );
      await refused(
        404,
        () => jeanne.api.get(`/api/v1/me/work/${jp.employeeId}/documents`),
        "reading a colleague's documents",
      );
      step("a colleague's file answers 404, never 403");
    },
  },
];
