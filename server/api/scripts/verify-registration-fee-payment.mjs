#!/usr/bin/env node
/**
 * The registration fee, paid by mobile money, end to end against a running API
 * and its database (073-gtbank-payments AC-2, AC-6, AC-6a, AC-9, AC-10, AC-16,
 * AC-17, AC-24).
 *
 * Needs an API on a SAMPLE database with the payments seam on `mock` (every
 * local, staging and demo stack): the fixed sign in code, and a mock prompt that
 * settles after MOCK_MOMO_APPROVAL_MS (a few seconds). It WRITES: each run
 * creates fresh registrants and registrations, so it never collides with the
 * last run, and it never touches an existing account.
 *
 *   API_BASE=http://127.0.0.1:8000 DATABASE_URL=... node scripts/verify-registration-fee-payment.mjs
 *
 * DATABASE_URL defaults to the one in ../.env. Exits 1 on any failed check and
 * prints `registration fee verification passed` only when every check holds.
 */
import { randomInt, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";

const BASE = process.env.API_BASE || "http://127.0.0.1:8000";
const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://localhost:3000";
const GASABO = { country: "RW", provinceId: 1, districtId: 102, sectorId: 10201 };
const CONTRACT = "2026-09-12";
const GOOD_NUMBER = "788123456";
const DECLINED_NUMBER = "788120000";

let pass = 0;
let fail = 0;
function check(label, ok, detail) {
  if (ok) {
    pass += 1;
    console.log(`  PASS  ${label}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const line = readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL is not set and ../.env has none");
  return line.slice("DATABASE_URL=".length).trim();
}
const pool = new pg.Pool({ connectionString: databaseUrl(), max: 2 });
const q = async (text, params = []) => (await pool.query(text, params)).rows;

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

/** A brand new registrant, signed in with the sample stack's fixed code and verified. */
async function newRegistrant(label) {
  const stamp = `${Date.now()}${randomInt(1000, 9999)}`;
  const email = `gtbank-fee-${label}-${stamp}@verify.injishi.test`;
  const session = makeSession();
  const origin = { origin: WEB_ORIGIN };
  await call(session, "POST", "/api/auth/email-otp/send-verification-otp", { email, type: "sign-in" }, origin);
  const res = await call(session, "POST", "/api/auth/sign-in/email-otp", { email, otp: "123456" }, origin);
  if (res.status !== 200) throw new Error(`sign in failed for ${email}: ${res.status} ${res.text.slice(0, 160)}`);
  const [user] = await q(`select id from users where lower(email) = lower($1)`, [email]);
  // A synthetic `999` stem national id, fresh per run: one human, one account.
  const nationalId = `11999${String(randomInt(0, 99_999_999_999)).padStart(11, "0")}`;
  await q(
    `insert into verified_identities (user_id, kyc_status, legal_full_name, dob, verified_method, verified_at)
     values ($1, 'verified', $2, '1990-01-01', 'manual', now())
     on conflict (user_id) do update set kyc_status = 'verified'`,
    [user.id, `GTBank Fee ${label}`],
  );
  return { session, email, userId: user.id, nationalId };
}

async function newRegistration(registrant, label) {
  const created = await call(registrant.session, "POST", "/api/v1/registrations", {
    role: "host",
    capacity: "owner",
    personal: {
      fullName: `GTBank Fee ${label}`,
      document: { documentType: "national_id", documentNumber: registrant.nationalId, issuingCountry: "RW" },
      dateOfBirth: "1990-01-01",
      phoneE164: `+25078${String(randomInt(1_000_000, 9_999_999))}`,
      address: GASABO,
    },
    business: {
      domain: "hospitality",
      legalName: `GTBank Fee Verify ${label} ${Date.now()}`,
      address: GASABO,
      accommodationClass: "guest_house",
      tin: String(100_000_000 + randomInt(0, 899_999_999)),
      certificates: [],
    },
  });
  if (!created.json?.orgId) throw new Error(`could not create a registration: ${created.status} ${created.text.slice(0, 200)}`);
  return created.json;
}

const mm = (msisdn) => ({ kind: "mobile_money", network: "mtn_momo", msisdn });

async function pollUntilFinal(session, orgId, token) {
  for (let i = 0; i < 60; i += 1) {
    await new Promise((r) => setTimeout(r, 1_000));
    const polled = await call(session, "GET", `/api/v1/registrations/${orgId}/pay/attempts/${token}`);
    if (polled.status !== 200) return polled;
    if (polled.json?.state !== "prompting") return polled;
  }
  return { status: 504, json: null, text: "never settled" };
}

const transactionsFor = (key) =>
  q(
    `select id, status, reference, provider_reference, payer_msisdn, payer_network, payment_attempt_id,
            operation, direction, provider, adapter_mode, amount_rwf
       from payment_transactions where idempotency_key = $1`,
    [key],
  );

const main = async () => {
  console.log(`API ${BASE}`);

  // ---------------------------------------------------------------------------
  console.log("\n=== /platform tells a payment screen the truth (AC-17, AC-24) ===");
  const platform = await call(null, "GET", "/api/v1/platform");
  check(
    "the payments seam is published as mock and card as off",
    platform.json?.integrations?.payments === "mock" && platform.json?.integrations?.card_payments === "off",
    platform.text.slice(0, 200),
  );
  check(
    "payment rules name the networks and every purpose (mock)",
    Array.isArray(platform.json?.paymentRules?.networks) &&
      platform.json.paymentRules.livePurposes.includes("registration_fee"),
    JSON.stringify(platform.json?.paymentRules),
  );

  // ---------------------------------------------------------------------------
  console.log("\n=== Refusals come before any prompt (AC-16) ===");
  const a = await newRegistrant("a");
  const regA = await newRegistration(a, "A");
  const orgA = regA.orgId;
  const wsA = regA.workspaceId;

  const early = await call(a.session, "POST", `/api/v1/registrations/${orgA}/pay`, {
    attemptToken: randomUUID(),
    instrument: mm(GOOD_NUMBER),
  });
  check(
    "paying before the contract is accepted is 409 contract_not_accepted",
    early.status === 409 && early.json?.code === "contract_not_accepted",
    `${early.status} ${early.text.slice(0, 160)}`,
  );
  const accepted = await call(a.session, "POST", `/api/v1/registrations/${orgA}/contract`, { contractVersion: CONTRACT });
  check("accept the operator contract", accepted.status === 200 || accepted.status === 201, `${accepted.status}`);

  const noNumber = await call(a.session, "POST", `/api/v1/registrations/${orgA}/pay`, {});
  check("paying with no number is 422", noNumber.status === 422, `${noNumber.status} ${noNumber.text.slice(0, 160)}`);
  const card = await call(a.session, "POST", `/api/v1/registrations/${orgA}/pay`, {
    attemptToken: randomUUID(),
    instrument: { kind: "card", token: "tok_test" },
  });
  check("paying by card is 422", card.status === 422, `${card.status} ${card.text.slice(0, 160)}`);
  const wrongNetwork = await call(a.session, "POST", `/api/v1/registrations/${orgA}/pay`, {
    attemptToken: randomUUID(),
    instrument: { kind: "mobile_money", network: "airtel_money", msisdn: GOOD_NUMBER },
  });
  check("a number filed under the wrong network is 422", wrongNetwork.status === 422, `${wrongNetwork.status}`);
  const [{ n: refusedRows }] = await q(
    `select count(*)::int as n from payment_transactions where workspace_id = $1`,
    [wsA],
  );
  check("no refusal wrote a bank row", refusedRows === 0, `${refusedRows} row(s)`);

  // ---------------------------------------------------------------------------
  console.log("\n=== A declined prompt changes nothing but its own row ===");
  const declinedToken = randomUUID();
  const declined = await call(a.session, "POST", `/api/v1/registrations/${orgA}/pay`, {
    attemptToken: declinedToken,
    instrument: mm(DECLINED_NUMBER),
  });
  check(
    "a declined prompt answers the attempt as refused, with the sentence to show",
    declined.json?.kind === "attempt" && declined.json.attempt.state === "refused" && /declined/i.test(declined.json.attempt.failureReason ?? ""),
    declined.text.slice(0, 200),
  );
  const [declinedRow] = await transactionsFor(`${wsA}:registration-fee:${declinedToken}`);
  check("its bank row is failed", declinedRow?.status === "failed", JSON.stringify(declinedRow));
  const [stillOwed] = await q(
    `select o.registration_status, i.status from orgs o
       join subscription_invoices i on i.org_id = o.id and i.invoice_kind = 'registration_fee'
      where o.id = $1`,
    [orgA],
  );
  check(
    "the registration still awaits its fee, and the invoice is still payable",
    stillOwed?.registration_status === "pending_payment" && stillOwed?.status === "pending",
    JSON.stringify(stillOwed),
  );

  // ---------------------------------------------------------------------------
  console.log("\n=== A good prompt waits, settles, and settles the registration (AC-9, AC-16) ===");
  const token = randomUUID();
  const key = `${wsA}:registration-fee:${token}`;
  const pressed = await call(a.session, "POST", `/api/v1/registrations/${orgA}/pay`, {
    attemptToken: token,
    instrument: mm(GOOD_NUMBER),
  });
  check(
    "the press answers an attempt waiting on the phone",
    pressed.json?.kind === "attempt" && pressed.json.attempt.state === "prompting",
    pressed.text.slice(0, 200),
  );
  check(
    "the response masks the payer number and never carries it whole (AC-10)",
    !pressed.text.includes(GOOD_NUMBER) && /•/.test(pressed.json?.attempt?.payerMasked ?? ""),
    pressed.json?.attempt?.payerMasked,
  );
  const [waitingRow] = await transactionsFor(key);
  check(
    "a bank row was written: a pending collection, one fee, the derived reference, the whole number",
    waitingRow?.status === "pending" &&
      waitingRow.direction === "collection" &&
      waitingRow.operation === "one_time_fee" &&
      /^INJ[A-Z2-7]{20}$/.test(waitingRow.reference) &&
      waitingRow.payer_msisdn === GOOD_NUMBER &&
      waitingRow.provider === "mock" &&
      waitingRow.adapter_mode === "mock",
    JSON.stringify(waitingRow),
  );
  const [attemptRow] = await q(`select id, purpose, subscription_invoice_id from payment_attempts where idempotency_key = $1`, [key]);
  check(
    "the attempt is a registration fee naming the invoice, and the bank row points at it",
    attemptRow?.purpose === "registration_fee" && attemptRow.subscription_invoice_id && waitingRow?.payment_attempt_id === attemptRow.id,
    JSON.stringify({ attemptRow, linked: waitingRow?.payment_attempt_id }),
  );

  const stranger = await newRegistrant("stranger");
  const probe = await call(stranger.session, "GET", `/api/v1/registrations/${orgA}/pay/attempts/${token}`);
  check("a stranger polling the attempt gets 404", probe.status === 404, `${probe.status}`);

  const final = await pollUntilFinal(a.session, orgA, token);
  check(
    "the poll ends confirmed, carrying a registration that left pending_payment",
    final.json?.state === "confirmed" && final.json?.registration?.status !== "pending_payment",
    final.text.slice(0, 200),
  );
  const [settledRow] = await transactionsFor(key);
  check("the bank row is successful", settledRow?.status === "successful", JSON.stringify(settledRow));
  const [{ status: invoiceStatus }] = await q(
    `select status from subscription_invoices where org_id = $1 and invoice_kind = 'registration_fee'`,
    [orgA],
  );
  check("the invoice is paid", invoiceStatus === "paid", invoiceStatus);
  const moves = await q(
    `select from_status, to_status, trigger, actor_user_id from org_registration_events
      where org_id = $1 and from_status = 'pending_payment' and to_status = 'submitted'`,
    [orgA],
  );
  check(
    "the move to submitted is a SYSTEM move with no actor: the money moved it",
    moves.length === 1 && moves[0].trigger === "system" && moves[0].actor_user_id === null,
    JSON.stringify(moves),
  );

  const again = await call(a.session, "POST", `/api/v1/registrations/${orgA}/pay`, {
    attemptToken: token,
    instrument: mm(GOOD_NUMBER),
  });
  const [{ n: rowsAfter }] = await q(
    `select count(*)::int as n from payment_transactions where workspace_id = $1 and status = 'successful'`,
    [wsA],
  );
  check(
    "pressing pay again after it settled charges nothing more",
    again.json?.kind === "settled" && rowsAfter === 1,
    `${again.text.slice(0, 120)} / ${rowsAfter} successful row(s)`,
  );

  // ---------------------------------------------------------------------------
  console.log("\n=== Two presses that both settle: the second is refunded (AC-6a, AC-16) ===");
  const b = await newRegistrant("b");
  const regB = await newRegistration(b, "B");
  await call(b.session, "POST", `/api/v1/registrations/${regB.orgId}/contract`, { contractVersion: CONTRACT });
  const first = randomUUID();
  const second = randomUUID();
  const p1 = await call(b.session, "POST", `/api/v1/registrations/${regB.orgId}/pay`, { attemptToken: first, instrument: mm(GOOD_NUMBER) });
  const p2 = await call(b.session, "POST", `/api/v1/registrations/${regB.orgId}/pay`, { attemptToken: second, instrument: mm("788654321") });
  check(
    "both presses are out on a phone at once",
    p1.json?.attempt?.state === "prompting" && p2.json?.attempt?.state === "prompting",
    `${p1.text.slice(0, 80)} / ${p2.text.slice(0, 80)}`,
  );
  const f1 = await pollUntilFinal(b.session, regB.orgId, first);
  const f2 = await pollUntilFinal(b.session, regB.orgId, second);
  const states = [f1.json?.state, f2.json?.state].sort();
  check(
    "exactly one settles the registration and the other is refused as already paid",
    states[0] === "confirmed" && states[1] === "refused" &&
      [f1, f2].some((f) => f.json?.state === "refused" && /already paid/.test(f.json?.failureReason ?? "")),
    `${f1.text.slice(0, 120)} / ${f2.text.slice(0, 120)}`,
  );
  const loser = f1.json?.state === "refused" ? first : second;
  const loserKey = `${regB.workspaceId}:registration-fee:${loser}`;
  const refunds = await q(
    `select kind, idempotency_key, amount_rwf from payment_compensations where idempotency_key = $1`,
    [`fee-duplicate:${loserKey}`],
  );
  check(
    "the refund is queued on the fee's own derived key, for the full amount",
    refunds.length === 1 && refunds[0].kind === "refund" && Number(refunds[0].amount_rwf) > 0,
    JSON.stringify(refunds),
  );
  const [{ n: bMoves }] = await q(
    `select count(*)::int as n from org_registration_events
      where org_id = $1 and from_status = 'pending_payment' and to_status = 'submitted'`,
    [regB.orgId],
  );
  check("the registration moved to submitted once", bMoves === 1, `${bMoves} move(s)`);

  console.log(`\n${pass} passed, ${fail} failed`);
  await pool.end();
  if (fail > 0) process.exit(1);
  console.log("registration fee verification passed");
};

main().catch(async (error) => {
  console.error(error);
  await pool.end().catch(() => {});
  process.exit(1);
});
