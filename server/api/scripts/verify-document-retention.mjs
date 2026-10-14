// Verify that a submitted registration document cannot be destroyed by the
// person who uploaded it (F-S03 §5, F-S09).
//
// The audit this was written for found the opposite. `removeOwnUnattached`
// checked the uploader and the `legal_hold` flag and nothing else, and nothing
// in the codebase ever sets `legal_hold`. A registrant could therefore delete a
// certificate while an officer was on their way to read it — and worse, the
// bytes went first and the row delete then failed on
// `org_certificates.object_key`'s foreign key, leaving a certificate row
// pointing at a file that no longer existed and answering the caller with a 500.
//
// So this proves three things, and the first is the positive control without
// which the second proves nothing:
//
//   - an UNATTACHED upload is still deletable by the person who uploaded it;
//   - an ATTACHED one is refused, its row survives, and its bytes are still
//     readable afterwards through the officer's own route;
//   - somebody else's unattached upload is not deletable either.
//
//   VERIFY_API_URL=http://localhost:8021 \
//   DATABASE_URL=postgres://injishi:injishi@127.0.0.1:5460/injishi_docs \
//   node scripts/verify-document-retention.mjs
import pg from 'pg';

import { assertSampleDatabase } from './sample-database.mjs';

const API = process.env.VERIFY_API_URL || 'http://localhost:8000';
const OTP = process.env.VERIFY_OTP_CODE || '123456';
const DB = process.env.DATABASE_URL?.trim();

const SUBJECT = 'Umucyo Garden Guest House';
/** Any second account; it only needs a session to be refused with. */
const STRANGER = 'landlord@injishi.com';

let failures = 0;
let checks = 0;
function check(label, ok, detail) {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok || detail === undefined ? '' : `   ${detail}`}`);
}

const SESSIONS = new Map();
async function sessionFor(email) {
  if (SESSIONS.has(email)) return SESSIONS.get(email);
  const headers = { 'Content-Type': 'application/json', origin: 'http://localhost:3000' };
  const sent = await fetch(`${API}/api/auth/email-otp/send-verification-otp`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, type: 'sign-in' }),
  });
  if (sent.status === 429) {
    throw new Error(`${email} is OTP rate limited; on a sample database: delete from auth_otp_requests;`);
  }
  const res = await fetch(`${API}/api/auth/sign-in/email-otp`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, otp: OTP }),
  });
  const cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  if (!res.ok || !cookie) throw new Error(`could not sign in ${email}: ${res.status}`);
  SESSIONS.set(email, cookie);
  return cookie;
}

async function request(email, method, path, init = {}) {
  const cookie = await sessionFor(email);
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { origin: 'http://localhost:3000', cookie, ...(init.headers ?? {}) },
    body: init.body,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, json, message: String(json?.message ?? '') };
}

/** A tiny, valid PDF, so the upload route's mime allowlist is satisfied honestly. */
function tinyPdf(label) {
  const stream = `BT /F1 12 Tf 64 700 Td (${label}) Tj ET\n`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

async function uploadCertificate(email, label) {
  const form = new FormData();
  form.append('file', new Blob([tinyPdf(label)], { type: 'application/pdf' }), 'certificate.pdf');
  const r = await request(email, 'POST', '/api/v1/uploads/certificate', { body: form });
  if (r.status !== 200 && r.status !== 201) {
    throw new Error(`upload failed: ${r.status} ${r.message}`);
  }
  return r.json.objectKey;
}

const one = async (db, sql, params) => (await db.query(sql, params)).rows[0];

async function main() {
  if (!DB) throw new Error('DATABASE_URL is not set; point it at the database the API serves.');
  const db = new pg.Client({ connectionString: DB });
  await db.connect();
  try {
    await assertSampleDatabase(db, 'verify-document-retention.mjs');

    const org = await one(
      db,
      `SELECT o.id,
              (SELECT u.email FROM org_memberships m JOIN users u ON u.id = m.user_id
                WHERE m.org_id = o.id AND m.org_role = 'owner' AND m.status = 'active'
                ORDER BY m.created_at LIMIT 1) AS owner_email
         FROM orgs o WHERE o.legal_name = $1`,
      [SUBJECT],
    );
    if (!org?.owner_email) throw new Error(`${SUBJECT} has no owner in this database.`);
    const attached = await one(
      db,
      `SELECT c.id, c.object_key FROM org_certificates c
        JOIN stored_objects s ON s.object_key = c.object_key
       WHERE c.org_id = $1 LIMIT 1`,
      [org.id],
    );
    if (!attached) throw new Error(`${SUBJECT} carries no stored document; run seed-demo-documents.mjs.`);

    console.log(`\nVerifying document retention against ${API}\n`);

    console.log('=== Positive control: a draft upload is still the uploader\'s to remove ===');
    {
      const key = await uploadCertificate(org.owner_email, 'RETENTION CONTROL');
      const stored = await one(db, `SELECT object_key FROM stored_objects WHERE object_key = $1`, [key]);
      check('the upload is recorded', Boolean(stored), key);

      const removed = await request(
        org.owner_email,
        'DELETE',
        `/api/v1/uploads/certificate?objectKey=${encodeURIComponent(key)}`,
      );
      check('an unattached upload is removed on request', removed.status === 200, `${removed.status} ${removed.message}`);
      const afterRow = await one(db, `SELECT object_key FROM stored_objects WHERE object_key = $1`, [key]);
      check('and its row is gone', !afterRow);
    }

    console.log('=== Somebody else\'s upload is not theirs to remove ===');
    {
      const key = await uploadCertificate(org.owner_email, 'RETENTION STRANGER');
      const refused = await request(
        STRANGER,
        'DELETE',
        `/api/v1/uploads/certificate?objectKey=${encodeURIComponent(key)}`,
      );
      check('a different account is refused', refused.status === 404, `${refused.status} ${refused.message}`);
      const still = await one(db, `SELECT object_key FROM stored_objects WHERE object_key = $1`, [key]);
      check('and the upload survives', Boolean(still));
      // Tidy up the control's own leftovers.
      await request(org.owner_email, 'DELETE', `/api/v1/uploads/certificate?objectKey=${encodeURIComponent(key)}`);
    }

    console.log('=== A submitted document is evidence, and survives the attempt ===');
    {
      const attempt = await request(
        org.owner_email,
        'DELETE',
        `/api/v1/uploads/certificate?objectKey=${encodeURIComponent(attached.object_key)}`,
      );
      check('deleting an attached certificate is refused', attempt.status === 404, `${attempt.status} ${attempt.message}`);
      check('it is never a 500', attempt.status < 500, attempt.status);

      const row = await one(db, `SELECT object_key FROM stored_objects WHERE object_key = $1`, [attached.object_key]);
      check('the stored object survives', Boolean(row));
      const cert = await one(db, `SELECT object_key FROM org_certificates WHERE id = $1`, [attached.id]);
      check('the certificate still names it', cert?.object_key === attached.object_key);

      // The whole point: an officer can still read the bytes afterwards.
      const verifier = await one(
        db,
        `SELECT u.email FROM oversight_assignments a
           JOIN users u ON u.id = a.user_id
           JOIN orgs o ON o.district_id = a.district_id
          WHERE o.id = $1 AND a.oversight_role = 'business_field_verifier' AND a.revoked_at IS NULL
          LIMIT 1`,
        [org.id],
      );
      const list = await request(verifier.email, 'GET', `/api/v1/oversight/registrations/${org.id}/documents`);
      const doc = (list.json?.documents ?? []).find((d) => d.id === attached.id);
      check('the officer is still offered a link to it', Boolean(doc?.url), list.status);
      const bytes = doc?.url ? Buffer.from(await (await fetch(doc.url)).arrayBuffer()) : Buffer.alloc(0);
      check('and the document still opens', bytes.subarray(0, 4).toString() === '%PDF', bytes.byteLength);
    }
  } finally {
    await db.end();
  }

  console.log(`\n${checks - failures}/${checks} checks passed`);
  if (failures) {
    console.log('DOCUMENT RETENTION VERIFY FAILED');
    process.exit(1);
  }
  console.log('DOCUMENT RETENTION VERIFY PASSED');
}

main().catch((err) => {
  console.error(`\nverify-document-retention: ${err.message}`);
  process.exit(1);
});
