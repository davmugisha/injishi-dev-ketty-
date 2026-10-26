/**
 * The tenant's phone on the API: a repair reported and seen on management's board, a visitor
 * registered with a gate code, a message to management, the renewal offer answered and notice held to
 * the lease's period, with the same mutations the screens call and the same live sources they read.
 * Each flow ends with the refusals the platform makes on purpose.
 */
import type { PreregisteredVisitor, ServiceTicket } from "@injishi/data/fixtures/residence";
import type {
  MessageThread,
  RenewalOffer,
  RepairRequest,
  Tenancy,
  ThreadMessage,
  VisitorPass,
} from "@injishi/data/fixtures/resident";
import * as tenant from "../../src/server/mutations/resident";
import { forgetResidence, sources as residenceSources } from "../../src/server/sources/residence";
import { forgetTenancy, sources } from "../../src/server/sources/resident";
import type { SourceContext } from "../../src/server/sources/types";
import type { Flow } from "./types";

/** A live collection as the phone would read it now (never a read from before the last write). */
async function read<T>(ctx: SourceContext, name: keyof typeof sources): Promise<T[]> {
  forgetTenancy(ctx);
  return (await sources[name].list(ctx)) as T[];
}

async function readBoard<T>(ctx: SourceContext, name: keyof typeof residenceSources): Promise<T[]> {
  forgetResidence(ctx);
  return (await residenceSources[name].list(ctx)) as T[];
}

const stamp = () => Date.now().toString(36).toUpperCase();

export const flows: Flow[] = [
  {
    name: "repairs and visitors: reported from the phone, seen by management; another unit and a long stay refused",
    async run({ as, check, refused, step }) {
      const olivier = await as("resident");
      const solange = await as("residence");
      const [tenancy] = await read<Tenancy>(olivier, "resident.tenancies");
      check(tenancy?.unit === "B-07", `Olivier's tenancy reads ${JSON.stringify(tenancy)}`);

      const description = `Flow ${stamp()}: the shower drains slowly`;
      const { reference } = await tenant.requestRepair(olivier, {
        unit: tenancy.unit,
        category: "plumbing",
        description,
        staffMayEnter: false,
      });
      check(reference?.startsWith("WO-"), `reporting a repair answered ${reference}`);
      const mine = (await read<RepairRequest>(olivier, "resident.repairs")).find((r) => r.id === reference);
      check(
        mine?.title === description && mine.state === "Submitted",
        `the repair on the phone reads ${JSON.stringify(mine)}`,
      );
      const board = (await readBoard<ServiceTicket>(solange, "residence.tickets")).find((t) => t.id === reference);
      check(
        board?.status === "new" &&
          board.unit === "B-07" &&
          board.thread.some((m) => m.from === "resident" && m.text === description),
        `the repair on management's board reads ${JSON.stringify(board)}`,
      );
      step(`Olivier reported ${reference}; it is on Solange's board with his words as the first message`);

      await refused(
        404,
        () =>
          tenant.requestRepair(olivier, {
            unit: "A-01",
            category: "plumbing",
            description: "Not my flat",
            staffMayEnter: false,
          }),
        "a repair on somebody else's unit",
      );

      const name = `Flow Guest ${stamp()}`;
      const { code } = await tenant.registerVisitor(olivier, {
        unit: tenancy.unit,
        visitorName: name,
        date: "Tomorrow",
        time: "18:00–21:00",
        overnight: true,
      });
      check(code && /^\d{4}$/.test(code), `the gate code reads ${code}`);
      const pass = (await read<VisitorPass>(olivier, "resident.visitors")).find((v) => v.name === name);
      check(pass?.code === code && pass.state === "Expected", `the pass on the phone reads ${JSON.stringify(pass)}`);
      const gate = (await readBoard<PreregisteredVisitor>(solange, "residence.visitors")).find((v) => v.name === name);
      check(gate?.code === code && gate.unit === "B-07", `the gate list reads ${JSON.stringify(gate)}`);
      step(`registered ${name} overnight from tomorrow; the gate sees code ${code}`);

      const from = Date.parse(`${olivier.today.iso}T12:00:00+02:00`) + 86_400_000;
      await refused(
        422,
        () =>
          olivier.api.post("/api/v1/me/residence/visitor-passes", {
            unit: tenancy.unit,
            visitorName: "Flow long stay",
            validFrom: new Date(from).toISOString(),
            validTo: new Date(from + 7 * 86_400_000 + 3 * 3_600_000).toISOString(),
            overnight: true,
            kind: "guest",
          }),
        "an eight-night stay without management's approval",
      );
      await refused(
        404,
        () =>
          tenant.registerVisitor(olivier, {
            unit: "A-01",
            visitorName: "x",
            date: "Tomorrow",
            time: "10:00–11:00",
            overnight: false,
          }),
        "a visitor for somebody else's unit",
      );
      step("refused: another unit (404 twice), eight nights without approval (422)");
    },
  },
  {
    name: "conversation and lease: a message sent, the renewal accepted once, notice held to the period",
    async run({ as, check, refused, step }) {
      const olivier = await as("resident");
      const solange = await as("residence");
      const threads = await read<MessageThread>(olivier, "resident.threads");
      const thread = threads.find((t) => t.title === "Management") ?? threads[0];
      check(thread, "Olivier has no conversation with management");
      const text = `Flow ${stamp()}: is the water back on in Block B tonight?`;
      await tenant.sendMessage(olivier, thread.id, text);
      const sent = (await read<ThreadMessage>(olivier, "resident.messages")).find((m) => m.text === text);
      check(sent?.from === "resident" && sent.thread === thread.id, `the message reads ${JSON.stringify(sent)}`);
      step(`Olivier wrote in "${thread.title}"`);

      const [tenancy] = await read<Tenancy>(olivier, "resident.tenancies");
      check(tenancy, "Olivier holds no tenancy");
      await refused(
        422,
        () => tenant.giveNotice(olivier, tenancy.id, { moveOut: "Tomorrow", reason: "kigali", note: "" }),
        "notice shorter than the lease's period",
      );

      const offer = (await read<RenewalOffer>(olivier, "resident.renewalOffers")).find((o) => o.status === "open");
      check(offer, "Olivier has no open renewal offer");
      await tenant.answerRenewal(olivier, offer.id, "accepted");
      const answered = (await read<RenewalOffer>(olivier, "resident.renewalOffers")).find((o) => o.id === offer.id);
      const after = (await read<Tenancy>(olivier, "resident.tenancies")).find((t) => t.id === tenancy.id);
      check(
        answered?.status === "accepted" && after?.status === "Renewal accepted",
        `after Accept: ${answered?.status}, ${after?.status}`,
      );
      const lease = (await readBoard<{ id: string; status: string }>(solange, "residence.leases")).find(
        (l) => l.id === offer.lease,
      );
      check(lease?.status === "Renewal accepted", `management's lease reads ${JSON.stringify(lease)}`);
      step(`accepted the renewal of ${offer.lease}; management sees Renewal accepted`);
      await tenant.answerRenewal(olivier, offer.id, "accepted");
      await refused(409, () => tenant.answerRenewal(olivier, offer.id, "declined"), "changing an answered offer");

      forgetResidence(solange);
      const view = await solange
        .ops("residence")
        .get<{ leases: { id: string; reference: string | null; tenantUserId: string | null }[] }>(
          "/api/v1/ops/residence",
        );
      const notMine = view.leases.find(
        (l) => l.reference && l.reference !== tenancy.id && l.tenantUserId !== olivier.account?.user.id,
      );
      check(notMine, "no other lease to try");
      await refused(
        404,
        () =>
          olivier.api.post(`/api/v1/me/residence/leases/${notMine.id}/notice`, {
            moveOutDate: "2027-06-30",
            reason: "leaving",
          }),
        "notice on somebody else's lease",
      );
      await refused(
        403,
        () => olivier.api.get("/api/v1/ops/residence", { workspaceId: solange.ops("residence").workspace.workspaceId }),
        "a resident reading management's building",
      );
      step("refused: short notice (422), changing the answer (409), another lease (404), management's view (403)");
    },
  },
];
