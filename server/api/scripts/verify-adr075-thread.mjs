// Verify ADR-075 A1's thread over real HTTP: one business from the first Pay press to PSF review, with no
// agreement before payment, and the kinds and the fee the record decides.
//
// WHAT IT PROVES:
//   A. The fee is 50,000 RWF for a stay, a venue and a residence, and 0 for a broker, asked by kind (AC-13, D-j);
//      an unknown kind is a 404.
//   B. A hotel created at the Pay press carries `business_kind = hotel` and its accommodation class (AC-31), is
//      billed the quoted 50,000, and pays with NO agreement accepted first: it lands at `tin_verified` once the
//      mock RRA answers (AC-12, AC-3). The contract route is gone.
//   C. The same Pay press sent twice (one Idempotency-Key) answers the one registration, and a second press with
//      a new key on the caller's own TIN answers it too: one org, one invoice (AC-14). Another person's key is
//      refused, and another person's TIN is still a 409.
//   D. A coffee shop is a real kind: `coffee_shop`, no accommodation class, the restaurant entity group, the
//      hospitality fee, and the same pay to `tin_verified` (AC-31, the A1 critical scenario's kind half).
//   E. A coffee shop sent WITH an accommodation class is refused at the field.
//   F. The document a kind requires (AC-11), from the table the wizard reads: a venue with no RDB certificate is a
//      422 naming it and writes nothing; a residence is asked for its land title; another person's upload is a 422
//      at its key; and a franchise agreement on a business that runs no other company's brand is refused at it.
//   G. Part of a franchise? (AC-8): a franchisee hotel and its agreement, and a franchisor coffee shop, are each one
//      `org_franchises` row holding its own role's fields; No writes no row; a franchisee with no country and a
//      residence with a franchise are refused at the field.
//   H. Save as you type (AC-9, D-m): the TIN check and the ID scan are kept beside the draft, counted, by the server
//      alone; the answers save whole (the open step, the reach, the marks, the franchise, the documents) and read
//      back with when they were saved, keeping the checks; a draft saved before ADR-075 still reads; an ID number
//      anywhere is a 422; the first Pay press marks the draft with its registration and keeps it (D-l); starting
//      another business clears answers and checks; one business's fee leaves another's draft alone, and clears
//      the draft made into it, tries and all.
//
// WRITES: fresh accounts, small uploads and seven registrations per run. SAMPLE database only.
//   node --env-file=.env scripts/verify-adr075-thread.mjs
import { randomBytes, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
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

async function call(cookie, method, path, body, headers = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
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

/** Upload bytes as an `id_photo`, the way the wizard does, and return the key. */
async function uploadIdPhoto(cookie, bytes, name) {
  const form = new FormData();
  form.append('kind', 'id_photo');
  form.append('attemptToken', randomUUID());
  form.append('file', new Blob([bytes], { type: 'image/jpeg' }), name);
  const res = await fetch(`${API}/api/v1/uploads`, { method: 'POST', headers: { cookie }, body: form });
  const json = await res.json().catch(() => null);
  if (!json?.objectKey) throw new Error(`upload ${name}: ${res.status} ${JSON.stringify(json)}`);
  return json.objectKey;
}

/**
 * Scan a National ID (ADR-075 A1): a demo card front, which the mock verifier reads as the number it carries,
 * then a selfie. Answers who the scan says they are.
 */
async function scanNationalId(cookie, documentNumber) {
  const front = Buffer.concat([randomBytes(6_000), Buffer.from(`INJISHI-DEMO-NID:${documentNumber}`, 'latin1')]);
  const [frontKey, selfieKey] = await Promise.all([
    uploadIdPhoto(cookie, front, 'id-front.jpg'),
    uploadIdPhoto(cookie, randomBytes(5_000), 'selfie.jpg'),
  ]);
  const scan = await call(cookie, 'POST', '/api/v1/me/identity/scan', { documentType: 'national_id', frontKey, selfieKey });
  if (scan.json?.outcome !== 'machine_passed') throw new Error(`scan ${documentNumber}: ${scan.text}`);
  return scan.json.fields;
}

/**
 * Upload a small PDF as this person's RDB certificate. ADR-075 AC-11: create refuses a stay or a venue without
 * one, and only takes a certificate the registrant uploaded. Uploaded once per person per run and reused for each
 * of their registrations, because the certificate route allows 10 per person in 10 minutes.
 */
const uploadedCertificates = new Map();
async function rdbCertificate(cookie) {
  if (uploadedCertificates.has(cookie)) return uploadedCertificates.get(cookie);
  const certificates = [{ kind: 'rdb_certificate', objectKey: await uploadCertificate(cookie, 'rdb-certificate.pdf') }];
  uploadedCertificates.set(cookie, certificates);
  return certificates;
}

/** Upload one small PDF through the certificate route, as this person, and answer its key. */
async function uploadCertificate(cookie, filename) {
  const form = new FormData();
  form.append('file', new Blob([CERTIFICATE_PDF], { type: 'application/pdf' }), filename);
  const res = await fetch(`${API}/api/v1/uploads/certificate`, { method: 'POST', headers: { cookie }, body: form });
  const json = await res.json().catch(() => null);
  if (!json?.objectKey) throw new Error(`certificate upload: ${res.status} ${JSON.stringify(json)}`);
  return json.objectKey;
}
const CERTIFICATE_PDF = '%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n';

/** A checked registrant (their National ID scanned, A1 task 3) holding an uploaded RDB certificate (task 4). */
async function verifiedRegistrant(label) {
  const cookie = await sessionFor(`adr075-${label}-${RUN}@verify.injishi.rw`);
  const nid = `119908${String(2_000_000 + Math.floor(Math.random() * 7_000_000))}${String(Math.floor(Math.random() * 90) + 10)}1`;
  return { cookie, person: await scanNationalId(cookie, nid), certificates: await rdbCertificate(cookie) };
}

const tinFor = () => `9990${String(Math.floor(Math.random() * 1e5)).padStart(5, '0')}`;
const ADDRESS = { country: 'RW', provinceId: 1, districtId: 102, sectorId: 10201, street: 'KG 11 Ave' };

function registration(person, business) {
  return {
    role: 'host',
    capacity: 'owner',
    personal: {
      fullName: person.fullName,
      dateOfBirth: person.dateOfBirth,
      phoneE164: person.phoneE164 ?? '+250788300412',
      address: ADDRESS,
    },
    business: { domain: 'hospitality', address: ADDRESS, certificates: [], branches: [], ...business },
  };
}

/** Pay, then wait for the mock RRA's answer to move the case past `submitted`. */
async function payAndSettle(cookie, orgId) {
  const paid = await call(cookie, 'POST', `/api/v1/registrations/${orgId}/pay`);
  let now = paid.json;
  for (let i = 0; i < 20 && now?.status === 'submitted'; i++) {
    await new Promise((r) => setTimeout(r, 500));
    now = (await call(cookie, 'GET', `/api/v1/registrations/${orgId}`)).json;
  }
  return { paid, now };
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const q = async (text, params = []) => (await db.query(text, params)).rows;

try {
  console.log('A. the fee, by kind');
  for (const [kind, amount] of [['hotel', 50000], ['coffee_shop', 50000], ['bar_restaurant', 50000], ['residence', 50000], ['broker', 0]]) {
    const fee = await call(null, 'GET', `/api/v1/registrations/fee?kind=${kind}`);
    check(`${kind}: ${amount} RWF`, fee.status === 200 && fee.json?.amountRwf === amount, fee.text);
  }
  check('an unknown kind is a 404', (await call(null, 'GET', '/api/v1/registrations/fee?kind=spaceport')).status === 404);

  console.log('B. a hotel, created at the Pay press, paid with no agreement');
  const owner = await verifiedRegistrant('hotel');
  const hotelTin = tinFor();
  const key = randomUUID();
  const hotelBody = registration(owner.person, {
    certificates: owner.certificates,
    legalName: `ADR-075 Thread ${RUN} Hotel`,
    businessKind: 'hotel',
    accommodationClass: 'hotel',
    tin: hotelTin,
  });
  const created = await call(owner.cookie, 'POST', '/api/v1/registrations', hotelBody, { 'Idempotency-Key': key });
  check(
    'created at pending_payment, kind hotel, billed 50,000, no agreement',
    created.status === 201 &&
      created.json?.status === 'pending_payment' &&
      created.json?.businessKind === 'hotel' &&
      created.json?.accommodationClass === 'hotel' &&
      created.json?.amountDueRwf === 50000 &&
      created.json?.contractAcceptedAt === null,
    created.text.slice(0, 300),
  );
  const orgId = created.json?.orgId;
  check(
    'the contract route is gone',
    (await call(owner.cookie, 'POST', `/api/v1/registrations/${orgId}/contract`, { contractVersion: '2026-09-12' })).status === 404,
  );

  console.log('C. one press, one registration');
  const replay = await call(owner.cookie, 'POST', '/api/v1/registrations', hotelBody, { 'Idempotency-Key': key });
  check('the same key answers the same registration', replay.status === 201 && replay.json?.orgId === orgId, replay.text.slice(0, 200));
  const newPress = await call(owner.cookie, 'POST', '/api/v1/registrations', hotelBody, { 'Idempotency-Key': randomUUID() });
  check('a new key on my own TIN answers it too', newPress.json?.orgId === orgId, newPress.text.slice(0, 200));
  const noKey = await call(owner.cookie, 'POST', '/api/v1/registrations', hotelBody);
  check('and so does a press with no key at all', noKey.json?.orgId === orgId, noKey.text.slice(0, 200));
  const badKey = await call(owner.cookie, 'POST', '/api/v1/registrations', hotelBody, { 'Idempotency-Key': 'retry' });
  check('a malformed key is a 400', badKey.status === 400, badKey.text.slice(0, 200));
  const [counts] = await q(
    `select (select count(*)::int from orgs where tin = $1) as orgs,
            (select count(*)::int from subscription_invoices i join orgs o on o.id = i.org_id
              where o.tin = $1 and i.invoice_kind = 'registration_fee') as invoices,
            (select creation_key from orgs where tin = $1) as creation_key`,
    [hotelTin],
  );
  check('one org and one invoice in the database', counts.orgs === 1 && counts.invoices === 1, JSON.stringify(counts));
  check('the org carries the first press key', counts.creation_key === key, JSON.stringify(counts));
  const stranger = await verifiedRegistrant('stranger');
  const theirs = await call(stranger.cookie, 'POST', '/api/v1/registrations', hotelBody, { 'Idempotency-Key': key });
  check("another person's key is refused, not answered", theirs.status === 409 && theirs.json?.orgId === undefined, theirs.text.slice(0, 200));
  const theirTin = await call(
    stranger.cookie,
    'POST',
    '/api/v1/registrations',
    registration(stranger.person, { certificates: stranger.certificates, legalName: `ADR-075 Thread ${RUN} Hotel`, businessKind: 'hotel', accommodationClass: 'hotel', tin: hotelTin }),
    { 'Idempotency-Key': randomUUID() },
  );
  check("another person's TIN is still a 409", theirTin.status === 409, theirTin.text.slice(0, 200));

  const { paid, now } = await payAndSettle(owner.cookie, orgId);
  check('pay needs no agreement', paid.status === 201 || paid.status === 200, paid.text.slice(0, 200));
  check('RRA moves it to tin_verified, PSF review', now?.status === 'tin_verified', JSON.stringify(now).slice(0, 200));
  const [paidRow] = await q(`select status, amount_rwf from subscription_invoices where org_id = $1 and invoice_kind = 'registration_fee'`, [orgId]);
  check('the invoice is paid at the quoted 50,000', paidRow?.status === 'paid' && Number(paidRow?.amount_rwf) === 50000, JSON.stringify(paidRow));

  console.log('D. a coffee shop');
  const shop = await verifiedRegistrant('coffee');
  const shopTin = tinFor();
  const shopCreated = await call(
    shop.cookie,
    'POST',
    '/api/v1/registrations',
    registration(shop.person, { certificates: shop.certificates, legalName: `ADR-075 Thread ${RUN} Coffee`, businessKind: 'coffee_shop', tin: shopTin }),
    { 'Idempotency-Key': randomUUID() },
  );
  check(
    'kind coffee_shop, no accommodation class, billed 50,000',
    shopCreated.status === 201 &&
      shopCreated.json?.businessKind === 'coffee_shop' &&
      shopCreated.json?.accommodationClass === null &&
      shopCreated.json?.amountDueRwf === 50000,
    shopCreated.text.slice(0, 300),
  );
  const [shopRow] = await q(`select business_kind, accommodation_class, rdb_entity_group from orgs where tin = $1`, [shopTin]);
  check(
    'stored as a venue in the restaurant group',
    shopRow?.business_kind === 'coffee_shop' && shopRow?.accommodation_class === null && shopRow?.rdb_entity_group === 'restaurant_bar_nightclub',
    JSON.stringify(shopRow),
  );
  const shopPaid = await payAndSettle(shop.cookie, shopCreated.json?.orgId);
  check('and pays to tin_verified', shopPaid.now?.status === 'tin_verified', JSON.stringify(shopPaid.now).slice(0, 200));

  console.log('E. a venue with a class');
  const wrong = await call(
    shop.cookie,
    'POST',
    '/api/v1/registrations',
    registration(shop.person, { certificates: shop.certificates, legalName: `ADR-075 Thread ${RUN} Cafe`, businessKind: 'coffee_shop', accommodationClass: 'hotel', tin: tinFor() }),
    { 'Idempotency-Key': randomUUID() },
  );
  check(
    'refused at business.accommodationClass',
    wrong.status === 400 && (wrong.json?.issues ?? []).some((i) => i.path?.join('.') === 'business.accommodationClass'),
    wrong.text.slice(0, 300),
  );

  console.log('F. the document a kind requires (AC-11)');
  const issuesAt = (res, path) => (res.json?.issues ?? []).filter((i) => i.path?.join('.') === path);
  const bareName = `ADR-075 Thread ${RUN} Bare`;
  const bare = await call(
    shop.cookie,
    'POST',
    '/api/v1/registrations',
    registration(shop.person, { legalName: bareName, businessKind: 'bar_restaurant', tin: tinFor() }),
    { 'Idempotency-Key': randomUUID() },
  );
  check(
    'a venue with no RDB certificate is refused 422 at the certificates, naming it',
    bare.status === 422 && issuesAt(bare, 'business.certificates').some((i) => /RDB certificate/.test(i.message)),
    bare.text.slice(0, 300),
  );
  check('and nothing is written', (await q('select count(*)::int n from orgs where legal_name = $1', [bareName]))[0].n === 0);
  const flats = await call(
    shop.cookie,
    'POST',
    '/api/v1/registrations',
    {
      ...registration(shop.person, {}),
      role: 'landlord',
      business: {
        domain: 'residence',
        legalName: `ADR-075 Thread ${RUN} Flats`,
        residenceClass: 'residential_landlord',
        upi: `1/03/07/02/${String(Math.floor(Math.random() * 9000) + 1000)}`,
        address: ADDRESS,
        certificates: shop.certificates,
      },
    },
    { 'Idempotency-Key': randomUUID() },
  );
  check(
    'a residence carrying only an RDB certificate is asked for its land title',
    flats.status === 422 && issuesAt(flats, 'business.certificates').some((i) => /land title/.test(i.message)),
    flats.text.slice(0, 300),
  );
  const borrowed = await call(
    stranger.cookie,
    'POST',
    '/api/v1/registrations',
    registration(stranger.person, {
      certificates: owner.certificates,
      legalName: `ADR-075 Thread ${RUN} Borrowed`,
      businessKind: 'hotel',
      accommodationClass: 'hotel',
      tin: tinFor(),
    }),
    { 'Idempotency-Key': randomUUID() },
  );
  check(
    "another person's upload is refused 422 at its key",
    borrowed.status === 422 && issuesAt(borrowed, 'business.certificates.0.objectKey').length === 1,
    borrowed.text.slice(0, 300),
  );
  const franchised = await verifiedRegistrant('franchise');
  const agreementKey = await uploadCertificate(franchised.cookie, 'franchise-agreement.pdf');
  const agreement = [{ kind: 'franchise_agreement', objectKey: agreementKey }];
  const stray = await call(
    franchised.cookie,
    'POST',
    '/api/v1/registrations',
    registration(franchised.person, {
      certificates: [...franchised.certificates, ...agreement],
      legalName: `ADR-075 Thread ${RUN} Stray Agreement`,
      businessKind: 'hotel',
      accommodationClass: 'hotel',
      tin: tinFor(),
    }),
    { 'Idempotency-Key': randomUUID() },
  );
  check(
    'a franchise agreement on a business that runs no other brand is refused at its kind',
    stray.status === 400 && issuesAt(stray, 'business.certificates.1.kind').length === 1,
    stray.text.slice(0, 300),
  );

  console.log('G. part of a franchise? (AC-8)');
  const franchiseOf = async (orgId) =>
    (
      await q(
        `select f.role, f.brand_name, f.franchisor_legal_name, f.franchisor_country, f.franchised_locations,
                (f.agreement_object_id = (select id from stored_objects where object_key = $2)) as agreement_is_the_upload,
                f.agreement_object_id is null as no_agreement
           from org_franchises f where f.org_id = $1`,
        [orgId, agreementKey],
      )
    )[0] ?? null;
  const franchisee = await call(
    franchised.cookie,
    'POST',
    '/api/v1/registrations',
    registration(franchised.person, {
      certificates: [...franchised.certificates, ...agreement],
      legalName: `ADR-075 Thread ${RUN} Franchisee`,
      businessKind: 'hotel',
      accommodationClass: 'hotel',
      tin: tinFor(),
      franchise: { role: 'franchisee', brandName: 'Java House', franchisorLegalName: 'Java House Africa Ltd', franchisorCountry: 'KE' },
    }),
    { 'Idempotency-Key': randomUUID() },
  );
  const franchiseeRow = franchisee.json?.orgId ? await franchiseOf(franchisee.json.orgId) : null;
  check(
    'a franchisee hotel is one row: the brand, the franchisor and its country, and the agreement it uploaded',
    franchisee.status === 201 &&
      franchiseeRow?.role === 'franchisee' &&
      franchiseeRow.brand_name === 'Java House' &&
      franchiseeRow.franchisor_legal_name === 'Java House Africa Ltd' &&
      franchiseeRow.franchisor_country === 'KE' &&
      franchiseeRow.franchised_locations === null &&
      franchiseeRow.agreement_is_the_upload === true,
    `${franchisee.status} ${JSON.stringify(franchiseeRow)} ${franchisee.text.slice(0, 200)}`,
  );
  const franchisor = await call(
    shop.cookie,
    'POST',
    '/api/v1/registrations',
    registration(shop.person, {
      certificates: shop.certificates,
      legalName: `ADR-075 Thread ${RUN} Franchisor`,
      businessKind: 'coffee_shop',
      tin: tinFor(),
      franchise: { role: 'franchisor', brandName: 'Kivu Coffee', franchisedLocations: 12 },
    }),
    { 'Idempotency-Key': randomUUID() },
  );
  const franchisorRow = franchisor.json?.orgId ? await franchiseOf(franchisor.json.orgId) : null;
  check(
    'a franchisor coffee shop is one row: the brand and its 12 locations, and no franchisor fields',
    franchisor.status === 201 &&
      franchisorRow?.role === 'franchisor' &&
      franchisorRow.brand_name === 'Kivu Coffee' &&
      franchisorRow.franchised_locations === 12 &&
      franchisorRow.franchisor_legal_name === null &&
      franchisorRow.franchisor_country === null &&
      franchisorRow.no_agreement === true,
    `${franchisor.status} ${JSON.stringify(franchisorRow)} ${franchisor.text.slice(0, 200)}`,
  );
  check('No writes no row', orgId !== undefined && (await franchiseOf(orgId)) === null);
  const noCountry = await call(
    franchised.cookie,
    'POST',
    '/api/v1/registrations',
    registration(franchised.person, {
      certificates: franchised.certificates,
      legalName: `ADR-075 Thread ${RUN} No Country`,
      businessKind: 'hotel',
      accommodationClass: 'hotel',
      tin: tinFor(),
      franchise: { role: 'franchisee', brandName: 'Java House', franchisorLegalName: 'Java House Africa Ltd' },
    }),
    { 'Idempotency-Key': randomUUID() },
  );
  check(
    "a franchisee who names no franchisor's country is refused at it",
    noCountry.status === 400 &&
      issuesAt(noCountry, 'business.franchise.franchisorCountry').some((i) => /country/.test(i.message)),
    noCountry.text.slice(0, 300),
  );
  const franchisedFlats = await call(
    shop.cookie,
    'POST',
    '/api/v1/registrations',
    {
      ...registration(shop.person, {}),
      role: 'landlord',
      business: {
        domain: 'residence',
        legalName: `ADR-075 Thread ${RUN} Franchised Flats`,
        residenceClass: 'residential_landlord',
        upi: `1/03/07/02/${String(Math.floor(Math.random() * 9000) + 1000)}`,
        address: ADDRESS,
        certificates: [],
        franchise: { role: 'franchisor', brandName: 'Flats Co', franchisedLocations: 2 },
      },
    },
    { 'Idempotency-Key': randomUUID() },
  );
  check(
    'a residence with a franchise is refused at it',
    franchisedFlats.status === 400 && issuesAt(franchisedFlats, 'business.franchise').length === 1,
    franchisedFlats.text.slice(0, 300),
  );

  console.log('H. save as you type, and the checks kept beside it (AC-9)');
  const typist = await verifiedRegistrant('draft');
  const readDraft = async () => (await call(typist.cookie, 'GET', '/api/v1/me/registration-draft')).json;
  const saveDraft = (body) => call(typist.cookie, 'PUT', '/api/v1/me/registration-draft', body);
  const draftTin = tinFor();
  const asked = await call(typist.cookie, 'POST', '/api/v1/registrations/tin-check', { tin: draftTin, capacity: 'owner' });
  let kept = await readDraft();
  check(
    'the TIN check is kept beside the draft: the TIN, whose question it was, the answer, counted',
    asked.status === 200 &&
      kept?.checks?.tin?.tin === draftTin &&
      kept.checks.tin.capacity === 'owner' &&
      kept.checks.tin.attempts === 1 &&
      isDeepStrictEqual(kept.checks.tin.answer, asked.json),
    JSON.stringify(kept?.checks?.tin).slice(0, 300),
  );
  check(
    'so is the ID scan, and nothing typed is saved yet',
    kept?.checks?.scan?.attempts === 1 && kept.checks.scan.outcome === 'machine_passed' && kept.draft === null && kept.savedAt === null,
    JSON.stringify(kept).slice(0, 300),
  );
  await call(typist.cookie, 'POST', '/api/v1/registrations/tin-check', { tin: draftTin, capacity: 'on_behalf_of' });
  kept = await readDraft();
  check(
    'asked again for the owner, it is counted again and says whose question it was',
    kept?.checks?.tin?.attempts === 2 && kept.checks.tin.capacity === 'on_behalf_of',
    JSON.stringify(kept?.checks?.tin).slice(0, 200),
  );
  const blankPerson = {
    firstName: '',
    middleName: '',
    lastName: '',
    documentType: 'national_id',
    issuingCountry: 'RW',
    gender: '',
    dateOfBirth: '',
    phoneE164: '',
    address: { country: 'RW' },
  };
  const legacy = {
    v: 1,
    phase: 'business',
    kind: 'hotel',
    capacity: 'owner',
    typedPersonal: true,
    personal: blankPerson,
    intendedOwner: { name: '', email: '' },
    business: { legalName: 'Old Draft', tin: draftTin, address: { country: 'RW' } },
    branches: [],
  };
  const oldSave = await saveDraft(legacy);
  kept = await readDraft();
  check(
    'a draft saved before ADR-075 still saves and reads, with no step of its own',
    oldSave.status === 200 && kept?.draft?.phase === 'business' && kept.draft.openStep === undefined,
    `${oldSave.status} ${JSON.stringify(kept?.draft).slice(0, 200)}`,
  );
  const typed = {
    v: 1,
    openStep: 'documents',
    reached: 'documents',
    done: ['tin', 'owner', 'loc', 'fr'],
    kind: 'hotel',
    capacity: 'owner',
    typedPersonal: false,
    personal: blankPerson,
    intendedOwner: { name: '', email: '' },
    business: {
      legalName: `ADR-075 Thread ${RUN} Draft`,
      tin: draftTin,
      accommodationClass: 'hotel',
      psfMember: false,
      address: { country: 'RW', provinceId: '1', districtId: '102', sectorId: '10201', street: 'KG 11 Ave' },
    },
    branches: [],
    franchise: { role: 'none', brandName: '', franchisorLegalName: '', franchisorCountry: '', franchisedLocations: '' },
    documents: [{ kind: 'rdb_certificate', objectKey: typist.certificates[0].objectKey, filename: 'rdb-certificate.pdf', sizeBytes: 90 }],
  };
  const first = await saveDraft(typed);
  kept = await readDraft();
  check(
    'the answers save whole, the open step, the reach, the marks, the franchise and the documents, and read back as they were',
    first.status === 200 && typeof first.json?.savedAt === 'string' && isDeepStrictEqual(kept?.draft, typed) && kept.savedAt === first.json.savedAt,
    `${first.status} ${first.text.slice(0, 120)} ${JSON.stringify(kept?.draft).slice(0, 200)}`,
  );
  check(
    'saving the answers keeps the checks beside them',
    kept?.checks?.tin?.attempts === 2 && kept.checks.scan?.attempts === 1,
    JSON.stringify(kept?.checks).slice(0, 200),
  );
  await new Promise((r) => setTimeout(r, 20));
  const second = await saveDraft({ ...typed, openStep: 'review', reached: 'review', done: [...typed.done, 'review'] });
  check(
    'a later save moves when it was saved',
    second.status === 200 && Date.parse(second.json?.savedAt) > Date.parse(first.json?.savedAt),
    `${first.json?.savedAt} then ${second.json?.savedAt}`,
  );
  const smuggled = await saveDraft({ ...typed, business: { ...typed.business, note: 'ID 1199080123456789' } });
  kept = await readDraft();
  check(
    'a draft holding an ID number anywhere is a 422, and what was saved stays',
    smuggled.status === 422 && kept?.draft?.openStep === 'review',
    `${smuggled.status} ${smuggled.text.slice(0, 160)}`,
  );
  const misshapen = await saveDraft({ ...typed, openStep: 'checkout' });
  check('any other bad shape is the validation 400', misshapen.status === 400, `${misshapen.status} ${misshapen.text.slice(0, 160)}`);

  const firstOrg = await call(
    typist.cookie,
    'POST',
    '/api/v1/registrations',
    registration(typist.person, {
      certificates: typist.certificates,
      legalName: `ADR-075 Thread ${RUN} Draft`,
      businessKind: 'hotel',
      accommodationClass: 'hotel',
      tin: draftTin,
    }),
    { 'Idempotency-Key': randomUUID() },
  );
  kept = await readDraft();
  check(
    'the first Pay press marks the draft with its registration and keeps it, answers and checks (D-l)',
    firstOrg.status === 201 &&
      kept?.checks?.registrationId === firstOrg.json?.orgId &&
      kept.draft?.openStep === 'review' &&
      kept.checks.tin?.tin === draftTin,
    `${firstOrg.status} ${JSON.stringify(kept?.checks).slice(0, 200)}`,
  );
  const cleared = await call(typist.cookie, 'DELETE', '/api/v1/me/registration-draft');
  kept = await readDraft();
  check(
    'starting another business clears the answers and every check',
    cleared.status === 204 && kept?.draft === null && isDeepStrictEqual(kept.checks, {}) && kept.savedAt === null,
    JSON.stringify(kept),
  );
  const nextTin = tinFor();
  const nextDraft = {
    ...typed,
    openStep: 'business',
    reached: 'business',
    done: [],
    business: { ...typed.business, legalName: `ADR-075 Thread ${RUN} Next`, tin: nextTin },
  };
  await saveDraft(nextDraft);
  const firstPaid = await payAndSettle(typist.cookie, firstOrg.json?.orgId);
  kept = await readDraft();
  check(
    "one business's fee leaves the draft of another begun since alone",
    (firstPaid.paid.status === 200 || firstPaid.paid.status === 201) && kept?.draft?.business?.tin === nextTin,
    `${firstPaid.paid.status} ${JSON.stringify(kept?.draft?.business).slice(0, 160)}`,
  );
  const nextOrg = await call(
    typist.cookie,
    'POST',
    '/api/v1/registrations',
    registration(typist.person, {
      certificates: typist.certificates,
      legalName: `ADR-075 Thread ${RUN} Next`,
      businessKind: 'hotel',
      accommodationClass: 'hotel',
      tin: nextTin,
    }),
    { 'Idempotency-Key': randomUUID() },
  );
  const nextPaid = await payAndSettle(typist.cookie, nextOrg.json?.orgId);
  kept = await readDraft();
  const [left] = await q(`select count(*)::int as n from registration_drafts where checks ->> 'registrationId' = $1`, [
    nextOrg.json?.orgId ?? '',
  ]);
  check(
    'and its own fee clears the draft made into it, tries and all (D-m)',
    nextOrg.status === 201 &&
      nextPaid.now?.status === 'tin_verified' &&
      kept?.draft === null &&
      isDeepStrictEqual(kept.checks, {}) &&
      left?.n === 0,
    `${nextOrg.status} ${nextPaid.now?.status} ${JSON.stringify(kept)}`,
  );
} finally {
  await db.end();
}

console.log(failures === 0 ? '\nADR-075 THREAD OK' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
