// Verify that a registration's documents reach the two officers who decide on
// it, and that the field verification gate makes them look (F-S03 §5).
//
// Every claim is a real request over a real session against a running API, with
// the database read directly to check what was written. It proves:
//
//   - a field verifier reads the documents on a business in their own queue,
//     and the signed link returns the real bytes of the real file;
//   - an officer outside the district is refused, and so is an anonymous caller;
//   - the gate REFUSES while a document has not been checked, writes nothing
//     when it refuses, and passes once every one has been;
//   - marking a document checked records who and when, and a second mark does
//     not move the first officer's name off it;
//   - the approver reads the same documents and sees who checked them, and
//     cannot record a check of their own.
//
// It MUTATES one demo business (Umucyo Garden Guest House) and puts it back:
// stage, review rows and document checks are all restored on the way out, so
// the script is re-runnable and the demo it borrows is unchanged.
//
//   VERIFY_API_URL=http://localhost:8021 \
//   DATABASE_URL=postgres://injishi:injishi@127.0.0.1:5460/injishi_docs \
//   node scripts/verify-registration-documents.mjs
import pg from 'pg';

import { assertSampleDatabase } from './sample-database.mjs';

const API = process.env.VERIFY_API_URL || 'http://localhost:8000';
const OTP = process.env.VERIFY_OTP_CODE || '123456';
const DB = process.env.DATABASE_URL?.trim();

/** Gasabo: the verifier whose queue holds the business under test. */
const VERIFIER = 'jeanbosco@demo.injishi.com';
/** Gasabo: the approver it moves to. */
const APPROVER = 'claudine@demo.injishi.com';
/** Karongi: an officer of the right function in the wrong region. */
const OUTSIDE = 'yvette@demo.injishi.com';
const SUBJECT = 'Umucyo Garden Guest House';

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

async function as(email, method, path, body) {
  const cookie = email === null ? '' : await sessionFor(email);
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      origin: 'http://localhost:3000',
      ...(cookie ? { cookie } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, json, message: String(json?.message ?? '') };
}

const one = async (db, sql, params) => (await db.query(sql, params)).rows[0];

/** The signed-in email of a field verifier whose district covers this business. */
async function officerFor(db, orgId) {
  const row = await one(
    db,
    `SELECT u.email FROM oversight_assignments a
       JOIN users u ON u.id = a.user_id
       JOIN orgs o ON o.district_id = a.district_id
      WHERE o.id = $1 AND a.oversight_role = 'business_field_verifier' AND a.revoked_at IS NULL
      LIMIT 1`,
    [orgId],
  );
  if (!row) throw new Error(`no field verifier covers ${orgId}`);
  return row.email;
}

async function main() {
  if (!DB) throw new Error('DATABASE_URL is not set; point it at the database the API serves.');
  const db = new pg.Client({ connectionString: DB });
  await db.connect();
  let org = null;
  try {
    await assertSampleDatabase(db, 'verify-registration-documents.mjs');
    org = await one(db, `SELECT id, registration_status FROM orgs WHERE legal_name = $1`, [SUBJECT]);
    if (!org) throw new Error(`${SUBJECT} is not in this database; run seed-sample.mjs.`);
    if (org.registration_status !== 'tin_verified') {
      throw new Error(`${SUBJECT} is ${org.registration_status}, not tin_verified; a previous run did not restore it.`);
    }
    const documents = (
      await db.query(`SELECT c.id, c.object_key, s.size_bytes IS NOT NULL AS has_object
                         FROM org_certificates c
                         LEFT JOIN stored_objects s ON s.object_key = c.object_key
                        WHERE c.org_id = $1 ORDER BY c.created_at, c.id`, [org.id])
    ).rows;
    if (documents.length === 0) {
      throw new Error(`${SUBJECT} carries no documents; run seed-demo-documents.mjs.`);
    }

    console.log(`\nVerifying registration document review against ${API}\n`);
    const DOCS = `/api/v1/oversight/registrations/${org.id}/documents`;

    console.log('=== The verifier reads the file, and the bytes are real ===');
    let list;
    {
      const r = await as(VERIFIER, 'GET', DOCS);
      check('a field verifier reads the documents', r.status === 200, `${r.status} ${r.message}`);
      list = r.json;
      check(
        'every document on the registration is listed',
        list?.documents?.length === documents.length,
        `${list?.documents?.length} vs ${documents.length}`,
      );
      check('none of them has been checked yet', list?.uncheckedCount === documents.length, list?.uncheckedCount);

      const withUrl = (list?.documents ?? []).filter((d) => d.url);
      check('the uploaded ones carry a link', withUrl.length > 0, withUrl.length);
      const fetched = await fetch(withUrl[0].url);
      const bytes = Buffer.from(await fetched.arrayBuffer());
      check('the link returns the document', fetched.status === 200, fetched.status);
      check('and it is the PDF that was uploaded', bytes.subarray(0, 4).toString() === '%PDF', bytes.subarray(0, 8).toString());
      check(
        'the size the officer is shown is the size of the file',
        bytes.byteLength === withUrl[0].sizeBytes,
        `${bytes.byteLength} vs ${withUrl[0].sizeBytes}`,
      );
      // Measured against the table, not asserted loosely: the first version of
      // this check read `expired.length >= 0`, which is true of every list.
      const expectedExpired = (
        await db.query(
          `SELECT count(*)::int n FROM org_certificates
            WHERE org_id = $1 AND expires_on IS NOT NULL AND expires_on < current_date`,
          [org.id],
        )
      ).rows[0].n;
      const expired = (list?.documents ?? []).filter((d) => d.expired).length;
      check(
        'expiry is flagged on exactly the certificates that have expired',
        expired === expectedExpired,
        `${expired} flagged vs ${expectedExpired} expired in the table`,
      );
    }

    console.log('=== Expiry is read from the certificate, on the file that has one ===');
    {
      const other = await one(
        db,
        `SELECT o.id, o.legal_name FROM orgs o
           JOIN org_certificates c ON c.org_id = o.id
          WHERE o.registration_status = 'tin_verified'
            AND c.expires_on IS NOT NULL AND c.expires_on < current_date
          LIMIT 1`,
      );
      if (!other) throw new Error('no queued business carries an expired certificate; run seed-demo-documents.mjs');
      const who = other.id === org.id ? VERIFIER : await officerFor(db, other.id);
      const r = await as(who, 'GET', `/api/v1/oversight/registrations/${other.id}/documents`);
      check(`${other.legal_name} is readable by its own district's verifier`, r.status === 200, `${r.status} ${r.message}`);
      check(
        'and its out of date certificate is flagged expired',
        (r.json?.documents ?? []).some((d) => d.expired),
        JSON.stringify((r.json?.documents ?? []).map((d) => [d.kind, d.expiresOn, d.expired])),
      );
    }

    console.log('=== The queue row says how many are waiting ===');
    {
      const q = await as(VERIFIER, 'GET', '/api/v1/oversight/verification-queue');
      const row = (q.json ?? []).find((x) => x.orgId === org.id);
      check('the business is in this officer\'s queue', Boolean(row), q.status);
      check('the row counts its documents', row?.documentCount === documents.length, row?.documentCount);
      check('and how many are unchecked', row?.uncheckedDocumentCount === documents.length, row?.uncheckedDocumentCount);
    }

    console.log('=== Region and identity ===');
    {
      const far = await as(OUTSIDE, 'GET', DOCS);
      check('an officer from another district is refused', far.status === 403, `${far.status} ${far.message}`);
      check('and told why', /region/i.test(far.message), far.message);
      const anon = await as(null, 'GET', DOCS);
      check('an anonymous caller is refused', anon.status === 401, anon.status);
    }

    console.log('=== The gate refuses while a document is unread ===');
    {
      const r = await as(VERIFIER, 'POST', `/api/v1/registrations/${org.id}/field-verify`, {});
      check('field verification is refused', r.status === 409, `${r.status} ${r.message}`);
      check('and the refusal counts what is left', /not been checked/i.test(r.message), r.message);
      const after = await one(db, `SELECT registration_status s FROM orgs WHERE id = $1`, [org.id]);
      check('the registration did not move', after.s === 'tin_verified', after.s);
      const reviews = await one(db, `SELECT count(*)::int n FROM org_registration_reviews WHERE org_id = $1`, [org.id]);
      check('and no decision was recorded', reviews.n === 0, reviews.n);
    }

    console.log('=== Marking a document checked ===');
    {
      const first = list.documents[0];
      const r = await as(VERIFIER, 'POST', `${DOCS}/${first.id}/check`);
      check('the verifier records a check', r.status === 200, `${r.status} ${r.message}`);
      check('the count drops by one', r.json?.uncheckedCount === documents.length - 1, r.json?.uncheckedCount);
      const stamped = r.json.documents.find((d) => d.id === first.id);
      check('the document names who checked it', Boolean(stamped?.checkedAt && stamped?.checkedByName), JSON.stringify(stamped?.checkedByName));
      const row = await one(db, `SELECT verified_at, verified_by_user_id FROM org_certificates WHERE id = $1`, [first.id]);
      check('and the database holds the same', Boolean(row.verified_at && row.verified_by_user_id));

      const again = await as(VERIFIER, 'POST', `${DOCS}/${first.id}/check`);
      const re = again.json?.documents?.find((d) => d.id === first.id);
      check('a second mark is not an error', again.status === 200, again.status);
      check('and does not move the first check', re?.checkedAt === stamped.checkedAt, `${re?.checkedAt} vs ${stamped.checkedAt}`);

      const strayOrg = await one(db, `SELECT id FROM orgs WHERE legal_name <> $1 AND registration_status = 'tin_verified' LIMIT 1`, [SUBJECT]);
      const stray = await one(db, `SELECT id FROM org_certificates WHERE org_id = $1 LIMIT 1`, [strayOrg.id]);
      if (stray) {
        const r2 = await as(VERIFIER, 'POST', `${DOCS}/${stray.id}/check`);
        check('a document from another registration is refused', r2.status === 404, `${r2.status} ${r2.message}`);
      }
    }

    console.log('=== Once every document has been read, the gate opens ===');
    {
      for (const d of list.documents.slice(1)) {
        await as(VERIFIER, 'POST', `${DOCS}/${d.id}/check`);
      }
      const left = await as(VERIFIER, 'GET', DOCS);
      check('nothing is left unchecked', left.json?.uncheckedCount === 0, left.json?.uncheckedCount);

      const pass = await as(VERIFIER, 'POST', `/api/v1/registrations/${org.id}/field-verify`, {});
      check('field verification now passes', pass.status === 200 || pass.status === 201, `${pass.status} ${pass.message}`);
      const moved = await one(db, `SELECT registration_status s FROM orgs WHERE id = $1`, [org.id]);
      check('and the business moves to the approval queue', moved.s === 'field_verified', moved.s);
    }

    console.log('=== The approver reads what the verifier read ===');
    {
      const r = await as(APPROVER, 'GET', DOCS);
      check('an approver reads the same documents', r.status === 200, `${r.status} ${r.message}`);
      check('and sees who checked them', (r.json?.documents ?? []).every((d) => d.checkedByName), JSON.stringify((r.json?.documents ?? []).map((d) => d.checkedByName)));
      const mark = await as(APPROVER, 'POST', `${DOCS}/${list.documents[0].id}/check`);
      check('an approver cannot record a check', mark.status === 403, `${mark.status} ${mark.message}`);
    }
  } finally {
    // Put the borrowed business back exactly as the seed left it, whatever
    // happened above: stage, the decision this script caused, and every check.
    if (org) {
      await db.query(`UPDATE org_certificates SET verified_at = NULL, verified_by_user_id = NULL
                       WHERE org_id = $1 AND id IN (SELECT id FROM org_certificates WHERE org_id = $1)`, [org.id]).catch(() => {});
      await db.query(`DELETE FROM org_registration_reviews WHERE org_id = $1 AND stage = 'tin_verified' AND decided_at > now() - interval '1 hour'`, [org.id]).catch(() => {});
      await db.query(`DELETE FROM org_registration_events WHERE org_id = $1 AND occurred_at > now() - interval '1 hour'`, [org.id]).catch(() => {});
      await db.query(`UPDATE orgs SET registration_status = 'tin_verified' WHERE id = $1`, [org.id]).catch(() => {});
    }
    await db.end();
  }

  console.log(`\n${checks - failures}/${checks} checks passed`);
  if (failures) {
    console.log('DOCUMENT REVIEW VERIFY FAILED');
    process.exit(1);
  }
  console.log('DOCUMENT REVIEW VERIFY PASSED');
}

main().catch((err) => {
  console.error(`\nverify-registration-documents: ${err.message}`);
  process.exit(1);
});
