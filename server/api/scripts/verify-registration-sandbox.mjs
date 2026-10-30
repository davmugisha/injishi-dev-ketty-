#!/usr/bin/env node
/**
 * Business registration, end to end, with every provider seam on `sandbox`:
 * the API's real HTTP adapters talking to Injishi Mock APIs (`server/mock-apis`)
 * for RRA's taxpayer register, NIDA through GTBank, and GTBank's Payment Hub.
 * The registrant does what the wizard does, route by route:
 *
 *   sign in -> National ID number + selfie (NIDA) -> TIN check (RRA)
 *   -> RDB certificate -> create -> pay by mobile money (GTBank) -> in review
 *
 * Needs, all on this machine:
 * - Injishi Mock APIs running (`pnpm mock-apis:dev`), at MOCK_APIS_URL.
 * - An API on a SAMPLE database with RRA_TIN_ADAPTER_MODE, NIDA_ADAPTER_MODE
 *   and PAYMENT_ADAPTER_MODE set to `sandbox`, and the demo's fixed sign in
 *   code (INJISHI_ENVIRONMENT=demo).
 *
 *   API_BASE=http://127.0.0.1:8010 MOCK_APIS_URL=http://localhost:8100 \
 *   DATABASE_URL=... node scripts/verify-registration-sandbox.mjs
 *
 * It WRITES: each run signs up a fresh person, the director of a fresh company
 * from the mock register's generated blocks (`9981NNNNN`, director
 * `11990800NNNNN101`), so it never collides with the last run. Exits 1 on any
 * failed check; prints `sandbox registration verification passed` only when
 * every check holds.
 */
import { randomInt, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';

const BASE = process.env.API_BASE || 'http://127.0.0.1:8000';
const MOCK = (process.env.MOCK_APIS_URL || 'http://localhost:8100').replace(/\/+$/, '');
const WEB_ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:3000';
const GASABO = { country: 'RW', provinceId: 1, districtId: 102, sectorId: 10201 };
const PAYER = '788123456';
const DECLINER = '788120000';

let pass = 0;
let fail = 0;
function check(label, ok, detail) {
  if (ok) {
    pass += 1;
    console.log(`  PASS  ${label}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const line = readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith('DATABASE_URL='));
  if (!line) throw new Error('DATABASE_URL is not set and ../.env has none');
  return line.slice('DATABASE_URL='.length).trim();
}
const pool = new pg.Pool({ connectionString: databaseUrl(), max: 2 });
const q = async (text, params = []) => (await pool.query(text, params)).rows;

function makeSession() {
  const jar = new Map();
  return {
    cookie: () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; '),
    absorb(res) {
      for (const line of res.headers.getSetCookie?.() ?? []) {
        const [pair] = line.split(';');
        const idx = pair.indexOf('=');
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
    headers['content-type'] = 'application/json';
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

async function upload(session, path, form) {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers: { cookie: session.cookie() }, body: form });
  session.absorb(res);
  const json = await res.json().catch(() => null);
  if (!json?.objectKey) throw new Error(`${path}: ${res.status} ${JSON.stringify(json)}`);
  return json.objectKey;
}

/** A demo selfie from the mock console, uploaded as this session's `id_photo`. */
async function uploadSelfieOf(session, nationalId) {
  const png = await (await fetch(`${MOCK}/__mock/documents/citizens/${nationalId}/selfie.png`)).arrayBuffer();
  const form = new FormData();
  form.append('kind', 'id_photo');
  form.append('attemptToken', randomUUID());
  form.append('file', new Blob([png], { type: 'image/png' }), 'selfie.png');
  return upload(session, '/api/v1/uploads', form);
}

const CERTIFICATE_PDF = '%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n';
async function uploadCertificate(session) {
  const form = new FormData();
  form.append('file', new Blob([CERTIFICATE_PDF], { type: 'application/pdf' }), 'rdb-certificate.pdf');
  return upload(session, '/api/v1/uploads/certificate', form);
}

async function pollAttempt(session, orgId, token) {
  for (let i = 0; i < 45; i += 1) {
    await new Promise((r) => setTimeout(r, 1_000));
    const polled = await call(session, 'GET', `/api/v1/registrations/${orgId}/pay/attempts/${token}`);
    if (polled.status !== 200 || polled.json?.state !== 'prompting') return polled;
  }
  return { status: 504, json: null, text: 'never left prompting' };
}

const main = async () => {
  console.log(`API ${BASE}, Injishi Mock APIs ${MOCK}`);

  console.log('\n=== The stack runs every registration seam on sandbox ===');
  const health = await fetch(`${MOCK}/__mock/health`).then((r) => r.json()).catch(() => null);
  check('Injishi Mock APIs answers', health?.service === 'injishi-mock-apis', JSON.stringify(health));
  const platform = await call(null, 'GET', '/api/v1/platform');
  check('the API is a sample stack whose payments read as a test', platform.json?.sampleData === true && platform.json?.integrations?.payments === 'mock', platform.text.slice(0, 160));

  // A fresh person who directs a fresh company, both from the mock register's generated blocks.
  const digits = String(randomInt(10_000, 99_999));
  const tin = `9981${digits}`;
  const nationalId = `11990800${digits}101`;
  const email = `sandbox-${Date.now()}${randomInt(100, 999)}@verify.injishi.test`;
  const session = makeSession();
  await call(session, 'POST', '/api/auth/email-otp/send-verification-otp', { email, type: 'sign-in' }, { origin: WEB_ORIGIN });
  const signedIn = await call(session, 'POST', '/api/auth/sign-in/email-otp', { email, otp: '123456' }, { origin: WEB_ORIGIN });
  check('a new registrant signs in with an emailed code', signedIn.status === 200, `${signedIn.status} ${signedIn.text.slice(0, 160)}`);

  console.log('\n=== You: the National ID by number and selfie, through NIDA (GTBank) ===');
  const status = await call(session, 'GET', '/api/v1/me/identity');
  check(
    'identity says NIDA checks a National ID here, and Smile ID a passport',
    status.json?.nationalIdMode === 'sandbox' && status.json?.mode === 'sandbox' && status.json?.onFile === null,
    status.text.slice(0, 200),
  );

  const strangerSelfie = await uploadSelfieOf(session, '1198580045678923');
  const mismatch = await call(session, 'POST', '/api/v1/me/identity/national-id', { documentNumber: nationalId, selfieKey: strangerSelfie });
  check(
    "someone else's selfie is refused as a face mismatch, saying so",
    mismatch.json?.outcome === 'machine_failed' && mismatch.json?.reason === 'face_mismatch' && /NIDA/.test(mismatch.json?.message ?? ''),
    mismatch.text.slice(0, 220),
  );

  const unknown = await call(session, 'POST', '/api/v1/me/identity/national-id', {
    documentNumber: '1199080000000012',
    selfieKey: strangerSelfie,
  });
  check('a number NIDA does not hold is refused as not found', unknown.json?.reason === 'not_found', unknown.text.slice(0, 200));

  const ownSelfie = await uploadSelfieOf(session, nationalId);
  const grouped = `${nationalId.slice(0, 1)} ${nationalId.slice(1, 5)} ${nationalId.slice(5, 6)} ${nationalId.slice(6, 13)} ${nationalId.slice(13)}`;
  const checked = await call(session, 'POST', '/api/v1/me/identity/national-id', { documentNumber: grouped, selfieKey: ownSelfie });
  check(
    'the number as printed, with its own selfie, is checked by the register',
    checked.json?.outcome === 'machine_passed' && checked.json?.fields?.checked === true && checked.json?.fields?.source === 'registry',
    checked.text.slice(0, 260),
  );
  check('the answer never carries the whole number', !checked.text.includes(nationalId), checked.json?.fields?.documentNumberMasked);
  const holderName = checked.json?.fields?.fullName;
  const holderDob = checked.json?.fields?.dateOfBirth;

  const onFile = await call(session, 'GET', '/api/v1/me/identity');
  check('the identity on file reads Checked, from the register', onFile.json?.kycStatus === 'verified' && onFile.json?.onFile?.source === 'registry', onFile.text.slice(0, 220));

  const [scanRow] = await q(
    `select s.check_kind, s.front_object_key, s.adapter_mode, s.outcome
       from identity_scans s join users u on u.id = s.user_id
      where lower(u.email) = lower($1) order by s.created_at desc limit 1`,
    [email],
  );
  check(
    'the try is kept as a register check: no card photo, the selfie, stamped sandbox',
    scanRow?.check_kind === 'national_id_registry' && scanRow.front_object_key === null && scanRow.adapter_mode === 'sandbox' && scanRow.outcome === 'machine_passed',
    JSON.stringify(scanRow),
  );

  console.log('\n=== Business: the TIN, through RRA ===');
  const tinCheck = await call(session, 'POST', '/api/v1/registrations/tin-check', { tin, capacity: 'owner' });
  check(
    "RRA verifies the TIN, names the company, and lists this person as a director",
    tinCheck.json?.result === 'verified' && typeof tinCheck.json?.business?.legalName === 'string' && tinCheck.json?.registrantIsDirector === true,
    tinCheck.text.slice(0, 260),
  );
  check("the owner is not shown the directors' names", Array.isArray(tinCheck.json?.business?.directors) && tinCheck.json.business.directors.length === 0, tinCheck.text.slice(0, 200));
  const legalName = tinCheck.json?.business?.legalName;

  const notRegistered = await call(session, 'POST', '/api/v1/registrations/tin-check', { tin: '123456789', capacity: 'owner' });
  check('a TIN RRA does not hold fails', notRegistered.json?.result === 'failed', notRegistered.text.slice(0, 160));
  const outage = await call(session, 'POST', '/api/v1/registrations/tin-check', { tin: '998000098', capacity: 'owner' });
  check("an RRA outage reads as pending, never failed", outage.json?.result === 'pending', outage.text.slice(0, 160));

  console.log('\n=== Pay: create, then a Request to Pay through GTBank ===');
  const created = await call(session, 'POST', '/api/v1/registrations', {
    role: 'host',
    capacity: 'owner',
    personal: {
      fullName: holderName,
      document: { documentType: 'national_id', documentNumber: nationalId, issuingCountry: 'RW' },
      dateOfBirth: holderDob,
      phoneE164: `+250${PAYER}`,
      address: GASABO,
    },
    business: {
      domain: 'hospitality',
      businessKind: 'guest_house',
      legalName,
      address: GASABO,
      accommodationClass: 'guest_house',
      tin,
      certificates: [{ kind: 'rdb_certificate', objectKey: await uploadCertificate(session) }],
    },
  }, { 'idempotency-key': randomUUID() });
  check('the registration is created, awaiting its fee', created.json?.registrationStatus === 'pending_payment' || created.json?.status === 'pending_payment', `${created.status} ${created.text.slice(0, 260)}`);
  const orgId = created.json?.orgId;

  const declinedToken = randomUUID();
  const declinedPress = await call(session, 'POST', `/api/v1/registrations/${orgId}/pay`, {
    attemptToken: declinedToken,
    instrument: { kind: 'mobile_money', network: 'mtn_momo', msisdn: DECLINER },
  });
  check('a press prompts the payer', declinedPress.json?.kind === 'attempt' && declinedPress.json.attempt.state === 'prompting', declinedPress.text.slice(0, 200));
  const declined = await pollAttempt(session, orgId, declinedToken);
  check(
    'a prompt the payer declines ends at once, refused, saying why',
    declined.json?.state === 'refused' && /declined/.test(declined.json?.failureReason ?? ''),
    declined.text.slice(0, 220),
  );

  const token = randomUUID();
  const pressed = await call(session, 'POST', `/api/v1/registrations/${orgId}/pay`, {
    attemptToken: token,
    instrument: { kind: 'mobile_money', network: 'mtn_momo', msisdn: PAYER },
  });
  check('a second press prompts again', pressed.json?.kind === 'attempt' && pressed.json.attempt.state === 'prompting', pressed.text.slice(0, 200));
  const settled = await pollAttempt(session, orgId, token);
  check('the handset approves and the attempt is confirmed', settled.json?.state === 'confirmed', settled.text.slice(0, 220));

  const summary = await call(session, 'GET', `/api/v1/registrations/${orgId}`);
  const state = summary.json?.registrationStatus ?? summary.json?.status;
  check('the paid registration is in review, past the TIN check', state === 'tin_verified' || state === 'submitted', summary.text.slice(0, 220));

  const [tinRow] = await q(`select result, adapter_mode from tin_verifications where org_id = $1 order by checked_at desc limit 1`, [orgId]);
  check('the check of record ran through the sandbox and is stamped mock', tinRow?.adapter_mode === 'mock' && tinRow?.result === 'verified', JSON.stringify(tinRow));
  const payments = await q(
    `select status, provider, adapter_mode, provider_reference from payment_transactions where workspace_id = $1 order by created_at`,
    [created.json?.workspaceId],
  );
  check(
    'the bank record holds the declined prompt and the paid one, on GTBank rows stamped mock',
    payments.length === 2 &&
      payments[0].status === 'failed' &&
      payments[1].status === 'successful' &&
      payments.every((p) => p.provider === 'gtbank' && p.adapter_mode === 'mock' && /^GTB/.test(p.provider_reference ?? '')),
    JSON.stringify(payments),
  );

  console.log(`\n${pass} passed, ${fail} failed`);
  await pool.end();
  if (fail > 0) process.exit(1);
  console.log('sandbox registration verification passed');
};

main().catch(async (error) => {
  console.error(error);
  await pool.end().catch(() => {});
  process.exit(1);
});
