// Verify THE PUBLIC PSF PATH end to end over real HTTP (2026-10-19): a
// business of any sector joins PSF with no account. It checks its National ID,
// sends one form, and pays its first year's membership in one payment (PSF
// reviews only paid applications, 2026-10-20; there is no registration fee,
// 2026-10-23), and keeps a docID; a PSF officer of its district (or its
// province) approves, which makes it a member that day, or declines, which
// keeps the fee (nothing is refunded); and the officer console's report,
// decision log and register read the region the officer covers.
//
// A WRITING verifier, like verify-adr056-psf.mjs: what it proves (a business
// registered, a membership paid for) cannot be observed without making one.
//
// WHAT IT PROVES:
//   A. Catalogues read without a session, and the old account door is closed.
//   B. The ID check: a code to the register's phone, nothing revealed before
//      it, a wrong code counted, the right one revealing the person once.
//   C0. Fees: PSF officers set each band's price; a district officer prices
//      their district only, inside the band, and never the national list; a
//      province officer prices its districts; the form reads the district's.
//   C. The form: an amount that is not PSF's price, a sector outside its district and a
//      spent ID check are each refused; a good form gives a docID, a code from
//      its district's letters, and a place in PSF's queue, with no workspace.
//   D. Tracking: the docID opens it (typed in any case), shows no ID number or
//      birth date, and a docID that does not exist is a 404.
//   E. Officers: Kicukiro sees Kicukiro only; Kigali City (the province) sees
//      Kicukiro and Gasabo but not Musanze, for reporting: only a District
//      Manager decides (2026-10-23), so the province and the nation are refused;
//      approval suggests the next membership number.
//   F. Paid first: approving a paid application makes it a member at once,
//      with its certificate; declining one keeps its fee, and there is no
//      refund anywhere: not on tracking, not for finance.
//   G. The console: the report for the province lists only Kigali's districts,
//      narrows to one, and the decision log shows the approval.
//   H. Branches (2026-10-23): a Kicukiro business with a branch in Gasabo and
//      one in Kicukiro. A branch's sector must sit in its district. The Gasabo
//      officer sees the application for its branch only, admits that branch,
//      and may neither decide the business nor the Kicukiro branch; the
//      Kicukiro officer declines its branch with a reason; tracking shows both.
//   (The logo, 2026-10-23, has its own verifier: verify-psf-logo.mjs, so one
//   run of each stays inside the form's per-address budget.)
//
// WHAT IT LEAVES BEHIND: two PSF businesses per run, named with the run's time.
// Meant for a SAMPLE MARKED database seeded by seed-sample and seed-demo-psf.
//
//   API_BASE=http://127.0.0.1:8000 DATABASE_URL=... node scripts/verify-psf-path.mjs
import pg from 'pg';

const BASE = process.env.API_BASE || 'http://127.0.0.1:8000';
const WEB_ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:3000';
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required (the script reads the seeded ids and checks rows).');
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
const brief = (r) => `${r.status} ${r.text.slice(0, 240)}`;

// --- Sessions ----------------------------------------------------------------

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

/** Sign in with the demo code, then present it again for two-factor (F-S02). */
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

const touchedFees = [];
const RUN = new Date().toISOString().slice(5, 19).replace(/[-T:]/g, '');
const V = '/api/v1';
const pub = (method, path, b) => call(null, method, `${V}${path}`, b);

async function sector(district, offset = 0) {
  return one(
    `SELECT d.id AS district, d.province_id AS province, s.id AS sector FROM sectors s JOIN districts d ON d.id = s.district_id
      WHERE lower(d.name) = lower($1) ORDER BY s.id OFFSET $2 LIMIT 1`,
    [district, offset],
  );
}

/** A fresh National ID the mock register knows: 16 digits, a woman's (the sixth digit 7). */
function nidFor(n) {
  return `11990700${String(Date.now()).slice(-6)}${String(n).padStart(2, '0')}`;
}

async function verifiedToken(n) {
  const look = await pub('POST', '/psf/identity/lookup', { documentNumber: nidFor(n), consent: true });
  if (look.json?.status !== 'code_sent') throw new Error(`lookup failed: ${brief(look)}`);
  const ok = await pub('POST', '/psf/identity/confirm', { checkId: look.json.checkId, code: look.json.demoCode ?? '123456' });
  if (ok.status !== 200) throw new Error(`confirm failed: ${brief(ok)}`);
  return ok.json;
}

function form(token, where, over = {}) {
  return {
    checkToken: token,
    business: {
      legalName: `Verify PSF ${RUN} ${over.suffix ?? ''}`.trim(),
      registrationKind: 'none',
      associationCode: 'acgdr',
      subsectorOther: 'Groceries',
      ownerGroups: ['women'],
      address: { provinceId: where.province, districtId: where.district, sectorId: where.sector, street: 'KK 1 Ave' },
      companyType: 'sole_trader',
      ownership: 'rwandan_100',
      businessActivity: 'Groceries',
      tradeDirection: 'none',
      tradeCountries: [],
      ...(over.business ?? {}),
    },
    membership: { tierCode: 'indatwa_20k', declaredFeeRwf: 30_000, ...(over.membership ?? {}) },
    contact: { role: 'owner', gender: 'female', phoneE164: '+250788123456', email: 'verify.psf@example.test' },
    payerPhoneE164: '+250788123456',
    consent: true,
  };
}

try {
  console.log('A. Catalogues and the closed account door');
  const tiers = await pub('GET', '/psf/tiers');
  check('tiers read without a session', tiers.status === 200 && tiers.json.length >= 6, brief(tiers));
  const legacy = await call(null, 'POST', `${V}/registrations`, { role: 'enterprise' });
  check('the account registration door does not take a PSF business', legacy.status !== 201, brief(legacy));

  console.log('B. The ID check');
  const look = await pub('POST', '/psf/identity/lookup', { documentNumber: nidFor(1), consent: true });
  check('a code goes to the register phone', look.json?.status === 'code_sent' && /•/.test(look.json.sentTo), brief(look));
  check('the lookup reveals nobody', !look.text.includes('fullName') && !look.text.includes('dateOfBirth'));
  const wrong = await pub('POST', '/psf/identity/confirm', { checkId: look.json.checkId, code: '000000' });
  check('a wrong code is refused with tries left', wrong.status === 400 && /tries? left/.test(wrong.text), brief(wrong));
  const right = await pub('POST', '/psf/identity/confirm', { checkId: look.json.checkId, code: look.json.demoCode ?? '123456' });
  check('the right code reveals the person and a token', right.status === 200 && right.json.fullName && right.json.checkToken, brief(right));
  const again = await pub('POST', '/psf/identity/confirm', { checkId: look.json.checkId, code: '123456' });
  check('a code is read back once', again.status === 410, brief(again));

  const kicukiro = await sector('Kicukiro', 1);
  const gasabo = await sector('Gasabo', 2);
  const musanze = await sector('Musanze', 0);

  console.log('C0. Fees');
  // The prices this run changes, put back in `finally` so the demo keeps its own.
  for (const d of [kicukiro.district, gasabo.district]) {
    const was = await one('SELECT annual_fee_rwf::int AS amount, set_by_user_id FROM psf_tier_fees WHERE tier_code = $1 AND district_id = $2', ['indatwa_20k', d]);
    touchedFees.push({ district: d, was });
  }
  const oliFees = await signIn('olivier@demo.injishi.com');
  const alineFees = await signIn('aline@demo.injishi.com');
  const mineFees = await call(oliFees, 'GET', `${V}/oversight/psf/fees`);
  check('a district officer reads their own district’s prices', mineFees.status === 200 && mineFees.json.districtId === kicukiro.district && mineFees.json.canEditDistrict && !mineFees.json.canEditNational, brief(mineFees));
  const natTry = await call(oliFees, 'PUT', `${V}/oversight/psf/fees`, { tierCode: 'indatwa_20k', districtId: null, amountRwf: 30_000 });
  check('a district officer may not set the national price', natTry.status === 403, brief(natTry));
  const gasTry = await call(oliFees, 'PUT', `${V}/oversight/psf/fees`, { tierCode: 'indatwa_20k', districtId: gasabo.district, amountRwf: 30_000 });
  check('nor another district’s', gasTry.status === 403, brief(gasTry));
  const outside = await call(oliFees, 'PUT', `${V}/oversight/psf/fees`, { tierCode: 'indatwa_20k', districtId: kicukiro.district, amountRwf: 60_000 });
  check('a price outside the band is refused at its field', outside.status === 422 && outside.text.includes('amountRwf'), brief(outside));
  const setKic = await call(oliFees, 'PUT', `${V}/oversight/psf/fees`, { tierCode: 'indatwa_20k', districtId: kicukiro.district, amountRwf: 30_000 });
  const kicRow = setKic.json?.rows?.find((r) => r.tierCode === 'indatwa_20k');
  check('a district officer prices a band for their district', setKic.status === 200 && kicRow?.effectiveRwf === 30_000 && kicRow.source === 'district', brief(setKic));
  const setGas = await call(alineFees, 'PUT', `${V}/oversight/psf/fees`, { tierCode: 'indatwa_20k', districtId: gasabo.district, amountRwf: 30_000 });
  check('a province officer prices a district in the province', setGas.status === 200, brief(setGas));
  const formFees = await pub('GET', `/psf/fees?district=${kicukiro.district}`);
  check('the form reads the district’s price', formFees.json?.fees?.find((f) => f.tierCode === 'indatwa_20k')?.amountRwf === 30_000, brief(formFees));
  const otherFees = await pub('GET', `/psf/fees?district=${musanze.district}`);
  check('another district keeps the band’s own price', otherFees.json?.fees?.find((f) => f.tierCode === 'indatwa_20k')?.source !== 'district', brief(otherFees));

  console.log('C. The form');
  const low = await pub('POST', '/psf/applications', form(right.json.checkToken, kicukiro, { membership: { declaredFeeRwf: 25_000 } }));
  check('an amount under the band’s price is refused at its field, and nothing is charged', low.status === 422 && low.text.includes('declaredFeeRwf') && low.text.includes('30,000'), brief(low));
  // A business may pay more than the band's price, up to the top of the
  // band's range in PSF's catalogue (2026-10-23); the top band has no ceiling.
  const ceiling = formFees.json?.fees?.find((f) => f.tierCode === 'indatwa_20k')?.ceilingRwf;
  check('the band’s ceiling is the top of its catalogue range', ceiling === 49_999, String(ceiling));
  check('the Golden Circle has no ceiling', formFees.json?.fees?.find((f) => f.tierCode === 'golden_circle')?.ceilingRwf === null, brief(formFees));
  const high = await pub('POST', '/psf/applications', form(right.json.checkToken, kicukiro, { membership: { declaredFeeRwf: ceiling + 1 } }));
  check('an amount that reaches the next band is refused at its field', high.status === 422 && high.text.includes('declaredFeeRwf'), brief(high));
  const wrongPlace = await pub('POST', '/psf/applications', form(right.json.checkToken, { ...kicukiro, sector: gasabo.sector }));
  check('a sector outside the district is refused', wrongPlace.status === 422 && wrongPlace.text.includes('sectorId'), brief(wrongPlace));
  const sent = await pub('POST', '/psf/applications', form(right.json.checkToken, kicukiro, { suffix: 'Kicukiro' }));
  check('a good form gives a docID and a paid fee', sent.status === 201 && /^PSF-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(sent.json?.docId) && sent.json.feePaid, brief(sent));
  check('the one payment is the membership fee, with no registration fee', sent.json?.totalRwf === 30_000, brief(sent));
  const invoices = await one('SELECT count(*)::int AS n FROM subscription_invoices i JOIN psf_membership_applications a ON a.org_id = i.org_id WHERE a.doc_id = $1', [sent.json?.docId]);
  check('no registration fee bill is written', invoices?.n === 0, String(invoices?.n));
  const prepaid = await one('SELECT paid_at, paid_amount_rwf::int AS amount, payment_ref, status FROM psf_membership_applications WHERE doc_id = $1', [sent.json?.docId]);
  check('the membership fee is held on the application, still with PSF', prepaid?.status === 'submitted' && prepaid.paid_at !== null && prepaid.amount === 30_000 && Boolean(prepaid.payment_ref), JSON.stringify(prepaid));
  check('the code carries the district letters', sent.json?.businessCode?.startsWith('KIC'), brief(sent));
  const spent = await pub('POST', '/psf/applications', form(right.json.checkToken, kicukiro, { suffix: 'twice' }));
  check('an ID check sends one form only', spent.status === 410, brief(spent));
  const org = await one(
    `SELECT o.id, o.registration_status, (SELECT count(*)::int FROM workspaces w WHERE w.org_id = o.id) AS workspaces,
            a.submitted_by_user_id, a.queued_at FROM psf_membership_applications a JOIN orgs o ON o.id = a.org_id WHERE a.doc_id = $1`,
    [sent.json.docId],
  );
  check('the business is active, in the queue, with no workspace and nobody behind it',
    org?.registration_status === 'active' && org.workspaces === 0 && org.submitted_by_user_id === null && org.queued_at !== null,
    JSON.stringify(org));

  const typed = await verifiedToken(3);
  const noName = await pub('POST', '/psf/applications', form(typed.checkToken, kicukiro, { suffix: 'Bees', business: { associationCode: 'agriculture_other' } }));
  check('an association not on the list needs its name', noName.status === 400 && noName.text.includes('associationOther'), brief(noName));
  const named = await pub('POST', '/psf/applications', form(typed.checkToken, kicukiro, { suffix: 'Bees', business: { associationCode: 'agriculture_other', associationOther: 'Rwanda Beekeepers Association' } }));
  const namedTrack = named.status === 201 ? await pub('GET', `/psf/track/${named.json.docId}`) : null;
  check('a typed association is filed under the cluster and shown by name', namedTrack?.json?.business?.associationName === 'Rwanda Beekeepers Association', brief(namedTrack ?? named));

  console.log('C2. Subtypes');
  const national = await pub('GET', '/psf/catalogue');
  const services = national.json?.clusters?.find((c) => c.code === 'services');
  const hospitality = services?.subsectors?.find((x) => x.nameEn === 'Hospitality');
  check('the catalogue carries the national subtypes, with their associations', Boolean(hospitality?.associationCodes?.includes('rha')), brief(national));
  const oli = await signIn('olivier@demo.injishi.com');
  const nationalTry = await call(oli, 'POST', `${V}/oversight/psf/subsectors`, { clusterCode: 'services', nameEn: `Event planning ${RUN}`, districtId: null });
  check('a district officer may not change the national list', nationalTry.status === 403, brief(nationalTry));
  const gasaboTry = await call(oli, 'POST', `${V}/oversight/psf/subsectors`, { clusterCode: 'services', nameEn: `Event planning ${RUN}`, districtId: gasabo.district });
  check('nor add a subtype for another district', gasaboTry.status === 403, brief(gasaboTry));
  const added = await call(oli, 'POST', `${V}/oversight/psf/subsectors`, { clusterCode: 'services', nameEn: `Event planning ${RUN}`, districtId: kicukiro.district, associationCodes: ['rha'] });
  const mine = added.json?.clusters?.find((c) => c.code === 'services')?.subsectors?.find((x) => x.nameEn === `Event planning ${RUN}`);
  check('a district officer adds a subtype for their district', added.status === 201 && mine?.districtId === kicukiro.district && mine.canEdit, brief(added));
  const dupe = await call(oli, 'POST', `${V}/oversight/psf/subsectors`, { clusterCode: 'services', nameEn: `event planning ${RUN}`, districtId: kicukiro.district });
  check('the same name twice in one place is refused', dupe.status === 409, brief(dupe));
  const inKic = await pub('GET', `/psf/catalogue?district=${kicukiro.district}`);
  const inGas = await pub('GET', `/psf/catalogue?district=${gasabo.district}`);
  const has = (r) => Boolean(r.json?.clusters?.find((c) => c.code === 'services')?.subsectors?.some((x) => x.id === mine?.id));
  check('it is offered in Kicukiro and not in Gasabo', has(inKic) && !has(inGas));
  const withSub = await verifiedToken(4);
  const wrongPlace2 = await pub('POST', '/psf/applications', form(withSub.checkToken, gasabo, { suffix: 'Events G', business: { associationCode: 'rha', subsectorOther: undefined, subsectorId: mine?.id } }));
  check('a district subtype is refused outside its district', wrongPlace2.status === 422 && wrongPlace2.text.includes('subsectorId'), brief(wrongPlace2));
  const picked = await pub('POST', '/psf/applications', form(withSub.checkToken, kicukiro, { suffix: 'Events', business: { associationCode: 'rha', subsectorOther: undefined, subsectorId: mine?.id } }));
  const pickedTrack = picked.status === 201 ? await pub('GET', `/psf/track/${picked.json.docId}`) : null;
  check('a picked subtype is filed and shown', pickedTrack?.json?.business?.subsectorName === `Event planning ${RUN}`, brief(pickedTrack ?? picked));
  const hide = await call(oli, 'PATCH', `${V}/oversight/psf/subsectors/${mine?.id}`, { active: false });
  check('the officer can hide it from the form', hide.status === 200 && !has(await pub('GET', `/psf/catalogue?district=${kicukiro.district}`)), brief(hide));
  const typedTrack = await pub('GET', `/psf/track/${sent.json.docId}`);
  check('a typed subtype is shown as typed', typedTrack.json?.business?.subsectorName === 'Groceries', brief(typedTrack));

  console.log('D. Tracking');
  const docId = sent.json.docId;
  const track = await pub('GET', `/psf/track/${docId.toLowerCase().replace(/-/g, '')}`);
  check('the docID opens the tracking page, typed loosely', track.status === 200 && track.json.stage === 'under_review', brief(track));
  check('tracking shows no ID number and no birth date', !/1199070/.test(track.text) && !track.text.includes('dateOfBirth'));
  check('tracking names the district office', track.json?.reviewingOffice?.includes('Kicukiro'), brief(track));
  const kinds = (track.json?.payments ?? []).map((p) => `${p.kind}:${p.amountRwf}`).join(',');
  check('tracking lists the one payment and nothing due', kinds === 'membership_fee:30000' && track.json.dueRwf === null && !('refund' in track.json), kinds);
  const nobody = await pub('GET', '/psf/track/PSF-0000-0000');
  check('a docID that does not exist is a 404', nobody.status === 404, brief(nobody));

  console.log('E. Officers');
  const second = await verifiedToken(2);
  const gas = await pub('POST', '/psf/applications', form(second.checkToken, gasabo, { suffix: 'Gasabo', business: { registrationKind: 'rca', registrationNumber: `RCA/${RUN}` } }));
  check('a Gasabo business is registered', gas.status === 201 && gas.json.businessCode?.startsWith('GAS'), brief(gas));
  const olivier = await signIn('olivier@demo.injishi.com');
  const aline = await signIn('aline@demo.injishi.com');
  const bosco = await signIn('bosco@demo.injishi.com');
  const eric = await signIn('eric@demo.injishi.com');
  const qOlivier = await call(olivier, 'GET', `${V}/oversight/psf-applications`);
  const kicApp = await one('SELECT id FROM psf_membership_applications WHERE doc_id = $1', [docId]);
  const gasApp = await one('SELECT id FROM psf_membership_applications WHERE doc_id = $1', [gas.json.docId]);
  check('Kicukiro sees its own application', qOlivier.json?.items?.some((i) => i.applicationId === kicApp.id), brief(qOlivier));
  check('Kicukiro does not see Gasabo', !qOlivier.json?.items?.some((i) => i.applicationId === gasApp.id));
  check('queue rows carry the docID and days waiting', qOlivier.json?.items?.every((i) => typeof i.waitingDays === 'number'));
  check('the queue counts what matches and shows the amount paid', qOlivier.json?.total >= 1 && qOlivier.json.items.find((i) => i.applicationId === kicApp.id)?.paidRwf === 30_000, brief(qOlivier));
  const newest = qOlivier.json?.items?.map((i) => i.queuedAt ?? i.submittedAt) ?? [];
  check('the queue is newest first by default', newest.every((t, i) => i === 0 || newest[i - 1] >= t));
  const oldest = await call(olivier, 'GET', `${V}/oversight/psf-applications?sort=oldest`);
  const oldestAt = oldest.json?.items?.map((i) => i.queuedAt ?? i.submittedAt) ?? [];
  check('and longest waiting first when asked', oldestAt.length > 1 && oldestAt.every((t, i) => i === 0 || oldestAt[i - 1] <= t), brief(oldest));
  const found = await call(olivier, 'GET', `${V}/oversight/psf-applications?q=${encodeURIComponent(docId)}`);
  check('search finds an application by its docID', found.json?.total === 1 && found.json.items[0]?.applicationId === kicApp.id, brief(found));
  const bySector = await call(olivier, 'GET', `${V}/oversight/psf-applications?cluster=industry`);
  check('the sector filter leaves out a trade business', !bySector.json?.items?.some((i) => i.applicationId === kicApp.id), brief(bySector));
  const hist = await call(olivier, 'GET', `${V}/oversight/psf-applications/${kicApp.id}/history`);
  check('the detail panel reads the business\'s payments and applications',
    hist.status === 200 && hist.json.payments.length === 1 && hist.json.applications.some((a) => a.id === kicApp.id), brief(hist));
  const histOut = await call(olivier, 'GET', `${V}/oversight/psf-applications/${gasApp.id}/history`);
  check('and not those of a business outside the district', histOut.status === 404, brief(histOut));
  const scope = await call(aline, 'GET', `${V}/oversight/psf/scope`);
  check('Aline is posted to Kigali City', scope.json?.level === 'province' && scope.json.label === 'Kigali City', brief(scope));
  check('Kigali City lists its three districts', scope.json?.provinces?.[0]?.districts?.length === 3, brief(scope));
  const qAline = await call(aline, 'GET', `${V}/oversight/psf-applications`);
  check('the province sees Kicukiro and Gasabo', [kicApp.id, gasApp.id].every((id) => qAline.json?.items?.some((i) => i.applicationId === id)), brief(qAline));
  const musanzeApp = await one(
    `SELECT a.id FROM psf_membership_applications a JOIN orgs o ON o.id = a.org_id JOIN districts d ON d.id = o.district_id
      WHERE lower(d.name) = 'musanze' AND a.status = 'submitted' LIMIT 1`);
  if (musanzeApp) {
    const out = await call(aline, 'GET', `${V}/oversight/psf-applications/${musanzeApp.id}`);
    check('the province gets a 404 outside Kigali', out.status === 404, brief(out));
  }
  const narrowed = await call(aline, 'GET', `${V}/oversight/psf-applications?district=${gasabo.district}`);
  check('the switcher narrows the queue to Gasabo', narrowed.json?.items?.length > 0 && narrowed.json.items.every((i) => i.districtId === gasabo.district), brief(narrowed));
  const detail = await call(aline, 'GET', `${V}/oversight/psf-applications/${gasApp.id}`);
  check('the approve dialog gets the next Gasabo number', /^PSF\/GAS\/\d{4}\/\d{4}$/.test(detail.json?.suggestedMembershipNumber ?? ''), brief(detail));
  const used = await one(
    `SELECT count(*)::int AS n FROM (SELECT approved_membership_number AS x FROM psf_membership_applications UNION ALL SELECT membership_number FROM psf_memberships) t WHERE x = $1`,
    [detail.json?.suggestedMembershipNumber],
  );
  check('the suggested number is not given to anyone yet', used.n === 0, String(used.n));
  const taken = await one(`SELECT approved_membership_number AS x FROM psf_membership_applications WHERE approved_membership_number LIKE 'PSF/GAS/%' LIMIT 1`);
  if (taken) {
    const dup = await call(bosco, 'POST', `${V}/oversight/psf-applications/${gasApp.id}/approve`, { membershipNumber: taken.x });
    check('a membership number already given is refused at its field', dup.status === 422 && dup.text.includes('membershipNumber'), brief(dup));
  }
  check('the approve dialog knows it was paid before review', detail.json?.paidBeforeReview === true && detail.json.payment?.amountRwf === 30_000, brief(detail));

  console.log('F. Paid first: approve makes a member, decline keeps the fee');
  // Approval is a district's (2026-10-23): the province and the nation read and report.
  check('the province manager reads it but may not decide it', detail.json?.canDecide === false && detail.json.decidesHere === false, brief(detail));
  const provinceTry = await call(aline, 'POST', `${V}/oversight/psf-applications/${gasApp.id}/approve`, { membershipNumber: detail.json.suggestedMembershipNumber });
  check('the province manager is refused an approval', provinceTry.status === 403 && /District Manager/.test(provinceTry.text), brief(provinceTry));
  const nationTry = await call(eric, 'POST', `${V}/oversight/psf-applications/${gasApp.id}/decline`, { reason: 'details_incomplete' });
  check('and so is the national manager a decline', nationTry.status === 403, brief(nationTry));
  const gasDetailE = await call(bosco, 'GET', `${V}/oversight/psf-applications/${gasApp.id}`);
  check('Gasabo’s District Manager decides it', gasDetailE.json?.canDecide === true && gasDetailE.json.decidesHere === true, brief(gasDetailE));
  const approve = await call(bosco, 'POST', `${V}/oversight/psf-applications/${gasApp.id}/approve`, { membershipNumber: detail.json.suggestedMembershipNumber });
  check('Gasabo’s District Manager approves a paid application, and it is a member at once', approve.status === 200 && approve.json.status === 'member', brief(approve));
  const memberTrack = await pub('GET', `/psf/track/${gas.json.docId}`);
  check('tracking shows the certificate with the number and a year',
    memberTrack.json?.stage === 'member' && memberTrack.json.membership?.number === detail.json.suggestedMembershipNumber && Boolean(memberTrack.json.membership.expiresOn),
    brief(memberTrack));
  const pdf = await fetch(`${BASE}${V}/psf/track/${gas.json.docId}/certificate`);
  const pdfBytes = Buffer.from(await pdf.arrayBuffer());
  check('the certificate downloads as a PDF', pdf.status === 200 && pdf.headers.get('content-type') === 'application/pdf' && pdfBytes.subarray(0, 4).toString() === '%PDF', String(pdf.status));
  const mailed = await pub('POST', `/psf/track/${gas.json.docId}/certificate/email`);
  check('and goes to the email the application gave, masked', mailed.status === 200 && /•/.test(mailed.json?.sentTo ?? ''), brief(mailed));
  const officerPdf = await fetch(`${BASE}${V}/oversight/psf-applications/${gasApp.id}/certificate`, { headers: { cookie: aline.cookie(), origin: WEB_ORIGIN } });
  check('an officer of the region downloads it too', officerPdf.status === 200 && officerPdf.headers.get('content-type') === 'application/pdf', String(officerPdf.status));
  const outsiderPdf = await fetch(`${BASE}${V}/oversight/psf-applications/${gasApp.id}/certificate`, { headers: { cookie: olivier.cookie(), origin: WEB_ORIGIN } });
  check('an officer of another district does not', outsiderPdf.status === 404, String(outsiderPdf.status));
  const noCert = await pub('GET', `/psf/track/${docId}/certificate`);
  check('an application still with PSF has no certificate yet', noCert.status === 409, brief(noCert));
  const count = await one('SELECT count(*)::int AS n FROM psf_memberships m JOIN psf_membership_applications a ON a.id = m.application_id WHERE a.doc_id = $1', [gas.json.docId]);
  check('one membership is written', count.n === 1, String(count.n));
  const payAgain = await pub('POST', `/psf/track/${gas.json.docId}/pay`, { phoneE164: '+250788123456' });
  check('there is nothing left to pay', payAgain.status !== 200 || payAgain.json?.status !== 'paid' || payAgain.json.view.payments.length === 1, brief(payAgain));

  const decline = await call(olivier, 'POST', `${V}/oversight/psf-applications/${kicApp.id}/decline`, { reason: 'details_incomplete', note: 'The street address does not match.' });
  check('Kicukiro declines a paid application', decline.status === 200 && decline.json.status === 'declined', brief(decline));
  const declinedTrack = await pub('GET', `/psf/track/${docId}`);
  check('tracking shows the decline, and the fee paid is kept: nothing is refunded',
    declinedTrack.json?.stage === 'declined' && !('refund' in declinedTrack.json) &&
      declinedTrack.json.payments.length === 1 && declinedTrack.json.payments[0].kind === 'membership_fee' &&
      !declinedTrack.json.events.some((e) => /refund/i.test(e.kind)),
    brief(declinedTrack));
  const admin = await signIn('admin@injishi.com');
  const refunds = await call(admin, 'GET', `${V}/admin/psf/refunds`);
  check('finance has no PSF refunds to release', refunds.status === 404, brief(refunds));

  console.log('G. The console');
  const today = new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 10);
  const from = `${today.slice(0, 4)}-01-01`;
  const report = await call(aline, 'GET', `${V}/oversight/psf/report?from=${from}&to=${today}`);
  check('the province report reads', report.status === 200 && report.json.regionLabel === 'Kigali City', brief(report));
  check('its district table is Kigali only', report.json?.districts?.length === 3 && report.json.districts.every((d) => d.provinceName === 'Kigali City'), brief(report));
  check('it counts this run’s approval', report.json?.kpis?.approved?.value >= 1);
  check('the chart has twelve months or more', report.json?.months?.length >= 12, String(report.json?.months?.length));
  const narrowReport = await call(aline, 'GET', `${V}/oversight/psf/report?from=${from}&to=${today}&district=${kicukiro.district}`);
  check('the report narrows to Kicukiro', narrowReport.json?.regionLabel === 'Kicukiro district' && narrowReport.json.districts.length === 1, brief(narrowReport));
  const oReport = await call(olivier, 'GET', `${V}/oversight/psf/report?from=${from}&to=${today}&district=${gasabo.district}`);
  check('a district officer cannot widen to another district', oReport.json?.now?.waiting === 0 && oReport.json.districts.length === 0, brief(oReport));
  const decisions = await call(aline, 'GET', `${V}/oversight/psf/decisions`);
  check('the decision log shows the approval, paid', decisions.json?.items?.some((d) => d.applicationId === gasApp.id && d.paid), brief(decisions));
  const runDecisions = await call(aline, 'GET', `${V}/oversight/psf/decisions?q=${encodeURIComponent(`Verify PSF ${RUN}`)}`);
  check('the decision log searches by name', runDecisions.json?.items?.length >= 2 && runDecisions.json.items.every((d) => d.businessName.includes(RUN)), brief(runDecisions));
  const declinedLog = await call(aline, 'GET', `${V}/oversight/psf/decisions?outcome=declined&q=${encodeURIComponent(docId)}`);
  check('and shows the decline, with no refund on it', declinedLog.json?.items?.[0]?.outcome === 'declined' && !('refundStatus' in declinedLog.json.items[0]), brief(declinedLog));
  const decidedOpen = await call(aline, 'GET', `${V}/oversight/psf-applications/${kicApp.id}`);
  check('a decided application still opens, and cannot be decided again', decidedOpen.status === 200 && decidedOpen.json.canDecide === false, brief(decidedOpen));
  const register = await call(aline, 'GET', `${V}/oversight/psf/businesses?province=${kicukiro.province}`);
  check('the register narrows to the province', register.status === 200 && register.json.total > 0, brief(register));
  void musanze;

  console.log('H. Branches');
  const third = await verifiedToken(3);
  const branchForm = (branches) =>
    form(third.checkToken, kicukiro, { suffix: 'Branches', business: { branches }, membership: { declaredFeeRwf: ceiling } });
  // A branch has no name of its own: it trades under the business's.
  const gasBranch = { address: { provinceId: gasabo.province, districtId: gasabo.district, sectorId: gasabo.sector, street: 'KG 9 Ave' } };
  const kicBranch = { address: { provinceId: kicukiro.province, districtId: kicukiro.district, sectorId: kicukiro.sector, street: 'KK 30 Rd' } };
  const misplaced = await pub('POST', '/psf/applications', branchForm([{ ...gasBranch, address: { ...gasBranch.address, sectorId: kicukiro.sector } }]));
  check('a branch whose sector is outside its district is refused at its field', misplaced.status === 422 && misplaced.text.includes('branches'), brief(misplaced));
  const twice = await pub('POST', '/psf/applications', branchForm([gasBranch, { address: { ...gasBranch.address, street: ' kg  9 AVE ' } }]));
  check('the same place listed twice is refused', twice.status === 400 && twice.text.includes('branches'), brief(twice));
  const atHead = await pub('POST', '/psf/applications', branchForm([{ address: { provinceId: kicukiro.province, districtId: kicukiro.district, sectorId: kicukiro.sector, street: 'KK 1 Ave' } }]));
  check('a branch at the head office is refused', atHead.status === 400 && atHead.text.includes('branches'), brief(atHead));
  const withBranches = await pub('POST', '/psf/applications', branchForm([gasBranch, kicBranch]));
  check('a business with two branches is registered', withBranches.status === 201 && withBranches.json.businessCode?.startsWith('KIC'), brief(withBranches));
  check('it paid the top of its band, not the band’s price', withBranches.json?.totalRwf === ceiling && withBranches.json.feePaid === true, brief(withBranches));
  const brApp = await one('SELECT id FROM psf_membership_applications WHERE doc_id = $1', [withBranches.json?.docId]);
  const rows = await db.query('SELECT district_id, status FROM psf_application_branches WHERE application_id = $1', [brApp?.id]);
  check('both branches are filed, waiting on PSF', rows.rows.length === 2 && rows.rows.every((r) => r.status === 'pending'), JSON.stringify(rows.rows));
  const qBosco = await call(bosco, 'GET', `${V}/oversight/psf-applications`);
  const brItem = qBosco.json?.items?.find((i) => i.applicationId === brApp.id);
  check('Gasabo’s queue shows the Kicukiro business for its branch', brItem?.headOfficeInScope === false && brItem.branchesPending === 1, brief(qBosco));
  const bDetail = await call(bosco, 'GET', `${V}/oversight/psf-applications/${brApp.id}`);
  const bGas = bDetail.json?.branches?.find((b) => b.districtId === gasabo.district);
  const bKic = bDetail.json?.branches?.find((b) => b.districtId === kicukiro.district);
  check('Gasabo may decide its branch and not the business', bDetail.status === 200 && bDetail.json.headOfficeInScope === false && bDetail.json.canDecide === false && bGas?.canDecide === true && bKic?.canDecide === false, brief(bDetail));
  const bApprove = await call(bosco, 'POST', `${V}/oversight/psf-applications/${brApp.id}/approve`, { membershipNumber: 'PSF/GAS/2099/9999' });
  check('Gasabo cannot approve the Kicukiro business', bApprove.status === 404, brief(bApprove));
  const bare = await call(bosco, 'POST', `${V}/oversight/psf-applications/${brApp.id}/branches/${bGas?.id}/decision`, { decision: 'decline' });
  check('a branch decline without a reason is refused', bare.status === 400 && bare.text.includes('note'), brief(bare));
  const admit = await call(bosco, 'POST', `${V}/oversight/psf-applications/${brApp.id}/branches/${bGas?.id}/decision`, { decision: 'admit' });
  check('Gasabo admits its branch', admit.status === 200 && admit.json.branches.find((b) => b.id === bGas?.id)?.status === 'admitted', brief(admit));
  const admitAgain = await call(bosco, 'POST', `${V}/oversight/psf-applications/${brApp.id}/branches/${bGas?.id}/decision`, { decision: 'admit' });
  check('a decided branch is a 409', admitAgain.status === 409, brief(admitAgain));
  const notHis = await call(bosco, 'POST', `${V}/oversight/psf-applications/${brApp.id}/branches/${bKic?.id}/decision`, { decision: 'admit' });
  check('Gasabo cannot decide the Kicukiro branch', notHis.status === 404, brief(notHis));
  const oDetail = await call(olivier, 'GET', `${V}/oversight/psf-applications/${brApp.id}`);
  check('Kicukiro decides the business and its own branch', oDetail.json?.headOfficeInScope === true && oDetail.json.canDecide === true && oDetail.json.branches.find((b) => b.id === bKic?.id)?.canDecide === true, brief(oDetail));
  const oDecline = await call(olivier, 'POST', `${V}/oversight/psf-applications/${brApp.id}/branches/${bKic?.id}/decision`, { decision: 'decline', note: 'No trading licence for this address.' });
  check('Kicukiro declines its branch with a reason', oDecline.status === 200 && oDecline.json.branches.find((b) => b.id === bKic?.id)?.status === 'declined', brief(oDecline));
  const bTrack = await pub('GET', `/psf/track/${withBranches.json?.docId}`);
  const tracked = bTrack.json?.business?.branches ?? [];
  check('tracking shows each branch and where it stands', tracked.length === 2 && tracked.some((b) => b.districtName === 'Gasabo' && b.status === 'admitted') && tracked.some((b) => b.districtName === 'Kicukiro' && b.status === 'declined' && b.note), brief(bTrack));
  // Seeing every branch (2026-10-23): the national manager reads them all, and
  // Gasabo's manager discovers the Kicukiro business through its branch.
  const brOrg = await one('SELECT org_id FROM psf_membership_applications WHERE id = $1', [brApp.id]);
  const nat = await call(eric, 'GET', `${V}/oversight/psf/businesses/${brOrg.org_id}`);
  check('the national manager sees the business and both its branches, with where each is',
    nat.status === 200 && nat.json.business.branchCount === 2 && nat.json.branches.length === 2 &&
      nat.json.branches.every((b) => b.districtName && b.sectorName && b.street && b.provinceName && b.inScope),
    brief(nat));
  const gasReg = await call(bosco, 'GET', `${V}/oversight/psf/businesses?q=${encodeURIComponent(`Verify PSF ${RUN} Branches`)}`);
  const gasRow = gasReg.json?.items?.find((i) => i.orgId === brOrg.org_id);
  check('Gasabo’s register lists it for its branch there', gasRow?.headOfficeInScope === false && gasRow.branchCount === 2, brief(gasReg));
  const gasDetail = await call(bosco, 'GET', `${V}/oversight/psf/businesses/${brOrg.org_id}`);
  check('and Gasabo opens it and sees every branch, its own marked',
    gasDetail.status === 200 && gasDetail.json.business.headOfficeInScope === false && gasDetail.json.branches.length === 2 &&
      gasDetail.json.branches.filter((b) => b.inScope).map((b) => b.districtName).join() === 'Gasabo',
    brief(gasDetail));
  const kicDetail = await call(olivier, 'GET', `${V}/oversight/psf/businesses/${brOrg.org_id}`);
  check('Kicukiro, its head office, sees both branches too', kicDetail.status === 200 && kicDetail.json.business.headOfficeInScope === true && kicDetail.json.branches.length === 2, brief(kicDetail));

} catch (error) {
  fail += 1;
  console.log(`  FAIL  ${error instanceof Error ? error.message : String(error)}`);
} finally {
  for (const t of touchedFees) {
    if (t.was) {
      await db.query('UPDATE psf_tier_fees SET annual_fee_rwf = $3, set_by_user_id = $4 WHERE tier_code = $1 AND district_id = $2', ['indatwa_20k', t.district, t.was.amount, t.was.set_by_user_id]);
    } else {
      await db.query('DELETE FROM psf_tier_fees WHERE tier_code = $1 AND district_id = $2', ['indatwa_20k', t.district]);
    }
  }
  await db.end();
}

console.log(`\n${pass} passed, ${fail} failed.`);
if (fail) {
  console.log(`Failed: ${failures.join('; ')}`);
  process.exitCode = 1;
}
