/**
 * The government's side of a registration, on the API, with the sources and mutations the officer screens use:
 *   - a fresh Gasabo registration reaches Gasabo's field verifier (queue and case file), and not another
 *     district's verifier nor the approver; the verifier passes it; it moves to the approver's queue; the
 *     approver approves it and the owner reads it as `active`;
 *   - a second registration is rejected at the field gate with a reason code the owner then reads;
 *   - the registry refuses what the screen must never allow: a verifier approving, an out-of-district verifier
 *     verifying, a rejection with no explanation, and an approver deciding before the field visit.
 */
import type { CaseFile, QueueCase } from "@injishi/data/fixtures/oversight";
import { approve, fieldVerify, OversightRefusal, reject } from "../../src/server/mutations/oversight";
import { sources } from "../../src/server/sources/oversight";
import type { SourceContext } from "../../src/server/sources/types";
import { GASABO, OFFICERS, registerBusiness, registrationOf } from "../lib/registration";
import type { Flow } from "./types";

const cases = async (ctx: SourceContext) => (await sources["oversight.cases"].list(ctx)) as QueueCase[];
const caseFile = async (ctx: SourceContext, orgId: string) =>
  (await sources["oversight.caseFiles"].get?.(ctx, orgId)) as CaseFile | undefined;
const inQueue = async (ctx: SourceContext, orgId: string, queue: "verification" | "approval") =>
  (await cases(ctx)).find((c) => c.id === orgId && c.queue === queue);

/** Expect a refusal the screen words itself (before the API), and return its words. */
async function screenRefusal(call: () => Promise<unknown>, what: string): Promise<string> {
  try {
    await call();
  } catch (error) {
    if (error instanceof OversightRefusal) return error.message;
    throw new Error(`${what}: expected the screen's refusal, got ${String(error)}`);
  }
  throw new Error(`${what}: expected a refusal, but it succeeded`);
}

export const flows: Flow[] = [
  {
    name: "a Gasabo registration reaches Gasabo's verifier, is field verified, approved, and the owner reads it as active",
    async run({ asEmail, check, refused, step }) {
      const business = await registerBusiness(GASABO, "approve");
      step(`registered ${business.legalName} in Gasabo`);

      const verifier = await asEmail(OFFICERS.gasaboVerifier);
      const approver = await asEmail(OFFICERS.gasaboApprover);
      const elsewhere = await asEmail(OFFICERS.otherDistrictVerifier);

      const row = await inQueue(verifier, business.orgId, "verification");
      check(row, "the Gasabo field verifier does not see the new registration in their verification queue");
      check(row.business === business.legalName, `the queue names it "${row.business}", not "${business.legalName}"`);
      check(row.href === `/officer/cases/${business.orgId}`, `the queue row opens ${row.href}, not its case page`);
      check(row.place.includes("Gasabo"), `the queue row places it in "${row.place}", not Gasabo`);
      check(
        !(await inQueue(elsewhere, business.orgId, "verification")),
        "a verifier posted in another district can see a Gasabo registration",
      );
      check(
        !(await cases(approver)).some((c) => c.id === business.orgId),
        "the approver sees the registration before any field visit",
      );
      step("only Gasabo's verifier has it");

      const file = await caseFile(verifier, business.orgId);
      check(file, "the verifier cannot open the case file");
      check(file.gate === "field", `the case file says the gate is "${file.gate}", not "field"`);
      check(file.business === business.legalName, "the case file is for another business");
      check(
        !(await caseFile(elsewhere, business.orgId)),
        "a verifier posted in another district can open a Gasabo case file",
      );

      // Allowed to approve, but not yet: the stage says no (409), whoever asks.
      await refused(409, () => approve(approver, business.orgId), "approving before the field visit");
      await refused(403, () => approve(verifier, business.orgId), "a field verifier approving");
      await refused(403, () => fieldVerify(elsewhere, business.orgId), "an out-of-district verifier verifying");
      step("the registry refuses the wrong officer and the wrong order");

      const verified = await fieldVerify(verifier, business.orgId, "Visited on site; premises as declared.");
      check(verified.status === "field_verified", `field verification left it at ${verified.status}`);
      check(
        !(await inQueue(await asEmail(OFFICERS.gasaboVerifier), business.orgId, "verification")),
        "the verified registration is still in the verifier's verification queue",
      );

      // A page gets a fresh context per request, and the desk is read once per context: open a new one.
      const approverNow = await asEmail(OFFICERS.gasaboApprover);
      const waiting = await inQueue(approverNow, business.orgId, "approval");
      check(waiting, "the Gasabo approver does not see the verified registration in their approval queue");
      check(waiting.action === "open", `the approver's row is "${waiting.action}", not open`);
      const approvalFile = await caseFile(approverNow, business.orgId);
      check(approvalFile?.gate === "approval", "the approver's case file does not say the gate is approval");
      step("it moved to the approver");

      const approved = await approve(approverNow, business.orgId, "Documents and visit support opening.");
      check(approved.status === "active", `approval left it at ${approved.status}, not active`);
      check(
        !(await cases(await asEmail(OFFICERS.gasaboApprover))).some((c) => c.id === business.orgId),
        "the approved registration is still in the approver's queue",
      );
      const owner = await registrationOf(business.ctx, business.orgId);
      check(owner.status === "active", `the owner reads ${owner.status}, not active`);
      step("approved: the owner reads it as active");
    },
  },
  {
    name: "a rejected registration tells the owner why, and a rejection needs both a reason and an explanation",
    async run({ asEmail, check, step }) {
      const business = await registerBusiness(GASABO, "reject");
      const verifier = await asEmail(OFFICERS.gasaboVerifier);

      const noReason = await screenRefusal(
        () => reject(verifier, business.orgId, "field", "", "The address does not exist."),
        "a rejection with no reason code",
      );
      check(/reason/i.test(noReason), `the screen worded the missing reason as "${noReason}"`);
      const noNote = await screenRefusal(
        () => reject(verifier, business.orgId, "field", "premises_not_found", "   "),
        "a rejection with no explanation",
      );
      check(/explanation/i.test(noNote), `the screen worded the missing explanation as "${noNote}"`);
      check(
        (await registrationOf(business.ctx, business.orgId)).status === "tin_verified",
        "a refused rejection changed the registration",
      );
      step("an incomplete rejection is refused before it is sent");

      const note = "No such address on KG 192 St; the plot is empty.";
      const rejected = await reject(verifier, business.orgId, "field", "premises_not_found", note);
      check(rejected.status === "rejected", `the rejection left it at ${rejected.status}`);
      check(
        !(await inQueue(await asEmail(OFFICERS.gasaboVerifier), business.orgId, "verification")),
        "the rejected registration is still in the verifier's queue",
      );
      const owner = await registrationOf(business.ctx, business.orgId);
      check(owner.status === "rejected", `the owner reads ${owner.status}, not rejected`);
      check(owner.rejectionReason === "premises_not_found", `the owner reads reason ${owner.rejectionReason}`);
      check(owner.rejectionNotes === note, `the owner reads the note "${owner.rejectionNotes}", not the officer's`);
      step("the owner reads the reason code and the officer's words");
    },
  },
];
