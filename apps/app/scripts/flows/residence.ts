/**
 * The residence on the API: repairs from report to fixed, the gate (a code issued, an access request
 * decided), rent recorded and reminded, a notice, a renewal offer and the tenancy pipeline (screened,
 * converted to a draft, declined), with the same mutations the screens call and the same live sources
 * they read. Each flow ends with the refusals the platform makes on purpose.
 */
import { randomUUID } from "node:crypto";
import type {
  AccessRequest,
  Applicant,
  Lease,
  PreregisteredVisitor,
  RentLedger,
  RentRollRow,
  ResidenceUnit,
  ServiceTicket,
} from "@injishi/data/fixtures/residence";
import type { ThreadMessage } from "@injishi/data/fixtures/resident";
import * as res from "../../src/server/mutations/residence";
import { forgetResidence, type LiveLease, sources } from "../../src/server/sources/residence";
import { forgetTenancy, sources as tenantSources } from "../../src/server/sources/resident";
import type { SourceContext } from "../../src/server/sources/types";
import type { Flow } from "./types";

/** A live collection as the screen would read it now (never a read from before the last write). */
async function read<T>(ctx: SourceContext, name: keyof typeof sources): Promise<T[]> {
  forgetResidence(ctx);
  return (await sources[name].list(ctx)) as T[];
}

async function readTenant<T>(ctx: SourceContext, name: keyof typeof tenantSources): Promise<T[]> {
  forgetTenancy(ctx);
  return (await tenantSources[name].list(ctx)) as T[];
}

const stamp = () => Date.now().toString(36).toUpperCase();

export const flows: Flow[] = [
  {
    name: "amounts: rent and a draft lease take whole francs as typed, and a decimal is refused, never multiplied",
    async run({ check, step }) {
      // The amount reader behind Save as pending and Create draft lease. It used to strip every non-digit, so
      // "450,000.00" became 45,000,000 a month and "20000.5" became 200,005.
      const read: [string, number][] = [
        ["450,000", 450_000],
        ["RWF 950 000", 950_000],
        ["1.250.000", 1_250_000],
        ["20000", 20_000],
      ];
      for (const [text, want] of read) {
        check(res.readAmount(text) === want, `"${text}" must read ${want}, it reads ${res.readAmount(text)}`);
      }
      const refusedText = ["450,000.00", "20000.5", "20.000", "0", ""];
      for (const text of refusedText) {
        let threw = false;
        try {
          res.readAmount(text);
        } catch (error) {
          threw = error instanceof res.ResidenceInputError;
        }
        check(threw, `"${text}" must be refused with a reason, not read as an amount`);
      }
      step(`${read.length} amounts read exactly; ${refusedText.length} refused, "450,000.00" among them`);
    },
  },
  {
    name: "repairs: raised on a unit, moved across the board, noted, answered to the resident, refused backwards",
    async run({ as, check, refused, step }) {
      const solange = await as("residence");
      const olivier = await as("resident");
      const title = `Flow ${stamp()}: bathroom extractor fan rattles`;

      const { reference } = await res.raiseRepair(solange, {
        unit: "B-07",
        title,
        category: "electrical",
        staffMayEnter: true,
      });
      check(reference?.startsWith("WO-"), `raising a repair answered ${reference}`);
      let ticket = (await read<ServiceTicket>(solange, "residence.tickets")).find((t) => t.id === reference);
      check(
        ticket?.status === "new" && ticket.unit === "B-07" && ticket.title === title,
        `the new repair reads ${JSON.stringify(ticket)}`,
      );
      step(`Solange raised ${reference} on B-07`);

      await res.moveRepair(solange, reference, "assigned");
      await res.moveRepair(solange, reference, "in_progress");
      ticket = (await read<ServiceTicket>(solange, "residence.tickets")).find((t) => t.id === reference);
      check(ticket?.status === "progress", `after Assigned and In progress: ${JSON.stringify(ticket)}`);
      await res.moveRepair(solange, reference, "in_progress");
      step("moved to Assigned, then In progress (a second tap is not an error)");

      const note = `Flow note ${stamp()}: electrician booked`;
      await res.writeOnRepair(solange, reference, note, true);
      const reply = `Flow reply ${stamp()}: the electrician comes tomorrow morning`;
      await res.writeOnRepair(solange, reference, reply, false);
      ticket = (await read<ServiceTicket>(solange, "residence.tickets")).find((t) => t.id === reference);
      check(
        ticket?.thread.some((m) => m.from === "note" && m.text === note) &&
          ticket.thread.some((m) => m.from === "manager" && m.text === reply),
        `the repair's thread reads ${JSON.stringify(ticket?.thread)}`,
      );
      const seen = await readTenant<ThreadMessage>(olivier, "resident.messages");
      check(
        seen.some((m) => m.text === reply && m.from === "management") && !seen.some((m) => m.text === note),
        "Olivier does not see the reply, or sees the internal note",
      );
      step("an internal note stays with staff; the reply reaches Olivier's phone");

      await res.moveRepair(solange, reference, "resolved");
      ticket = (await read<ServiceTicket>(solange, "residence.tickets")).find((t) => t.id === reference);
      check(ticket?.status === "done", `after Fulfilled: ${JSON.stringify(ticket)}`);
      step("fulfilled");

      await refused(409, () => res.moveRepair(solange, reference, "assigned"), "moving a fixed repair back");
      const vacant = (await read<ResidenceUnit>(solange, "residence.units")).find((u) => u.status === "vacant");
      check(vacant, "the building has no vacant unit");
      const empty = await res.raiseRepair(solange, {
        unit: vacant.id,
        title: `Flow ${stamp()}: repaint before the next tenant`,
        category: "decoration",
        staffMayEnter: null,
      });
      await refused(
        409,
        () => res.writeOnRepair(solange, empty.reference ?? empty.id, "Anyone there?", false),
        "replying on a vacant unit's repair",
      );
      const workspaceId = solange.ops("residence").workspace.workspaceId;
      await refused(
        403,
        () =>
          olivier.api.post(
            "/api/v1/ops/residence/repairs",
            { unit: "B-07", title: "Flow: from the resident", category: "other", staffMayEnter: null },
            { workspaceId },
          ),
        "a resident using management's board",
      );
      step("refused: moving back (409), replying where nobody lives (409), a resident on management's board (403)");
    },
  },
  {
    name: "gate: a visitor pre-registered with a code, an access request decided once",
    async run({ as, check, refused, step }) {
      const solange = await as("residence");
      const name = `Flow Visitor ${stamp()}`;
      const { code } = await res.preregisterVisitor(solange, {
        unit: "C-04",
        visitorName: name,
        window: "Tomorrow 10:00–12:00",
      });
      check(code && /^\d{4}$/.test(code), `the gate code reads ${code}`);
      const visitor = (await read<PreregisteredVisitor>(solange, "residence.visitors")).find((v) => v.name === name);
      check(visitor?.code === code && visitor.unit === "C-04", `the visitor reads ${JSON.stringify(visitor)}`);
      step(`pre-registered ${name} for C-04 tomorrow with code ${code}`);

      await refused(
        400,
        () =>
          res.preregisterVisitor(solange, { unit: "C-04", visitorName: "Too late", window: "1 Jan 2020 10:00–12:00" }),
        "a visit that already ended",
      );

      const open = (await read<AccessRequest>(solange, "residence.accessRequests")).find((r) => r.status === "open");
      check(open, "no access request is waiting");
      await res.decideAccessRequest(solange, open.id, "approved");
      const decided = (await read<AccessRequest>(solange, "residence.accessRequests")).find((r) => r.id === open.id);
      check(decided?.status === "approved", `after Approve: ${JSON.stringify(decided)}`);
      step(`approved "${open.title}"`);
      await refused(409, () => res.decideAccessRequest(solange, open.id, "declined"), "deciding a request twice");
    },
  },
  {
    name: "rent: an office payment saved as pending, replayed, refused when over or reused; a reminder sent",
    async run({ as, check, refused, step }) {
      const solange = await as("residence");
      const before = (await read<RentRollRow>(solange, "residence.rentRoll")).find((r) => r.id === "A-03");
      check(before && before.overdue > 300_000, `A-03 on the rent roll reads ${JSON.stringify(before)}`);

      const key = randomUUID();
      const providerRef = `FLOW-BK-${stamp()}`;
      const input = { unit: "A-03", amountRwf: 300_000, method: "bank_transfer" as const, providerRef };
      const first = await res.recordRentPayment(solange, input, key);
      const ledger = (await read<RentLedger>(solange, "residence.rentLedgers")).find((l) => l.id === "A-03");
      const entry = ledger?.ledger.find((e) => e.desc.includes(providerRef));
      check(
        entry?.title === "Bank transfer payment" && entry.state === "Pending" && entry.amount === 300_000,
        `the ledger entry reads ${JSON.stringify(entry)}`,
      );
      const after = (await read<RentRollRow>(solange, "residence.rentRoll")).find((r) => r.id === "A-03");
      check(after?.verified === before.verified, "a pending payment was counted as verified rent");
      step(`recorded a 300,000 bank transfer on A-03 as pending (${providerRef})`);

      const again = await res.recordRentPayment(solange, input, key);
      check(again.id === first.id, "replaying the same press saved a second payment");
      await refused(
        409,
        () => res.recordRentPayment(solange, { ...input, amountRwf: 400_000 }, key),
        "reusing a key for another amount",
      );
      await refused(
        422,
        () =>
          res.recordRentPayment(
            solange,
            { ...input, amountRwf: 50_000_000, providerRef: `${providerRef}-X` },
            randomUUID(),
          ),
        "recording more than the unit owes",
      );
      step("a replay answers the same payment; a reused key (409) and an overpayment (422) are refused");

      const sentBefore = ledger?.reminders.length ?? 0;
      await res.remindResidents(solange, ["A-03"], "Flow: please settle the open rent this week.");
      const reminded = (await read<RentLedger>(solange, "residence.rentLedgers")).find((l) => l.id === "A-03");
      check(
        reminded?.reminders.length === sentBefore + 1,
        `A-03's reminders read ${JSON.stringify(reminded?.reminders)}`,
      );
      step("reminded A-03");

      const paid = (await read<RentRollRow>(solange, "residence.rentRoll")).find((r) => r.status === "paid");
      check(paid, "no unit is paid up");
      await refused(
        409,
        () => res.remindResidents(solange, [paid.id], "Flow: nothing owed"),
        "reminding a unit that owes nothing",
      );
      const jeanne = await as("housekeeper");
      await refused(
        403,
        () => jeanne.ops().post("/api/v1/ops/residence/rent-payments", input, { idempotencyKey: randomUUID() }),
        "a hotel housekeeper recording rent",
      );
      step(`refused: reminding ${paid.id}, which owes nothing (409), a hotel housekeeper recording rent (403)`);
    },
  },
  {
    name: "leases: a notice recorded once, an open offer reminded, a settled offer not withdrawn",
    async run({ as, check, refused, step }) {
      const solange = await as("residence");
      const leases = await read<Lease>(solange, "residence.leases");
      const target = leases.find((l) => l.unit === "C-04");
      check(target && target.status !== "Notice given", `C-04's lease reads ${JSON.stringify(target)}`);
      const today = solange.today.iso;
      const day = (n: number) => {
        const d = new Date(Date.parse(`${today}T12:00:00Z`) + n * 86_400_000);
        return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
      };
      await res.recordNotice(solange, { unit: "C-04", received: day(0), movesOut: day(40), channel: "Letter" });
      const lease = (await read<Lease>(solange, "residence.leases")).find((l) => l.id === target.id);
      const unit = (await read<ResidenceUnit>(solange, "residence.units")).find((u) => u.id === "C-04");
      check(
        lease?.status === "Notice given" && unit?.status === "notice",
        `after the notice: ${lease?.status}, ${unit?.status}`,
      );
      step(`recorded a letter giving notice on C-04 (${target.id}), moving out ${day(40)}`);
      await refused(
        409,
        () => res.recordNotice(solange, { unit: "C-04", received: day(0), movesOut: day(45), channel: "Email" }),
        "a second notice on one lease",
      );
      await refused(
        400,
        () => res.recordNotice(solange, { unit: "A-03", received: day(3), movesOut: day(60), channel: "Letter" }),
        "a notice received in the future",
      );

      const offered = leases.find((l) => l.status === "Renewal offered");
      check(offered, "no lease carries an open renewal offer");
      await res.remindAboutOffer(solange, offered.id);
      const reminded = (await read<Lease>(solange, "residence.leases")).find((l) => l.id === offered.id);
      check(
        reminded?.offer?.events.some((e) => e.title === "Reminder sent"),
        `the offer reads ${JSON.stringify(reminded?.offer)}`,
      );
      step(`reminded the resident of ${offered.id} about the renewal offer`);

      forgetResidence(solange);
      const view = await solange
        .ops("residence")
        .get<{ offers: { id: string; status: string }[] }>("/api/v1/ops/residence");
      const settled = view.offers.find((o) => o.status !== "open");
      check(settled, "no answered offer to try withdrawing");
      await refused(
        409,
        () => solange.ops("residence").post(`/api/v1/ops/residence/offers/${settled.id}/withdraw`, {}),
        "withdrawing an offer already answered",
      );
      step(
        "refused: a second notice (409), a notice received in three days (400), withdrawing an answered offer (409)",
      );
    },
  },
  {
    name: "applicants: screened to ready, converted to a lease draft, another declined with a reason",
    async run({ as, check, refused, step }) {
      const solange = await as("residence");
      const applicants = await read<Applicant>(solange, "residence.applicants");
      const screening = applicants.find((a) => a.stage === "Screening" || a.stage === "Ready");
      check(screening?.profile, `no applicant in screening: ${JSON.stringify(applicants.map((a) => a.stage))}`);
      // Nothing is sent to an invited applicant, so the screen never says an email went or when it expires.
      const invited = applicants.filter((a) => a.stage === "Invited");
      check(
        invited.every((a) => !/email|expires|invitation sent/i.test(`${a.source} ${a.pendingNote ?? ""}`)),
        `an invited applicant claims a message: ${JSON.stringify(invited.map((a) => [a.source, a.pendingNote]))}`,
      );

      await res.recordScreening(solange, screening.id, [true, true, true, true, true, true]);
      let row = (await read<Applicant>(solange, "residence.applicants")).find((a) => a.id === screening.id);
      check(row?.stage === "Ready", `after every check: ${JSON.stringify(row?.stage)}`);
      step(`screened ${screening.name}: every check done, Ready`);

      const { reference } = await res.convertToLeaseDraft(solange, screening.id, {
        start: "1 Dec 2026",
        term: "12 months",
        rent: String(screening.profile.rent),
        deposit: String(screening.profile.deposit),
        notice: "30 days",
      });
      check(reference, "converting answered no lease number");
      const draft = (await read<LiveLease>(solange, "residence.leases")).find((l) => l.id === reference);
      check(draft?.status === "Draft" && draft.unit === screening.unit, `the draft reads ${JSON.stringify(draft)}`);
      // The Leases screen shows the draft's own terms and landlord, never a fixed deposit, term or signer.
      const rec = draft.record;
      check(
        rec?.deposit === screening.profile.deposit &&
          rec.termMonths === 12 &&
          rec.noticeDays === 30 &&
          rec.landlord !== "" &&
          rec.tenantSignedOn === "" &&
          rec.landlordSignedOn === "",
        `the draft's record reads ${JSON.stringify(rec)}`,
      );
      row = (await read<Applicant>(solange, "residence.applicants")).find((a) => a.id === screening.id);
      check(!row, "the converted applicant is still in the pipeline");
      step(`converted ${screening.name} into lease draft ${reference} on ${screening.unit}`);
      await refused(
        409,
        () => res.recordScreening(solange, screening.id, [true, true, true, true, true, true]),
        "screening an application already converted",
      );

      const other = (await read<Applicant>(solange, "residence.applicants"))[0];
      check(other, "no other applicant to decline");
      await res.declineApplication(solange, other.id, "The unit was let to an applicant who could move in sooner.");
      const gone = (await read<Applicant>(solange, "residence.applicants")).find((a) => a.id === other.id);
      check(!gone, "the declined applicant is still in the pipeline");
      await res.declineApplication(solange, other.id, "Declined again");
      step(`declined ${other.name} with a reason (a second tap is not an error)`);
      await refused(
        409,
        () =>
          res.convertToLeaseDraft(solange, other.id, {
            start: "1 Dec 2026",
            term: "12 months",
            rent: "1",
            deposit: "1",
            notice: "30 days",
          }),
        "converting a declined application",
      );
      const jeanne = await as("housekeeper");
      await refused(
        403,
        () =>
          jeanne.ops().post(`/api/v1/ops/residence/applications/${other.id}/decline`, { reason: "not mine to decide" }),
        "a hotel housekeeper declining an applicant",
      );
      step("refused: converting a declined application (409), a hotel housekeeper (403)");
    },
  },
];
