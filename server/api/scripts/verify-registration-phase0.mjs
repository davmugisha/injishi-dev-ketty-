// Verify registration Phase 0 (less typing, earlier refusals) over real HTTP.
//
// THE TIN PRE-CHECK. A TIN used to reach RRA only after the non-refundable fee
// was paid, so a mistyped one was found once the money was gone. The Business
// step now asks `POST /registrations/tin-check` first. This proves the route:
//   A. It refuses a caller with no session.
//   B. It refuses a TIN that is not 9 digits, at the validation pipe.
//   C. A TIN nobody holds comes back `verified` (the mock always verifies).
//   D. A TIN an org already holds comes back `taken`, not `verified`.
//   E. It writes nothing: no `tin_verifications` row appears for either TIN.
//   F. It is throttled per person, so it is not a free TIN directory.
//
// THE PSF ID ON FILE. A returning registrant's profile reads back masked, so
// the PSF step used to leave the ID blank for them to retype.
//   G. A registration whose PSF application says `useDocumentOnFile` is filed
//      with the full number from the profile, which the request never carried.
//   H. Sending both a typed ID and `useDocumentOnFile` is refused.
//
// WRITES: one registration for rayan@demo.injishi.com, with a fresh TIN. Meant
// for a SAMPLE MARKED database, never the shared one:
//   node --env-file=.env scripts/verify-registration-phase0.mjs
import pg from 'pg';

const API = process.env.VERIFY_API_URL || 'http://127.0.0.1:8000';
const OTP = process.env.VERIFY_OTP_CODE || '123456';
const EMAIL = process.env.VERIFY_EMAIL || 'host@injishi.rw';

let failures = 0;
function check(label, ok, detail) {
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : `   ${detail}`}`);
}

function jar(res) {
  return (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
}

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

async function tinCheck(cookie, tin) {
  const res = await fetch(`${API}/api/v1/registrations/tin-check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({ tin }),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const q = async (text, params = []) => (await db.query(text, params)).rows;
const rowsFor = async (tin) =>
  Number((await q('select count(*)::int as n from tin_verifications where tin = $1', [tin]))[0].n);

try {
  const cookie = await sessionFor(EMAIL);

  console.log('A. no session');
  check('401 without a session', (await tinCheck(null, '123456789')).status === 401);

  console.log('B. shape');
  check('400 on an 8 digit TIN', (await tinCheck(cookie, '12345678')).status === 400);

  console.log('C. a TIN nobody holds');
  let fresh;
  do {
    fresh = String(100000000 + Math.floor(Math.random() * 899999999));
  } while ((await q('select 1 from orgs where tin = $1', [fresh])).length > 0);
  const c = await tinCheck(cookie, fresh.replace(/(\d{3})(?=\d)/g, '$1 '));
  check('200 verified, spaces accepted', c.status === 200 && c.body?.result === 'verified', JSON.stringify(c));

  console.log('D. a TIN an org holds');
  const [held] = await q('select tin from orgs where tin is not null limit 1');
  if (!held) {
    check('the database holds a business with a TIN to test against', false, 'seed first');
  } else {
    const d = await tinCheck(cookie, held.tin);
    check('200 taken', d.status === 200 && d.body?.result === 'taken', JSON.stringify(d));
  }

  console.log('E. writes nothing');
  check('no tin_verifications row for the fresh TIN', (await rowsFor(fresh)) === 0);

  console.log('F. throttle');
  // A second person spends their allowance, so a rerun inside the minute still
  // finds A to D's person unthrottled; and the first stays unthrottled, which is
  // the "per person" half of the claim.
  const spender = await sessionFor('clarisse@demo.injishi.com');
  const statuses = [];
  for (let i = 0; i < 22; i += 1) statuses.push((await tinCheck(spender, fresh)).status);
  check('429 once the per-person limit is spent', statuses.includes(429), statuses.join(','));
  check('another person is not throttled by it', (await tinCheck(cookie, fresh)).status === 200);

  console.log('G. the PSF ID on file');
  const NID = '1199080123456789';
  const rayan = await sessionFor('rayan@demo.injishi.com');
  const ADDRESS = { country: 'RW', provinceId: 1, districtId: 102, sectorId: 10201, street: 'KG 11 Ave' };
  const newTin = async () => {
    let t;
    do t = `9990${String(Math.floor(Math.random() * 1e5)).padStart(5, '0')}`;
    while ((await q('select 1 from orgs where tin = $1', [t])).length > 0);
    return t;
  };
  const psf = (extra) => ({
    requestedTierCode: 'ordinary_100k',
    companyName: 'Phase 0 Verify Hotel',
    streetAddress: 'KG 11 Ave, Kigali',
    companyType: 'private_company',
    ownership: 'rwandan_100',
    businessActivity: 'Accommodation: Hotel',
    tradeDirection: 'none',
    contactRole: 'owner',
    firstName: 'Rayan',
    lastName: 'Iraguha',
    gender: 'male',
    phoneE164: '+250788000211',
    email: 'rayan@demo.injishi.com',
    dateOfBirth: '1990-02-14',
    consent: true,
    ...extra,
  });
  const register = async (tinValue, application, extraBusiness = {}) => {
    const certificates = await rdbCertificate(rayan);
    const res = await fetch(`${API}/api/v1/registrations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: rayan },
      body: JSON.stringify({
        role: 'host',
        capacity: 'owner',
        personal: {
          fullName: 'Rayan Iraguha',
          document: { documentType: 'national_id', documentNumber: NID, issuingCountry: 'RW' },
          gender: 'male',
          dateOfBirth: '1990-02-14',
          phoneE164: '+250788000211',
          address: ADDRESS,
        },
        business: {
          domain: 'hospitality',
          legalName: `Phase 0 Verify Hotel ${tinValue}`,
          address: ADDRESS,
          accommodationClass: 'hotel',
          tin: tinValue,
          chamberOfTourismMember: false,
          psfMember: false,
          certificates,
          ...(application ? { psfApplication: application } : {}),
          ...extraBusiness,
        },
      }),
    });
    return { status: res.status, text: await res.text() };
  };

  const onFileTin = await newTin();
  const g = await register(onFileTin, psf({ useDocumentOnFile: true }));
  check('created with no ID in the request', g.status === 201 || g.status === 200, `${g.status} ${g.text.slice(0, 200)}`);
  const [filed] = await q(
    `select a.id_document_type, a.id_document_number
       from psf_membership_applications a join orgs o on o.id = a.org_id where o.tin = $1`,
    [onFileTin],
  );
  check(
    'filed with the full number from the profile',
    filed?.id_document_type === 'national_id' && filed?.id_document_number === NID,
    JSON.stringify(filed),
  );

  console.log('H. one source for the ID');
  const h = await register(
    await newTin(),
    psf({ useDocumentOnFile: true, idDocument: { documentType: 'national_id', documentNumber: NID } }),
  );
  check('400 on both a typed ID and the one on file', h.status === 400, `${h.status} ${h.text.slice(0, 160)}`);

  console.log('I. the officer sees what was declared');
  const licence = `TL-PHASE0-${Date.now()}`;
  const queuedTin = await newTin();
  const created = await register(queuedTin, null, { tourismLicenseNumber: licence });
  check('created with a tourism licence', created.status === 201 || created.status === 200, `${created.status} ${created.text.slice(0, 300)}`);
  const orgId = JSON.parse(created.text).orgId;
  const post = (path, body) =>
    fetch(`${API}/api/v1/registrations/${orgId}/${path}`, {
      method: 'POST',
      // Fastify refuses a JSON content type with an empty body, so `/pay`
      // goes without one.
      headers: body === undefined ? { cookie: rayan } : { 'Content-Type': 'application/json', cookie: rayan },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const paid = await post('pay');
  check('created and paid (ADR-075: no contract before paying)', paid.status === 200 || paid.status === 201, String(paid.status));
  const verifier = await sessionFor('jeanbosco@demo.injishi.com');
  const queue = await (
    await fetch(`${API}/api/v1/oversight/verification-queue`, { headers: { cookie: verifier } })
  ).json();
  const row = Array.isArray(queue) ? queue.find((r) => r.orgId === orgId) : undefined;
  check('the business is in the verifier queue', row !== undefined, JSON.stringify(queue).slice(0, 160));
  check('it carries the tourism licence', row?.tourismLicenseNumber === licence, JSON.stringify(row));
  check('and says it was not registered on someone\'s behalf', row?.onBehalfOf === false);
  check(
    'and lists its one certificate, the RDB certificate (ADR-075 AC-11)',
    Array.isArray(row?.certificates) && row.certificates.length === 1 && row.certificates[0]?.kind === 'rdb_certificate',
    JSON.stringify(row?.certificates),
  );
  check(
    'and carries the RRA answer with the side of the seam that gave it',
    row?.tinCheck?.result === 'verified' && row?.tinCheck?.adapterMode === 'mock' && Boolean(row?.tinCheck?.checkedAt),
    JSON.stringify(row?.tinCheck),
  );
  const registrantOk = row?.registrantName === 'Rayan Iraguha' && row?.intendedOwnerName === null;
  check('and names who registered it, by their verified name', registrantOk, `${row?.registrantName} / ${row?.intendedOwnerName}`);
  if (registrantOk) console.log('  the queue names the registrant as owner');

  console.log('K. the draft, kept on the server between steps');
  const draftBody = {
    v: 1,
    phase: 'business',
    kind: 'hotel',
    capacity: 'owner',
    typedPersonal: true,
    personal: {
      firstName: 'Rayan', middleName: '', lastName: 'Iraguha', documentType: 'national_id', issuingCountry: 'RW',
      gender: 'male', dateOfBirth: '1990-02-14', phoneE164: '+250788000211', address: { country: 'RW', provinceId: '1' },
    },
    intendedOwner: { name: '', email: '' },
    business: { legalName: 'Draft Hotel', tin: '999012345', chamberOfTourismMember: null, address: { country: 'RW' } },
    branches: [],
  };
  const draftCall = (method, body) =>
    fetch(`${API}/api/v1/me/registration-draft`, {
      method,
      headers: body === undefined ? { cookie: rayan } : { 'Content-Type': 'application/json', cookie: rayan },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const saved = await draftCall('PUT', draftBody);
  const savedJson = await saved.json().catch(() => null);
  const readBack = await draftCall('GET');
  const readJson = await readBack.json().catch(() => null);
  check(
    'saved, and read back as it was, with when it was saved',
    saved.status === 200 &&
      readJson?.draft?.business?.legalName === 'Draft Hotel' &&
      readJson?.draft?.phase === 'business' &&
      typeof savedJson?.savedAt === 'string' &&
      readJson?.savedAt === savedJson.savedAt,
    `${saved.status} ${readBack.status}`,
  );
  // ADR-075's API row: a payload holding an ID number is a 422 (S9).
  const smuggled = await draftCall('PUT', { ...draftBody, business: { ...draftBody.business, note: 'id 1199080123456789' } });
  check('a draft carrying an ID number anywhere is refused', smuggled.status === 422, String(smuggled.status));
  const withNumber = await draftCall('PUT', { ...draftBody, personal: { ...draftBody.personal, documentNumber: '1199080123456789' } });
  check('a draft with a document number field is refused', withNumber.status === 422, String(withNumber.status));
  await draftCall('PUT', draftBody);
  const clearTin = await newTin();
  const made = await register(clearTin, null);
  const madeId = made.status === 201 ? JSON.parse(made.text).orgId : null;
  const afterCreate = await (await draftCall('GET')).json().catch(() => null);
  // ADR-075 D-l and D-m: the draft outlives the registration it became, until that registration's fee settles.
  check(
    'creating the registration marks the draft with it, and keeps it',
    madeId !== null && afterCreate?.checks?.registrationId === madeId && afterCreate?.draft?.business?.legalName === 'Draft Hotel',
    `${made.status} ${JSON.stringify(afterCreate?.checks)}`,
  );
  const paidDraft = await fetch(`${API}/api/v1/registrations/${madeId}/pay`, { method: 'POST', headers: { cookie: rayan } });
  const afterPay = await (await draftCall('GET')).json().catch(() => null);
  check('paying the fee clears it', paidDraft.ok && afterPay?.draft === null && afterPay?.checks?.registrationId === undefined, `${paidDraft.status} ${JSON.stringify(afterPay)}`);
} finally {
  await db.end();
}

console.log(failures === 0 ? '\nPHASE0 VERIFIED' : `\n${failures} FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
