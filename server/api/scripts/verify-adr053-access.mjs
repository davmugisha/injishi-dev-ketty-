// Verify ADR-053 slice 4 over HTTP: one authorization model.
//
// WHAT IT PROVES, in order:
//   A. Each staff role reads exactly the admin areas the five new view
//      permissions give it, and is refused the rest; `/me/staff` carries the
//      decided membership; a read permission never authorises a write (AC-A6).
//   B. The host's booking decision routes run behind `WorkspaceGuard` and
//      `reservation.approve`: a receptionist decides through BOTH doors, a
//      housekeeper through neither, a booking in another workspace is a 404
//      never a 403, and a suspended business is refused through both doors with
//      the refusal worded from the registration stage (AC-A5).
//
// The operator nav (AC-A1, AC-A2) had its own script, removed with the old
// operator app it read; the admin sidebar
// and the typed URL refusal (AC-A3, AC-A4) are a browser check; the staff matrix
// itself is `packages/contracts/tests/staff-authz.test.mjs` (AC-A7).
//
// WHAT IT LEAVES BEHIND: two throwaway staff accounts, `adr053-compliance@` and
// `adr053-finance@injishi.com`, holding one staff role each; and three CLONES of
// the seeded request `BK-DEMO-001` (references `BK-A049-…`), decided during the
// run. The seeded requests themselves are never touched. Amahoro Hospitality
// Group is suspended and reinstated; the finally block reinstates it if a step
// fails in between.
//
// Needs the API on 8000 against a sample marked database.
// Run it:  node scripts/verify-adr053-access.mjs

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { apiEnvFile } from "./env-file.mjs";

const BASE = process.env.API_BASE || "http://127.0.0.1:8000";
const WEB_ORIGIN = "http://localhost:3000";
const REASON = "ADR-053 slice 4 verification";

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
  const line = readFileSync(apiEnvFile() ?? new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL is not set and not in server/api/.env.test (or the APP_ENV file)");
  return line.slice("DATABASE_URL=".length).trim();
}
const db = new pg.Pool({ connectionString: databaseUrl() });
const q = async (text, params = []) => (await db.query(text, params)).rows;

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

/** Make a throwaway account hold exactly one staff role. */
async function makeStaff(email, role) {
  await signIn(email);
  const id = await userId(email);
  await q(
    `insert into admin_users (user_id, staff_roles) values ($1, $2::staff_role[])
     on conflict (user_id) do update set staff_roles = excluded.staff_roles, revoked_at = null`,
    [id, `{${role}}`],
  );
  return signIn(email);
}

/** A fresh copy of the seeded request, so the seeded one is never decided. */
async function clonePendingRequest() {
  const [src] = await q(`select * from bookings where reference = 'BK-DEMO-001'`);
  const [escrow] = await q(`select * from escrows where booking_id = $1`, [src.id]);
  const id = randomUUID();
  const reference = `BK-A049-${id.slice(0, 4).toUpperCase()}`;
  await q(
    `insert into bookings (id, reference, room_type_id, guest_user_id, workspace_id, check_in, check_out,
       guest_count, status, booking_mode, locked_nightly_rate_rwf, locked_cancellation_tier, nonrefundable,
       gross_rwf, currency, payment_status, approval_expires_at, rate_plan_id)
     select $1, $2, room_type_id, guest_user_id, workspace_id, check_in + 90, check_out + 90,
       guest_count, 'pending_approval', booking_mode, locked_nightly_rate_rwf, locked_cancellation_tier, nonrefundable,
       gross_rwf, currency, payment_status, now() + interval '1 day', rate_plan_id
       from bookings where id = $3`,
    [id, reference, src.id],
  );
  await q(
    `insert into escrows (id, workspace_id, source, booking_id, amount_rwf, currency, status, adapter_ref, adapter_mode, idempotency_key)
     values ($1, $2, $3, $4, $5, $6, 'held', $7, $8, $9)`,
    // A clone keeps the seeded escrow's mock capture reference. Seeds from
    // before ADR-053 J27 left it null (a decline answered 503), so a null still
    // gets one here and the decline path can run on an unrepaired database.
    [randomUUID(), escrow.workspace_id, escrow.source, id, escrow.amount_rwf, escrow.currency, escrow.adapter_ref ?? `mock_escrow_capture_adr053_${id}`, escrow.adapter_mode, `${escrow.workspace_id}:adr053-verify:${id}`],
  );
  return { id, reference, workspaceId: src.workspace_id };
}

let suspendedOrgId = null;
let admin = null;

const main = async () => {
  admin = await signIn("admin@injishi.com");

  // -------------------------------------------------------------------------
  console.log("\n=== A. Five read permissions (AC-A6) ===");
  const ops = await signIn("ops@demo.injishi.com");
  const compliance = await makeStaff("adr053-compliance@injishi.com", "compliance");
  const finance = await makeStaff("adr053-finance@injishi.com", "finance");

  const READS = {
    configuration: "/api/v1/admin/configuration",
    fees: "/api/v1/admin/configuration/fees",
    moderation: "/api/v1/admin/moderation",
    announcements: "/api/v1/admin/announcements",
    environments: "/api/v1/admin/environments",
    localization: "/api/v1/admin/localization",
  };
  const EXPECT = {
    ops: { session: ops, count: 18, reads: ["configuration", "fees", "moderation", "announcements", "environments", "localization"] },
    compliance: { session: compliance, count: 10, reads: ["configuration", "fees", "moderation", "localization"] },
    finance: { session: finance, count: 7, reads: ["configuration", "fees"] },
  };

  for (const [role, want] of Object.entries(EXPECT)) {
    const me = await call(want.session, "GET", "/api/v1/me/staff");
    check(
      `${role}: /me/staff carries ${want.count} permissions, admin.config.view among them`,
      me.status === 200 && me.json?.permissions?.length === want.count && me.json.permissions.includes("admin.config.view"),
      `status ${me.status} ${me.json?.permissions?.length}`,
    );
    const got = {};
    for (const [area, path] of Object.entries(READS)) got[area] = (await call(want.session, "GET", path)).status;
    const reads = Object.keys(READS).filter((a) => got[a] === 200).sort();
    const refused = Object.keys(READS).filter((a) => got[a] === 403).sort();
    check(
      `${role}: reads exactly ${want.reads.join(", ")}`,
      JSON.stringify(reads) === JSON.stringify([...want.reads].sort()),
      JSON.stringify(got),
    );
    check(
      `${role}: and is refused with 403 everywhere else`,
      JSON.stringify(refused) === JSON.stringify(Object.keys(READS).filter((a) => !want.reads.includes(a)).sort()),
      JSON.stringify(got),
    );
  }

  // A read never authorises a write. A past date is refused 422 AFTER the guard
  // lets a staffer through, so it proves authorisation without writing a row.
  const pastFee = { businessType: "hospitality", amountRwf: 7000, effectiveFrom: "2020-01-01T00:00:00Z", reason: REASON };
  const opsAppend = await call(ops, "POST", "/api/v1/admin/configuration/fees", pastFee);
  check("ops reads the fee catalog and is refused the append (403)", opsAppend.status === 403, `status ${opsAppend.status}`);
  const complianceAppend = await call(compliance, "POST", "/api/v1/admin/configuration/fees", pastFee);
  check("compliance is refused the append (403)", complianceAppend.status === 403, `status ${complianceAppend.status}`);
  const financeAppend = await call(finance, "POST", "/api/v1/admin/configuration/fees", pastFee);
  check("finance passes the guard to the append (422 on the past date, not 403)", financeAppend.status === 422, `status ${financeAppend.status}`);

  // -------------------------------------------------------------------------
  console.log("\n=== B. The host booking doors join the model (AC-A5) ===");
  const denise = await signIn("denise@demo.injishi.com");
  const beatha = await signIn("beatha@demo.injishi.com");
  const host = await signIn("host@injishi.com");
  const [first, second, third, fourth] = [
    await clonePendingRequest(),
    await clonePendingRequest(),
    await clonePendingRequest(),
    await clonePendingRequest(),
  ];
  const H = { "x-workspace-id": first.workspaceId };

  const hk = await call(beatha, "POST", `/api/v1/bookings/${first.id}/approve`, undefined, H);
  check("a housekeeper is refused the host door (403)", hk.status === 403, `status ${hk.status} ${hk.text.slice(0, 160)}`);
  const hkOps = await call(beatha, "POST", `/api/v1/ops/reservations/${first.id}/approve`, undefined, H);
  check("and the ops door (403)", hkOps.status === 403, `status ${hkOps.status}`);

  const viaHost = await call(denise, "POST", `/api/v1/bookings/${first.id}/approve`, undefined, H);
  check(
    "a receptionist approves through the host door",
    [200, 201].includes(viaHost.status) && viaHost.json?.status === "confirmed",
    `status ${viaHost.status} ${viaHost.text.slice(0, 200)}`,
  );
  const viaOps = await call(denise, "POST", `/api/v1/ops/reservations/${second.id}/approve`, undefined, H);
  check("and through the ops door", [200, 201].includes(viaOps.status), `status ${viaOps.status} ${viaOps.text.slice(0, 200)}`);
  const declined = await call(denise, "POST", `/api/v1/bookings/${third.id}/decline`, undefined, H);
  check(
    "a receptionist declines through the host door, refunded",
    [200, 201].includes(declined.status) && declined.json?.status === "declined",
    `status ${declined.status} ${declined.text.slice(0, 200)}`,
  );

  const hostWs = (await call(host, "GET", "/api/v1/me/workspaces")).json?.workspaces?.find((w) => w.kind === "business" && w.permissions?.includes("reservation.approve"));
  const elsewhere = await call(host, "POST", `/api/v1/bookings/${fourth.id}/approve`, undefined, { "x-workspace-id": hostWs?.workspaceId });
  check("a booking outside the named workspace is 404, never 403", elsewhere.status === 404, `status ${elsewhere.status}`);
  const noWs = await call(denise, "POST", `/api/v1/bookings/${fourth.id}/approve`);
  check("naming no workspace at all is refused", [400, 403].includes(noWs.status), `status ${noWs.status}`);

  console.log("\n--- suspend the business: both doors close ---");
  const [{ org_id: orgId }] = await q(`select org_id from workspaces where id = $1`, [first.workspaceId]);
  const sus = await call(admin, "POST", `/api/v1/admin/orgs/${orgId}/suspend`, { reason: REASON });
  suspendedOrgId = [200, 201].includes(sus.status) ? orgId : null;
  check("suspend Amahoro Hospitality Group", [200, 201].includes(sus.status), `status ${sus.status}`);
  const susHost = await call(denise, "POST", `/api/v1/bookings/${fourth.id}/approve`, undefined, H);
  const susOps = await call(denise, "POST", `/api/v1/ops/reservations/${fourth.id}/approve`, undefined, H);
  check("a suspended business is refused through the host door", susHost.status === 403, `status ${susHost.status}`);
  check("and through the ops door", susOps.status === 403, `status ${susOps.status}`);
  check(
    "the refusal is worded from the registration stage, not a missing power",
    /suspend/i.test(String(susHost.json?.message)),
    String(susHost.json?.message),
  );
  const [{ status: stillPending }] = await q(`select status from bookings where id = $1`, [fourth.id]);
  check("and the request is still pending", stillPending === "pending_approval", stillPending);
  const rei = await call(admin, "POST", `/api/v1/admin/orgs/${orgId}/reinstate`, { reason: REASON });
  if ([200, 201].includes(rei.status)) suspendedOrgId = null;
  check("reinstate", [200, 201].includes(rei.status), `status ${rei.status}`);
  const afterRei = await call(denise, "POST", `/api/v1/bookings/${fourth.id}/decline`, undefined, H);
  check("reinstated, the receptionist decides again", [200, 201].includes(afterRei.status), `status ${afterRei.status}`);
};

main()
  .catch((error) => {
    console.error("\nHARNESS ERROR:", error.message);
    fail += 1;
  })
  .finally(async () => {
    if (suspendedOrgId && admin) {
      await call(admin, "POST", `/api/v1/admin/orgs/${suspendedOrgId}/reinstate`, { reason: REASON }).catch(() => {});
      console.log("  (reinstated the business the run left suspended)");
    }
    await db.end().catch(() => {});
    console.log(`\n==================== ${pass} passed, ${fail} failed ====================`);
    if (failures.length) console.log("Failed:\n - " + failures.join("\n - "));
    process.exit(fail === 0 ? 0 : 1);
  });
