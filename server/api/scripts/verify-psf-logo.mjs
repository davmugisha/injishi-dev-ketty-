// Verify A BUSINESS LOGO on the public PSF path (2026-10-23) over real HTTP:
// a logo is uploaded only under the form's verified ID check (never
// anonymously), only as an image whatever it claims to be, and kept as a
// clean PNG with nobody behind it; the form carries its key, a key that is not
// a logo or is another business's is refused at its field; tracking gives it
// an address the API serves; and the certificate prints it once the business
// is a member.
//
// A WRITING verifier, like verify-psf-path.mjs, which this one sits beside:
// split from it so one run of each stays inside the form's per-address budget.
//
// WHAT IT LEAVES BEHIND: one PSF business with a logo, a member, per run.
//
//   API_BASE=http://127.0.0.1:8000 DATABASE_URL=... node scripts/verify-psf-logo.mjs
import pg from 'pg';
import sharp from 'sharp';

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
  const kicukiro = await sector('Kicukiro', 1);
  const fees = await pub('GET', `/psf/fees?district=${kicukiro.district}`);
  const price = fees.json?.fees?.find((f) => f.tierCode === 'indatwa_20k')?.amountRwf;
  if (!price) throw new Error(`no price for indatwa_20k in Kicukiro: ${brief(fees)}`);
  const kicForm = (token, over = {}) => form(token, kicukiro, { ...over, membership: { declaredFeeRwf: price } });
  const olivier = await signIn('olivier@demo.injishi.com');

  console.log('I. A logo');
  const logoPng = await sharp({ create: { width: 360, height: 160, channels: 4, background: { r: 20, g: 110, b: 70, alpha: 1 } } })
    .composite([{ input: Buffer.from('<svg width="360" height="160"><circle cx="80" cy="80" r="60" fill="#f4c430"/><rect x="170" y="40" width="160" height="80" fill="#ffffff"/></svg>'), top: 0, left: 0 }])
    .png()
    .toBuffer();
  const sendLogo = async (token, bytes, type = 'image/png', name = 'logo.png') => {
    const fd = new FormData();
    fd.append('file', new Blob([bytes], { type }), name);
    const headers = { origin: WEB_ORIGIN };
    if (token) headers['x-psf-check-token'] = token;
    const res = await fetch(`${BASE}${V}/psf/logo`, { method: 'POST', body: fd, headers });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, json, text };
  };
  const noToken = await sendLogo(null, logoPng);
  check('a logo without a verified ID check is refused', noToken.status === 410, brief(noToken));
  const fourth = await verifiedToken(4);
  const notImage = await sendLogo(fourth.checkToken, Buffer.from('%PDF-1.4 not a logo'), 'image/png', 'logo.png');
  check('a file that is not an image is refused, whatever it says it is', notImage.status === 400, brief(notImage));
  const logo = await sendLogo(fourth.checkToken, logoPng);
  check('a logo uploads under the ID check, and comes back as a key', logo.status === 201 && /^org_logo\//.test(logo.json?.objectKey ?? ''), brief(logo));
  const stored = await one('SELECT kind::text AS kind, mime, uploaded_by_user_id FROM stored_objects WHERE object_key = $1', [logo.json?.objectKey]);
  check('it is kept as a PNG logo with nobody behind it', stored?.kind === 'org_logo' && stored.mime === 'image/png' && stored.uploaded_by_user_id === null, JSON.stringify(stored));
  const badKey = await pub('POST', '/psf/applications', kicForm(fourth.checkToken, { suffix: 'Logo', business: { logoObjectKey: 'certificate/2026/10/not-a-logo.pdf' } }));
  check('a key that is not a logo is refused at its field', badKey.status === 422 && badKey.text.includes('logoObjectKey'), brief(badKey));
  const withLogo = await pub('POST', '/psf/applications', kicForm(fourth.checkToken, { suffix: 'Logo', business: { logoObjectKey: logo.json?.objectKey } }));
  check('a business with a logo is registered', withLogo.status === 201 && withLogo.json?.feePaid === true, brief(withLogo));
  const logoTrack = await pub('GET', `/psf/track/${withLogo.json?.docId}`);
  check('tracking gives the logo an address', logoTrack.json?.business?.logoUrl === `${V}/psf/track/${withLogo.json?.docId}/logo`, brief(logoTrack));
  const served = await fetch(`${BASE}${V}/psf/track/${withLogo.json?.docId}/logo`);
  const servedBytes = Buffer.from(await served.arrayBuffer());
  check('the logo is served as a PNG', served.status === 200 && served.headers.get('content-type') === 'image/png' && servedBytes.subarray(1, 4).toString() === 'PNG', String(served.status));
  const without = await one(`SELECT a.doc_id FROM psf_membership_applications a JOIN orgs o ON o.id = a.org_id WHERE o.logo_object_key IS NULL AND a.doc_id LIKE 'PSF-%' LIMIT 1`);
  const noLogo = await fetch(`${BASE}${V}/psf/track/${without?.doc_id}/logo`);
  check('a business without one has no logo', noLogo.status === 404, String(noLogo.status));
  const fifth = await verifiedToken(5);
  const reused = await pub('POST', '/psf/applications', kicForm(fifth.checkToken, { suffix: 'Logo again', business: { logoObjectKey: logo.json?.objectKey } }));
  check('another business cannot take the same logo', reused.status === 422 && reused.text.includes('logoObjectKey'), brief(reused));
  const logoApp = await one('SELECT id FROM psf_membership_applications WHERE doc_id = $1', [withLogo.json?.docId]);
  const logoDetail = await call(olivier, 'GET', `${V}/oversight/psf-applications/${logoApp.id}`);
  const logoApprove = await call(olivier, 'POST', `${V}/oversight/psf-applications/${logoApp.id}/approve`, { membershipNumber: logoDetail.json?.suggestedMembershipNumber });
  check('Kicukiro approves it, and it is a member', logoApprove.status === 200 && logoApprove.json.status === 'member', brief(logoApprove));
  const withLogoPdf = Buffer.from(await (await fetch(`${BASE}${V}/psf/track/${withLogo.json?.docId}/certificate`)).arrayBuffer());
  // Image streams are never packed into object streams, so each picture's
  // dictionary is plain in the file: PSF's logo, and now the business's.
  const images = (withLogoPdf.toString('latin1').match(/\/Subtype\s*\/Image/g) ?? []).length;
  check('its certificate carries the logo beside PSF\'s', withLogoPdf.subarray(0, 4).toString() === '%PDF' && images >= 2, `${images} image(s)`);
} catch (error) {
  fail += 1;
  console.log(`  FAIL  ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await db.end();
}

console.log(`\n${pass} passed, ${fail} failed.`);
if (fail) {
  console.log(`Failed: ${failures.join('; ')}`);
  process.exitCode = 1;
}
