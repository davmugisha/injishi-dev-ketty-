#!/usr/bin/env node
// Verify PSF membership renewals (2026-11-02, migration 0126) end to end,
// against a running demo API (the fixed code 123456) and its database:
//
//   R1. A public application is sent and paid, and the district's PSF officer
//       approves it: a member, renewal closed until 60 days before the end.
//   R2. Inside the window, a renewal on another band is paid: the same
//       membership row runs on a year from the old end date, at the new band
//       and price; no officer acts. Tracking lists it, its payment and event.
//   R3. A band price outside the district's band is refused, and nothing changes.
//   R4. A lapsed membership is renewed: a new row under the same number,
//       starting on the day it is paid.
//   R5. A declined prompt leaves the membership as it was.
//
// The membership's dates are moved by SQL to stand in for time passing; only
// the business this run creates is touched. Each run leaves one
// "Verify PSF renewal <time>" business behind, like verify-psf-path.mjs.
//
//   API_BASE=http://127.0.0.1:8000 DATABASE_URL=... OFFICER_EMAIL=... \
//     node scripts/verify-psf-renewal.mjs
//
// OFFICER_EMAIL is an active PSF membership officer covering the district the
// business is filed in (its first assignment's district).
import pg from 'pg';

const BASE = process.env.API_BASE || 'http://127.0.0.1:8000';
const WEB_ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:3000';
const { DATABASE_URL, OFFICER_EMAIL } = process.env;
if (!DATABASE_URL || !OFFICER_EMAIL) {
  console.error('DATABASE_URL and OFFICER_EMAIL are required.');
  process.exit(1);
}

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
const brief = (r) => `${r.status} ${r.text.slice(0, 300)}`;

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

const db = new pg.Client({ connectionString: DATABASE_URL });
await db.connect();
const one = async (sql, args = []) => (await db.query(sql, args)).rows[0] ?? null;

const V = '/api/v1';
const pub = (method, path, b) => call(null, method, `${V}${path}`, b);
const RUN = new Date().toISOString().slice(5, 19).replace(/[-T:]/g, '');
const kigaliToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali' }).format(new Date());
const addDays = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const PHONE = '+250788123456';
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** Mock mobile money approves a few seconds after the prompt: press again until it settles. */
async function untilSettled(press) {
  let res = await press();
  for (let i = 0; i < 12 && res.json?.status === 'pending'; i += 1) {
    await sleep(2_500);
    res = await press();
  }
  return res;
}
const renew = (docId, body) => untilSettled(() => pub('POST', `/psf/track/${docId}/renew`, body));

try {
  const where = await one(
    `SELECT a.district_id AS district, d.province_id AS province,
            (SELECT s.id FROM sectors s WHERE s.district_id = a.district_id ORDER BY s.id LIMIT 1) AS sector
       FROM oversight_assignments a JOIN users u ON u.id = a.user_id JOIN districts d ON d.id = a.district_id
      WHERE lower(u.email) = lower($1) AND a.oversight_role = 'psf_membership_officer' AND a.revoked_at IS NULL
      ORDER BY a.granted_at LIMIT 1`,
    [OFFICER_EMAIL],
  );
  if (!where) throw new Error(`${OFFICER_EMAIL} is not a PSF membership officer with a district.`);

  console.log('R1. A member, approved by the district officer');
  const look = await pub('POST', '/psf/identity/lookup', { documentNumber: `11990700${String(Date.now()).slice(-8)}`, consent: true });
  const ok = await pub('POST', '/psf/identity/confirm', { checkId: look.json?.checkId, code: look.json?.demoCode ?? '123456' });
  if (ok.status !== 200) throw new Error(`ID check failed: ${brief(ok)}`);
  const sent = await pub('POST', '/psf/applications', {
    checkToken: ok.json.checkToken,
    business: {
      legalName: `Verify PSF renewal ${RUN}`,
      registrationKind: 'none',
      associationCode: 'acgdr',
      subsectorOther: 'Groceries',
      ownerGroups: ['women'],
      address: { provinceId: where.province, districtId: where.district, sectorId: where.sector, street: 'KG 1 Ave' },
      companyType: 'sole_trader',
      ownership: 'rwandan_100',
      businessActivity: 'Groceries',
      tradeDirection: 'none',
      tradeCountries: [],
    },
    membership: { tierCode: 'indatwa_20k', declaredFeeRwf: 30_000 },
    contact: { role: 'owner', gender: 'female', phoneE164: PHONE, email: 'verify.renewal@example.test' },
    payerPhoneE164: PHONE,
    consent: true,
  });
  const docId = sent.json?.docId;
  const settled = sent.json?.feePaid ? sent : await untilSettled(() => pub('POST', `/psf/track/${docId}/pay-registration`, { phoneE164: PHONE }));
  check('the application is sent and paid', sent.status === 201 && (sent.json.feePaid === true || settled.json?.status === 'paid'), brief(settled));
  const app = await one(`SELECT id, org_id FROM psf_membership_applications WHERE doc_id = $1`, [docId]);

  const officer = await signIn(OFFICER_EMAIL);
  const detail = await call(officer, 'GET', `${V}/oversight/psf-applications/${app.id}`);
  const approve = await call(officer, 'POST', `${V}/oversight/psf-applications/${app.id}/approve`, {
    membershipNumber: detail.json?.suggestedMembershipNumber,
  });
  check('the district officer approves it', approve.status < 300, brief(approve));

  let view = (await pub('GET', `/psf/track/${docId}`)).json;
  const first = { number: view?.membership?.number, expiresOn: view?.membership?.expiresOn };
  check('tracking shows a member with an end date', view?.stage === 'member' && Boolean(first.number && first.expiresOn), JSON.stringify(view?.membership));
  check(
    'renewal is closed until 60 days before the end',
    view?.renewal?.open === false && view.renewal.opensOn === addDays(first.expiresOn, -60) && view.renewal.tierCode === 'indatwa_20k',
    JSON.stringify(view?.renewal),
  );
  const early = await pub('POST', `/psf/track/${docId}/renew`, { tierCode: 'indatwa_20k', declaredFeeRwf: 30_000, phoneE164: PHONE });
  check('a renewal outside the window is refused', early.status === 409, brief(early));

  console.log('R2. Renewing inside the window, on another band');
  const ending = addDays(kigaliToday(), 20);
  await db.query(`UPDATE psf_memberships SET expires_on = $2, starts_on = $3 WHERE org_id = $1 AND ended_at IS NULL`, [
    app.org_id,
    ending,
    addDays(ending, -364),
  ]);
  view = (await pub('GET', `/psf/track/${docId}`)).json;
  check('renewal is open 20 days before the end, for the year after it', view?.renewal?.open === true && view.renewal.startsOn === addDays(ending, 1), JSON.stringify(view?.renewal));

  console.log('R3. An amount outside the band');
  const low = await pub('POST', `/psf/track/${docId}/renew`, { tierCode: 'indatwa_50k', declaredFeeRwf: 20_000, phoneE164: PHONE });
  check('an amount under the band is refused at its field', low.status === 422 && low.json?.issues?.[0]?.path?.join('.') === 'declaredFeeRwf', brief(low));

  const renewed = await renew(docId, { tierCode: 'indatwa_50k', declaredFeeRwf: 60_000, phoneE164: PHONE });
  check('the renewal is paid, with no officer', renewed.status === 200 && renewed.json?.status === 'paid', brief(renewed));
  const m2 = renewed.json?.view?.membership;
  check(
    'the same membership runs a year on from the old end date, at the new band',
    m2?.number === first.number && m2.expiresOn === addDays(addDays(ending, 1), 364) && m2.tierCode === 'indatwa_50k' && m2.feeRwf === 60_000,
    JSON.stringify(m2),
  );
  const rows = await one(`SELECT count(*)::int AS n FROM psf_memberships WHERE org_id = $1`, [app.org_id]);
  check('no second membership row was made', rows?.n === 1, JSON.stringify(rows));
  check(
    'tracking lists the renewal, its payment and its event',
    renewed.json?.view?.renewals?.length === 1 &&
      renewed.json.view.payments.some((p) => p.kind === 'membership_renewal' && p.amountRwf === 60_000) &&
      renewed.json.view.events.some((e) => e.kind === 'renewed'),
    JSON.stringify(renewed.json?.view?.renewals),
  );
  const again = await pub('POST', `/psf/track/${docId}/renew`, { tierCode: 'indatwa_50k', declaredFeeRwf: 60_000, phoneE164: PHONE });
  check('renewal closes again until the next window', again.status === 409, brief(again));

  console.log('R4. Renewing after it lapsed');
  const lapsedOn = addDays(kigaliToday(), -10);
  await db.query(`UPDATE psf_memberships SET expires_on = $2, starts_on = $3, ended_at = now() WHERE org_id = $1 AND ended_at IS NULL`, [
    app.org_id,
    lapsedOn,
    addDays(lapsedOn, -364),
  ]);
  await db.query(`UPDATE orgs SET psf_member = false WHERE id = $1`, [app.org_id]);
  view = (await pub('GET', `/psf/track/${docId}`)).json;
  check('tracking shows it lapsed, renewable from today', view?.stage === 'lapsed' && view.renewal?.open === true && view.renewal.startsOn === kigaliToday(), JSON.stringify({ stage: view?.stage, r: view?.renewal }));

  console.log('R5. A declined prompt');
  const declined = await renew(docId, { tierCode: 'indatwa_20k', declaredFeeRwf: 20_000, phoneE164: '+250780000000' });
  check('a declined prompt says so', declined.status === 200 && declined.json?.status === 'declined', brief(declined));
  check('and the membership stays lapsed', declined.json?.view?.stage === 'lapsed', declined.json?.view?.stage);

  const back = await renew(docId, { tierCode: 'indatwa_20k', declaredFeeRwf: 20_000, phoneE164: PHONE });
  const m4 = back.json?.view?.membership;
  check('the lapsed membership is renewed', back.json?.status === 'paid' && back.json.view.stage === 'member', brief(back));
  check(
    'under the same number, from today, for a year',
    m4?.number === first.number && m4.startsOn === kigaliToday() && m4.expiresOn === addDays(kigaliToday(), 364),
    JSON.stringify(m4),
  );
  const after = await one(
    `SELECT count(*)::int AS n, count(*) FILTER (WHERE ended_at IS NULL)::int AS current, bool_and(membership_number = $2) AS same
       FROM psf_memberships WHERE org_id = $1`,
    [app.org_id, first.number],
  );
  check('a new current row beside the ended one, both under the number', after?.n === 2 && after.current === 1 && after.same === true, JSON.stringify(after));
  const org = await one(`SELECT psf_member FROM orgs WHERE id = $1`, [app.org_id]);
  check('the business shows as a member again', org?.psf_member === true, JSON.stringify(org));
  const paidRenewals = await one(`SELECT count(*) FILTER (WHERE status = 'paid')::int AS paid, count(*) FILTER (WHERE status = 'failed')::int AS failed FROM psf_membership_renewals WHERE org_id = $1`, [app.org_id]);
  check('two paid renewals and one failed attempt are kept', paidRenewals?.paid === 2 && paidRenewals.failed === 1, JSON.stringify(paidRenewals));
  console.log(`\n  docID ${docId}`);
} catch (error) {
  fail += 1;
  failures.push(String(error?.message ?? error));
  console.error(error);
} finally {
  await db.end();
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
