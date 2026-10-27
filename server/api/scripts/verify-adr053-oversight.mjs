// Verify ADR-053 slice 5 over HTTP: the oversight console.
//
// WHAT IT PROVES, in order:
//   A. Region scope is stated once: a province verifier's queue holds that
//      province's districts and nothing else, a district verifier's holds that
//      district, a country verifier's holds every business at its stage, and a
//      single record gate act outside the scope is refused by the same rule
//      (AC-G8).
//   B. The decision log: an officer reads their OWN decisions, newest first, each
//      naming the business, the stage, the outcome, the reason and the date; a
//      colleague's are absent; the read writes an access log row; a decision keeps
//      the title it was taken under after the posting is revoked and re granted;
//      a tax compliance officer is refused it (AC-G6, AC-G7).
//   C. The government body catalogue: create, a duplicate refused, rename,
//      retire; a retired body refused for a new grant while an existing grant
//      still names it; finance reads and cannot write; each change audited with
//      the acting staffer (AC-G4, AC-G10).
//   D. Coverage on admin's review queue, three state and computed at read time:
//      covered, uncovered after a revoke with no job run, and not_applicable at
//      `submitted` and `approved` (AC-G9).
//
// WHAT IT LEAVES BEHIND: throwaway officers `adr053-prov@`, `adr053-dist@`,
// `adr053-country@`, `adr053-approver@` and `adr053-tax@injishi.com`, whose grants
// are all REVOKED by the end, so no seeded officer's queue or coverage changes;
// a government body `V049_…` that ends retired; and a handful of "ADR-053 Verify
// Scope …" registrations owned by `adr053-registrant@`.
//
// Needs the API on 8000 against a sample marked database.
// Run it:  node scripts/verify-adr053-oversight.mjs

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";

const BASE = process.env.API_BASE || "http://127.0.0.1:8000";
const WEB_ORIGIN = "http://localhost:3000";
const REASON = "ADR-053 slice 5 verification";
const PLACES = {
  gasabo: { country: "RW", provinceId: 1, districtId: 102, sectorId: 10201 },
  nyanza: { country: "RW", provinceId: 2, districtId: 201, sectorId: 20101 },
  rubavu: { country: "RW", provinceId: 3, districtId: 303, sectorId: 30301 },
  rusizi: { country: "RW", provinceId: 3, districtId: 306, sectorId: 30601 },
};

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

/**
 * Registering a business needs a verified identity wherever a check can run
 * (ADR-060). This proof is about something else, so its registrant is verified
 * by staff, the way the demo seeds verify theirs (`manual`), under the same
 * name and birth date the proof then sends.
 */
async function markVerified(email, fullName, dateOfBirth) {
  const [user] = await q(`select id from users where lower(email) = lower($1)`, [email]);
  if (!user) throw new Error(`markVerified: no user ${email}`);
  await q(
    `insert into verified_identities (user_id, kyc_status, legal_full_name, dob, verified_method, verified_at)
     values ($1, 'verified', $2, $3, 'manual', now())
     on conflict (user_id) do update set kyc_status = 'verified', legal_full_name = $2, dob = $3,
       verified_method = 'manual', verified_at = now()`,
    [user.id, fullName, dateOfBirth],
  );
}

const JAR_FILE = join(tmpdir(), "injishi-verify-adr053-sessions.json");
const JARS = (() => {
  try {
    return existsSync(JAR_FILE) ? JSON.parse(readFileSync(JAR_FILE, "utf8")) : {};
  } catch {
    return {};
  }
})();

function makeSession(seed) {
  const jar = new Map(Object.entries(seed ?? {}));
  return {
    cookie: () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; "),
    absorb(res) {
      for (const line of res.headers.getSetCookie?.() ?? []) {
        const [pair] = line.split(";");
        const idx = pair.indexOf("=");
        if (idx > 0) jar.set(pair.slice(0, idx), pair.slice(idx + 1));
      }
    },
    snapshot: () => Object.fromEntries(jar),
  };
}

async function call(session, method, path, body, extraHeaders = {}) {
  const headers = { ...extraHeaders };
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

async function signIn(email) {
  const cached = JARS[email];
  if (cached) {
    const reused = makeSession(cached);
    const probe = await call(reused, "GET", "/api/v1/me/profile");
    if (probe.status === 200) return reused;
  }
  const session = makeSession();
  const origin = { origin: WEB_ORIGIN };
  await call(session, "POST", "/api/auth/email-otp/send-verification-otp", { email, type: "sign-in" }, origin);
  const res = await call(session, "POST", "/api/auth/sign-in/email-otp", { email, otp: "123456" }, origin);
  if (res.status !== 200) throw new Error(`sign-in failed for ${email}: ${res.status} ${res.text.slice(0, 160)}`);
  JARS[email] = session.snapshot();
  writeFileSync(JAR_FILE, JSON.stringify(JARS, null, 1));
  return session;
}

const userId = async (email) =>
  (await q(`select id from users where lower(email) = lower($1)`, [email]))[0]?.id;

let admin = null;
const granted = []; // { userId, id } to revoke at the end

async function grant(email, body) {
  await signIn(email);
  const uid = await userId(email);
  const res = await call(admin, "POST", `/api/v1/admin/users/${uid}/oversight`, { reason: REASON, ...body });
  if (res.status === 201) granted.push({ userId: uid, id: res.json.id });
  return { ...res, userId: uid };
}

async function revoke(g) {
  const res = await call(admin, "DELETE", `/api/v1/admin/users/${g.userId}/oversight/${g.id}?reason=${encodeURIComponent(REASON)}`);
  if (res.status === 204) granted.splice(granted.findIndex((x) => x.id === g.id), 1);
  return res;
}

/**
 * Upload a small PDF as this session's RDB certificate. ADR-075 AC-11: create refuses a stay or a venue without
 * one, and only takes a certificate the registrant uploaded. Uploaded once per person per run and reused for each
 * of their registrations, because the certificate route allows 10 per person in 10 minutes.
 */
const uploadedCertificates = new WeakMap();
async function rdbCertificate(session) {
  if (uploadedCertificates.has(session)) return uploadedCertificates.get(session);
  const form = new FormData();
  form.append("file", new Blob([CERTIFICATE_PDF], { type: "application/pdf" }), "rdb-certificate.pdf");
  const res = await fetch(`${BASE}/api/v1/uploads/certificate`, { method: "POST", headers: { cookie: session.cookie() }, body: form });
  session.absorb(res);
  const json = await res.json().catch(() => null);
  if (!json?.objectKey) throw new Error(`certificate upload: ${res.status} ${JSON.stringify(json)}`);
  const certificates = [{ kind: "rdb_certificate", objectKey: json.objectKey }];
  uploadedCertificates.set(session, certificates);
  return certificates;
}
const CERTIFICATE_PDF = "%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n";

/**
 * Mark every document on a registration checked, as the field verifier does before verifying (F-S03 §5: the gate
 * refuses while one is unread). Every registration carries its RDB certificate since ADR-075 AC-11.
 */
async function checkEveryDocument(officer, orgId) {
  const list = await call(officer, "GET", `/api/v1/oversight/registrations/${orgId}/documents`);
  for (const d of list.json?.documents ?? []) {
    await call(officer, "POST", `/api/v1/oversight/registrations/${orgId}/documents/${d.id}/check`, {});
  }
}

/** A registration taken to `tin_verified` in a place: create and pay (ADR-075: no contract before paying). */
async function registrationAt(host, place, name) {
  const created = await call(host, "POST", "/api/v1/registrations", {
    role: "host",
    capacity: "owner",
    business: {
      domain: "hospitality",
      legalName: `ADR-053 Verify Scope ${name} ${Date.now()}`,
      address: PLACES[place],
      accommodationClass: "guest_house",
      tin: String(100000000 + Math.floor(Math.random() * 899999999)),
      certificates: await rdbCertificate(host),
    },
  });
  const id = created.json?.orgId;
  if (!id) throw new Error(`could not create a registration in ${place}: ${created.status} ${created.text.slice(0, 160)}`);
  await call(host, "POST", `/api/v1/registrations/${id}/pay`);
  const [{ registration_status: status }] = await q(`select registration_status from orgs where id = $1`, [id]);
  if (status !== "tin_verified") throw new Error(`${place} registration is at ${status}, expected tin_verified`);
  return id;
}

const queueIds = async (session, which) =>
  new Set(((await call(session, "GET", `/api/v1/oversight/${which}`)).json ?? []).map((r) => r.orgId));

async function coverageOf(orgId) {
  for (let page = 1; page < 50; page += 1) {
    const res = await call(admin, "GET", `/api/v1/admin/orgs/review-queue?page=${page}&pageSize=100`);
    const item = (res.json?.items ?? []).find((i) => i.orgId === orgId);
    if (item) return item.coverage;
    if ((res.json?.items ?? []).length < 100) return undefined;
  }
  return undefined;
}

const main = async () => {
  admin = await signIn("admin@injishi.com");
  const host = await signIn("adr053-registrant@injishi.com");
  await markVerified("adr053-registrant@injishi.com", "ADR-053 Verify Registrant", "1990-01-01");

  // -------------------------------------------------------------------------
  console.log("\n=== A. One definition of region scope (AC-G8) ===");
  const rubavu = await registrationAt(host, "rubavu", "Rubavu");
  const nyanza = await registrationAt(host, "nyanza", "Nyanza");
  const gasabo = await registrationAt(host, "gasabo", "Gasabo");

  const provG = await grant("adr053-prov@injishi.com", { oversightRole: "business_field_verifier", governmentBodyCode: "PSF", governmentTitle: "ADR-053 Province Officer", scopeLevel: "province", provinceId: 3 });
  const distG = await grant("adr053-dist@injishi.com", { oversightRole: "business_field_verifier", governmentBodyCode: "PSF", governmentTitle: "ADR-053 District Officer", scopeLevel: "district", districtId: 201 });
  const countryG = await grant("adr053-country@injishi.com", { oversightRole: "business_field_verifier", governmentBodyCode: "MINALOC", governmentTitle: "ADR-053 Country Officer v1", scopeLevel: "country" });
  check("grant a province, a district and a country verifier", [provG, distG, countryG].every((g) => g.status === 201), [provG, distG, countryG].map((g) => `${g.status} ${g.text.slice(0, 80)}`).join(" | "));

  const prov = await signIn("adr053-prov@injishi.com");
  const dist = await signIn("adr053-dist@injishi.com");
  const country = await signIn("adr053-country@injishi.com");

  const provQ = await queueIds(prov, "verification-queue");
  const distQ = await queueIds(dist, "verification-queue");
  const countryQ = await queueIds(country, "verification-queue");
  check("the province verifier sees Rubavu, in its province, and not Nyanza or Gasabo", provQ.has(rubavu) && !provQ.has(nyanza) && !provQ.has(gasabo));
  check("the district verifier sees Nyanza and not Rubavu or Gasabo", distQ.has(nyanza) && !distQ.has(rubavu) && !distQ.has(gasabo));
  const [{ n: allAtStage }] = await q(`select count(*)::int as n from orgs where registration_status = 'tin_verified'`);
  check("the country verifier sees all three, and every business at the stage", countryQ.has(rubavu) && countryQ.has(nyanza) && countryQ.has(gasabo) && countryQ.size === allAtStage, `${countryQ.size} vs ${allAtStage}`);
  const provInScope = await q(
    `select o.id from orgs o join districts d on d.id = o.district_id where o.registration_status = 'tin_verified' and d.province_id = 3`,
  );
  check("the province queue is exactly the province's businesses at the stage", provQ.size === provInScope.length && provInScope.every((r) => provQ.has(r.id)), `${provQ.size} vs ${provInScope.length}`);

  const outOfScope = await call(prov, "POST", `/api/v1/registrations/${nyanza}/field-verify`, {});
  check("a single record act outside the scope is refused by the same rule (403)", outOfScope.status === 403 && /outside the region/i.test(String(outOfScope.json?.message)), `${outOfScope.status} ${outOfScope.text.slice(0, 120)}`);
  const outOfScope2 = await call(dist, "POST", `/api/v1/registrations/${rubavu}/field-verify`, {});
  check("and for the district verifier too", outOfScope2.status === 403, `status ${outOfScope2.status}`);

  // -------------------------------------------------------------------------
  console.log("\n=== B. The decision log (AC-G6, AC-G7) ===");
  await checkEveryDocument(country, rubavu);
  await checkEveryDocument(dist, nyanza);
  const v1 = await call(country, "POST", `/api/v1/registrations/${rubavu}/field-verify`, { notes: "Premises seen" });
  const r1 = await call(country, "POST", `/api/v1/registrations/${gasabo}/field-reject`, { reasonCode: "documents_invalid", notes: "Certificate expired" });
  const d1 = await call(dist, "POST", `/api/v1/registrations/${nyanza}/field-verify`, {});
  check("the country officer verifies one and rejects one; the district officer verifies one", [v1, r1, d1].every((r) => [200, 201].includes(r.status)), [v1, r1, d1].map((r) => r.status).join(","));

  const before = (await q(`select count(*)::int as n from record_access_logs where actor_user_id = $1 and reason = 'oversight decision log'`, [countryG.userId]))[0].n;
  const log = await call(country, "GET", "/api/v1/oversight/decisions");
  const items = log.json?.items ?? [];
  check("GET /oversight/decisions answers a page", log.status === 200 && Array.isArray(items) && "nextCursor" in (log.json ?? {}), `status ${log.status} ${log.text.slice(0, 160)}`);
  const ids = items.map((i) => i.orgId);
  check("it holds the officer's two decisions, newest first", ids[0] === gasabo && ids[1] === rubavu, JSON.stringify(ids.slice(0, 3)));
  const rej = items[0];
  const pas = items[1];
  check(
    "each names the business, the stage, the outcome, the reason where there was one, and the date",
    rej?.legalName?.includes("Scope Gasabo") && rej.stage === "tin_verified" && rej.decision === "rejected" && rej.reasonCode === "documents_invalid" && rej.notes === "Certificate expired" && typeof rej.decidedAt === "string" &&
      pas?.decision === "passed" && pas.reasonCode === null && pas.notes === "Premises seen",
    JSON.stringify(items.slice(0, 2)),
  );
  check("a colleague's decision is not in it", !ids.includes(nyanza), JSON.stringify(ids));
  const distLog = (await call(dist, "GET", "/api/v1/oversight/decisions")).json?.items ?? [];
  check("and the colleague's log holds only their own", distLog.length >= 1 && distLog.every((i) => i.orgId !== rubavu && i.orgId !== gasabo) && distLog[0].orgId === nyanza);
  const after = (await q(`select count(*)::int as n from record_access_logs where actor_user_id = $1 and reason = 'oversight decision log'`, [countryG.userId]))[0].n;
  check("reading it wrote a record_access_logs row", after === before + 1, `${before} -> ${after}`);
  const junk = await call(country, "GET", "/api/v1/oversight/decisions?cursor=not-a-cursor");
  check("a malformed cursor reads the newest page rather than failing", junk.status === 200 && junk.json?.items?.[0]?.orgId === gasabo);

  const rev = await revoke({ userId: countryG.userId, id: countryG.json.id });
  const countryV2 = await grant("adr053-country@injishi.com", { oversightRole: "business_field_verifier", governmentBodyCode: "MINALOC", governmentTitle: "ADR-053 Country Officer v2", scopeLevel: "country" });
  const relog = (await call(country, "GET", "/api/v1/oversight/decisions")).json?.items ?? [];
  check(
    "after the posting is revoked and re granted with a new title, old decisions keep the title they were taken under",
    rev.status === 204 && countryV2.status === 201 && relog.find((i) => i.orgId === rubavu)?.governmentTitle === "ADR-053 Country Officer v1",
    JSON.stringify(relog.slice(0, 2).map((i) => i.governmentTitle)),
  );

  const taxG = await grant("adr053-tax@injishi.com", { oversightRole: "tax_compliance_officer", governmentBodyCode: "MINALOC", governmentTitle: "ADR-053 Tax Officer", scopeLevel: "country" });
  const tax = await signIn("adr053-tax@injishi.com");
  const taxMe = await call(tax, "GET", "/api/v1/me/oversight");
  const taxLog = await call(tax, "GET", "/api/v1/oversight/decisions");
  check("AC-G7 a tax compliance officer's grant opens the tax console, reported as such", taxG.status === 201 && taxMe.json?.consoles?.some((c) => c.console === "tax"), JSON.stringify(taxMe.json?.consoles));
  check("and the decision log refuses them, since they decide no gate (403)", taxLog.status === 403, `status ${taxLog.status}`);

  // -------------------------------------------------------------------------
  console.log("\n=== C. The government body catalogue (AC-G4, AC-G10) ===");
  const code = `V049_${Date.now().toString(36).toUpperCase().slice(-6)}`;
  const adminId = await userId("admin@injishi.com");
  const created = await call(admin, "POST", "/api/v1/admin/government-bodies", { code, nameEn: "ADR-053 Verify Board", nameRw: "Ikigo cya ADR-053", abbreviation: "V49", reason: REASON });
  check("a staffer with admin.config.edit creates a body", created.status === 201 && created.json?.code === code && created.json.active === true, `${created.status} ${created.text.slice(0, 160)}`);
  const dup = await call(admin, "POST", "/api/v1/admin/government-bodies", { code, nameEn: "Again", nameRw: "Again", reason: REASON });
  check("the same code again is refused with 409", dup.status === 409, `status ${dup.status}`);
  const bodyGrant = await grant("adr053-approver@injishi.com", { oversightRole: "business_approver", governmentBodyCode: code, governmentTitle: "ADR-053 Board Approver", scopeLevel: "district", districtId: 201 });
  check("an officer is appointed under the new body", bodyGrant.status === 201, `${bodyGrant.status} ${bodyGrant.text.slice(0, 120)}`);
  const renamed = await call(admin, "PATCH", `/api/v1/admin/government-bodies/${code}`, { nameEn: "ADR-053 Verify Board Renamed", reason: REASON });
  check("rename it", renamed.status === 200 && renamed.json?.nameEn === "ADR-053 Verify Board Renamed" && renamed.json.code === code, `${renamed.status} ${renamed.text.slice(0, 120)}`);
  const approver = await signIn("adr053-approver@injishi.com");
  const approverMe = await call(approver, "GET", "/api/v1/me/oversight");
  check("the officer's console shows the new name at once", approverMe.json?.consoles?.[0]?.bodyName === "ADR-053 Verify Board Renamed", JSON.stringify(approverMe.json?.consoles?.[0]));
  const retired = await call(admin, "PATCH", `/api/v1/admin/government-bodies/${code}`, { active: false, reason: REASON });
  check("soft retire it", retired.status === 200 && retired.json?.active === false, `${retired.status}`);
  const refusedGrant = await grant("adr053-prov@injishi.com", { oversightRole: "business_approver", governmentBodyCode: code, governmentTitle: "Should be refused", scopeLevel: "district", districtId: 202 });
  check("a retired body is refused for a new grant (409)", refusedGrant.status === 409 && /retired/i.test(refusedGrant.text), `${refusedGrant.status} ${refusedGrant.text.slice(0, 120)}`);
  const stillNamed = await q(`select government_body_code from oversight_assignments where id = $1 and revoked_at is null`, [bodyGrant.json?.id]);
  check("and the existing grant still names it", stillNamed[0]?.government_body_code === code, JSON.stringify(stillNamed));
  const listed = await call(admin, "GET", "/api/v1/admin/government-bodies");
  check("the list keeps the retired body, inactive", listed.status === 200 && listed.json?.some((b) => b.code === code && b.active === false), `status ${listed.status}`);

  const finance = await signIn("adr053-finance@injishi.com");
  const fRead = await call(finance, "GET", "/api/v1/admin/government-bodies");
  const fCreate = await call(finance, "POST", "/api/v1/admin/government-bodies", { code: `${code}X`, nameEn: "No", nameRw: "Oya", reason: REASON });
  const fPatch = await call(finance, "PATCH", `/api/v1/admin/government-bodies/${code}`, { nameEn: "No", reason: REASON });
  check("finance reads the catalogue (200) and every write is refused (403)", fRead.status === 200 && fCreate.status === 403 && fPatch.status === 403, `${fRead.status}/${fCreate.status}/${fPatch.status}`);

  const audits = await q(
    `select event_type, actor_user_id from audit_events
      where event_type like 'admin.government_body.%' and payload_diff::text like $1 order by occurred_at`,
    [`%${code}%`],
  );
  check(
    "AC-G10 create, rename and retire each wrote an audit row naming the staffer",
    JSON.stringify(audits.map((a) => a.event_type)) === JSON.stringify(["admin.government_body.created", "admin.government_body.renamed", "admin.government_body.retired"]) && audits.every((a) => a.actor_user_id === adminId),
    JSON.stringify(audits),
  );

  // -------------------------------------------------------------------------
  console.log("\n=== D. Coverage on the review queue (AC-G9) ===");
  // The country verifier from B covers every district, so it goes first: with it
  // in place nothing can read uncovered, which is the point of a country grant.
  await revoke({ userId: countryV2.userId, id: countryV2.json.id });
  // Nyanza's verifier is now `adr053-dist@`, and nobody else covers Nyanza.
  const nyanza2 = await registrationAt(host, "nyanza", "Nyanza Coverage");
  const rusizi = await registrationAt(host, "rusizi", "Rusizi Coverage");
  check("a business at tin_verified in a district its verifier covers reads covered", (await coverageOf(nyanza2)) === "covered");
  check("and one covered through a PROVINCE grant reads covered", (await coverageOf(rusizi)) === "covered");
  await revoke({ userId: distG.userId, id: distG.json.id });
  check("revoke that verifier and it reads uncovered on the next read, no job run", (await coverageOf(nyanza2)) === "uncovered");
  // Rubavu is at field_verified since section B. Its approver would have to cover
  // province 3; the only board approver is in Nyanza.
  check("a business at field_verified with no approver in reach reads uncovered", (await coverageOf(rubavu)) === "uncovered");
  const countryApprover = await grant("adr053-approver@injishi.com", { oversightRole: "business_approver", governmentBodyCode: "MINALOC", governmentTitle: "ADR-053 Country Approver", scopeLevel: "country" });
  check("grant a country approver and it reads covered", countryApprover.status === 201 && (await coverageOf(rubavu)) === "covered", `${countryApprover.status} ${countryApprover.text.slice(0, 120)}`);
  // `submitted` and `approved` are staged on two throwaway rows, the way the slice
  // 2 script stages an RRA outage: the mock adapter never leaves a business there.
  await q(`update orgs set registration_status = 'submitted' where id = $1`, [nyanza]);
  await q(`update orgs set registration_status = 'approved' where id = $1`, [rusizi]);
  check("a business at submitted reads not_applicable", (await coverageOf(nyanza)) === "not_applicable");
  check("a business at approved reads not_applicable", (await coverageOf(rusizi)) === "not_applicable");
};

main()
  .catch((error) => {
    console.error("\nHARNESS ERROR:", error.message);
    fail += 1;
  })
  .finally(async () => {
    // Every grant this run made is revoked, so no seeded officer's queue and no
    // coverage answer is left changed by a verification run.
    for (const g of [...granted]) await revoke(g).catch(() => {});
    await db.end().catch(() => {});
    console.log(`\n==================== ${pass} passed, ${fail} failed ====================`);
    if (failures.length) console.log("Failed:\n - " + failures.join("\n - "));
    process.exit(fail === 0 ? 0 : 1);
  });
