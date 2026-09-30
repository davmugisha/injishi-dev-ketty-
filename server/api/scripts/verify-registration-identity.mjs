// Verify ADR-060 Phase 1 over real HTTP: the National ID lookup, its binding
// code, the verified identity it records, and a registration held to it.
//
// WHAT IT PROVES:
//   A. A new account reads its identity as unverified, with the lookup
//      available and verification required on this (mock, sample) stack.
//   B. The lookup refuses a caller with no session.
//   C. A number the register does not hold is `not_found`; one it holds with
//      no phone is `no_phone`.
//   D. A number it holds sends a code and answers with where it went, masked,
//      and NOTHING about the person.
//   E. A wrong code is refused with the tries left; the right one reveals the
//      person, marked generated, and records the identity as verified.
//   F. The status route then reads verified, by the register.
//   G. The same number cannot be verified onto a second account.
//   H. A replaced challenge cannot be spent.
//   I. An unverified person is refused a business registration and a broker
//      registration with `identity_not_verified`; a verified one registers
//      without re-sending their document.
//   J. A verified person cannot change their name through Step 1.
//
// WRITES: fresh accounts and one registration per run. SAMPLE database only.
//   node --env-file=.env scripts/verify-registration-identity.mjs
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
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { cookie } : {}) },
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

/** A fresh male National ID born 1990, never the all-zero or all-one sequence. */
function freshNid() {
  const seq = String(2_000_000 + Math.floor(Math.random() * 7_000_000));
  return `119908${seq}${String(Math.floor(Math.random() * 90) + 10)}1`;
}
const tinFor = () => `9990${String(Math.floor(Math.random() * 1e5)).padStart(5, '0')}`;
const ADDRESS = { country: 'RW', provinceId: 1, districtId: 102, sectorId: 10201, street: 'KG 11 Ave' };

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const q = async (text, params = []) => (await db.query(text, params)).rows;

try {
  const alice = await sessionFor(`identity-a-${RUN}@verify.injishi.rw`);
  const bob = await sessionFor(`identity-b-${RUN}@verify.injishi.rw`);
  const carol = await sessionFor(`identity-c-${RUN}@verify.injishi.rw`);

  console.log('A. a new account');
  const before = await call(alice, 'GET', '/api/v1/me/identity');
  check(
    'unverified, lookup available, verification required, mock register',
    before.status === 200 &&
      before.json?.kycStatus === 'unverified' &&
      before.json?.available?.nationalId === true &&
      before.json?.required === true &&
      before.json?.modes?.registry === 'mock',
    before.text.slice(0, 200),
  );

  console.log('B. no session');
  check('401', (await call(null, 'POST', '/api/v1/me/identity/national-id/lookup', { documentNumber: freshNid() })).status === 401);

  console.log('C. numbers the register cannot bind');
  const missing = await call(carol, 'POST', '/api/v1/me/identity/national-id/lookup', { documentNumber: '1199080000000012' });
  check('an all-zero sequence is not_found', missing.json?.status === 'not_found', missing.text);
  const phoneless = await call(carol, 'POST', '/api/v1/me/identity/national-id/lookup', { documentNumber: '1199081111111012' });
  check('an all-one sequence is no_phone', phoneless.json?.status === 'no_phone', phoneless.text);

  console.log('D. a number the register holds');
  const nid = freshNid();
  const sent = await call(alice, 'POST', '/api/v1/me/identity/national-id/lookup', { documentNumber: nid });
  check('code_sent, to a masked phone', sent.json?.status === 'code_sent' && /·/.test(sent.json?.sentTo ?? ''), sent.text);
  check('and nothing about the person', !/fullName|dateOfBirth|gender/.test(sent.text), sent.text);

  console.log('E. the code');
  const wrong = await call(alice, 'POST', '/api/v1/me/identity/national-id/confirm', { challengeId: sent.json.challengeId, code: '000001' });
  check('a wrong code is refused with the tries left', wrong.status === 400 && /tries? left/.test(wrong.text), wrong.text);
  const right = await call(alice, 'POST', '/api/v1/me/identity/national-id/confirm', { challengeId: sent.json.challengeId, code: OTP });
  check(
    'the right code reveals the person, generated, masked',
    right.status === 200 && right.json?.fullName && right.json?.generated === true && right.json?.documentNumberMasked?.endsWith(nid.slice(-4)),
    right.text,
  );
  const [row] = await q(
    `select v.kyc_status, v.verified_method, d.status, d.verified_at
       from users u join verified_identities v on v.user_id = u.id
       join identity_documents d on d.identity_id = u.id and d.document_number = $2
      where u.email = $1`,
    [`identity-a-${RUN}@verify.injishi.rw`, nid],
  );
  check('recorded: kyc verified by the register, document active and verified', row?.kyc_status === 'verified' && row?.verified_method === 'registry' && row?.status === 'active' && row?.verified_at, JSON.stringify(row));

  console.log('F. the status route');
  const after = await call(alice, 'GET', '/api/v1/me/identity');
  check('verified, by the register, under the revealed name', after.json?.kycStatus === 'verified' && after.json?.method === 'registry' && after.json?.verified?.fullName === right.json?.fullName, after.text.slice(0, 200));

  console.log('G. one human, one account');
  const clash = await call(bob, 'POST', '/api/v1/me/identity/national-id/lookup', { documentNumber: nid });
  check('the same number is refused for a second account', clash.status === 409, clash.text);

  console.log('H. a replaced challenge');
  const bobNid = freshNid();
  const first = await call(bob, 'POST', '/api/v1/me/identity/national-id/lookup', { documentNumber: bobNid });
  const second = await call(bob, 'POST', '/api/v1/me/identity/national-id/lookup', { documentNumber: bobNid });
  const stale = await call(bob, 'POST', '/api/v1/me/identity/national-id/confirm', { challengeId: first.json?.challengeId, code: OTP });
  check('the first code cannot be spent after a second was sent', second.json?.status === 'code_sent' && stale.status === 410, `${stale.status} ${stale.text}`);

  console.log('I. registration is held to a verified identity');
  const business = (tin) => ({
    domain: 'hospitality',
    legalName: `Identity Verify Hotel ${tin}`,
    address: ADDRESS,
    accommodationClass: 'hotel',
    tin,
    chamberOfTourismMember: false,
    psfMember: false,
  });
  const unverified = await call(carol, 'POST', '/api/v1/registrations', {
    role: 'host',
    capacity: 'owner',
    personal: {
      fullName: 'Carol Unverified',
      document: { documentType: 'national_id', documentNumber: freshNid(), issuingCountry: 'RW' },
      dateOfBirth: '1990-05-05',
      phoneE164: '+250788555111',
      address: ADDRESS,
    },
    business: business(tinFor()),
  });
  check('an unverified person is refused, identity_not_verified', unverified.status === 403 && unverified.json?.code === 'identity_not_verified', unverified.text);
  const broker = await call(carol, 'POST', '/api/v1/registrations/broker', {});
  check('and refused as a broker too', broker.status === 403 && broker.json?.code === 'identity_not_verified', broker.text);
  const verified = await call(alice, 'POST', '/api/v1/registrations', {
    role: 'host',
    capacity: 'owner',
    // No document: the verified one is kept.
    personal: {
      fullName: right.json.fullName,
      dateOfBirth: right.json.dateOfBirth,
      phoneE164: right.json.phoneE164,
      address: ADDRESS,
    },
    business: business(tinFor()),
  });
  check('a verified person registers without re-sending their document', verified.status === 201 || verified.status === 200, verified.text.slice(0, 300));
  if (verified.status === 201 || verified.status === 200) {
    console.log('  mayElevate is enforced at create');
  }

  console.log('J. Step 1 cannot rename a verified person');
  const renamed = await call(alice, 'PUT', '/api/v1/me/profile', {
    fullName: 'Somebody Else',
    dateOfBirth: right.json.dateOfBirth,
    phoneE164: right.json.phoneE164,
    address: ADDRESS,
  });
  check('refused at fullName', renamed.status === 400 && /fullName/.test(renamed.text), renamed.text);
} finally {
  await db.end();
}

console.log(failures === 0 ? '\nIDENTITY VERIFIED' : `\n${failures} FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
