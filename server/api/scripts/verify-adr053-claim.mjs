// Verify the ADR-053 registration ends that slice 2 left: the owner claim
// (task 14), and, since ADR-075, that paying needs no contract (task 11 undone).
//
// The twelfth verify script, and it WRITES. It drives registrations over HTTP,
// reads the claim invitation out of Mailpit the way an owner would, and reads the
// database after every act, because "in one transaction" and "unchanged" are
// claims about rows.
//
// WHAT IT PROVES, in order:
//   A. ADR-075 moved the agreement to after approval (AC-12, superseding AC-R8
//      and AC-R13): the contract route is gone, paying needs no acceptance and
//      records none, and paying never makes a business `active`; only signing
//      the agreement will (A3).
//   B. An OBO registration writes a claim invitation in its create transaction,
//      7 days, addressed to the owner, and mails a link on WEB_URL's origin
//      (AC-R12, AC-R14).
//   C. The preview shows the real business, district, stage and registrant, and
//      no national id, email or TIN. A made up token and a real token under the
//      wrong org are the same 404 (AC-R2, AC-R3).
//   D. A second account holding a valid but different national id previews the
//      claim and is refused the claim with that same 404, and nothing moves
//      (AC-R11).
//   E. The owner claims: active, owner, `owner_claimed`, payouts STILL locked for
//      an unverified claimant, the invitation spent, one `approved > active`
//      event and one audit row saying why. The spent token is refused (AC-R1,
//      AC-R2).
//   F. A KYC verified owner claims, two presses at once: one claim, one refusal,
//      and payouts unlock (AC-R1).
//   G. An expired invitation is the same 404 as one that never existed (AC-R12).
//   H. Hammering the preview from one account answers 429.
//
// WHAT IT LEAVES BEHIND: throwaway accounts `adr053-registrant@`,
// `adr053-owner@`, `adr053-owner2@` and `adr053-other@injishi.com`, their
// profiles, and a handful of "ADR-053 Verify …" registrations. `adr053-owner2@`
// is marked KYC verified by this script, on purpose and only on that account.
//
// Needs the API on 8000 against a sample marked database, and Mailpit on 8025.
// The preview and the claim are throttled to five a minute per person, so leave
// a minute between runs.
//
// Run it:  node scripts/verify-adr053-claim.mjs

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";

const BASE = process.env.API_BASE || "http://127.0.0.1:8000";
const MAILPIT = process.env.MAILPIT_URL || "http://127.0.0.1:8025";
const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://localhost:3000";
const EXPECTED_WEB_URL = process.env.WEB_URL || "http://localhost:3000";
const OPERATOR_CONTRACT_VERSION = "2026-09-12";
const GASABO = { country: "RW", provinceId: 1, districtId: 102, sectorId: 10201 };

const REGISTRANT = "adr053-registrant@injishi.com";
const OWNER = "adr053-owner@injishi.com";
const OWNER2 = "adr053-owner2@injishi.com";
const OTHER = "adr053-other@injishi.com";
const NID = {
  [REGISTRANT]: "1199900000049049",
  [OWNER]: "1199900000049050",
  [OWNER2]: "1199900000049052",
  [OTHER]: "1199900000049051",
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

// Sessions cached in the OS temp directory, never beside the script: they are
// live cookies, and the OTP cap is five codes per address per hour.
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

/** Give an account a complete profile holding a fixed national id. */
async function ensureProfile(session, email, fullName) {
  const res = await call(session, "PUT", "/api/v1/me/profile", {
    fullName,
    document: { documentType: "national_id", documentNumber: NID[email], issuingCountry: "RW" },
    dateOfBirth: "1990-01-01",
    phoneE164: `+25078${NID[email].slice(-7)}`,
    address: GASABO,
  });
  if (res.status !== 200) throw new Error(`profile for ${email}: ${res.status} ${res.text.slice(0, 200)}`);
}

const randomTin = () => String(100000000 + Math.floor(Math.random() * 899999999));
const userId = async (email) =>
  (await q(`select id from users where lower(email) = lower($1)`, [email]))[0]?.id;

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

async function registrationBody(session, name, intendedOwner) {
  return {
    role: "host",
    ...(intendedOwner ? { capacity: "on_behalf_of", intendedOwner } : { capacity: "owner" }),
    business: {
      domain: "hospitality",
      legalName: `ADR-053 Verify ${name} ${Date.now()}`,
      address: GASABO,
      accommodationClass: "guest_house",
      tin: randomTin(),
      certificates: await rdbCertificate(session),
    },
  };
}

/** The newest claim mail to an address, after a moment, as the owner would read it. */
async function claimMailTo(address, orgId) {
  for (let i = 0; i < 20; i += 1) {
    const search = await fetch(
      `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${address}" subject:"Claim"`)}&limit=20`,
    ).then((r) => r.json());
    for (const m of search.messages ?? []) {
      const full = await fetch(`${MAILPIT}/api/v1/message/${m.ID}`).then((r) => r.json());
      const text = full.Text ?? "";
      const match = text.match(/(https?:\/\/[^\s]+\/claim-org\?[^\s]+)/);
      if (match && match[1].includes(orgId)) return { subject: full.Subject, text, link: match[1] };
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

const DIGITS_ONLY = (s) => s.replace(/\s+/g, "");

async function throughBothGates(sessions, orgId) {
  const { host, verifier, approver } = sessions;
  const paid = await call(host, "POST", `/api/v1/registrations/${orgId}/pay`);
  await checkEveryDocument(verifier, orgId);
  const fv = await call(verifier, "POST", `/api/v1/registrations/${orgId}/field-verify`, {});
  const ap = await call(approver, "POST", `/api/v1/registrations/${orgId}/approve`, {});
  return [paid.status, fv.status, ap.status];
}

const main = async () => {
  const host = await signIn(REGISTRANT);
  const owner = await signIn(OWNER);
  const owner2 = await signIn(OWNER2);
  const other = await signIn(OTHER);
  const verifier = await signIn("jeanbosco@demo.injishi.com");
  const approver = await signIn("claudine@demo.injishi.com");
  await markVerified(REGISTRANT, "ADR-053 Verify Registrant", "1990-01-01");
  await ensureProfile(host, REGISTRANT, "ADR-053 Verify Registrant");
  await ensureProfile(owner, OWNER, "ADR-053 Verify Owner");
  await ensureProfile(owner2, OWNER2, "ADR-053 Verify Verified Owner");
  await ensureProfile(other, OTHER, "ADR-053 Verify Other");
  const ownerId = await userId(OWNER);
  const owner2Id = await userId(OWNER2);

  // Reruns start from the shape the test needs: the first owner NOT verified,
  // the second verified. Only these throwaway accounts are touched.
  await q(`update verified_identities set kyc_status = 'unverified', verified_at = null, verified_method = null where user_id = $1`, [ownerId]);
  await q(
    `update verified_identities set kyc_status = 'verified', verified_at = now(), verified_method = 'manual' where user_id = $1`,
    [owner2Id],
  );

  // -------------------------------------------------------------------------
  console.log("\n=== A. Paying needs no contract (ADR-075 AC-12) ===");
  const created = await call(host, "POST", "/api/v1/registrations", await registrationBody(host, "Contract"));
  const orgId = created.json?.orgId;
  check(
    "create answers a summary with no contract on it",
    created.status === 201 && orgId && created.json.contractAcceptedAt === null && created.json.contractVersion === null && created.json.payoutLocked === null,
    `status ${created.status} ${created.text.slice(0, 200)}`,
  );
  if (!orgId) return;

  const gone = await call(host, "POST", `/api/v1/registrations/${orgId}/contract`, { contractVersion: OPERATOR_CONTRACT_VERSION });
  check("the contract route is gone", gone.status === 404, `status ${gone.status}`);

  const paid = await call(host, "POST", `/api/v1/registrations/${orgId}/pay`);
  check(
    "pay settles with no acceptance and the business leaves pending_payment",
    // `/pay` has always answered 201, being a POST with no `@HttpCode`.
    (paid.status === 200 || paid.status === 201) && paid.json?.status !== "pending_payment",
    `status ${paid.status} ${paid.text.slice(0, 160)}`,
  );
  const [row] = await q(
    `select registration_status, contract_version, contract_accepted_at from orgs where id = $1`,
    [orgId],
  );
  check(
    "no acceptance was recorded, and paying did not make it active",
    row?.contract_version === null && row?.contract_accepted_at === null && row?.registration_status !== "active",
    JSON.stringify(row),
  );

  // -------------------------------------------------------------------------
  console.log("\n=== B. The invitation, written at create and mailed (AC-R12, AC-R14) ===");
  const oboCreated = await call(
    host,
    "POST",
    "/api/v1/registrations",
    await registrationBody(host, "Claim", { name: "ADR-053 Verify Owner", nationalId: NID[OWNER], email: OWNER }),
  );
  const oboId = oboCreated.json?.orgId;
  check(
    "an OBO registration is created, payout locked",
    oboCreated.status === 201 && oboId && oboCreated.json.payoutLocked === true,
    `status ${oboCreated.status} ${oboCreated.text.slice(0, 200)}`,
  );
  if (!oboId) return;

  const [invitation] = await q(
    `select i.id, i.email, i.purpose, i.status, i.org_role, i.token,
            extract(epoch from (i.expires_at - i.created_at))::int as ttl_seconds,
            o.claim_invitation_id
       from obo_registrations o join org_invitations i on i.id = o.claim_invitation_id
      where o.org_id = $1`,
    [oboId],
  );
  check(
    "one obo_claim invitation, sent, owner role, addressed to the intended owner, linked on the OBO row",
    invitation && invitation.purpose === "obo_claim" && invitation.status === "sent" && invitation.org_role === "owner" && invitation.email === OWNER,
    JSON.stringify(invitation && { ...invitation, token: "…" }),
  );
  check(
    "AC-R12 it expires 7 days after issue",
    invitation && Math.abs(invitation.ttl_seconds - 7 * 24 * 3600) <= 5,
    `ttl ${invitation?.ttl_seconds}s`,
  );
  check(
    "the token is 43 base64url characters (32 random bytes)",
    invitation && /^[A-Za-z0-9_-]{43}$/.test(invitation.token),
    `length ${invitation?.token?.length}`,
  );

  const mail = await claimMailTo(OWNER, oboId);
  const link = mail ? new URL(mail.link) : null;
  check(
    "AC-R14 the mail links to /claim-org on WEB_URL's origin, carrying the org and the token",
    link && link.origin === EXPECTED_WEB_URL && link.pathname === "/claim-org" && link.searchParams.get("org") === oboId && link.searchParams.get("token") === invitation?.token,
    mail ? mail.link.replace(/token=[^&\s]+/, "token=…") : "no claim mail found in Mailpit",
  );
  check(
    "the mail never carries the national id",
    mail && !DIGITS_ONLY(mail.text).includes(NID[OWNER]),
    "national id found in the mail",
  );
  const token = link?.searchParams.get("token") ?? invitation?.token;

  console.log("\n--- pay, both gates: it stops at approved, held for the claim ---");
  const walk = await throughBothGates({ host, verifier, approver }, oboId);
  const [held] = await q(`select registration_status from orgs where id = $1`, [oboId]);
  check(
    "pay, field verify, approve, and the business waits at approved",
    walk.every((s) => s === 200 || s === 201) && held?.registration_status === "approved",
    `${walk.join(",")} → ${held?.registration_status}`,
  );

  // -------------------------------------------------------------------------
  console.log("\n=== C. The preview (AC-R2, AC-R3) ===");
  const preview = await call(owner, "POST", `/api/v1/orgs/${oboId}/claim/preview`, { token });
  check(
    "AC-R3 the preview shows the real business, district, stage and registrant",
    preview.status === 200 &&
      preview.json?.orgId === oboId &&
      preview.json?.legalName?.startsWith("ADR-053 Verify Claim") &&
      preview.json?.districtName === "Gasabo" &&
      preview.json?.registrationStatus === "approved" &&
      preview.json?.registrantName === "ADR-053 Verify Registrant",
    `status ${preview.status} ${preview.text.slice(0, 240)}`,
  );
  const [{ tin }] = await q(`select tin from orgs where id = $1`, [oboId]);
  check(
    "and carries no national id, no email and no TIN",
    preview.status === 200 && !preview.text.includes(NID[OWNER]) && !preview.text.includes(OWNER) && !preview.text.includes(tin),
    preview.text.slice(0, 240),
  );

  const madeUp = await call(other, "POST", `/api/v1/orgs/${oboId}/claim/preview`, { token: "x".repeat(43) });
  const wrongOrg = await call(other, "POST", `/api/v1/orgs/${orgId}/claim/preview`, { token });
  check(
    "AC-R2 a made up token and a real token under another org are both 404, worded identically",
    madeUp.status === 404 && wrongOrg.status === 404 && madeUp.text === wrongOrg.text,
    `${madeUp.status} ${madeUp.text} | ${wrongOrg.status} ${wrongOrg.text}`,
  );
  const signedOut = await call(null, "POST", `/api/v1/orgs/${oboId}/claim/preview`, { token });
  check("a signed out preview is 401", signedOut.status === 401, `status ${signedOut.status}`);

  // -------------------------------------------------------------------------
  console.log("\n=== D. Holding the link is not enough (AC-R11) ===");
  const otherPreview = await call(other, "POST", `/api/v1/orgs/${oboId}/claim/preview`, { token });
  check("another signed in account can open the preview", otherPreview.status === 200, `status ${otherPreview.status}`);
  const otherClaim = await call(other, "POST", `/api/v1/orgs/${oboId}/claim`, { token });
  check(
    "AC-R11 but its claim is refused with the same 404 a bad token gets",
    otherClaim.status === 404 && otherClaim.text === madeUp.text,
    `${otherClaim.status} ${otherClaim.text}`,
  );
  const [untouched] = await q(
    `select o.registration_status, b.claim_status, i.status as invitation
       from orgs o join obo_registrations b on b.org_id = o.id join org_invitations i on i.id = b.claim_invitation_id
      where o.id = $1`,
    [oboId],
  );
  check(
    "and nothing moved: approved, registrant_held, invitation still sent",
    untouched?.registration_status === "approved" && untouched?.claim_status === "registrant_held" && untouched?.invitation === "sent",
    JSON.stringify(untouched),
  );

  // -------------------------------------------------------------------------
  console.log("\n=== E. The owner claims, unverified (AC-R1, AC-R2) ===");
  const claimed = await call(owner, "POST", `/api/v1/orgs/${oboId}/claim`, { token });
  check(
    "AC-R1 the claim answers the summary: active, payouts still locked",
    claimed.status === 200 && claimed.json?.status === "active" && claimed.json?.payoutLocked === true,
    `status ${claimed.status} ${claimed.text.slice(0, 200)}`,
  );
  const [after] = await q(
    `select o.registration_status, b.claim_status, b.claimed_at, b.payout_locked,
            i.status as invitation, i.accepted_by_user_id,
            (select org_role from org_memberships m where m.org_id = o.id and m.user_id = $2 and m.status = 'active') as owner_role
       from orgs o join obo_registrations b on b.org_id = o.id join org_invitations i on i.id = b.claim_invitation_id
      where o.id = $1`,
    [oboId, ownerId],
  );
  check(
    "AC-R1 in one act: owner membership, owner_claimed, claimed_at, lock kept, invitation accepted by the owner",
    after?.registration_status === "active" &&
      after?.owner_role === "owner" &&
      after?.claim_status === "owner_claimed" &&
      after?.claimed_at &&
      after?.payout_locked === true &&
      after?.invitation === "accepted" &&
      after?.accepted_by_user_id === ownerId,
    JSON.stringify(after),
  );
  const tail = await q(
    `select from_status, to_status, trigger, actor_user_id from org_registration_events where org_id = $1 order by occurred_at desc, id desc limit 1`,
    [oboId],
  );
  check(
    "one approved > active event, a registrant move by the owner",
    tail[0]?.from_status === "approved" && tail[0]?.to_status === "active" && tail[0]?.trigger === "registrant" && tail[0]?.actor_user_id === ownerId,
    JSON.stringify(tail[0]),
  );
  const audit = await q(
    `select actor_user_id, payload_diff from audit_events where subject_id = $1 and event_type = 'registration.owner_claimed'`,
    [oboId],
  );
  check(
    "the audit row says payouts stayed locked, and why",
    audit.length === 1 && audit[0].actor_user_id === ownerId && audit[0].payload_diff?.payoutUnlocked === false && audit[0].payload_diff?.payoutLockReason === "claimant_not_kyc_verified",
    JSON.stringify(audit),
  );
  const spentPreview = await call(owner, "POST", `/api/v1/orgs/${oboId}/claim/preview`, { token });
  const spentClaim = await call(owner, "POST", `/api/v1/orgs/${oboId}/claim`, { token });
  check(
    "AC-R2 the spent token is refused by the preview and the claim alike",
    spentPreview.status === 404 && spentClaim.status === 404 && spentClaim.text === madeUp.text,
    `${spentPreview.status} / ${spentClaim.status}`,
  );

  // -------------------------------------------------------------------------
  console.log("\n=== F. A verified owner, two presses at once (AC-R1) ===");
  const verifiedObo = await call(
    host,
    "POST",
    "/api/v1/registrations",
    await registrationBody(host, "Verified Claim", { name: "ADR-053 Verify Verified Owner", nationalId: NID[OWNER2], email: OWNER2 }),
  );
  const vId = verifiedObo.json?.orgId;
  check("a second OBO registration", verifiedObo.status === 201 && vId, `status ${verifiedObo.status}`);
  if (vId) {
    await throughBothGates({ host, verifier, approver }, vId);
    const [{ token: vToken }] = await q(
      `select i.token from obo_registrations b join org_invitations i on i.id = b.claim_invitation_id where b.org_id = $1`,
      [vId],
    );
    const [first, second] = await Promise.all([
      call(owner2, "POST", `/api/v1/orgs/${vId}/claim`, { token: vToken }),
      call(owner2, "POST", `/api/v1/orgs/${vId}/claim`, { token: vToken }),
    ]);
    const statuses = [first.status, second.status].sort();
    check("two presses at once: one claim and one 404", JSON.stringify(statuses) === JSON.stringify([200, 404]), statuses.join(","));
    const winner = first.status === 200 ? first : second;
    check("AC-R1 a KYC verified claimant's payouts unlock", winner.json?.payoutLocked === false, winner.text.slice(0, 160));
    const [v] = await q(
      `select b.payout_locked, (select count(*)::int from org_registration_events e where e.org_id = b.org_id and e.to_status = 'active') as activations,
              (select count(*)::int from audit_events a where a.subject_id = b.org_id and a.event_type = 'registration.owner_claimed') as audits
         from obo_registrations b where b.org_id = $1`,
      [vId],
    );
    check(
      "one activation, one audit row, lock cleared",
      v?.payout_locked === false && v?.activations === 1 && v?.audits === 1,
      JSON.stringify(v),
    );
  }

  // -------------------------------------------------------------------------
  console.log("\n=== G. An expired invitation (AC-R12) ===");
  const expiring = await call(
    host,
    "POST",
    "/api/v1/registrations",
    await registrationBody(host, "Expired Claim", { name: "ADR-053 Verify Owner", nationalId: NID[OWNER], email: OWNER }),
  );
  const eId = expiring.json?.orgId;
  if (eId) {
    const [{ id: invId, token: eToken }] = await q(
      `select i.id, i.token from obo_registrations b join org_invitations i on i.id = b.claim_invitation_id where b.org_id = $1`,
      [eId],
    );
    await q(`update org_invitations set expires_at = now() - interval '1 minute' where id = $1`, [invId]);
    const ePreview = await call(owner, "POST", `/api/v1/orgs/${eId}/claim/preview`, { token: eToken });
    const eClaim = await call(owner, "POST", `/api/v1/orgs/${eId}/claim`, { token: eToken });
    check(
      "AC-R12 an expired invitation is refused by both, with the answer a made up token gets",
      ePreview.status === 404 && eClaim.status === 404 && ePreview.text === madeUp.text && eClaim.text === madeUp.text,
      `${ePreview.status} ${ePreview.text} | ${eClaim.status}`,
    );
  } else {
    check("create a registration to expire", false, expiring.text.slice(0, 160));
  }

  // -------------------------------------------------------------------------
  console.log("\n=== H. The preview is throttled per person ===");
  const burst = await Promise.all(
    Array.from({ length: 8 }, () => call(other, "POST", `/api/v1/orgs/${oboId}/claim/preview`, { token: "y".repeat(43) })),
  );
  const codes = burst.map((r) => r.status);
  check("hammering the preview from one account answers 429", codes.includes(429), codes.join(","));
};

main()
  .then(async () => {
    await db.end();
    console.log(`\n==================== ${pass} passed, ${fail} failed ====================`);
    if (failures.length) console.log("Failed:\n - " + failures.join("\n - "));
    process.exit(fail === 0 ? 0 : 1);
  })
  .catch(async (error) => {
    await db.end().catch(() => {});
    console.error("\nHARNESS ERROR:", error.message);
    process.exit(2);
  });
