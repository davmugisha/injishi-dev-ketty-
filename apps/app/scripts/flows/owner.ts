/**
 * The owner's writes, on the API, with the mutations the Team and Reports screens call:
 *   - invite a front desk member to the lodge, see the invitation on the team, cancel it;
 *   - move a member to another role and other branches, then put them back; the owner's own role is refused;
 *   - withdraw a permission from a role preset and grant it back; team.manage cannot be handed out;
 *   - save a Reports view; the same name twice is refused.
 * The general manager, who holds no `team.manage`, is refused each team write with 403; the front desk,
 * which holds no `money.view`, is refused a Reports view.
 */
import type { ReportsSavedView, TeamRolesMember, TeamRolesRole } from "@injishi/data/fixtures/owner";
import {
  cancelInvitation,
  changeMember,
  inviteMember,
  OwnerRefusal,
  saveReportView,
  saveRolePresets,
  sendStepUpCode,
} from "../../src/server/mutations/owner";
import { employeeFileEmails, sources, teamScopes } from "../../src/server/sources/owner";
import type { SourceContext } from "../../src/server/sources/types";
import { demoCode } from "../lib/harness";
import type { Flow } from "./types";

const members = async (ctx: SourceContext) => (await sources["owner.teamRolesMembers"].list(ctx)) as TeamRolesMember[];
const roles = async (ctx: SourceContext) => (await sources["owner.teamRolesRoles"].list(ctx)) as TeamRolesRole[];

/** Expect a refusal the screen words itself (before the API), and return its words. */
async function screenRefusal(call: () => Promise<unknown>, what: string): Promise<string> {
  try {
    await call();
  } catch (error) {
    if (error instanceof OwnerRefusal) return error.message;
    throw new Error(`${what}: expected the screen's refusal, got ${String(error)}`);
  }
  throw new Error(`${what}: expected a refusal, but it succeeded`);
}

export const flows: Flow[] = [
  {
    name: "the owner invites a front desk member to the lodge, sees the invitation, and cancels it",
    async run({ as, check, refused, step }) {
      const owner = await as("owner");
      const email = `flow.invitee.${Date.now()}@app.demo.injishi.com`;
      const { id } = await inviteMember(owner, {
        name: "Flow Invitee",
        contact: email,
        role: "frontdesk",
        scopeIds: ["ish"],
      });
      const invited = (await members(owner)).find((m) => m.id === id);
      check(
        invited &&
          invited.status === "invited" &&
          invited.name === "Flow Invitee" &&
          invited.role === "frontdesk" &&
          invited.contact === email &&
          invited.scopeIds.join() === "ish" &&
          /^Invited \d{1,2} [A-Z][a-z]{2} · link expires \d{1,2} [A-Z][a-z]{2}$/.test(invited.lastActive),
        `the new invitation reads ${JSON.stringify(invited)}`,
      );
      step(`invited ${email} as front desk at Ishyamba: "${invited.lastActive}"`);

      await cancelInvitation(owner, id);
      const cancelled = (await members(owner)).find((m) => m.id === id);
      check(cancelled?.status === "revoked", `after cancelling, the invitation reads ${JSON.stringify(cancelled)}`);
      step(`cancelled: "${cancelled.lastActive}"`);
      // A cancelled invitation stays listed for the record, and cannot be cancelled again.
      await refused(404, () => cancelInvitation(owner, id), "cancelling an invitation twice");

      const phone = await screenRefusal(
        () =>
          inviteMember(owner, { name: "By phone", contact: "+250 788 000 111", role: "frontdesk", scopeIds: ["isg"] }),
        "inviting by phone",
      );
      const twoEntities = await screenRefusal(
        () =>
          inviteMember(owner, {
            name: "Two",
            contact: "two@app.demo.injishi.com",
            role: "manager",
            scopeIds: ["isg", "kcr"],
          }),
        "inviting into two legal entities",
      );
      const outlet = await screenRefusal(
        () =>
          inviteMember(owner, { name: "Bar", contact: "bar@app.demo.injishi.com", role: "staff", scopeIds: ["ter"] }),
        "inviting to an outlet only",
      );
      step(`refused before the API: "${phone}" / "${twoEntities}" / "${outlet}"`);

      const manager = await as("manager");
      await refused(
        403,
        () =>
          inviteMember(manager, {
            name: "No",
            contact: "no@app.demo.injishi.com",
            role: "frontdesk",
            scopeIds: ["isg"],
          }),
        "the general manager inviting staff",
      );
      step("the general manager (no team.manage) is refused with 403");
    },
  },
  {
    name: "the owner moves a member to another role and branches, puts them back, and cannot touch the owner",
    async run({ as, check, refused, step }) {
      const owner = await as("owner");
      const before = (await members(owner)).find((m) => m.name === "Beatrice Mukandori");
      check(before?.status === "active" && before.role === "staff", `Beatrice reads ${JSON.stringify(before)}`);

      await changeMember(owner, before.id, { role: "frontdesk", scopeIds: ["isg", "ish"] });
      const moved = (await members(owner)).find((m) => m.id === before.id);
      check(
        moved?.role === "frontdesk" && [...moved.scopeIds].sort().join() === "isg,ish",
        `after the change Beatrice reads ${JSON.stringify(moved)}`,
      );
      step(`Beatrice is now front desk across "${moved.scope}"`);

      await changeMember(owner, before.id, { role: "staff", scopeIds: ["isg"] });
      const back = (await members(owner)).find((m) => m.id === before.id);
      check(
        back?.role === "staff" && back.scopeIds.join() === "isg",
        `after restoring Beatrice reads ${JSON.stringify(back)}`,
      );
      step("put back: housekeeping staff at Isangano");

      const didier = (await members(owner)).find((m) => m.role === "owner");
      check(didier, "no owner on the team");
      await refused(
        422,
        () => changeMember(owner, didier.id, { role: "manager", scopeIds: ["isg", "ish"] }),
        "changing the owner's role",
      );
      await refused(
        400,
        () => owner.ops().patch(`/api/v1/ops/team/${before.id}/role`, { orgRole: "owner" }),
        "making a member owner by a role change",
      );
      step("the owner's role cannot be changed, and nobody is made owner by a role change");

      const manager = await as("manager");
      await refused(
        403,
        () => changeMember(manager, before.id, { role: "frontdesk", scopeIds: ["isg"] }),
        "the general manager changing a role",
      );
      step("the general manager is refused with 403");
    },
  },
  {
    name: "the owner withdraws a permission from the front desk preset and grants it back",
    async run({ as, check, refused, step }) {
      const owner = await as("owner");
      const frontdesk = (await roles(owner)).find((r) => r.id === "frontdesk");
      check(
        frontdesk?.permissions.includes("message.send"),
        `the front desk preset reads ${JSON.stringify(frontdesk)}`,
      );

      const without = frontdesk.permissions.filter((p) => p !== "message.send");
      const { saved } = await saveRolePresets(owner, { frontdesk: without });
      check(saved.join() === "receptionist", `saving changed ${saved.join()}`);
      const after = (await roles(owner)).find((r) => r.id === "frontdesk");
      check(after && !after.permissions.includes("message.send"), "message.send is still on the front desk preset");
      step(`front desk no longer replies to guests: "${after.cannot}"`);

      await saveRolePresets(owner, { frontdesk: frontdesk.permissions });
      const restored = (await roles(owner)).find((r) => r.id === "frontdesk");
      check(restored?.permissions.includes("message.send"), "message.send did not come back");
      step("granted back");

      const manager = (await roles(owner)).find((r) => r.id === "manager");
      check(manager, "no manager preset");
      await refused(
        409,
        () => saveRolePresets(owner, { manager: [...manager.permissions, "team.manage"] }),
        "handing team.manage to the manager",
      );
      const unchanged = await saveRolePresets(owner, { owner: ["money.view"] });
      check(unchanged.saved.length === 0, "the owner's own preset was sent");
      step("team.manage cannot be granted (409) and the owner's preset is never sent");

      const gm = await as("manager");
      await refused(403, () => saveRolePresets(gm, { frontdesk: without }), "the general manager editing presets");
      step("the general manager is refused with 403");
    },
  },
  {
    name: "the grant screens' step-up code is checked by the API: unasked, wrong and spent codes are refused",
    async run({ as, check, refused, step }) {
      const owner = await as("owner");
      const email = () => `flow.stepup.${Date.now()}.${Math.round(Math.random() * 1e6)}@app.demo.injishi.com`;
      const invite = (stepUpCode: string, contact = email()) =>
        inviteMember(owner, { name: "Step Up", contact, role: "frontdesk", scopeIds: ["ish"], stepUpCode });
      const invitations = async () => (await members(owner)).filter((m) => m.name === "Step Up");
      const before = (await invitations()).length;

      // This session never asked for a code, so no code can be good, whatever its digits.
      await refused(422, () => invite("123456"), "a step-up code nobody asked for");
      const sent = await sendStepUpCode(owner);
      check(/@/.test(sent.sentTo) && sent.expiresInSeconds > 0, `the API answered ${JSON.stringify(sent)}`);
      step(`the API emailed a code to ${sent.sentTo}`);
      await refused(422, () => invite("000000"), "a wrong step-up code");
      const short = await screenRefusal(() => invite("12 34"), "a code that is not six digits");
      check((await invitations()).length === before, "a refused step-up still wrote an invitation");
      step(`unasked and wrong codes are refused by the API (422), "${short}" before it; nothing was written`);

      const code = await demoCode();
      const { id } = await invite(code);
      const made = (await members(owner)).find((m) => m.id === id);
      check(
        made?.status === "invited" && made.scopeIds.join() === "ish",
        `the invitation reads ${JSON.stringify(made)}`,
      );
      step("the right code let the invitation through");
      await refused(422, () => invite(code), "a step-up code used twice");
      step("the same code a second time is refused: a code is spent when it verifies");

      // A role change asks for its own code, and a change that changes nothing never spends one.
      const beatrice = (await members(owner)).find((m) => m.name === "Beatrice Mukandori");
      check(beatrice?.status === "active" && beatrice.role === "staff", `Beatrice reads ${JSON.stringify(beatrice)}`);
      await changeMember(owner, beatrice.id, { role: "staff", scopeIds: beatrice.scopeIds, stepUpCode: "000000" });
      await refused(
        422,
        () => changeMember(owner, beatrice.id, { role: "frontdesk", scopeIds: ["isg"], stepUpCode: "000000" }),
        "a role change with a wrong code",
      );
      check(
        (await members(owner)).find((m) => m.id === beatrice.id)?.role === "staff",
        "a refused code changed a role",
      );
      await sendStepUpCode(owner);
      await changeMember(owner, beatrice.id, { role: "frontdesk", scopeIds: ["isg"], stepUpCode: code });
      check((await members(owner)).find((m) => m.id === beatrice.id)?.role === "frontdesk", "the change did not land");
      await sendStepUpCode(owner);
      await changeMember(owner, beatrice.id, { role: "staff", scopeIds: ["isg"], stepUpCode: code });
      check((await members(owner)).find((m) => m.id === beatrice.id)?.role === "staff", "Beatrice was not put back");
      step("a role change went through only with a fresh code, and was put back with another");

      await cancelInvitation(owner, id);

      // The code proves who is typing, never what they may do.
      const manager = await as("manager");
      await sendStepUpCode(manager);
      await refused(
        403,
        () =>
          inviteMember(manager, {
            name: "No",
            contact: email(),
            role: "frontdesk",
            scopeIds: ["isg"],
            stepUpCode: code,
          }),
        "a stepped-up general manager inviting staff",
      );
      step("the general manager, with a good code, is still refused with 403 (no team.manage)");
    },
  },
  {
    name: "the owner saves a Reports view and a second view of the same name is refused",
    async run({ as, check, refused, step }) {
      const owner = await as("owner");
      const label = `Lodge flow ${Date.now() % 100000}`;
      const view = await saveReportView(owner, { tab: "fin", property: "ish", propertyLabel: label });
      const views = (await sources["owner.reportsSavedViews"].list(owner)) as ReportsSavedView[];
      const found = views.find((v) => v.id === view.id);
      check(
        found && found.label === view.name && found.tab === "fin" && found.property === "ish",
        `the saved view reads ${JSON.stringify(found)}`,
      );
      check(views.at(-1)?.id === view.id, "a new view is not listed after the owner's earlier ones");
      step(`saved "${found.label}"`);

      await refused(
        409,
        () => saveReportView(owner, { tab: "fin", property: "ish", propertyLabel: label }),
        "saving the same view name twice",
      );
      const desk = await as("frontdesk");
      await refused(
        403,
        () => saveReportView(desk, { tab: "perf", property: "all", propertyLabel: "All" }),
        "the front desk saving a Reports view",
      );
      step("the same name twice is refused (409); the front desk (no money.view) is refused with 403");
    },
  },
  {
    name: "the Team screen's scope picker and employee-file line come from live data, never the sample tree",
    async run({ as, check, step }) {
      const owner = await as("owner");
      const scopes = await teamScopes(owner);
      const grantable = scopes.filter((s) => s.kind !== "entity");
      check(
        grantable.length > 0 && grantable.every((s) => s.kind === "property"),
        `the picker offers outlets or merchants: ${JSON.stringify(scopes)}`,
      );
      const team = await members(owner);
      const offered = new Set(grantable.map((s) => s.id));
      const unknown = team.flatMap((m) => m.scopeIds).filter((id) => !offered.has(id));
      check(unknown.length === 0, `members cover branches the picker does not offer: ${unknown.join(", ")}`);
      step(
        `${grantable.length} live branches under ${scopes.filter((s) => s.kind === "entity").length} businesses; no outlet row`,
      );

      const files = await employeeFileEmails(owner);
      check(files !== null && files.length > 0, "the owner (people.view) read no employee file from People");
      const filed = team.filter((m) => m.status === "active" && files?.includes(m.contact.trim().toLowerCase()));
      check(filed.length > 0, "no active member's email matches an active file in People");
      step(`${filed.length} active members have a file in People, read from GET /ops/employees`);
      const manager = await as("manager");
      check((await employeeFileEmails(manager)) === null, "the manager holds no team.manage, so People is not read");
    },
  },
];
