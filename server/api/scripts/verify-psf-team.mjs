#!/usr/bin/env node
// Verify the PSF team (2026-11-02, migration 0128) against a running demo API
// (the fixed code 123456):
//
//   T1. Injishi's admin may not appoint a District Manager or a DBO, and does
//       appoint a Province Manager (Kigali).
//   T2. The Province Manager reads its team, appoints a DBO in Gasabo, and is
//       refused a district outside Kigali.
//   T3. The DBO reads Gasabo's businesses and fees, is refused the team, and is
//       refused every write: a fee, a claim, a decision, an appointment.
//   T4. The Province Manager ends the DBO's appointment with a reason; the DBO
//       is then refused the console.
//
// Each run appoints two new people (`verify.*@example.test`); ended
// appointments stay on record, like every revoked grant.
//
//   API_BASE=http://127.0.0.1:8000 ADMIN_EMAIL=admin@injishi.test node scripts/verify-psf-team.mjs

const BASE = process.env.API_BASE || 'http://127.0.0.1:8000';
const WEB_ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:3002';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@injishi.test';
const KIGALI = 1;
const GASABO = 102;
const NYANZA = 201;

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
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}
const brief = (r) => `${r.status} ${r.text.slice(0, 240)}`;

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

async function call(session, method, path, body) {
  const headers = { origin: WEB_ORIGIN };
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

async function signIn(email) {
  const session = makeSession();
  await call(session, 'POST', '/api/auth/email-otp/send-verification-otp', { email, type: 'sign-in' });
  const res = await call(session, 'POST', '/api/auth/sign-in/email-otp', { email, otp: '123456' });
  if (res.status !== 200) throw new Error(`sign-in failed for ${email}: ${brief(res)}`);
  await call(session, 'POST', '/api/v1/me/two-factor/send');
  await call(session, 'POST', '/api/v1/me/two-factor/verify', { code: '123456' });
  return session;
}

const V = '/api/v1';
const RUN = new Date().toISOString().slice(5, 19).replace(/[-T:]/g, '');
const PROVINCE_EMAIL = `verify.province.${RUN}@example.test`;
const DBO_EMAIL = `verify.dbo.${RUN}@example.test`;
const post = (role, scopeLevel, place) => ({
  email: PROVINCE_EMAIL,
  name: 'Verify Province Manager',
  role,
  governmentBodyCode: 'PSF',
  governmentTitle: 'PSF Province Manager',
  scopeLevel,
  ...place,
  reason: 'Verify the PSF team',
});

try {
  console.log('T1. Admin appoints Province Managers only');
  const admin = await signIn(ADMIN_EMAIL);
  const asDm = await call(admin, 'POST', `${V}/admin/local-leaders`, post('psf_membership_officer', 'district', { provinceId: KIGALI, districtId: GASABO }));
  check('admin may not appoint a District Manager', asDm.status === 422, brief(asDm));
  const asDbo = await call(admin, 'POST', `${V}/admin/local-leaders`, post('psf_business_officer', 'district', { provinceId: KIGALI, districtId: GASABO }));
  check('admin may not appoint a DBO', asDbo.status === 422 || asDbo.status === 400, brief(asDbo));
  const province = await call(admin, 'POST', `${V}/admin/local-leaders`, post('psf_membership_officer', 'province', { provinceId: KIGALI }));
  check('admin appoints a Province Manager for Kigali', province.status === 201, brief(province));

  console.log('T2. The Province Manager builds its team');
  const pm = await signIn(PROVINCE_EMAIL);
  const team = await call(pm, 'GET', `${V}/oversight/psf/team`);
  check(
    'it may appoint, in Kigali’s districts only',
    team.status === 200 && team.json?.canAppoint === true && team.json.districts.some((d) => d.id === GASABO) && !team.json.districts.some((d) => d.id === NYANZA),
    brief(team),
  );
  const outside = await call(pm, 'POST', `${V}/oversight/psf/team`, { email: DBO_EMAIL, name: 'Verify DBO', role: 'business_officer', districtId: NYANZA, reason: 'Verify the PSF team' });
  check('it is refused a district outside its province', outside.status === 403, brief(outside));
  const added = await call(pm, 'POST', `${V}/oversight/psf/team`, { email: DBO_EMAIL, name: 'Verify DBO', role: 'business_officer', districtId: GASABO, reason: 'Verify the PSF team' });
  const dboRow = added.json?.members?.find((m) => m.email === DBO_EMAIL);
  check('it appoints a DBO in Gasabo', (added.status === 200 || added.status === 201) && dboRow?.role === 'business_officer' && dboRow.districtId === GASABO, brief(added));
  const again = await call(pm, 'POST', `${V}/oversight/psf/team`, { email: DBO_EMAIL, name: 'Verify DBO', role: 'district_manager', districtId: GASABO, reason: 'Verify the PSF team' });
  check('one PSF post per person per district', again.status === 409, brief(again));

  console.log('T3. The DBO reads and changes nothing');
  const dbo = await signIn(DBO_EMAIL);
  const scope = await call(dbo, 'GET', `${V}/oversight/psf/scope`);
  check('the DBO opens the console for Gasabo', scope.status === 200 && JSON.stringify(scope.json).includes('Gasabo'), brief(scope));
  const businesses = await call(dbo, 'GET', `${V}/oversight/psf/businesses`);
  check('it reads Gasabo’s businesses', businesses.status === 200 && Array.isArray(businesses.json?.items), brief(businesses));
  const fees = await call(dbo, 'GET', `${V}/oversight/psf/fees`);
  check('it reads the fees, with no edit', fees.status === 200 && fees.json?.canEditDistrict === false && fees.json?.canEditNational === false, brief(fees));
  const subtypes = await call(dbo, 'GET', `${V}/oversight/psf/subsectors`);
  check('it reads the subtypes, with no edit', subtypes.status === 200 && subtypes.json?.places?.length === 0, brief(subtypes));
  const setFee = await call(dbo, 'PUT', `${V}/oversight/psf/fees`, { tierCode: 'golden_circle', districtId: GASABO, amountRwf: 6_000_000 });
  check('it is refused setting a fee', setFee.status === 403, brief(setFee));
  const confirm = await call(dbo, 'POST', `${V}/oversight/psf/claims/00000000-0000-4000-8000-000000000000/confirm`, {});
  check('it is refused a claim decision', confirm.status === 403, brief(confirm));
  const approve = await call(dbo, 'POST', `${V}/oversight/psf-applications/00000000-0000-4000-8000-000000000000/approve`, { membershipNumber: 'X' });
  check('it is refused an application decision', approve.status === 403, brief(approve));
  const dboTeam = await call(dbo, 'GET', `${V}/oversight/psf/team`);
  check('it does not see the team', dboTeam.status === 403, brief(dboTeam));
  const dboAppoints = await call(dbo, 'POST', `${V}/oversight/psf/team`, { email: `x.${RUN}@example.test`, name: 'Nobody', role: 'business_officer', districtId: GASABO, reason: 'Should be refused' });
  check('it is refused appointing anyone', dboAppoints.status === 403, brief(dboAppoints));

  console.log('T4. The Province Manager ends the DBO');
  const noReason = await call(pm, 'DELETE', `${V}/oversight/psf/team/${dboRow?.assignmentId}`);
  check('ending needs a reason', noReason.status === 400 || noReason.status === 422, brief(noReason));
  const ended = await call(pm, 'DELETE', `${V}/oversight/psf/team/${dboRow?.assignmentId}?reason=${encodeURIComponent('Verify: post ended')}`);
  check('it ends the DBO’s appointment', ended.status === 200 && !ended.json?.members?.some((m) => m.assignmentId === dboRow?.assignmentId), brief(ended));
  const after = await call(dbo, 'GET', `${V}/oversight/psf/businesses`);
  check('the DBO is then refused the console', after.status === 403, brief(after));
} catch (error) {
  fail += 1;
  failures.push(String(error?.message ?? error));
  console.error(error);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
