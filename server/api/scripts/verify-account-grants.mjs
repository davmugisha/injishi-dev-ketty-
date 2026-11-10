// Verify ADR-076 slice G over HTTP: grants, refusal layers, and products a
// business can have switched on and off.
//
// WHAT IT PROVES, in order:
//   A. `/me/workspaces` carries `grants` on every business workspace and keeps
//      every field it had: the owner's and the receptionist's roles and
//      permissions under their new names, the products each business can reach
//      today, a residence business without PMS, and a business still in
//      registration holding Account alone (G1, G3).
//   B. Every guard refusal names its layer and code beside the sentence it
//      always sent (G11, AC-U3).
//   C. Injishi staff switch a product on and off with a reason (G6): the
//      wrong staff role, a short reason, a branch list on a business level
//      product, switching Account off and a branch of another business are
//      each refused with their code; a product with a guest in house cannot be
//      switched off (G7); a real change writes one audit row under the staff
//      grant family and tells the owner in the app and by email (G8, G16); the
//      same request again changes nothing and writes nothing.
//   D. The route's product is enforced (G9): with Outlets off, the outlets
//      routes refuse its owner and its receptionist with layer `entitlement`,
//      and open again when it is switched back on. A landlord, whose business
//      has no PMS, is refused PMS's routes the same way (A-13).
//
// WHAT IT LEAVES BEHIND: Umurage Hospitality's `pos` and `outlets` end where
// they started (on for every branch), with the closed and reopened rows as
// their history, two audit rows per product, two in app notices and two mails
// to its owner in Mailpit. Nothing else is touched. The finally block switches
// both back on if a step fails in between.
//
// Needs the API against a sample marked database (seed-sample.mjs), in the
// demo shape so the fixed code signs in, and Mailpit's API for the mail check.
//   API_BASE=http://127.0.0.1:8010 MAILPIT_API=http://127.0.0.1:48125 node scripts/verify-account-grants.mjs

import { readFileSync } from "node:fs";
import pg from "pg";

const BASE = process.env.API_BASE || "http://127.0.0.1:8000";
const MAILPIT = process.env.MAILPIT_API || "http://127.0.0.1:8025";
const ORIGIN = process.env.WEB_ORIGIN || "http://localhost:3010";
const REASON = "ADR-076 slice G verification run";

const UMURAGE_ORG = "0f9a1b00-0000-4000-8000-000000000001";
const UMURAGE_WS = "0f9a1b00-0000-4000-8000-000000000002";
const UMURAGE_BRANCH = "0f9a1b00-0000-4000-8000-000000000003";
const LAVENDER_WS_OF = "landlord@injishi.com";
const AMAHORO_ORG = "de300000-0000-4000-8000-000000000101";

let pass = 0;
let fail = 0;
const failures = [];
function check(label, ok, detail) {
  if (ok) {
    pass += 1;
    console.log(`  PASS  ${label}`);
  } else {
    fail += 1;
    failures.push(label);
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const line = readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL is not set and not in server/api/.env");
  return line.slice("DATABASE_URL=".length).trim();
}
const db = new pg.Pool({ connectionString: databaseUrl() });
const q = async (text, params = []) => (await db.query(text, params)).rows;

function makeSession() {
  const jar = new Map();
  return {
    cookie: () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; "),
    absorb(res) {
      for (const line of res.headers.getSetCookie?.() ?? []) {
        const [pair] = line.split(";");
        const idx = pair.indexOf("=");
        if (idx > 0) jar.set(pair.slice(0, idx), pair.slice(idx + 1));
      }
    },
  };
}

async function call(session, method, path, body, extraHeaders = {}) {
  const headers = { origin: ORIGIN, ...extraHeaders };
  if (session) headers.cookie = session.cookie();
  let payload;
  if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  if (session) session.absorb(res);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

const sessions = new Map();
async function signIn(email) {
  if (sessions.has(email)) return sessions.get(email);
  const session = makeSession();
  await call(session, "POST", "/api/auth/email-otp/send-verification-otp", { email, type: "sign-in" });
  const res = await call(session, "POST", "/api/auth/sign-in/email-otp", { email, otp: "123456" });
  if (res.status !== 200) throw new Error(`sign-in failed for ${email}: ${res.status} ${res.text.slice(0, 160)}`);
  sessions.set(email, session);
  return session;
}

async function businessOf(email, orgId) {
  const me = await call(await signIn(email), "GET", "/api/v1/me/workspaces");
  const list = me.json?.workspaces ?? [];
  return orgId ? list.find((w) => w.orgId === orgId) : list.find((w) => w.kind === "business");
}

const refusal = (res, status, layer, code) =>
  res.status === status && res.json?.layer === layer && res.json?.code === code;

const productsPath = (product) => `/api/v1/admin/orgs/${UMURAGE_ORG}/products/${product}`;

async function setProduct(staff, product, body) {
  return call(staff, "PUT", productsPath(product), { reason: REASON, ...body });
}

async function main() {
  console.log(`\nADR-076 slice G against ${BASE}\n`);

  // ---------------------------------------------------------------------------
  console.log("A. Grants on /me/workspaces (G1, G3)");
  const owner = await businessOf("host@injishi.com", UMURAGE_ORG);
  check("the owner's business workspace carries grants", owner?.grants?.family === "business", JSON.stringify(owner?.grants)?.slice(0, 120));
  check("every field it returned before is still there", owner && ["permissions", "branches", "branchCoverage", "departments", "registrationStatus", "orgRole"].every((k) => k in owner));
  check("the owner holds one default role, keyed by its value, with no id yet", owner?.grants?.roles?.length === 1 && owner.grants.roles[0].key === "owner" && owner.grants.roles[0].roleId === null);
  check("the lock keeps its meaning under its new name", owner?.grants?.permissions?.some((p) => p.key === "account.team.manage"));
  check("as many permissions under new names as flat ones", owner?.grants?.permissions?.length === owner?.permissions?.length);
  const products = (owner?.grants?.products ?? []).map((p) => p.id).sort();
  check("a hotel reaches what it reached before: account, marketplace, pms, outlets, pos, hr, finance, pay", JSON.stringify(products) === JSON.stringify(["account", "finance", "hr", "marketplace", "outlets", "pay", "pms", "pos"]), products.join(","));
  check("on for every branch", owner?.grants?.products?.every((p) => p.branches === "all"));

  const desk = await businessOf("reception@injishi.com", UMURAGE_ORG);
  check("the receptionist holds receptionist, and pms.stay.checkin", desk?.grants?.roles?.[0]?.key === "receptionist" && desk.grants.permissions.some((p) => p.key === "pms.stay.checkin"));
  check("and not the lock", !desk?.grants?.permissions?.some((p) => p.key === "account.team.manage"));

  const landlord = await businessOf(LAVENDER_WS_OF);
  const landlordProducts = (landlord?.grants?.products ?? []).map((p) => p.id).sort();
  check("a residence reaches residence and no pms", landlordProducts.includes("residence") && !landlordProducts.includes("pms"), landlordProducts.join(","));

  const pending = await businessOf("pending@injishi.com");
  check("a business still in registration holds account alone, and no permission", JSON.stringify((pending?.grants?.products ?? []).map((p) => p.id)) === '["account"]' && pending?.grants?.permissions?.length === 0, JSON.stringify(pending?.grants));

  // ---------------------------------------------------------------------------
  console.log("\nB. Refusals name their layer and code (G11)");
  const anonymous = await call(null, "GET", "/api/v1/me/workspaces");
  check("no session: 401, session, unauthenticated", refusal(anonymous, 401, "session", "unauthenticated"), anonymous.text.slice(0, 120));

  const hostSession = await signIn("host@injishi.com");
  const notStaff = await call(hostSession, "GET", "/api/v1/admin/orgs");
  check("not staff: 403, permission, not_staff", refusal(notStaff, 403, "permission", "not_staff"), notStaff.text.slice(0, 120));

  const foreign = await call(hostSession, "GET", "/api/v1/ops/team", undefined, { "x-workspace-id": "00000000-0000-4000-8000-000000000000" });
  check("a workspace not held: 403, workspace, workspace_not_available, same sentence", refusal(foreign, 403, "workspace", "workspace_not_available") && foreign.json?.message === "That workspace is not available to you.");

  const badBranch = await call(hostSession, "GET", "/api/v1/ops/team", undefined, { "x-workspace-id": UMURAGE_WS, "x-branch-id": "11111111-1111-4111-8111-111111111111" });
  check("a branch not covered: 404, scope, not_found", refusal(badBranch, 404, "scope", "not_found"), badBranch.text.slice(0, 120));

  const deskSession = await signIn("reception@injishi.com");
  const lacks = await call(deskSession, "GET", "/api/v1/ops/team", undefined, { "x-workspace-id": UMURAGE_WS });
  check("a missing permission: 403, permission, permission_missing", refusal(lacks, 403, "permission", "permission_missing"), lacks.text.slice(0, 120));

  // G18: a member of one business meets 404 for another business's record,
  // asked through their own workspace, so a probe cannot learn the id exists.
  const amahoroBooking = (await q(`select b.id from bookings b join room_types rt on rt.id = b.room_type_id join properties p on p.id = rt.property_id where p.org_id = $1 limit 1`, [AMAHORO_ORG]))[0]?.id;
  const crossRecord = await call(hostSession, "GET", `/api/v1/ops/reservations/${amahoroBooking}`, undefined, { "x-workspace-id": UMURAGE_WS });
  check("another business's reservation, through your own workspace: 404", crossRecord.status === 404, `${crossRecord.status} ${crossRecord.text.slice(0, 100)}`);

  const pendingSession = await signIn("pending@injishi.com");
  const stage = await call(pendingSession, "GET", "/api/v1/ops/team", undefined, { "x-workspace-id": pending?.workspaceId });
  check("a business in registration: 403, operational, registration_stage", refusal(stage, 403, "operational", "registration_stage"), stage.text.slice(0, 120));

  // ---------------------------------------------------------------------------
  console.log("\nC. Staff switch products with a reason (G6, G7, G8, G16)");
  const ops = await signIn("admin-ops@injishi.com");
  const compliance = await signIn("admin-compliance@injishi.com");

  const view = await call(ops, "GET", `/api/v1/admin/orgs/${UMURAGE_ORG}/products`);
  check("ops reads where each product is on", view.status === 200 && view.json?.resolved?.find((r) => r.productId === "pos")?.everyBranch === true, view.text.slice(0, 120));

  const denied = await setProduct(compliance, "pos", { branchIds: null, state: "off" });
  check("compliance may read but not switch: 403, permission_missing", refusal(denied, 403, "permission", "permission_missing"), denied.text.slice(0, 120));

  const short = await call(ops, "PUT", productsPath("pos"), { branchIds: null, state: "off", reason: "because" });
  check("a short reason: 422 reason_required", short.status === 422 && short.json?.code === "reason_required", short.text.slice(0, 120));

  const level = await setProduct(ops, "hr", { branchIds: [UMURAGE_BRANCH], state: "off" });
  check("a branch list for HR: 422 entitlement_level", level.status === 422 && level.json?.code === "entitlement_level");

  const locked = await setProduct(ops, "account", { branchIds: null, state: "off" });
  check("Account off: 422 entitlement_locked", locked.status === 422 && locked.json?.code === "entitlement_locked");

  const otherBranch = await setProduct(ops, "pms", { branchIds: ["de300000-0000-4000-8000-000000000401"], state: "off" });
  check("a branch of another business: 422 branch_invalid", otherBranch.status === 422 && otherBranch.json?.code === "branch_invalid");

  const amahoroBranch = (await q(`select r.property_id from guest_stays s join rooms r on r.id = s.room_id join properties p on p.id = r.property_id where p.org_id = $1 and s.lifecycle = 'open' limit 1`, [AMAHORO_ORG]))[0]?.property_id;
  const inUse = await call(ops, "PUT", `/api/v1/admin/orgs/${AMAHORO_ORG}/products/pms`, { branchIds: [amahoroBranch], state: "off", reason: REASON });
  check("PMS off where a guest is in house: 409 product_in_use, naming it", inUse.status === 409 && inUse.json?.code === "product_in_use" && inUse.json?.reasons?.some((r) => r.kind === "guest_in_house"), inUse.text.slice(0, 160));

  const auditBefore = Number((await q(`select count(*)::int as n from audit_events where subject_type = 'entitlement'`))[0].n);
  const noticesBefore = Number((await q(`select count(*)::int as n from notifications n join users u on u.id = n.user_id where u.email = 'host@injishi.com' and n.category = 'system'`))[0].n);

  const off = await setProduct(ops, "pos", { branchIds: [UMURAGE_BRANCH], state: "off" });
  check("POS off at Umurage's only branch: the every branch row closes, none opens", off.status === 200 && off.json?.changed === true && off.json?.open?.length === 0, off.text.slice(0, 160));

  const auditRow = (await q(`select grant_family, role_keys, permissions, payload_diff, reason from audit_events where subject_type = 'entitlement' order by occurred_at desc limit 1`))[0];
  check("one audit row, under the staff family, the role and the permission it was granted on", auditRow?.grant_family === "staff" && auditRow?.role_keys?.includes("ops") && auditRow?.permissions?.includes("admin.business.entitlement.edit") && auditRow?.reason === REASON, JSON.stringify(auditRow)?.slice(0, 200));

  const notice = (await q(`select n.title, n.body from notifications n join users u on u.id = n.user_id where u.email = 'host@injishi.com' and n.category = 'system' order by n.created_at desc limit 1`))[0];
  const noticesAfter = Number((await q(`select count(*)::int as n from notifications n join users u on u.id = n.user_id where u.email = 'host@injishi.com' and n.category = 'system'`))[0].n);
  check("the owner is told in the app, naming the product, the branch and the reason", noticesAfter === noticesBefore + 1 && /POS is now off at Umurage Guesthouse/.test(notice?.title ?? "") && (notice?.body ?? "").includes(REASON), JSON.stringify(notice));

  const mail = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent('to:host@injishi.com subject:"POS is now off"')}`).then((r) => r.json()).catch(() => null);
  check("and by email", (mail?.messages_count ?? mail?.total ?? 0) > 0, JSON.stringify(mail)?.slice(0, 120));

  const again = await setProduct(ops, "pos", { branchIds: [UMURAGE_BRANCH], state: "off" });
  const auditAgain = Number((await q(`select count(*)::int as n from audit_events where subject_type = 'entitlement'`))[0].n);
  check("the same request again changes nothing and writes no audit row", again.status === 200 && again.json?.changed === false && auditAgain === auditBefore + 1);

  const ownerNow = await businessOf("host@injishi.com", UMURAGE_ORG);
  check("the owner's grants no longer list POS", !ownerNow?.grants?.products?.some((p) => p.id === "pos"), JSON.stringify(ownerNow?.grants?.products));

  // ---------------------------------------------------------------------------
  console.log("\nD. The route's product is enforced (G9, A-13)");
  const outletsOff = await setProduct(ops, "outlets", { branchIds: null, state: "off" });
  check("Outlets off for the whole business", outletsOff.status === 200 && outletsOff.json?.changed === true, outletsOff.text.slice(0, 160));

  const ownerOutlets = await call(hostSession, "GET", "/api/v1/ops/outlets", undefined, { "x-workspace-id": UMURAGE_WS });
  check("the owner is refused the outlets routes: 403, entitlement, product_off", refusal(ownerOutlets, 403, "entitlement", "product_off"), ownerOutlets.text.slice(0, 120));

  const deskOutlets = await call(deskSession, "GET", "/api/v1/ops/service-orders", undefined, { "x-workspace-id": UMURAGE_WS, "x-branch-id": UMURAGE_BRANCH });
  check("and so is the desk, at its branch", refusal(deskOutlets, 403, "entitlement", "product_off"), deskOutlets.text.slice(0, 120));

  const ownerPms = await call(hostSession, "GET", "/api/v1/ops/front-desk", undefined, { "x-workspace-id": UMURAGE_WS });
  check("PMS, still on, is untouched", ownerPms.status !== 403, `${ownerPms.status} ${ownerPms.text.slice(0, 80)}`);

  const outletsOn = await setProduct(ops, "outlets", { branchIds: null, state: "on" });
  const reopened = await call(hostSession, "GET", "/api/v1/ops/outlets", undefined, { "x-workspace-id": UMURAGE_WS });
  check("switched back on, the outlets routes open again", outletsOn.json?.changed === true && reopened.status === 200, `${reopened.status} ${reopened.text.slice(0, 80)}`);

  const landlordSession = await signIn(LAVENDER_WS_OF);
  const landlordPms = await call(landlordSession, "GET", "/api/v1/ops/reservations", undefined, { "x-workspace-id": landlord?.workspaceId });
  check("a landlord, whose business has no PMS, is refused PMS's routes by entitlement", refusal(landlordPms, 403, "entitlement", "product_off"), landlordPms.text.slice(0, 120));
  const landlordResidence = await call(landlordSession, "GET", "/api/v1/ops/rent-roll", undefined, { "x-workspace-id": landlord?.workspaceId });
  check("and keeps Residence's", landlordResidence.status !== 403, `${landlordResidence.status} ${landlordResidence.text.slice(0, 80)}`);
}

async function restore() {
  const ops = await signIn("admin-ops@injishi.com").catch(() => null);
  if (!ops) return;
  for (const product of ["pos", "outlets"]) {
    const res = await setProduct(ops, product, { branchIds: null, state: "on" });
    if (res.status !== 200) console.log(`  could not switch ${product} back on: ${res.status} ${res.text.slice(0, 120)}`);
  }
}

try {
  await main();
} catch (error) {
  fail += 1;
  failures.push(`crashed: ${error?.message ?? error}`);
  console.log(`  FAIL  the run crashed — ${error?.stack ?? error}`);
} finally {
  await restore();
  await db.end();
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
