// Verify ADR-056 end to end over real HTTP: PSF membership, from an
// application to a PSF officer's decision.
//
// A WRITING verifier, like verify-adr053-thread.mjs, because what it proves (an
// application filed, a membership recorded) cannot be observed without making
// one. Every assertion is a real request over a real session.
//
// WHAT IT PROVES:
//   A. The tier catalogue reads in its order, without a session (AC-2, made
//      public by the PSF path: the PSF page shows it to a visitor).
//   B. The business side: the applicant reads its page, a receptionist and a
//      residence are refused, a second open application is refused, a
//      withdrawal reopens the door (AC-15, AC-16, AC-22).
//   C. The officer side: one national queue, the filed form, two officers
//      racing to one approval, the business paying to become a member, a
//      decline with its reason (AC-10 to AC-13, as the PSF path changed them).
//   D. Queue membership is derived: a rejected business leaves the queue with
//      nothing written to the application, and returns unchanged (AC-8).
//   E. An officer who joins a business after being appointed cannot decide its
//      application (AC-14).
//   F. The workspace grant says who may manage PSF membership, and a Yes with
//      a number is a self declared membership (AC-7, AC-15).
//
// D and E change rows directly (a registration status, a staff membership) to
// stage the case, and put them back. Needs DATABASE_URL for that, and the API.
//
// WHAT IT LEAVES BEHIND: decided applications and one membership on the
// sample businesses. It starts each run by clearing the PSF rows of the four
// businesses it decides on and re-running seed-demo-psf.mjs, so it can be run
// again. Meant for a SAMPLE MARKED database seeded by seed-sample.
//
//   API_BASE=http://127.0.0.1:8056 DATABASE_URL=... node scripts/verify-adr056-psf.mjs
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const BASE = process.env.API_BASE || 'http://127.0.0.1:8000';
const WEB_ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:3000';
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required (sections D and E stage their case in the database).');
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

// --- Sessions (cached, because codes are capped per address per hour) --------

const JAR_FILE = join(tmpdir(), 'injishi-verify-adr056-sessions.json');
const JARS = existsSync(JAR_FILE) ? JSON.parse(readFileSync(JAR_FILE, 'utf8')) : {};
const saveJars = () => writeFileSync(JAR_FILE, JSON.stringify(JARS, null, 1));

function makeSession(seed) {
  const jar = new Map(Object.entries(seed ?? {}));
  return {
    cookie: () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; '),
    absorb(res) {
      for (const line of res.headers.getSetCookie?.() ?? []) {
        const [pair] = line.split(';');
        const idx = pair.indexOf('=');
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
  const cached = JARS[BASE + email];
  if (cached) {
    const reused = makeSession(cached);
    if ((await call(reused, 'GET', '/api/v1/me/profile')).status === 200) return reused;
  }
  const session = makeSession();
  const origin = { origin: WEB_ORIGIN };
  await call(session, 'POST', '/api/auth/email-otp/send-verification-otp', { email, type: 'sign-in' }, origin);
  const res = await call(session, 'POST', '/api/auth/sign-in/email-otp', { email, otp: '123456' }, origin);
  if (res.status !== 200) throw new Error(`sign-in failed for ${email}: ${res.status} ${res.text.slice(0, 200)}`);
  JARS[BASE + email] = session.snapshot();
  saveJars();
  return session;
}

// --- Fixtures ----------------------------------------------------------------

const db = new pg.Client({ connectionString: DATABASE_URL });
await db.connect();
const orgId = async (name) =>
  (await db.query('SELECT id FROM orgs WHERE legal_name = $1 LIMIT 1', [name])).rows[0]?.id;
const userId = async (email) =>
  (await db.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [email])).rows[0]?.id;

const UMUCYO = await orgId('Umucyo Garden Guest House');
const AMAHORO = await orgId('Amahoro Hospitality Group');
const INZOZI = await orgId('Inzozi Hotels Ltd');
const GREEN_HILLS = await orgId('Green Hills Properties');
const KACYIRU = await orgId('Kacyiru Jacaranda Suites');
if (!UMUCYO || !AMAHORO || !INZOZI || !GREEN_HILLS || !KACYIRU) {
  console.error('A seeded business is missing. Run seed-sample.mjs on a sample database first.');
  process.exit(1);
}

/**
 * Start every run from the seeded state: clear the PSF rows of the four
 * businesses this script decides on, restore their answers, and let the PSF
 * seed put Umucyo's application and Kacyiru's membership back. Only PSF rows
 * of sample businesses are touched.
 */
async function resetPsfState() {
  const ids = [UMUCYO, AMAHORO, INZOZI, KACYIRU];
  await db.query('DELETE FROM psf_memberships WHERE org_id = ANY($1)', [ids]);
  await db.query('DELETE FROM psf_membership_applications WHERE org_id = ANY($1)', [ids]);
  await db.query('UPDATE orgs SET psf_member = false WHERE id = ANY($1)', [[UMUCYO, AMAHORO, INZOZI]]);
  await db.query('UPDATE orgs SET psf_member = true WHERE id = $1', [KACYIRU]);
  const seeded = spawnSync(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), 'seed-demo-psf.mjs')], {
    env: process.env,
    encoding: 'utf8',
  });
  if (seeded.status !== 0) throw new Error(`seed-demo-psf.mjs failed: ${seeded.stderr || seeded.stdout}`);
}
await resetPsfState();

function form(overrides = {}) {
  return {
    requestedTierCode: 'golden_circle',
    declaredFeeRwf: 5_000_000,
    companyName: 'Amahoro Hospitality Group',
    streetAddress: 'KN 3 Rd, Kigali',
    companyType: 'private_company',
    ownership: 'rwandan_100',
    businessActivity: 'Accommodation: Hotel',
    tradeDirection: 'none',
    contactRole: 'owner',
    firstName: 'Yves',
    lastName: 'Rutayisire',
    gender: 'male',
    phoneE164: '+250788000001',
    email: 'yves@demo.injishi.com',
    idDocument: { documentType: 'national_id', documentNumber: '1198080012345601' },
    dateOfBirth: '1980-05-02',
    consent: true,
    ...overrides,
  };
}

/** An approval: PSF's number. The business's own amount stands (the PSF path). */
const approval = () => ({ membershipNumber: `PSF/VERIFY/${Date.now()}` });

const main = async () => {
  const innocent = await signIn('innocent.niyonsaba@guests.demo.injishi.com');
  const yves = await signIn('yves@demo.injishi.com');
  const clarisse = await signIn('clarisse@demo.injishi.com');
  const josephine = await signIn('josephine@demo.injishi.com');
  const aimable = await signIn('aimable@demo.injishi.com');
  const diane = await signIn('diane.umutoni@guests.demo.injishi.com');
  const eric = await signIn('eric@demo.injishi.com');

  console.log('\n=== A. The tier catalogue (AC-2) ===');
  const tiers = await call(innocent, 'GET', '/api/v1/psf/tiers');
  check('tiers read 200', tiers.status === 200, tiers.status);
  check('six active tiers, Golden Circle first', tiers.json?.length === 6 && tiers.json[0].code === 'golden_circle');
  check('a range tier carries its range', tiers.json?.find((t) => t.code === 'indashyikirwa')?.annualFeeMaxRwf === 4999999);
  check('signed out reads them too', (await call(null, 'GET', '/api/v1/psf/tiers')).status === 200);

  console.log('\n=== B. The business side (AC-15, AC-16, AC-22) ===');
  const u = await call(innocent, 'GET', `/api/v1/orgs/${UMUCYO}/psf-membership`);
  check('the owner reads their page', u.status === 200, u.status);
  check('the open application sits with PSF (TIN passed)', u.json?.open?.stage === 'with_psf', u.json?.open?.stage);
  check('it cannot apply twice', u.json?.canApply === false);
  check('the registration number is the TIN', u.json?.registrationNumber === '999031001', u.json?.registrationNumber);
  check('a receptionist is refused 403', (await call(clarisse, 'GET', `/api/v1/orgs/${AMAHORO}/psf-membership`)).status === 403);
  check('a stranger is refused 403', (await call(clarisse, 'GET', `/api/v1/orgs/${UMUCYO}/psf-membership`)).status === 403);
  check('a residence is refused 422', (await call(josephine, 'GET', `/api/v1/orgs/${GREEN_HILLS}/psf-membership`)).status === 422);
  check(
    'a second open application is refused 409',
    (await call(innocent, 'POST', `/api/v1/orgs/${UMUCYO}/psf-applications`, form({ companyName: 'Umucyo' }))).status === 409,
  );

  const a = await call(yves, 'GET', `/api/v1/orgs/${AMAHORO}/psf-membership`);
  check('Amahoro may apply', a.json?.canApply === true);
  check('the form starts from the business and the person', a.json?.prefill?.companyName === 'Amahoro Hospitality Group' && a.json?.prefill?.email === 'yves@demo.injishi.com');
  check('an unknown tier is refused 422', (await call(yves, 'POST', `/api/v1/orgs/${AMAHORO}/psf-applications`, form({ requestedTierCode: 'nope' }))).status === 422);
  check('no consent is refused 400', (await call(yves, 'POST', `/api/v1/orgs/${AMAHORO}/psf-applications`, form({ consent: false }))).status === 400);
  check('a receptionist cannot apply 403', (await call(clarisse, 'POST', `/api/v1/orgs/${AMAHORO}/psf-applications`, form())).status === 403);

  const applied = await call(yves, 'POST', `/api/v1/orgs/${AMAHORO}/psf-applications`, form());
  check('the owner applies 201', applied.status === 201, `${applied.status} ${applied.text.slice(0, 160)}`);
  check('an active business goes straight to PSF and is stamped', applied.json?.open?.stage === 'with_psf' && applied.json?.open?.queuedAt !== null);
  check('the price shown and the amount chosen are copied onto it',
    applied.json?.open?.quotedFeeMinRwf === 5000000 && applied.json?.open?.declaredFeeRwf === 5000000);
  const firstId = applied.json?.open?.id;
  const w = await call(yves, 'POST', `/api/v1/orgs/${AMAHORO}/psf-applications/${firstId}/withdraw`);
  check('the owner withdraws 200', w.status === 200 && w.json?.open === null && w.json?.history?.[0]?.status === 'withdrawn');
  check('withdrawing twice is refused 409', (await call(yves, 'POST', `/api/v1/orgs/${AMAHORO}/psf-applications/${firstId}/withdraw`)).status === 409);
  const again = await call(yves, 'POST', `/api/v1/orgs/${AMAHORO}/psf-applications`, form());
  check('and may apply again 201', again.status === 201);
  const amahoroApp = again.json?.open?.id;

  // Someone who signed up with an emailed code has an empty `users.name`; their
  // name is on the verified identity. Seeded users carry a name, which hid what
  // follows. Blank two owners the same way and read again (AC-3, AC-16, AC-17):
  //   Samuel, whose Umurage Guesthouse has never applied, so the form starts
  //   from the person rather than from an earlier application;
  //   Yves, whose open application must still say who sent it.
  const blanked = (await db.query(
    `SELECT id, name FROM users WHERE email IN ('yves@demo.injishi.com', 'samuel@demo.injishi.com')`,
  )).rows;
  await db.query(`UPDATE users SET name = '' WHERE id = ANY($1)`, [blanked.map((r) => r.id)]);
  try {
    const samuel = await signIn('samuel@demo.injishi.com');
    const fresh = await call(samuel, 'GET', `/api/v1/orgs/${await orgId('Umurage Guesthouse')}/psf-membership`);
    check(
      'with no account name, a first application starts from the verified name',
      fresh.json?.prefill?.firstName === 'Samuel' && fresh.json?.prefill?.lastName === 'Kayitare',
      `${fresh.status} ${fresh.json?.prefill?.firstName} ${fresh.json?.prefill?.lastName}`,
    );
    const blank = await call(yves, 'GET', `/api/v1/orgs/${AMAHORO}/psf-membership`);
    check('and an application names who sent it', blank.json?.open?.submittedByName === 'Yves Rutayisire', blank.json?.open?.submittedByName);
  } finally {
    for (const r of blanked) await db.query('UPDATE users SET name = $2 WHERE id = $1', [r.id, r.name]);
  }

  console.log('\n=== C. The officer side (AC-10 to AC-13) ===');
  check('a business owner is not an officer 403', (await call(innocent, 'GET', '/api/v1/oversight/psf-applications')).status === 403);
  const q = await call(eric, 'GET', '/api/v1/oversight/psf-applications');
  check('the officer reads one national queue', q.status === 200, q.status);
  const umucyoItem = q.json?.items?.find((i) => i.orgId === UMUCYO);
  check('it lists Umucyo and Amahoro', Boolean(umucyoItem) && q.json.items.some((i) => i.applicationId === amahoroApp));
  const order = (q.json?.items ?? []).map((i) => new Date(i.queuedAt ?? i.submittedAt).getTime());
  check('oldest first', order.every((t, i) => i === 0 || order[i - 1] <= t));
  const detail = await call(eric, 'GET', `/api/v1/oversight/psf-applications/${umucyoItem.applicationId}`);
  check('the filed form reads back', detail.status === 200 && detail.json?.form?.firstName === 'Innocent');
  check('an approval with no number is refused 400', (await call(eric, 'POST', `/api/v1/oversight/psf-applications/${umucyoItem.applicationId}/approve`, { membershipNumber: '' })).status === 400);

  const [r1, r2] = await Promise.all([
    call(eric, 'POST', `/api/v1/oversight/psf-applications/${umucyoItem.applicationId}/approve`, approval()),
    call(eric, 'POST', `/api/v1/oversight/psf-applications/${umucyoItem.applicationId}/approve`, approval()),
  ]);
  const statuses = [r1.status, r2.status].sort();
  check('two racing approvals: one 200, one 409', statuses[0] === 200 && statuses[1] === 409, statuses.join(','));
  const waiting = await call(innocent, 'GET', `/api/v1/orgs/${UMUCYO}/psf-membership`);
  check('approved, it waits on the payment and no membership exists yet',
    waiting.json?.open?.stage === 'awaiting_payment' && waiting.json?.current === null);
  const paid = await call(innocent, 'POST', `/api/v1/orgs/${UMUCYO}/psf-applications/${umucyoItem.applicationId}/pay`, { phoneE164: '+250788000101' });
  check('the owner pays 200', paid.status === 200, `${paid.status} ${paid.text.slice(0, 160)}`);
  const memberships = await db.query('SELECT count(*)::int n FROM psf_memberships WHERE org_id = $1 AND ended_at IS NULL', [UMUCYO]);
  check('exactly one current membership', memberships.rows[0].n === 1, memberships.rows[0].n);
  const flag = await db.query('SELECT psf_member FROM orgs WHERE id = $1', [UMUCYO]);
  check('the business is now a PSF member', flag.rows[0].psf_member === true);
  const after = await call(innocent, 'GET', `/api/v1/orgs/${UMUCYO}/psf-membership`);
  check('the owner sees the confirmed membership', after.json?.current?.source === 'psf_confirmed' && after.json?.open === null);
  check('deciding it again is refused 409', (await call(eric, 'POST', `/api/v1/oversight/psf-applications/${umucyoItem.applicationId}/decline`, { reason: 'details_incomplete' })).status === 409);

  check('decline Other with no note is refused 400', (await call(eric, 'POST', `/api/v1/oversight/psf-applications/${amahoroApp}/decline`, { reason: 'other' })).status === 400);
  const d = await call(eric, 'POST', `/api/v1/oversight/psf-applications/${amahoroApp}/decline`, { reason: 'other', note: 'Send the RDB certificate.' });
  check('the officer declines with a note 200', d.status === 200 && d.json?.status === 'declined');
  const y = await call(yves, 'GET', `/api/v1/orgs/${AMAHORO}/psf-membership`);
  check('the owner reads the reason and the note', y.json?.history?.[0]?.declineReason === 'other' && y.json?.history?.[0]?.decisionNote === 'Send the RDB certificate.');
  check('and may apply again', y.json?.canApply === true);
  const decidedBy = await db.query('SELECT decision_body_code FROM psf_membership_applications WHERE id = $1', [amahoroApp]);
  check('the decision records the body', decidedBy.rows[0].decision_body_code === 'PSF');

  console.log('\n=== D. Queue membership is derived (AC-8) ===');
  const inzoziApp = await call(aimable, 'POST', `/api/v1/orgs/${INZOZI}/psf-applications`, form({ companyName: 'Inzozi Hotels Ltd', email: 'aimable@demo.injishi.com', firstName: 'Aimable', lastName: 'Ntwari', idDocument: { documentType: 'national_id', documentNumber: '1198980012345616' } }));
  check('Inzozi applies 201', inzoziApp.status === 201, `${inzoziApp.status} ${inzoziApp.text.slice(0, 160)}`);
  const inzoziId = inzoziApp.json?.open?.id;
  const stampedAt = (await db.query('SELECT queued_at FROM psf_membership_applications WHERE id = $1', [inzoziId])).rows[0]?.queued_at;
  const inQueue = async () => ((await call(eric, 'GET', '/api/v1/oversight/psf-applications')).json?.items ?? []).some((i) => i.applicationId === inzoziId);
  check('it is in the queue', await inQueue());
  await db.query(`UPDATE orgs SET registration_status = 'rejected' WHERE id = $1`, [INZOZI]);
  try {
    check('a rejected business leaves the queue', !(await inQueue()));
    check('the officer cannot open it 404', (await call(eric, 'GET', `/api/v1/oversight/psf-applications/${inzoziId}`)).status === 404);
    const stage = await call(aimable, 'GET', `/api/v1/orgs/${INZOZI}/psf-membership`);
    check('the owner still sees it open', stage.json?.open?.id === inzoziId);
  } finally {
    await db.query(`UPDATE orgs SET registration_status = 'tin_verified' WHERE id = $1`, [INZOZI]);
  }
  check('back in good standing, it returns', await inQueue());
  const stampedAfter = (await db.query('SELECT queued_at, status FROM psf_membership_applications WHERE id = $1', [inzoziId])).rows[0];
  check('unchanged: still submitted, same first queue time', stampedAfter.status === 'submitted' && String(stampedAfter.queued_at) === String(stampedAt));

  console.log('\n=== E. An officer with a stake cannot decide (AC-14) ===');
  const ericId = await userId('eric@demo.injishi.com');
  await db.query(`INSERT INTO org_memberships (org_id, user_id, org_role) VALUES ($1, $2, 'receptionist')`, [INZOZI, ericId]);
  try {
    const item = ((await call(eric, 'GET', '/api/v1/oversight/psf-applications')).json?.items ?? []).find((i) => i.applicationId === inzoziId);
    check('the queue marks it as one they cannot decide', item?.canDecide === false);
    check('deciding it is refused 403', (await call(eric, 'POST', `/api/v1/oversight/psf-applications/${inzoziId}/approve`, approval())).status === 403);
  } finally {
    await db.query('DELETE FROM org_memberships WHERE org_id = $1 AND user_id = $2', [INZOZI, ericId]);
  }
  const clear = ((await call(eric, 'GET', '/api/v1/oversight/psf-applications')).json?.items ?? []).find((i) => i.applicationId === inzoziId);
  check('with the stake gone, it is decidable again', clear?.canDecide === true);

  console.log('\n=== F. The grant and the self declared membership (AC-7, AC-15) ===');
  const grantOf = async (s, id) => ((await call(s, 'GET', '/api/v1/me/workspaces')).json?.workspaces ?? []).find((g) => g.orgId === id);
  check('the owner may manage PSF membership', (await grantOf(yves, AMAHORO))?.psfMembership?.canManage === true);
  check('a receptionist may not', (await grantOf(clarisse, AMAHORO))?.psfMembership?.canManage === false);
  check('a residence grant carries none', (await grantOf(josephine, GREEN_HILLS))?.psfMembership === null);
  const k = await call(diane, 'GET', `/api/v1/orgs/${KACYIRU}/psf-membership`);
  check('a Yes with a number reads as self declared', k.json?.current?.source === 'self_declared' && k.json?.current?.membershipNumber === 'PSF/KGL/2019/0412');

  console.log('\n=== G. The registration carries it (AC-1, AC-6, AC-7) ===');
  const rayan = await signIn('rayan@demo.injishi.com');
  const ADDRESS = { country: 'RW', provinceId: 1, districtId: 102, sectorId: 10201, street: 'KG 11 Ave' };
  const personal = {
    fullName: 'Rayan Iraguha',
    document: { documentType: 'national_id', documentNumber: '1199080123456789', issuingCountry: 'RW' },
    gender: 'male',
    dateOfBirth: '1990-02-14',
    phoneE164: '+250788000211',
    address: ADDRESS,
  };
  // A fresh TIN each run, so a rerun never collides with its own last business.
  const tin = () => `9990${String(Math.floor(Math.random() * 1e5)).padStart(5, '0')}`;
  const hotel = (tinValue, psf) => ({
    role: 'host',
    capacity: 'owner',
    personal,
    business: {
      domain: 'hospitality',
      legalName: `ADR-056 Verify Hotel ${tinValue}`,
      address: ADDRESS,
      accommodationClass: 'hotel',
      tin: tinValue,
      chamberOfTourismMember: false,
      ...psf,
    },
  });

  const applyTin = tin();
  const reg = await call(rayan, 'POST', '/api/v1/registrations', hotel(applyTin, {
    psfMember: false,
    psfApplication: form({ requestedTierCode: 'indatwa_10k', declaredFeeRwf: 15000, companyName: `ADR-056 Verify Hotel ${applyTin}`, email: 'rayan@demo.injishi.com', firstName: 'Rayan', lastName: 'Iraguha', idDocument: { documentType: 'national_id', documentNumber: '1199080123456789' } }),
  }));
  check('a registration with an application is created', reg.status === 201 || reg.status === 200, `${reg.status} ${reg.text.slice(0, 200)}`);
  const filed = (await db.query(
    `SELECT a.status, a.queued_at, a.registration_number, a.submitted_capacity, a.quoted_fee_min_rwf, a.declared_fee_rwf
       FROM psf_membership_applications a JOIN orgs o ON o.id = a.org_id WHERE o.tin = $1`,
    [applyTin],
  )).rows[0];
  check('its application is filed in the same write', filed?.status === 'submitted' && filed?.registration_number === applyTin && filed?.submitted_capacity === 'owner');
  check('it waits for the TIN check, unstamped', filed?.queued_at === null);
  check('the price shown and the amount chosen are copied', Number(filed?.quoted_fee_min_rwf) === 10000 && Number(filed?.declared_fee_rwf) === 15000);
  const regOrg = reg.json?.orgId;
  const view = await call(rayan, 'GET', `/api/v1/orgs/${regOrg}/psf-membership`);
  check('the registrant sees it waiting for the TIN check', view.json?.open?.stage === 'waiting_tin_check', view.json?.open?.stage);

  const yesTin = tin();
  const yes = await call(rayan, 'POST', '/api/v1/registrations', hotel(yesTin, { psfMember: true, psfMembershipNumber: 'PSF/VERIFY/YES' }));
  check('a Yes with a number is created', yes.status === 201 || yes.status === 200, `${yes.status} ${yes.text.slice(0, 200)}`);
  const declared = (await db.query(
    `SELECT m.source, m.membership_number FROM psf_memberships m JOIN orgs o ON o.id = m.org_id WHERE o.tin = $1`,
    [yesTin],
  )).rows[0];
  check('and records a self declared membership', declared?.source === 'self_declared' && declared?.membership_number === 'PSF/VERIFY/YES');

  const residence = {
    role: 'landlord',
    capacity: 'owner',
    personal,
    business: {
      domain: 'residence',
      legalName: 'ADR-056 Verify Flats',
      address: ADDRESS,
      residenceClass: 'residential_landlord',
      upi: '1/03/07/02/1234',
      psfApplication: form(),
    },
  };
  check('a residence carrying an application is refused', (await call(rayan, 'POST', '/api/v1/registrations', residence)).status === 400);

  const retiredTin = tin();
  await db.query(`UPDATE psf_membership_tiers SET active = false WHERE code = 'indatwa_10k'`);
  try {
    const retired = await call(rayan, 'POST', '/api/v1/registrations', hotel(retiredTin, {
      psfMember: false,
      psfApplication: form({ requestedTierCode: 'indatwa_10k', declaredFeeRwf: 15000, idDocument: { documentType: 'national_id', documentNumber: '1199080123456789' } }),
    }));
    check('a retired tier refuses the whole registration 422', retired.status === 422, `${retired.status} ${retired.text.slice(0, 160)}`);
    const written = (await db.query('SELECT count(*)::int n FROM orgs WHERE tin = $1', [retiredTin])).rows[0].n;
    check('and nothing is written', written === 0, written);
  } finally {
    await db.query(`UPDATE psf_membership_tiers SET active = true WHERE code = 'indatwa_10k'`);
  }

  console.log('\n=== H. Admin: the tier catalogue and the business detail (AC-19, AC-20) ===');
  const admin = await signIn('admin@injishi.com');
  const list = await call(admin, 'GET', '/api/v1/admin/configuration/psf-tiers');
  check('admin reads every tier, retired ones too', list.status === 200 && list.json?.length >= 13, list.status);
  check('a business owner cannot', (await call(yves, 'GET', '/api/v1/admin/configuration/psf-tiers')).status === 403);
  const code = `verify_${Date.now().toString(36)}`;
  const tierBody = {
    code,
    family: 'indatwa',
    nameEn: 'ADR-056 verify tier',
    priceKind: 'fixed',
    annualFeeRwf: 150000,
    benefitsEn: ['A benefit'],
    sortOrder: 900,
    active: true,
    reason: 'ADR-056 verification',
  };
  const created = await call(admin, 'POST', '/api/v1/admin/configuration/psf-tiers', tierBody);
  check('admin adds a tier 201', created.status === 201, `${created.status} ${created.text.slice(0, 160)}`);
  check('the same code twice is refused 409', (await call(admin, 'POST', '/api/v1/admin/configuration/psf-tiers', tierBody)).status === 409);
  check('a price with no amount is refused 400', (await call(admin, 'POST', '/api/v1/admin/configuration/psf-tiers', { ...tierBody, code: `${code}_x`, annualFeeRwf: null })).status === 400);
  const { code: _code, ...patch } = tierBody;
  const retired = await call(admin, 'PATCH', `/api/v1/admin/configuration/psf-tiers/${code}`, { ...patch, active: false });
  check('admin retires it 200', retired.status === 200 && retired.json?.active === false, retired.status);
  const offered = (await call(innocent, 'GET', '/api/v1/psf/tiers')).json ?? [];
  check('a retired tier leaves the form', !offered.some((t) => t.code === code));
  const audited = (await db.query(`SELECT count(*)::int n FROM audit_events WHERE event_type LIKE 'admin.psf_tier.%' AND payload_diff::text LIKE $1`, [`%${code}%`])).rows[0].n;
  check('both writes are on the audit trail', audited === 2, audited);
  await db.query('DELETE FROM psf_membership_tiers WHERE code = $1', [code]);

  const orgDetail = await call(admin, 'GET', `/api/v1/admin/orgs/${UMUCYO}`);
  check('the business detail carries its PSF membership', orgDetail.status === 200 && orgDetail.json?.psf?.membership?.source === 'psf_confirmed', orgDetail.status);
  const apps = orgDetail.json?.psf?.applications ?? [];
  check('and its applications, without the filed form', apps.length > 0 && apps.every((a) => a.form === undefined));
  check('a residence has no PSF section', (await call(admin, 'GET', `/api/v1/admin/orgs/${GREEN_HILLS}`)).json?.psf === null);

  console.log('\n=== I. The officer posting rule (AC-10) ===');
  const target = await userId('grace@demo.injishi.com');
  const grant = (over) =>
    call(admin, 'POST', `/api/v1/admin/users/${target}/oversight`, {
      oversightRole: 'psf_membership_officer',
      governmentBodyCode: 'PSF',
      governmentTitle: 'Membership Officer',
      scopeLevel: 'country',
      reason: 'ADR-056 verification',
      ...over,
    });
  check('refused at another body 422', (await grant({ governmentBodyCode: 'MINALOC' })).status === 422);
  const ok = await grant({});
  check('granted at PSF, country scope 201', ok.status === 201, `${ok.status} ${ok.text.slice(0, 160)}`);
  await db.query(`DELETE FROM oversight_assignments WHERE user_id = $1 AND oversight_role = 'psf_membership_officer'`, [target]);
  // The PSF path: PSF posts officers to a district too, who see that district only.
  const district = await grant({ scopeLevel: 'district', provinceId: 1, districtId: 102 });
  check('granted at PSF, district scope 201', district.status === 201, `${district.status} ${district.text.slice(0, 160)}`);
  await db.query(`DELETE FROM oversight_assignments WHERE user_id = $1 AND oversight_role = 'psf_membership_officer'`, [target]);
};

try {
  await main();
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
