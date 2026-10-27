// Verify ADR-075 A1's identity scan over real HTTP (AC-4 to AC-6): the ID is scanned, front then a selfie, for a
// National ID and a passport alike; no code is sent to any phone; every try is kept for PSF; and the status reads
// "Checked" only after a machine check passed.
//
// The document verifier's mode decides which half runs, read from GET /api/v1/me/identity:
//   mock (unset over a sample database)       A, B, C, D, E, F
//   off  (DOCUMENT_VERIFIER_MODE=off, restart) A, G
// Run it once in each to prove AC-6's "in every mode".
//
// WHAT IT PROVES:
//   A. The SMS lookup, its confirm and the passport route are gone (404), and so is `identity_challenges` (AC-4).
//   B. A National ID front and a selfie pass: the fields come back masked and marked generated, the identity is
//      verified by `document_scan`, an `identity_scans` row keeps both photo keys, and no `/me/*` answer carries
//      a key (D-n). The status says checked. A passport page passes the same way (O-4).
//   C. A photo too small to read fails with the reason and the fix; the tries count on the draft; typing the
//      details is refused until the third try, then allowed, and lands `pending`, "PSF will check your ID"
//      (AC-5, AC-6). Every try is a row.
//   D. The typed, pending person registers; a person who typed an ID with no scan behind it is refused 403
//      `identity_not_verified`.
//   E. Someone else's upload is a 422 at its field; the same photo twice is a face mismatch; an ID another
//      account holds is a 409; a checked identity can be neither scanned again (409) nor typed over (422).
//   F. The demo card reads as its number, so a scanned director of a mock company is told "listed" at the TIN
//      check, with no director named to the owner (AC-7).
//   G. With no checker: the scan keeps the photos, answers `manual_needed` and may continue at once; the typed
//      details land `pending`, and that person registers.
//
// WRITES: fresh accounts, small uploads and up to two registrations per run. SAMPLE database only.
//   node --env-file=.env scripts/verify-adr075-identity.mjs
import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';

const API = process.env.VERIFY_API_URL || 'http://127.0.0.1:8000';
const OTP = process.env.VERIFY_OTP_CODE || '123456';
const RUN = Date.now().toString(36);

let failures = 0;
function check(label, ok, detail) {
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : `   ${detail}`}`);
}

function jar(res) {
  return (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
}

async function sessionFor(label) {
  const email = `adr075-id-${label}-${RUN}@verify.injishi.rw`;
  await fetch(`${API}/api/auth/email-otp/send-verification-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, type: 'sign-in' }),
  });
  const res = await fetch(`${API}/api/auth/sign-in/email-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp: OTP }),
  });
  if (!res.ok) throw new Error(`${email}: sign-in ${res.status}`);
  return { cookie: jar(res), email };
}

async function call(cookie, method, path, body, headers = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { cookie } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

async function upload(cookie, bytes, name) {
  const form = new FormData();
  form.append('kind', 'id_photo');
  form.append('attemptToken', randomUUID());
  form.append('file', new Blob([bytes], { type: 'image/jpeg' }), name);
  const res = await fetch(`${API}/api/v1/uploads`, { method: 'POST', headers: { cookie }, body: form });
  const json = await res.json().catch(() => null);
  if (!json?.objectKey) throw new Error(`upload ${name}: ${res.status} ${JSON.stringify(json)}`);
  return json.objectKey;
}

const demoCard = (nid) => Buffer.concat([randomBytes(6_000), Buffer.from(`INJISHI-DEMO-NID:${nid}`, 'latin1')]);
const freshNid = () =>
  `119908${String(2_000_000 + Math.floor(Math.random() * 7_000_000))}${String(Math.floor(Math.random() * 90) + 10)}1`;

async function scan(cookie, documentType, frontBytes, selfieBytes = randomBytes(5_000)) {
  const [frontKey, selfieKey] = await Promise.all([upload(cookie, frontBytes, 'front.jpg'), upload(cookie, selfieBytes, 'selfie.jpg')]);
  const res = await call(cookie, 'POST', '/api/v1/me/identity/scan', { documentType, frontKey, selfieKey });
  return { ...res, frontKey, selfieKey };
}

const ADDRESS = { country: 'RW', provinceId: 1, districtId: 102, sectorId: 10201, street: 'KG 11 Ave' };
const tinFor = () => `9990${String(Math.floor(Math.random() * 1e5)).padStart(5, '0')}`;

/**
 * Upload a small PDF as this person's RDB certificate. ADR-075 AC-11: create refuses a stay or a venue without
 * one, and only takes a certificate the registrant uploaded. Uploaded once per person per run and reused for each
 * of their registrations, because the certificate route allows 10 per person in 10 minutes.
 */
const uploadedCertificates = new Map();
async function rdbCertificate(cookie) {
  if (uploadedCertificates.has(cookie)) return uploadedCertificates.get(cookie);
  const form = new FormData();
  form.append('file', new Blob([CERTIFICATE_PDF], { type: 'application/pdf' }), 'rdb-certificate.pdf');
  const res = await fetch(`${API}/api/v1/uploads/certificate`, { method: 'POST', headers: { cookie }, body: form });
  const json = await res.json().catch(() => null);
  if (!json?.objectKey) throw new Error(`certificate upload: ${res.status} ${JSON.stringify(json)}`);
  const certificates = [{ kind: 'rdb_certificate', objectKey: json.objectKey }];
  uploadedCertificates.set(cookie, certificates);
  return certificates;
}
const CERTIFICATE_PDF = '%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n';

function registration(person, label, certificates = []) {
  return {
    role: 'host',
    capacity: 'owner',
    // No document: the identity on file is the one the scan or the typed details left (ADR-075 S4).
    personal: { fullName: person.fullName, dateOfBirth: person.dateOfBirth, phoneE164: '+250788300412', address: ADDRESS },
    business: {
      domain: 'hospitality',
      legalName: `ADR-075 Identity ${RUN} ${label}`,
      businessKind: 'guest_house',
      accommodationClass: 'guest_house',
      tin: tinFor(),
      address: ADDRESS,
      certificates,
      branches: [],
    },
  };
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const q = async (text, params = []) => (await db.query(text, params)).rows;
const scansOf = (email) =>
  q(
    `select s.outcome, s.reason, s.adapter_mode, s.document_type, s.front_object_key, s.selfie_object_key
       from identity_scans s join users u on u.id = s.user_id where u.email = $1 order by s.created_at`,
    [email],
  );
const kycOf = async (email) =>
  (await q(`select v.kyc_status, v.verified_method from verified_identities v join users u on u.id = v.user_id where u.email = $1`, [email]))[0];

try {
  const first = await sessionFor('first');
  const mode = (await call(first.cookie, 'GET', '/api/v1/me/identity')).json?.mode;
  console.log(`(document verifier: ${mode})`);

  console.log('A. no code is sent to any phone');
  for (const path of ['/api/v1/me/identity/national-id/lookup', '/api/v1/me/identity/national-id/confirm', '/api/v1/me/identity/passport']) {
    const gone = await call(first.cookie, 'POST', path, {});
    check(`${path} is gone`, gone.status === 404, `${gone.status}`);
  }
  check('identity_challenges is dropped', (await q(`select to_regclass('public.identity_challenges') as t`))[0].t === null);

  if (mode === 'mock') {
    console.log('B. a National ID front and a selfie pass, and so does a passport');
    const nid = freshNid();
    const passed = await scan(first.cookie, 'national_id', demoCard(nid));
    const f = passed.json?.fields;
    check(
      'machine_passed, the fields masked, generated and checked',
      passed.status === 200 && passed.json?.outcome === 'machine_passed' && f?.documentType === 'national_id' &&
        f?.issuingCountry === 'RW' && f?.generated === true && f?.checked === true && !/\d{16}/.test(passed.text),
      passed.text,
    );
    const kyc = await kycOf(first.email);
    check('verified by document_scan', kyc?.kyc_status === 'verified' && kyc?.verified_method === 'document_scan', JSON.stringify(kyc));
    const [row] = await scansOf(first.email);
    check(
      'one scan row keeping both photo keys, in mock mode',
      row?.outcome === 'machine_passed' && row?.reason === null && row?.adapter_mode === 'mock' &&
        row?.front_object_key === passed.frontKey && row?.selfie_object_key === passed.selfieKey,
      JSON.stringify(row),
    );
    const status = await call(first.cookie, 'GET', '/api/v1/me/identity');
    check(
      'the status says checked, with the latest scan',
      status.json?.onFile?.checked === true && status.json?.scan?.outcome === 'machine_passed' && status.json?.machineCheck === true,
      status.text,
    );
    check('no /me/* answer carries a photo key', !/id_photo\//.test(status.text + passed.text), status.text);

    const traveller = await sessionFor('passport');
    const page = await scan(traveller.cookie, 'passport', randomBytes(12_000));
    check(
      'a passport page passes the same way',
      page.json?.outcome === 'machine_passed' && page.json?.fields?.documentType === 'passport' && page.json?.fields?.issuingCountry !== 'RW',
      page.text,
    );

    console.log('C. three failed tries, then the details as printed');
    const unlucky = await sessionFor('unlucky');
    const tries = [];
    for (let i = 0; i < 3; i++) {
      if (i === 1) {
        const early = await call(unlucky.cookie, 'PUT', '/api/v1/me/identity/document', {
          fullName: 'Grace Uwimana',
          dateOfBirth: '1991-03-04',
          document: { documentType: 'national_id', documentNumber: freshNid() },
        });
        check('typing is refused before the third try (409)', early.status === 409, early.text);
      }
      tries.push(await scan(unlucky.cookie, 'national_id', randomBytes(600)));
    }
    check(
      'a failed try names the reason and the fix',
      tries[0].json?.outcome === 'machine_failed' && tries[0].json?.reason === 'unreadable' && /More light/.test(tries[0].json?.message ?? '') &&
        /whole card/.test(tries[0].json?.message ?? ''),
      tries[0].text,
    );
    check(
      'the tries count, and only the third may continue',
      tries.map((t) => t.json?.attempt).join() === '1,2,3' && tries.map((t) => t.json?.mayContinue).join() === 'false,false,true',
      tries.map((t) => t.text).join(' | '),
    );
    const counted = (
      await q(`select d.checks #>> '{scan,attempts}' as n, d.payload is null as empty from registration_drafts d join users u on u.id = d.user_id where u.email = $1`, [unlucky.email])
    )[0];
    check('the draft counts them, and holds no payload of its own', counted?.n === '3' && counted?.empty === true, JSON.stringify(counted));
    const typedNid = freshNid();
    const typed = await call(unlucky.cookie, 'PUT', '/api/v1/me/identity/document', {
      fullName: 'Grace Uwimana',
      dateOfBirth: '1991-03-04',
      document: { documentType: 'national_id', documentNumber: typedNid },
    });
    check(
      'after the third, the typed details land pending: PSF will check',
      typed.status === 200 && typed.json?.kycStatus === 'pending' && typed.json?.onFile?.checked === false &&
        typed.json?.onFile?.fullName === 'Grace Uwimana' && !typed.text.includes(typedNid),
      typed.text,
    );
    const rows = await scansOf(unlucky.email);
    check('every try is a row with its reason', rows.length === 3 && rows.every((r) => r.outcome === 'machine_failed' && r.reason === 'unreadable'), JSON.stringify(rows));

    console.log('D. who may register');
    const pending = await call(unlucky.cookie, 'POST', '/api/v1/registrations', registration({ fullName: 'Grace Uwimana', dateOfBirth: '1991-03-04' }, 'pending', await rdbCertificate(unlucky.cookie)), {
      'Idempotency-Key': randomUUID(),
    });
    check('the typed, pending person registers', pending.status === 201 && pending.json?.status === 'pending_payment', pending.text.slice(0, 300));
    const never = await sessionFor('never');
    const typedOnly = registration({ fullName: 'Nobody Scanned', dateOfBirth: '1990-01-01' }, 'never');
    typedOnly.personal.document = { documentType: 'national_id', documentNumber: freshNid() };
    const refused = await call(never.cookie, 'POST', '/api/v1/registrations', typedOnly, { 'Idempotency-Key': randomUUID() });
    check(
      'an ID typed with no scan behind it is refused 403 identity_not_verified',
      refused.status === 403 && refused.json?.code === 'identity_not_verified',
      refused.text,
    );

    console.log('E. what the scan refuses');
    const thief = await sessionFor('thief');
    const own = await upload(thief.cookie, randomBytes(5_000), 'selfie.jpg');
    const stolen = await call(thief.cookie, 'POST', '/api/v1/me/identity/scan', { documentType: 'national_id', frontKey: passed.frontKey, selfieKey: own });
    check("someone else's upload is a 422 at frontKey", stolen.status === 422 && /frontKey/.test(stolen.text), stolen.text);
    const same = await call(thief.cookie, 'POST', '/api/v1/me/identity/scan', { documentType: 'national_id', frontKey: own, selfieKey: own });
    check('the same photo twice is a face mismatch', same.json?.outcome === 'machine_failed' && same.json?.reason === 'face_mismatch', same.text);
    const twin = await scan(thief.cookie, 'national_id', demoCard(nid));
    check('an ID another account holds is a 409', twin.status === 409, twin.text);
    const again = await scan(first.cookie, 'national_id', demoCard(freshNid()));
    check('a checked identity is not scanned again (409)', again.status === 409, again.text);
    const over = await call(first.cookie, 'PUT', '/api/v1/me/identity/document', {
      fullName: 'Someone Else',
      dateOfBirth: '1990-01-01',
      document: { documentType: 'national_id', documentNumber: freshNid() },
    });
    check('nor typed over (422)', over.status === 422, over.text);

    console.log('F. the demo card, and the director line');
    const digits = String(10_000 + Math.floor(Math.random() * 89_999));
    const director = await sessionFor('director');
    const card = await scan(director.cookie, 'national_id', demoCard(`11990800${digits}101`));
    check('a demo card reads as its number', card.json?.outcome === 'machine_passed' && card.json?.fields?.documentNumberMasked?.endsWith(`${digits.slice(-1)}101`), card.text);
    const listed = await call(director.cookie, 'POST', '/api/v1/registrations/tin-check', { tin: `9981${digits}`, capacity: 'owner' });
    check(
      'its director is told listed, and no director is named to an owner',
      listed.json?.registrantIsDirector === true && listed.json?.business?.directors?.length === 0,
      listed.text.slice(0, 300),
    );
  } else if (mode === 'off') {
    console.log('G. no checker: the photos wait for PSF');
    const manual = await scan(first.cookie, 'national_id', randomBytes(6_000));
    check(
      'manual_needed, nothing read, may continue at once',
      manual.status === 200 && manual.json?.outcome === 'manual_needed' && manual.json?.fields === null && manual.json?.mayContinue === true &&
        manual.json?.attempt === 1,
      manual.text,
    );
    const [row] = await scansOf(first.email);
    check(
      'the photos are kept in off mode',
      row?.outcome === 'manual_needed' && row?.adapter_mode === 'off' && row?.front_object_key === manual.frontKey && row?.selfie_object_key === manual.selfieKey,
      JSON.stringify(row),
    );
    const status = await call(first.cookie, 'GET', '/api/v1/me/identity');
    check('the status says no machine check, and may continue', status.json?.machineCheck === false && status.json?.scan?.mayContinue === true, status.text);
    const typed = await call(first.cookie, 'PUT', '/api/v1/me/identity/document', {
      fullName: 'Jean Mugabo',
      dateOfBirth: '1989-06-12',
      document: { documentType: 'national_id', documentNumber: freshNid() },
    });
    check('the typed details land pending, never checked', typed.status === 200 && typed.json?.kycStatus === 'pending' && typed.json?.onFile?.checked === false, typed.text);
    const created = await call(first.cookie, 'POST', '/api/v1/registrations', registration({ fullName: 'Jean Mugabo', dateOfBirth: '1989-06-12' }, 'off', await rdbCertificate(first.cookie)), {
      'Idempotency-Key': randomUUID(),
    });
    check('and that person registers', created.status === 201 && created.json?.status === 'pending_payment', created.text.slice(0, 300));
  } else {
    check('the document verifier mode is mock or off', false, String(mode));
  }
} finally {
  await db.end();
}

console.log(failures === 0 ? '\nADR-075 IDENTITY SCAN VERIFIED' : `\n${failures} FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
