// Verify ADR-060 Phase 3 over real HTTP: a passport page and a selfie, read by
// the document verifier seam, verify the registrant.
//
// The mock verifier reads nothing off the image (there is no OCR behind it);
// its rules are the two a mock can honestly check. See
// `modules/user/infrastructure/mock-identity-adapters.ts`.
//
// WHAT IT PROVES:
//   A. Both photos upload through `POST /api/v1/uploads` as `kind=id_photo`.
//   B. A passport page and a different selfie verify: the answer is a person on
//      a passport, marked generated, and the identity is recorded verified by
//      `document_scan` with the passport as the active document.
//   C. A selfie that IS the passport photo is a face mismatch; a photo too small
//      to be one is unreadable; someone else's upload is refused at its field.
//   D. The verified passport holder registers a business.
//
// WRITES: fresh accounts, four small uploads and one registration per run.
// SAMPLE database only.
//   node --env-file=.env scripts/verify-registration-passport.mjs
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

async function sessionFor(email) {
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
  return jar(res);
}

async function call(cookie, method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), cookie },
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

/** Upload bytes as an `id_photo`, the way every client does, and return the key. */
async function upload(cookie, bytes, name) {
  const form = new FormData();
  form.append('kind', 'id_photo');
  form.append('attemptToken', randomUUID());
  form.append('file', new Blob([bytes], { type: 'image/jpeg' }), name);
  const res = await fetch(`${API}/api/v1/uploads`, { method: 'POST', headers: { cookie }, body: form });
  const json = await res.json().catch(() => null);
  return { status: res.status, key: json?.objectKey ?? null, json };
}

const ADDRESS = { country: 'RW', provinceId: 1, districtId: 102, sectorId: 10201, street: 'KG 11 Ave' };
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

try {
  const holder = await sessionFor(`passport-a-${RUN}@verify.injishi.rw`);
  const other = await sessionFor(`passport-b-${RUN}@verify.injishi.rw`);

  console.log('A. the two photos');
  const page = await upload(holder, randomBytes(12_000), 'passport.jpg');
  const selfie = await upload(holder, randomBytes(9_000), 'selfie.jpg');
  check('both upload as id_photo', page.status === 201 && selfie.status === 201 && page.key?.startsWith('id_photo/') && selfie.key?.startsWith('id_photo/'), `${page.status} ${JSON.stringify(page.json)}`);

  console.log('B. a passport and a selfie verify');
  const verified = await call(holder, 'POST', '/api/v1/me/identity/passport', {
    documentObjectKey: page.key,
    selfieObjectKey: selfie.key,
  });
  const person = verified.json?.person;
  check(
    'a passport holder, generated, masked',
    verified.status === 200 && verified.json?.status === 'verified' && person?.documentType === 'passport' && person?.generated === true && /^••••\d{4}$/.test(person?.documentNumberMasked ?? ''),
    verified.text,
  );
  const [row] = (await db.query(
    `select v.kyc_status, v.verified_method, d.document_type, d.status
       from users u join verified_identities v on v.user_id = u.id
       join identity_documents d on d.identity_id = u.id and d.is_primary
      where u.email = $1`,
    [`passport-a-${RUN}@verify.injishi.rw`],
  )).rows;
  check('recorded verified by document_scan, the passport active', row?.kyc_status === 'verified' && row?.verified_method === 'document_scan' && row?.document_type === 'passport' && row?.status === 'active', JSON.stringify(row));

  console.log('C. what the verifier refuses');
  const same = randomBytes(8_000);
  const twinA = await upload(other, same, 'passport.jpg');
  const twinB = await upload(other, same, 'selfie.jpg');
  const mismatch = await call(other, 'POST', '/api/v1/me/identity/passport', { documentObjectKey: twinA.key, selfieObjectKey: twinB.key });
  check('a selfie that is the passport photo is a face mismatch', mismatch.json?.status === 'rejected' && mismatch.json?.reason === 'face_mismatch', mismatch.text);
  const tiny = await upload(other, randomBytes(500), 'tiny.jpg');
  const fine = await upload(other, randomBytes(9_000), 'selfie2.jpg');
  const unreadable = await call(other, 'POST', '/api/v1/me/identity/passport', { documentObjectKey: tiny.key, selfieObjectKey: fine.key });
  check('a photo too small to be one is unreadable', unreadable.json?.status === 'rejected' && unreadable.json?.reason === 'unreadable', unreadable.text);
  const stolen = await call(other, 'POST', '/api/v1/me/identity/passport', { documentObjectKey: page.key, selfieObjectKey: fine.key });
  check("someone else's upload is refused at its field", stolen.status === 400 && /documentObjectKey/.test(stolen.text), stolen.text);

  console.log('D. the verified holder registers');
  const tin = `9990${String(Math.floor(Math.random() * 1e5)).padStart(5, '0')}`;
  const created = await call(holder, 'POST', '/api/v1/registrations', {
    role: 'host',
    capacity: 'owner',
    personal: { fullName: person.fullName, dateOfBirth: person.dateOfBirth, phoneE164: '+250788444222', address: ADDRESS },
    business: {
      domain: 'hospitality',
      legalName: `Passport Verify Hotel ${tin}`,
      address: ADDRESS,
      accommodationClass: 'hotel',
      tin,
      chamberOfTourismMember: false,
      psfMember: false,
    },
  });
  check('created', created.status === 201 || created.status === 200, created.text.slice(0, 300));
} finally {
  await db.end();
}

console.log(failures === 0 ? '\nPASSPORT VERIFIED' : `\n${failures} FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
