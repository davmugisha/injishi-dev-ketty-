// Verify the ADR-053 registration ends: the event log, time in stage, the TIN
// retry sweep, the fee append and the membership enum (slice 2).
//
// The eleventh verify script, and the third that WRITES. It drives a real
// registration through every gate over HTTP and then reads the database to
// check what each move left behind, because "one event row per status change"
// is a claim about rows, and only rows can prove it.
//
// WHAT IT PROVES, in order:
//   A. A fee is APPENDED, never edited: a past moment is refused with 422, a
//      future one is written with an audit row, and the fee a registration is
//      quoted today does not move (AC-R9, AC-G10).
//   B. A registration is created, paid, TIN checked, field verified, REJECTED,
//      resubmitted, field verified again and approved, and every status change
//      wrote exactly one `org_registration_events` row naming the previous
//      status, the new status, the trigger and the actor. The first wait at
//      `submitted` survives the resubmit (AC-R6).
//   C. Time in stage is readable for `pending_payment`, which no review row can
//      bound, and on the review queue (AC-R7).
//   D. Admin suspend and reinstate write event rows too: the pair that lives
//      outside the organization module (AC-R6).
//   E. Postgres refuses an `org_memberships.status` outside the enum (AC-R10).
//   F. A business held at `submitted` on unanswered RRA checks is flagged
//      stalled at the ceiling and not before, and — WHEN A WORKER IS RUNNING —
//      the sweep re checks a due one and moves it on with a `system` event
//      (AC-R5). With no worker the sweep step is reported as skipped, not passed.
//
// WHAT IT LEAVES BEHIND: a throwaway account, `adr053-registrant@injishi.com`,
// owning two registrations named "ADR-053 Verify …", and a registration fee for
// hospitality effective in 2099, chosen so it never becomes the price on a
// working sample database. The registrant is a NEW account on purpose: every
// seeded persona exists to hold one exact shape of access (`pending@` holds a
// business at `submitted` and nothing else), and registering a second business
// for one of them would quietly change what it proves.
//
// Needs the API on 8000, a sample marked database, and for section F's sweep a
// worker: `INJISHI_PROCESS=worker node dist/main` from server/api.
//
// Run it:  node scripts/verify-adr053-registration.mjs

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import pg from "pg";

const BASE = process.env.API_BASE || "http://127.0.0.1:8000";
const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://localhost:3000";
const GASABO = { country: "RW", provinceId: 1, districtId: 102, sectorId: 10201 };
const REASON = "ADR-053 slice 2 verification";
const REGISTRANT = "adr053-registrant@injishi.com";

/**
 * Step 1 of registration, for the throwaway registrant.
 *
 * A fixed national id rather than a random one, so a rerun re-saves the SAME
 * document for the same account instead of claiming a second identity. The
 * `999` stem keeps it visibly synthetic.
 */
const PERSONAL = {
  fullName: "ADR-053 Verify Registrant",
  document: {
    documentType: "national_id",
    documentNumber: "1199900000049049",
    issuingCountry: "RW",
  },
  dateOfBirth: "1990-01-01",
  phoneE164: "+250780049049",
  address: { country: "RW", provinceId: 1, districtId: 102, sectorId: 10201 },
};

let pass = 0;
let fail = 0;
let skipped = 0;
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

function skip(label, why) {
  skipped += 1;
  console.log(`  SKIP  ${label} — ${why}`);
}

// ---------------------------------------------------------------------------
// The database, read directly: the event log is the thing under test.
// ---------------------------------------------------------------------------
function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = new URL("../.env", import.meta.url);
  const line = readFileSync(env, "utf8")
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

// ---------------------------------------------------------------------------
// Sessions, cached between runs in the OS temp directory. The OTP cap is five
// codes per address per hour, and the cache holds live cookies, so it never
// sits in the repository.
// ---------------------------------------------------------------------------
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

/**
 * Pay the registration fee the way a registrant does now (073-gtbank-payments
 * AC-16): press pay with a mobile money number, then poll the attempt until
 * the prompt settles. Answers the registration summary in `json`, the shape the
 * bare `/pay` used to answer, so the checks read it unchanged; `attempt` is set
 * when money was taken. A stack where payments are off answers `settled` at
 * once. A refusal (409 contract_not_accepted) comes back as it is.
 */
async function payFee(session, orgId) {
  const attemptToken = randomUUID();
  const pressed = await call(session, "POST", `/api/v1/registrations/${orgId}/pay`, {
    attemptToken,
    instrument: { kind: "mobile_money", network: "mtn_momo", msisdn: "788123456" },
  });
  if (pressed.status !== 200 && pressed.status !== 201) return pressed;
  if (pressed.json?.kind === "settled") return { ...pressed, json: pressed.json.registration, attempt: null };
  for (let i = 0; i < 60; i += 1) {
    await new Promise((r) => setTimeout(r, 1_000));
    const polled = await call(session, "GET", `/api/v1/registrations/${orgId}/pay/attempts/${attemptToken}`);
    if (polled.status !== 200) return polled;
    if (polled.json?.state !== "prompting") {
      return { status: pressed.status, json: polled.json.registration, text: polled.text, attempt: polled.json };
    }
  }
  return { status: 504, json: null, text: "the fee prompt never settled", attempt: null };
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

const randomTin = () => String(100000000 + Math.floor(Math.random() * 899999999));

function registrationBody(name) {
  return {
    role: "host",
    capacity: "owner",
    personal: PERSONAL,
    business: {
      domain: "hospitality",
      legalName: `ADR-053 Verify ${name} ${Date.now()}`,
      address: GASABO,
      accommodationClass: "guest_house",
      tin: randomTin(),
      certificates: [],
    },
  };
}

const events = (orgId) =>
  q(
    `select from_status, to_status, trigger, actor_user_id
       from org_registration_events
      where org_id = $1
      order by occurred_at, id`,
    [orgId],
  );

const userId = async (email) =>
  (await q(`select id from users where lower(email) = lower($1)`, [email]))[0]?.id;

const main = async () => {
  const admin = await signIn("admin@injishi.com");
  const host = await signIn(REGISTRANT);
  await markVerified(REGISTRANT, "ADR-053 Verify Registrant", "1990-01-01");
  const verifier = await signIn("jeanbosco@demo.injishi.com");
  const approver = await signIn("claudine@demo.injishi.com");
  const hostId = await userId(REGISTRANT);
  const verifierId = await userId("jeanbosco@demo.injishi.com");
  const approverId = await userId("claudine@demo.injishi.com");
  const adminId = await userId("admin@injishi.com");

  // -------------------------------------------------------------------------
  console.log("\n=== A. The fee catalogue appends (AC-R9, AC-G10) ===");
  const quoteBefore = await call(null, "GET", "/api/v1/registrations/fee?businessType=hospitality");
  const past = await call(admin, "POST", "/api/v1/admin/configuration/fees", {
    businessType: "hospitality",
    amountRwf: 7000,
    effectiveFrom: "2020-01-01T00:00:00Z",
    reason: REASON,
  });
  check("a fee effective in the past is refused with 422", past.status === 422, `status ${past.status} ${past.text.slice(0, 160)}`);

  const future = await call(admin, "POST", "/api/v1/admin/configuration/fees", {
    businessType: "hospitality",
    amountRwf: 9000,
    effectiveFrom: "2099-01-01T00:00:00Z",
    reason: REASON,
  });
  check("a future fee is appended", future.status === 201 && future.json?.amountRwf === 9000, `status ${future.status} ${future.text.slice(0, 160)}`);
  if (future.json?.id) {
    const audit = await q(
      `select actor_user_id, event_type, reason from audit_events where subject_id = $1`,
      [future.json.id],
    );
    check(
      "AC-G10 the append wrote an audit_events row naming the staffer",
      audit.length === 1 && audit[0].actor_user_id === adminId && audit[0].event_type === "admin.fee.appended",
      JSON.stringify(audit),
    );
  }
  const quoteAfter = await call(null, "GET", "/api/v1/registrations/fee?businessType=hospitality");
  check(
    "the fee quoted today did not move",
    JSON.stringify(quoteBefore.json) === JSON.stringify(quoteAfter.json),
    `${quoteBefore.text} vs ${quoteAfter.text}`,
  );

  // -------------------------------------------------------------------------
  console.log("\n=== B. One event row per status change (AC-R6) ===");
  const created = await call(host, "POST", "/api/v1/registrations", registrationBody("Pipeline"));
  check("create a registration", created.status === 201 || created.status === 200, `status ${created.status} ${created.text.slice(0, 200)}`);
  const orgId = created.json?.orgId;
  if (!orgId) return;

  let rows = await events(orgId);
  check(
    "creation writes the first row: from nothing to pending_payment, by the registrant",
    rows.length === 1 &&
      rows[0].from_status === null &&
      rows[0].to_status === "pending_payment" &&
      rows[0].trigger === "registrant" &&
      rows[0].actor_user_id === hostId,
    JSON.stringify(rows),
  );

  // C (time in stage for pending_payment) is checked here, while it is there.
  console.log("\n=== C. Time in stage for a stage no review can bound (AC-R7) ===");
  const detail = await call(admin, "GET", `/api/v1/admin/orgs/${orgId}`);
  check(
    "AC-R7 admin reads a time in stage for a business at pending_payment",
    detail.status === 200 && detail.json?.registrationStatus === "pending_payment" && typeof detail.json?.stageEnteredAt === "string",
    `status ${detail.status} ${JSON.stringify({ s: detail.json?.registrationStatus, at: detail.json?.stageEnteredAt })}`,
  );

  console.log("\n--- accept the contract, pay, and the TIN check that follows ---");
  // Paying refuses an unaccepted contract since task 11 (AC-R13). Accepting
  // changes no status, so it writes no event row and the walk below is unchanged.
  const accepted = await call(host, "POST", `/api/v1/registrations/${orgId}/contract`, { contractVersion: "2026-09-12" });
  check("accept the operator contract", accepted.status === 200, `status ${accepted.status} ${accepted.text.slice(0, 160)}`);
  const paid = await payFee(host, orgId);
  check("pay", paid.status === 200 || paid.status === 201, `status ${paid.status} ${paid.text.slice(0, 160)}`);
  rows = await events(orgId);
  // Free (payments off): the registrant's press moved it. Paid (mock or live):
  // the money settling moved it, as a SYSTEM move with no actor
  // (073-gtbank-payments AC-16).
  const paidByMoney = paid.attempt != null;
  check(
    paidByMoney
      ? "paying is a system move from pending_payment to submitted once the money settles"
      : "paying is a registrant move from pending_payment to submitted",
    rows[1]?.from_status === "pending_payment" &&
      rows[1]?.to_status === "submitted" &&
      (paidByMoney
        ? rows[1]?.trigger === "system" && rows[1]?.actor_user_id === null
        : rows[1]?.trigger === "registrant" && rows[1]?.actor_user_id === hostId),
    JSON.stringify(rows[1]),
  );
  check(
    "the TIN answer is a SYSTEM move with no actor",
    rows[2]?.from_status === "submitted" && rows[2]?.to_status === "tin_verified" && rows[2]?.trigger === "system" && rows[2]?.actor_user_id === null,
    JSON.stringify(rows[2]),
  );

  const queue = await call(admin, "GET", "/api/v1/admin/orgs/review-queue?pageSize=100");
  const item = (queue.json?.items ?? []).find((i) => i.orgId === orgId);
  check(
    "AC-R7 the review queue carries a time in stage, and the business is not stalled",
    item && typeof item.stageEnteredAt === "string" && item.stalled === false,
    `status ${queue.status} ${JSON.stringify(item)}`,
  );

  console.log("\n--- both gates, a rejection, a resubmit, and an approval ---");
  const fv1 = await call(verifier, "POST", `/api/v1/registrations/${orgId}/field-verify`, {});
  check("field verify", fv1.status === 200 || fv1.status === 201, `status ${fv1.status} ${fv1.text.slice(0, 160)}`);
  const rej = await call(approver, "POST", `/api/v1/registrations/${orgId}/reject`, { reasonCode: "documents_invalid" });
  check("the approver rejects", rej.status === 200 || rej.status === 201, `status ${rej.status} ${rej.text.slice(0, 160)}`);
  const resub = await call(host, "POST", `/api/v1/registrations/${orgId}/resubmit`);
  check("the registrant resubmits", resub.status === 200 || resub.status === 201, `status ${resub.status} ${resub.text.slice(0, 160)}`);
  const fv2 = await call(verifier, "POST", `/api/v1/registrations/${orgId}/field-verify`, {});
  check("field verify again", fv2.status === 200 || fv2.status === 201, `status ${fv2.status} ${fv2.text.slice(0, 160)}`);
  const appr = await call(approver, "POST", `/api/v1/registrations/${orgId}/approve`, {});
  check("approve", appr.status === 200 || appr.status === 201, `status ${appr.status} ${appr.text.slice(0, 160)}`);

  rows = await events(orgId);
  const shape = rows.map((r) => `${r.from_status ?? "∅"}>${r.to_status}:${r.trigger}`);
  const expected = [
    "∅>pending_payment:registrant",
    // A system move once money settled it (073-gtbank-payments AC-16).
    `pending_payment>submitted:${paidByMoney ? "system" : "registrant"}`,
    "submitted>tin_verified:system",
    "tin_verified>field_verified:officer",
    "field_verified>rejected:officer",
    "rejected>submitted:registrant",
    "submitted>tin_verified:system",
    "tin_verified>field_verified:officer",
    "field_verified>approved:officer",
    "approved>active:officer",
  ];
  check(
    "AC-R6 the whole walk is exactly one row per change, in order",
    JSON.stringify(shape) === JSON.stringify(expected),
    `\n        got      ${shape.join(" | ")}\n        expected ${expected.join(" | ")}`,
  );
  const officerRows = rows.filter((r) => r.trigger === "officer");
  check(
    "each officer row names the officer who acted",
    officerRows.every((r) => r.actor_user_id === verifierId || r.actor_user_id === approverId) &&
      rows[8]?.actor_user_id === approverId && rows[9]?.actor_user_id === approverId,
    JSON.stringify(officerRows.map((r) => r.actor_user_id)),
  );
  check(
    "AC-R6 the FIRST wait at submitted survives the resubmit",
    rows.filter((r) => r.to_status === "submitted").length === 2,
    shape.join(" | "),
  );
  const [org] = await q(`select registration_status from orgs where id = $1`, [orgId]);
  check(
    "the current status is the newest event's destination",
    org?.registration_status === rows.at(-1)?.to_status,
    `${org?.registration_status} vs ${rows.at(-1)?.to_status}`,
  );

  // -------------------------------------------------------------------------
  console.log("\n=== D. Suspend and reinstate write rows too (AC-R6) ===");
  const sus = await call(admin, "POST", `/api/v1/admin/orgs/${orgId}/suspend`, { reason: REASON });
  const rei = await call(admin, "POST", `/api/v1/admin/orgs/${orgId}/reinstate`, { reason: REASON });
  check("suspend and reinstate", [200, 201].includes(sus.status) && [200, 201].includes(rei.status), `${sus.status} / ${rei.status}`);
  rows = await events(orgId);
  const tail = rows.slice(-2).map((r) => `${r.from_status}>${r.to_status}:${r.trigger}:${r.actor_user_id === adminId}`);
  check(
    "both moves are staff rows naming the staffer",
    JSON.stringify(tail) === JSON.stringify(["active>suspended:staff:true", "suspended>active:staff:true"]),
    tail.join(" | "),
  );

  // -------------------------------------------------------------------------
  console.log("\n=== E. The membership status is an enum (AC-R10) ===");
  let refused = null;
  try {
    await q(`update org_memberships set status = 'suspended' where org_id = $1`, [orgId]);
  } catch (error) {
    refused = error;
  }
  check(
    "Postgres refuses a status outside the enum",
    refused && /invalid input value for enum org_membership_status/.test(refused.message),
    refused ? refused.message : "the update was accepted",
  );

  // -------------------------------------------------------------------------
  console.log("\n=== F. Stalled at the ceiling, and the sweep (AC-R5) ===");
  // A second, unpaid registration, moved by hand to where an RRA outage leaves a
  // business: at `submitted`, its newest check `pending`. The mock adapter always
  // verifies, so an outage has to be staged in the database to be observed.
  const second = await call(host, "POST", "/api/v1/registrations", registrationBody("Outage"));
  const outageId = second.json?.orgId;
  check("create a second registration to stage an outage on", Boolean(outageId), `status ${second.status}`);
  if (!outageId) return;
  const [{ tin }] = await q(`select tin from orgs where id = $1`, [outageId]);
  await q(`update orgs set registration_status = 'submitted' where id = $1`, [outageId]);
  await q(
    `insert into org_registration_events (org_id, from_status, to_status, trigger, actor_user_id, occurred_at)
     values ($1, 'pending_payment', 'submitted', 'registrant', $2, now() - interval '3 days')`,
    [outageId, hostId],
  );
  const stagePending = async (count, minutesAgo) => {
    await q(`delete from tin_verifications where org_id = $1`, [outageId]);
    for (let i = 0; i < count; i += 1) {
      await q(
        `insert into tin_verifications (org_id, tin, result, adapter_mode, checked_at)
         values ($1, $2, 'pending', 'live', now() - make_interval(mins => ($3::int + $4::int)))`,
        [outageId, tin, minutesAgo, count - i],
      );
    }
  };
  const stalledFlag = async () => {
    const res = await call(admin, "GET", "/api/v1/admin/orgs/review-queue?pageSize=100");
    return (res.json?.items ?? []).find((i) => i.orgId === outageId)?.stalled;
  };

  // Staged as RECENT, so neither case is due: a sweep tick landing mid test must
  // not be able to move the business before its stalled flag is read.
  await stagePending(5, 0);
  check("five unanswered attempts is NOT stalled", (await stalledFlag()) === false);
  await stagePending(6, 0);
  check("AC-R5 six unanswered attempts IS stalled, and it is still at submitted", (await stalledFlag()) === true);
  const [still] = await q(`select registration_status from orgs where id = $1`, [outageId]);
  check("a stalled business is never auto rejected", still.registration_status === "submitted", still.registration_status);

  // One attempt, ten minutes ago: past the five minute wait, so due now.
  await stagePending(1, 10);
  check("one attempt is not stalled", (await stalledFlag()) === false);
  console.log("  ...waiting up to 90s for a worker's sweep to re check it");
  let moved = false;
  for (let i = 0; i < 90 && !moved; i += 1) {
    await new Promise((r) => setTimeout(r, 1000));
    const [now] = await q(`select registration_status from orgs where id = $1`, [outageId]);
    moved = now.registration_status === "tin_verified";
  }
  if (!moved) {
    skip(
      "AC-R5 the sweep re checks a due business",
      "no worker moved it within 90s; start one with INJISHI_PROCESS=worker node dist/main",
    );
  } else {
    const after = await events(outageId);
    const last = after.at(-1);
    check(
      "AC-R5 the sweep re checked it and moved it on as a SYSTEM move",
      last?.from_status === "submitted" && last?.to_status === "tin_verified" && last?.trigger === "system" && last?.actor_user_id === null,
      JSON.stringify(last),
    );
    const [{ n }] = await q(`select count(*)::int as n from tin_verifications where org_id = $1`, [outageId]);
    check("and the retry is a NEW tin_verifications row, not an update", n === 2, `rows ${n}`);
  }
};

main()
  .then(async () => {
    await db.end();
    console.log(`\n==================== ${pass} passed, ${fail} failed, ${skipped} skipped ====================`);
    if (failures.length) console.log("Failed:\n - " + failures.join("\n - "));
    process.exit(fail === 0 ? 0 : 1);
  })
  .catch(async (error) => {
    await db.end().catch(() => {});
    console.error("\nHARNESS ERROR:", error.message);
    process.exit(2);
  });
