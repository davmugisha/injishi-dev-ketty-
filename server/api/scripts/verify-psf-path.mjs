// Verify THE PSF PATH end to end over real HTTP: a business of any sector
// registers on Injishi with or without a TIN, gets its district code, applies
// for PSF membership in the band it can afford, a PSF officer of its district
// approves, the business pays through Injishi, and the officer's register reads
// the district by sector, standing and owner group.
//
// A WRITING verifier, like verify-adr056-psf.mjs, because what it proves (a
// business registered, a membership paid for) cannot be observed without
// making one. Every assertion is a real request over a real session.
//
// WHAT IT PROVES:
//   A. PSF's price list and sectors read without a session, and the PSF path
//      is priced on its own fee row.
//   B. Registration: a business registered nowhere, a cooperative with an RCA
//      number, and one with a TIN each register and become active on payment
//      with a code from their district's letters; an association off PSF's
//      list is refused at its field; the owner's grant may manage PSF.
//   C. Applying: the amount must sit inside the band, a second open
//      application is refused.
//   D. Officers: a Kicukiro officer sees Kicukiro and nothing else, a country
//      officer sees everything; approving names the number and keeps the
//      business's amount; an approval is not made twice.
//   E. Paying: the fee is charged once, the payment makes a membership of a
//      year, and paying again charges nothing.
//   F. The register: scoped, filtered by sector, standing, owner group, TIN and
//      search, and summarised for the officer's region.
//   G. Admin reads the sector catalogue.
//
// WHAT IT LEAVES BEHIND: three PSF businesses per run, named with the run's
// time, owned by the demo persona Chantal, one of them a paid member. Meant
// for a SAMPLE MARKED database seeded by seed-sample and seed-demo-psf.
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

const RUN = new Date().toISOString().slice(5, 19).replace(/[-T:]/g, '');
const KICUKIRO = { country: 'RW', provinceId: 1, districtId: 103, sectorId: 10303, street: 'KK 15 Rd, Gikondo' };
const GASABO = { country: 'RW', provinceId: 1, districtId: 102, sectorId: 10204, street: 'KG 9 Ave, Gisozi' };
const PERSONAL = {
  fullName: 'Chantal Mukandayisenga',
  gender: 'female',
  dateOfBirth: '1990-06-14',
  phoneE164: '+250788056001',
  address: KICUKIRO,
};

const FORM = {
  requestedTierCode: 'indatwa_100k',
  declaredFeeRwf: 150000,
  companyName: '',
  streetAddress: 'KK 15 Rd, Gikondo',
  companyType: 'sole_trader',
  ownership: 'rwandan_100',
  businessActivity: 'Metal fabrication',
  tradeDirection: 'none',
  tradeCountries: [],
  contactRole: 'owner',
  firstName: 'Chantal',
  lastName: 'Mukandayisenga',
  gender: 'female',
  phoneE164: '+250788056001',
  email: 'chantal@demo.injishi.com',
  useDocumentOnFile: true,
  dateOfBirth: '1990-06-14',
  consent: true,
};

try {
  const chantal = await signIn('chantal@demo.injishi.com');
  const olivier = await signIn('olivier@demo.injishi.com');
  const eric = await signIn('eric@demo.injishi.com');

  // --- A. The public price list ---------------------------------------------
  console.log('\nA. PSF’s price list and sectors');
  {
    const tiers = await call(null, 'GET', '/api/v1/psf/tiers');
    check('the tiers read without a session', tiers.status === 200, brief(tiers));
    check('six tiers, Golden Circle first, from 5,000,000 with no ceiling',
      tiers.json?.length === 6 && tiers.json[0].code === 'golden_circle' && tiers.json[0].priceKind === 'minimum'
        && tiers.json[0].annualFeeMinRwf === 5_000_000 && tiers.json[0].annualFeeMaxRwf === null);
    check('Indatwa comes in four bands',
      tiers.json?.filter((t) => t.family === 'indatwa').length === 4);
    const catalogue = await call(null, 'GET', '/api/v1/psf/catalogue');
    check('the sectors read without a session: four clusters, metal works in Industry',
      catalogue.status === 200 && catalogue.json?.clusters?.length === 4
        && catalogue.json.clusters.find((c) => c.code === 'industry')?.associations.some((a) => a.code === 'apromet'),
      brief(catalogue));
    const fee = await call(null, 'GET', '/api/v1/registrations/fee?businessType=enterprise');
    check('the PSF path costs 5,000 to register', fee.status === 200 && fee.json?.amountRwf === 5000, brief(fee));
  }

  // --- B. Registering ---------------------------------------------------------
  console.log('\nB. Registering through the PSF path');
  const register = async (business) => {
    const created = await call(chantal, 'POST', '/api/v1/registrations', {
      role: 'enterprise',
      personal: PERSONAL,
      business: { domain: 'enterprise', ownerGroups: ['women'], associationCode: 'apromet', ...business },
    });
    if (created.status !== 201 && created.status !== 200) return { created, paid: null };
    const paid = await call(chantal, 'POST', `/api/v1/registrations/${created.json.orgId}/pay`);
    return { created, paid };
  };

  const refused = await call(chantal, 'POST', '/api/v1/registrations', {
    role: 'enterprise',
    personal: PERSONAL,
    business: { domain: 'enterprise', legalName: `Verify Off List ${RUN}`, address: KICUKIRO, registrationKind: 'none', associationCode: 'no_such_association' },
  });
  check('an association off PSF’s list is refused at its field',
    refused.status === 422 && refused.text.includes('associationCode'), brief(refused));

  const workshop = await register({ legalName: `Verify Workshop ${RUN}`, address: KICUKIRO, registrationKind: 'none' });
  check('a business registered nowhere is created owing its fee, with no code yet',
    workshop.created.json?.status === 'pending_payment' && workshop.created.json?.businessCode === null
      && workshop.created.json?.amountDueRwf === 5000,
    brief(workshop.created));
  check('paying registers it at once, with a Kicukiro code',
    workshop.paid?.json?.status === 'active' && /^KIC\d{4,}$/.test(workshop.paid?.json?.businessCode ?? ''),
    workshop.paid ? brief(workshop.paid) : 'not paid');
  const workshopId = workshop.created.json?.orgId;

  const coop = await register({
    legalName: `Verify Cooperative ${RUN}`, address: GASABO, registrationKind: 'rca', registrationNumber: `RCA/${RUN}`,
    associationCode: 'rta', ownerGroups: ['youth', 'women'],
  });
  check('a cooperative with an RCA number registers in Gasabo with a GAS code',
    coop.paid?.json?.status === 'active' && /^GAS\d{4,}$/.test(coop.paid?.json?.businessCode ?? ''),
    coop.paid ? brief(coop.paid) : brief(coop.created));

  const tin = `9990${RUN.slice(-5)}`;
  const trader = await register({ legalName: `Verify Trader ${RUN}`, address: KICUKIRO, registrationKind: 'tin', tin, associationCode: 'acgdr', ownerGroups: [] });
  check('a business with a TIN is checked with RRA and registered',
    trader.paid?.json?.status === 'active', trader.paid ? brief(trader.paid) : brief(trader.created));
  const traderCheck = await one('SELECT result FROM tin_verifications WHERE org_id = $1', [trader.created.json?.orgId]);
  check('the RRA check is on file', traderCheck?.result === 'verified');

  const codes = [workshop.paid?.json?.businessCode, trader.paid?.json?.businessCode];
  check('two Kicukiro businesses draw consecutive numbers',
    codes.every(Boolean) && Number(codes[1].slice(3)) === Number(codes[0].slice(3)) + 1, codes.join(' '));

  const ws = await call(chantal, 'GET', '/api/v1/me/workspaces');
  const seat = ws.json?.workspaces?.find((w) => w.orgId === workshopId);
  check('the owner’s seat is a PSF business that may manage its membership',
    seat?.domain === 'enterprise' && seat?.psfMembership?.canManage === true, JSON.stringify(seat ?? null).slice(0, 200));

  // --- C. Applying ------------------------------------------------------------
  console.log('\nC. Applying for membership');
  const overview = await call(chantal, 'GET', `/api/v1/orgs/${workshopId}/psf-membership`);
  check('the portal shows PSF the code, the sector and the owner group',
    overview.status === 200 && overview.json?.profile?.businessCode === workshop.paid?.json?.businessCode
      && overview.json?.profile?.clusterName === 'Industry' && overview.json?.profile?.ownerGroups?.includes('women')
      && overview.json?.canApply === true,
    brief(overview));
  check('a business registered nowhere files with no registration number', overview.json?.registrationNumber === '');

  const tooLittle = await call(chantal, 'POST', `/api/v1/orgs/${workshopId}/psf-applications`, {
    ...FORM, companyName: `Verify Workshop ${RUN}`, declaredFeeRwf: 90000,
  });
  check('an amount below the band is refused at its field',
    tooLittle.status === 422 && tooLittle.text.includes('declaredFeeRwf'), brief(tooLittle));
  const applied = await call(chantal, 'POST', `/api/v1/orgs/${workshopId}/psf-applications`, {
    ...FORM, companyName: `Verify Workshop ${RUN}`,
  });
  check('an amount inside the band is filed, straight into PSF’s queue',
    applied.status === 201 && applied.json?.open?.status === 'submitted' && applied.json?.open?.stage === 'with_psf'
      && applied.json?.open?.declaredFeeRwf === 150000,
    brief(applied));
  const twice = await call(chantal, 'POST', `/api/v1/orgs/${workshopId}/psf-applications`, {
    ...FORM, companyName: `Verify Workshop ${RUN}`,
  });
  check('a second open application is refused', twice.status === 409, brief(twice));
  const applicationId = applied.json?.open?.id;

  // --- D. Officers --------------------------------------------------------------
  console.log('\nD. The officers');
  const gisozi = await one(
    `SELECT a.id FROM psf_membership_applications a JOIN orgs o ON o.id = a.org_id
      WHERE o.legal_name = 'Gisozi Furniture Works' AND a.status = 'submitted' LIMIT 1`,
  );
  const kicukiroQueue = await call(olivier, 'GET', '/api/v1/oversight/psf-applications');
  const kicukiroIds = (kicukiroQueue.json?.items ?? []).map((i) => i.applicationId);
  check('the Kicukiro officer’s queue holds the new application',
    kicukiroQueue.status === 200 && kicukiroIds.includes(applicationId), brief(kicukiroQueue));
  check('and holds nothing from outside Kicukiro',
    (kicukiroQueue.json?.items ?? []).every((i) => i.districtName === 'Kicukiro') && !kicukiroIds.includes(gisozi?.id));
  const countryQueue = await call(eric, 'GET', '/api/v1/oversight/psf-applications');
  const countryIds = (countryQueue.json?.items ?? []).map((i) => i.applicationId);
  check('the country officer sees both', countryIds.includes(applicationId) && countryIds.includes(gisozi?.id), brief(countryQueue));
  const row = (kicukiroQueue.json?.items ?? []).find((i) => i.applicationId === applicationId);
  check('a queue row carries the code, the association and the amount',
    row?.businessCode === workshop.paid?.json?.businessCode && row?.associationName === 'Metal Works Association'
      && row?.declaredFeeRwf === 150000 && row?.domain === 'enterprise');

  const outside = await call(olivier, 'GET', `/api/v1/oversight/psf-applications/${gisozi?.id}`);
  check('a Gasabo application is not found for the Kicukiro officer', outside.status === 404, brief(outside));
  const outsideApprove = await call(olivier, 'POST', `/api/v1/oversight/psf-applications/${gisozi?.id}/approve`, { membershipNumber: 'X' });
  check('nor can that officer approve it', outsideApprove.status === 404, brief(outsideApprove));

  const approved = await call(olivier, 'POST', `/api/v1/oversight/psf-applications/${applicationId}/approve`, {
    membershipNumber: `PSF/KIC/${RUN}`,
  });
  check('approving names the number and keeps the business’s amount',
    approved.status === 200 && approved.json?.status === 'approved' && approved.json?.approvedFeeRwf === 150000
      && approved.json?.approvedMembershipNumber === `PSF/KIC/${RUN}` && approved.json?.canDecide === false,
    brief(approved));
  const again = await call(eric, 'POST', `/api/v1/oversight/psf-applications/${applicationId}/approve`, { membershipNumber: 'Y' });
  check('an approved application is not approved twice', again.status === 409, brief(again));

  // --- E. Paying ------------------------------------------------------------------
  console.log('\nE. Paying the membership');
  const waiting = await call(chantal, 'GET', `/api/v1/orgs/${workshopId}/psf-membership`);
  check('the business reads that it is approved and owes its fee', waiting.json?.open?.stage === 'awaiting_payment');
  const badPhone = await call(chantal, 'POST', `/api/v1/orgs/${workshopId}/psf-applications/${applicationId}/pay`, { phoneE164: '+254712345678' });
  check('a number that is not Rwandan mobile money is refused', badPhone.status === 400, brief(badPhone));
  const paid = await call(chantal, 'POST', `/api/v1/orgs/${workshopId}/psf-applications/${applicationId}/pay`, { phoneE164: '+250788056001' });
  const current = paid.json?.current;
  check('paying makes it a member, with PSF’s number, for the amount paid',
    paid.status === 200 && current?.membershipNumber === `PSF/KIC/${RUN}` && current?.annualFeeRwf === 150000 && paid.json?.open === null,
    brief(paid));
  const start = current?.startsOn ? new Date(`${current.startsOn}T00:00:00Z`) : null;
  const expected = start ? new Date(Date.UTC(start.getUTCFullYear() + 1, start.getUTCMonth(), start.getUTCDate() - 1)).toISOString().slice(0, 10) : null;
  check('the membership runs a year less a day from the payment', current?.expiresOn === expected, `${current?.startsOn} → ${current?.expiresOn}`);
  const receipt = paid.json?.history?.find((h) => h.id === applicationId)?.payment;
  check('the application carries the payment and its reference', receipt?.amountRwf === 150000 && Boolean(receipt?.reference));
  const payAgain = await call(chantal, 'POST', `/api/v1/orgs/${workshopId}/psf-applications/${applicationId}/pay`, { phoneE164: '+250788056001' });
  const memberships = await one('SELECT count(*)::int AS n FROM psf_memberships WHERE org_id = $1', [workshopId]);
  check('paying again charges nothing and writes nothing', payAgain.status === 200 && memberships?.n === 1, `${payAgain.status}, ${memberships?.n} memberships`);
  const flag = await one('SELECT psf_member FROM orgs WHERE id = $1', [workshopId]);
  check('the business is flagged a PSF member', flag?.psf_member === true);

  // --- F. The register --------------------------------------------------------------
  console.log('\nF. The officer’s register');
  const list = async (s, query = '') => call(s, 'GET', `/api/v1/oversight/psf/businesses${query}`);
  const all = await list(olivier);
  check('the Kicukiro register lists Kicukiro only',
    all.status === 200 && all.json?.total > 0 && all.json.items.every((b) => b.districtName === 'Kicukiro'), brief(all));
  const mine = all.json?.items?.find((b) => b.orgId === workshopId);
  check('the new business is listed as a member, with its tier and number',
    mine?.standing === 'member' && mine?.tierName?.startsWith('Indatwa') && mine?.membershipNumber === `PSF/KIC/${RUN}`
      && mine?.clusterName === 'Industry',
    JSON.stringify(mine ?? null).slice(0, 240));
  const industry = await list(olivier, '?cluster=industry');
  check('by cluster', industry.json?.items?.length > 0 && industry.json.items.every((b) => b.clusterCode === 'industry'));
  const members = await list(olivier, '?standing=member');
  check('by standing', members.json?.items?.every((b) => b.standing === 'member')
    && members.json.items.some((b) => b.legalName === 'Kanombe Fresh Foods'));
  const women = await list(olivier, '?group=women');
  check('by owner group', women.json?.items?.length > 0 && women.json.items.every((b) => b.ownerGroups.includes('women')));
  const noTin = await list(olivier, '?tin=without');
  check('by TIN', noTin.json?.items?.length > 0 && noTin.json.items.every((b) => b.hasTin === false));
  const search = await list(olivier, `?q=${encodeURIComponent(workshop.paid?.json?.businessCode ?? 'none')}`);
  check('by code', search.json?.total === 1 && search.json.items[0].orgId === workshopId, brief(search));
  const gasaboForOlivier = await list(olivier, '?district=102');
  check('another district is a boundary, not a filter', gasaboForOlivier.json?.total === 0, brief(gasaboForOlivier));
  const gasaboForEric = await list(eric, '?district=102&kind=enterprise');
  check('the country officer reads Gasabo', gasaboForEric.json?.total > 0
    && gasaboForEric.json.items.every((b) => b.districtName === 'Gasabo' && b.domain === 'enterprise'));

  const summary = await call(olivier, 'GET', '/api/v1/oversight/psf/summary');
  check('the summary names the region, and counts only its district',
    summary.status === 200 && summary.json?.regionLabel === 'Kicukiro district' && summary.json?.byDistrict?.length === 1
      && summary.json.byDistrict[0].letters === 'KIC' && summary.json.total === all.json?.total,
    brief(summary));
  check('it counts members and this year’s fees',
    summary.json?.members >= 2 && summary.json?.paidThisYearRwf >= 150000, `${summary.json?.members} members, ${summary.json?.paidThisYearRwf} RWF`);
  check('it counts by cluster and owner group',
    summary.json?.byCluster?.some((c) => c.key === 'industry' && c.count > 0) && summary.json?.byGroup?.some((g) => g.key === 'women'));

  // --- G. Admin -------------------------------------------------------------------------
  console.log('\nG. Admin');
  const ops = await signIn('ops@demo.injishi.com');
  const adminCatalogue = await call(ops, 'GET', '/api/admin/v1/configuration/psf-catalogue');
  const adminCatalogueAlt = adminCatalogue.status === 404 ? await call(ops, 'GET', '/api/v1/admin/configuration/psf-catalogue') : adminCatalogue;
  check('admin reads the whole catalogue', adminCatalogueAlt.status === 200 && adminCatalogueAlt.json?.clusters?.length >= 4, brief(adminCatalogueAlt));
} catch (error) {
  console.error(`\nverify-psf-path stopped: ${error instanceof Error ? error.message : error}`);
  fail += 1;
} finally {
  await db.end();
}

console.log(`\n${pass} passed, ${fail} failed`);
if (failures.length) console.log(`Failed: ${failures.join('; ')}`);
process.exitCode = fail > 0 ? 1 : 0;
