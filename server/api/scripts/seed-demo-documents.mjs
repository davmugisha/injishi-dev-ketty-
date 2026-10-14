#!/usr/bin/env node
/**
 * Registration documents for the businesses sitting in the demo pipeline
 * (F-S03 §5, showcase).
 *
 * The pipeline seed writes `org_certificates` ROWS with no object behind them,
 * so a field verifier opening a file found a list of names and nothing to read.
 * This gives every queued business a real, openable document set: a one page
 * PDF per certificate, stored through the same object store the app uses, and
 * `object_key` written back onto the certificate.
 *
 * What it deliberately varies, because the point is to SHOW the review:
 *
 *   - businesses waiting on field verification have documents nobody has
 *     checked yet, which is the work the console now offers;
 *   - one of them carries an EXPIRED certificate, so the expiry flag has
 *     something to flag, and one carries an `other` document;
 *   - businesses already field-verified have their documents stamped as checked
 *     by the officer who verified them, so the approver sees who looked and
 *     when, and the separation between the two jobs is visible.
 *
 * Every document says DEMO SAMPLE DATA on its face, in the PDF itself, so a
 * screenshot of the console can never be mistaken for a real filing.
 *
 *   DATABASE_URL=… node scripts/seed-demo-documents.mjs
 *   DATABASE_URL=… node scripts/seed-demo-documents.mjs --check
 *
 * `--check` writes nothing. It asks whether every business in the two officer
 * queues has at least one document whose bytes are actually retrievable from
 * the store, and fails when one does not — which is what makes it a gate rather
 * than a hopeful message.
 *
 * Storage follows the API's own settings: `STORAGE_ADAPTER_MODE=live` puts the
 * bytes in the S3 bucket the API reads, anything else writes under
 * `STORAGE_LOCAL_ROOT` exactly as the local adapter does.
 */
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import { assertSampleDatabase } from './sample-database.mjs';

const CHECK_ONLY = process.argv.includes('--check');
const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * A setting from the environment, else from `server/api/.env`, else undefined —
 * the same order `issue-obo-claim-invitations.mjs` reads its own settings in.
 *
 * It matters here more than convenience: this script WRITES objects and then
 * `--check` READS them back, and the API reads them a third time. If the check
 * fell back to a different store than the seed wrote to, it would report a demo
 * with no documents while the documents were sitting in the bucket — which is
 * exactly what happened the first time this ran under a bare environment.
 */
function setting(name) {
  if (process.env[name] !== undefined) return process.env[name];
  const envFile = path.join(here, '..', '.env');
  if (!fs.existsSync(envFile)) return undefined;
  const line = readEnvLines(envFile).find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim() : undefined;
}

function readEnvLines(file) {
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((l) => !l.trimStart().startsWith('#'));
}

/** The demo pipeline's own id block (`seed-demo-portfolio.mjs` family 31NN). */
const DOC_ID = (n) => `de300000-0000-4000-8000-0031090${String(n).padStart(5, '0')}`;
const OBJ_ID = (n) => `de300000-0000-4000-8000-0031080${String(n).padStart(5, '0')}`;

/**
 * What each business carries, by legal name so this seed never has to repeat
 * the pipeline's id arithmetic. `expiredDaysAgo` puts a certificate's expiry in
 * the past on purpose.
 */
const DOCUMENTS = {
  'Umucyo Garden Guest House': [
    { kind: 'rdb_grade', title: 'RDB grade certificate', number: 'RDB/GR/2026/0188', issuedBy: 'Rwanda Development Board', validYears: 3 },
    { kind: 'tourism_license', title: 'Tourism operating licence', number: 'RTL/2026/1142', issuedBy: 'Rwanda Development Board', validYears: 1 },
    { kind: 'fire_safety', title: 'Fire safety inspection', number: 'RNP/FS/2026/0771', issuedBy: 'Rwanda National Police', validYears: 1 },
  ],
  'Kacyiru Jacaranda Suites': [
    { kind: 'rdb_grade', title: 'RDB grade certificate', number: 'RDB/GR/2025/0902', issuedBy: 'Rwanda Development Board', validYears: 3 },
    { kind: 'tax_clearance', title: 'Tax clearance certificate', number: 'RRA/TC/2026/4410', issuedBy: 'Rwanda Revenue Authority', validYears: 1 },
    // The one the verifier is meant to catch: valid document, out of date.
    { kind: 'health_inspection', title: 'Health inspection report', number: 'MOH/HI/2024/0231', issuedBy: 'Ministry of Health', validYears: 1, expiredDaysAgo: 96 },
  ],
  'Kagarama Courtyard Guest House': [
    { kind: 'rdb_grade', title: 'RDB grade certificate', number: 'RDB/GR/2026/0233', issuedBy: 'Rwanda Development Board', validYears: 3 },
    { kind: 'other', kindOther: 'District trading licence', title: 'District trading licence', number: 'KIC/TL/2026/0518', issuedBy: 'Kicukiro District', validYears: 1 },
  ],
  'Kanombe Stopover Motel': [
    { kind: 'rdb_grade', title: 'RDB grade certificate', number: 'RDB/GR/2026/0341', issuedBy: 'Rwanda Development Board', validYears: 3 },
    { kind: 'tourism_license', title: 'Tourism operating licence', number: 'RTL/2026/1188', issuedBy: 'Rwanda Development Board', validYears: 1 },
  ],
  'Inzozi Hotels Ltd': [
    { kind: 'rdb_grade', title: 'RDB grade certificate', number: 'RDB/GR/2026/0090', issuedBy: 'Rwanda Development Board', validYears: 3 },
    { kind: 'tax_clearance', title: 'Tax clearance certificate', number: 'RRA/TC/2026/4102', issuedBy: 'Rwanda Revenue Authority', validYears: 1 },
  ],
  // Already field-verified: the approver reads these, stamped by the verifier.
  'Amizero Boutique Hotel': [
    { kind: 'rdb_grade', title: 'RDB grade certificate', number: 'RDB/GR/2026/0455', issuedBy: 'Rwanda Development Board', validYears: 3, checked: true },
    { kind: 'tourism_license', title: 'Tourism operating licence', number: 'RTL/2026/1203', issuedBy: 'Rwanda Development Board', validYears: 1, checked: true },
    { kind: 'fire_safety', title: 'Fire safety inspection', number: 'RNP/FS/2026/0822', issuedBy: 'Rwanda National Police', validYears: 1, checked: true },
  ],
  'Isange Rooms Gisozi': [
    { kind: 'rdb_grade', title: 'RDB grade certificate', number: 'RDB/GR/2026/0461', issuedBy: 'Rwanda Development Board', validYears: 3, checked: true },
    { kind: 'tax_clearance', title: 'Tax clearance certificate', number: 'RRA/TC/2026/4477', issuedBy: 'Rwanda Revenue Authority', validYears: 1, checked: true },
  ],
};

// ---------------------------------------------------------------------------
// The document itself
// ---------------------------------------------------------------------------

/** PDF strings are parenthesised; a literal bracket or backslash must escape. */
const pdfText = (s) => String(s).replace(/([\\()])/g, '\\$1');

/**
 * A one page PDF, written by hand.
 *
 * No dependency, because a seed that needs a PDF library to fill a demo is a
 * seed nobody runs. The cross reference table is built from the real byte
 * offsets, so this is a valid PDF that any reader opens rather than a blob with
 * a `.pdf` on the end.
 */
function certificatePdf(lines) {
  const body = lines
    .map(
      (line, i) =>
        `BT /F1 ${i === 0 ? 17 : 11} Tf 64 ${690 - i * 26} Td (${pdfText(line)}) Tj ET`,
    )
    .join('\n');
  const stream = `0.10 0.12 0.11 rg\n${body}\n`;
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

// ---------------------------------------------------------------------------
// The object store, following the API's own settings
// ---------------------------------------------------------------------------

function storageMode() {
  return (setting('STORAGE_ADAPTER_MODE') ?? '').trim().toLowerCase() === 'live' ? 'live' : 'local';
}

/** The same key shape `mintObjectKey` produces: `certificate/YYYY/MM/<uuid>.pdf`. */
function mintKey(now = new Date()) {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `certificate/${yyyy}/${mm}/${randomUUID()}.pdf`;
}

async function s3Client() {
  const { S3Client } = await import('@aws-sdk/client-s3');
  const endpoint = setting('STORAGE_S3_ENDPOINT');
  if (!endpoint) throw new Error('STORAGE_ADAPTER_MODE=live needs STORAGE_S3_ENDPOINT.');
  return new S3Client({
    endpoint,
    region: setting('STORAGE_S3_REGION') || 'us-east-1',
    forcePathStyle: true,
    credentials: {
      accessKeyId: setting('STORAGE_S3_ACCESS_KEY') ?? '',
      secretAccessKey: setting('STORAGE_S3_SECRET_KEY') ?? '',
    },
  });
}

const BUCKET = () => setting('STORAGE_BUCKET') || 'injishi';
const LOCAL_ROOT = () =>
  path.resolve(setting('STORAGE_LOCAL_ROOT') ?? path.join(process.cwd(), '.storage'));

/** Put bytes where the API will look for them. */
async function putObject(key, body) {
  if (storageMode() === 'local') {
    const target = path.join(LOCAL_ROOT(), key);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body);
    return;
  }
  const { PutObjectCommand } = await import('@aws-sdk/client-s3');
  const client = await s3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET(),
      Key: key,
      Body: body,
      ContentType: 'application/pdf',
    }),
  );
}

/** Are the bytes really there? The whole point of `--check`. */
async function objectExists(key) {
  if (storageMode() === 'local') {
    return fs.existsSync(path.join(LOCAL_ROOT(), key));
  }
  const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
  const client = await s3Client();
  try {
    await client.send(new HeadObjectCommand({ Bucket: BUCKET(), Key: key }));
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

/** What a certificate of each kind is called on its own face. */
const KIND_TITLE = {
  rdb_grade: 'RDB grade certificate',
  tourism_license: 'Tourism operating licence',
  tax_clearance: 'Tax clearance certificate',
  fire_safety: 'Fire safety inspection',
  health_inspection: 'Health inspection report',
  other: 'Supporting document',
};

const day = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86_400_000);

/** A stable small integer per document, so re-running writes the same ids. */
function slot(orgName, index) {
  const h = createHash('sha256').update(orgName).digest();
  return ((h[0] << 8) | h[1]) % 900 * 10 + index;
}

async function seed(client) {
  const written = { objects: 0, documents: 0, checked: 0, skipped: 0 };

  for (const [legalName, docs] of Object.entries(DOCUMENTS)) {
    const { rows: orgRows } = await client.query(
      `SELECT o.id, o.registration_status,
              (SELECT m.user_id FROM org_memberships m
                WHERE m.org_id = o.id AND m.org_role = 'owner' AND m.status = 'active'
                ORDER BY m.created_at LIMIT 1) AS owner_id,
              (SELECT r.decided_by_user_id FROM org_registration_reviews r
                WHERE r.org_id = o.id AND r.stage = 'tin_verified' AND r.decision = 'passed'
                ORDER BY r.decided_at DESC LIMIT 1) AS verifier_id
         FROM orgs o WHERE o.legal_name = $1`,
      [legalName],
    );
    const org = orgRows[0];
    if (!org) {
      console.log(`  skip ${legalName}: not in this database`);
      written.skipped += 1;
      continue;
    }

    let i = 0;
    for (const doc of docs) {
      i += 1;
      const id = DOC_ID(slot(legalName, i));
      const { rows: existing } = await client.query(
        `SELECT id, object_key FROM org_certificates WHERE id = $1`,
        [id],
      );
      // A row this seed already wrote, with its file: nothing to do.
      if (existing[0]?.object_key && (await objectExists(existing[0].object_key))) continue;

      const issuedOn = doc.expiredDaysAgo
        ? addDays(new Date(), -(doc.expiredDaysAgo + 365 * doc.validYears))
        : addDays(new Date(), -Math.round(365 * doc.validYears * 0.4));
      const expiresOn = addDays(issuedOn, Math.round(365 * doc.validYears));

      const pdf = certificatePdf([
        doc.title,
        'DEMO SAMPLE DATA — not a real certificate',
        '',
        `Business: ${legalName}`,
        `Certificate number: ${doc.number}`,
        `Issued by: ${doc.issuedBy}`,
        `Issued on: ${day(issuedOn)}`,
        `Expires on: ${day(expiresOn)}`,
        '',
        'Uploaded with the business registration and shown to the',
        'field verifier and the approver inside the Injishi console.',
      ]);

      const objectKey = existing[0]?.object_key ?? mintKey();
      await putObject(objectKey, pdf);
      written.objects += 1;

      // The object row the API joins through. `uploaded_by` is the owner: this
      // is the registrant's own upload, replayed.
      await client.query(
        `INSERT INTO stored_objects (id, object_key, kind, mime, size_bytes, uploaded_by_user_id, created_at, updated_at)
         VALUES ($1, $2, 'certificate', 'application/pdf', $3, $4, now(), now())
         ON CONFLICT (object_key) DO NOTHING`,
        [OBJ_ID(slot(legalName, i)), objectKey, pdf.byteLength, org.owner_id],
      );

      // Documents on a business the verifier has already passed are stamped by
      // the officer who passed it; the ones still in their queue are not.
      const checked = doc.checked && org.verifier_id ? org.verifier_id : null;
      if (checked) written.checked += 1;

      await client.query(
        `INSERT INTO org_certificates
           (id, org_id, kind, kind_other, object_key, certificate_number, issued_by,
            issued_on, expires_on, verified_at, verified_by_user_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), now())
         ON CONFLICT (id) DO UPDATE SET
           object_key = EXCLUDED.object_key,
           certificate_number = EXCLUDED.certificate_number,
           issued_by = EXCLUDED.issued_by,
           issued_on = EXCLUDED.issued_on,
           expires_on = EXCLUDED.expires_on,
           verified_at = EXCLUDED.verified_at,
           verified_by_user_id = EXCLUDED.verified_by_user_id,
           updated_at = now()`,
        [
          id,
          org.id,
          doc.kind,
          doc.kindOther ?? null,
          objectKey,
          doc.number,
          doc.issuedBy,
          day(issuedOn),
          day(expiresOn),
          checked ? addDays(new Date(), -2) : null,
          checked,
        ],
      );
      written.documents += 1;
    }
  }

  written.backfilled = await backfill(client);

  console.log(
    `  documents written ${written.documents}, objects stored ${written.objects}, ` +
      `stamped as checked ${written.checked}, businesses skipped ${written.skipped}, ` +
      `earlier rows given a file ${written.backfilled}`,
  );
}

/**
 * Give a file to certificates the PIPELINE seed wrote before this script
 * existed.
 *
 * `seed-demo-portfolio.mjs` writes `org_certificates` rows with a number and an
 * issuer and no object at all. They are legitimate rows — a business can
 * declare a certificate it never uploaded — but a console demo full of "no file
 * was uploaded" shows the empty state rather than the review. So every
 * certificate on a business waiting in either queue gets the document it
 * describes.
 */
async function backfill(client) {
  const { rows } = await client.query(
    `SELECT c.id, c.kind, c.kind_other, c.certificate_number, c.issued_by,
            c.issued_on, c.expires_on, o.legal_name,
            (SELECT m.user_id FROM org_memberships m
              WHERE m.org_id = o.id AND m.org_role = 'owner' AND m.status = 'active'
              ORDER BY m.created_at LIMIT 1) AS owner_id
       FROM org_certificates c
       JOIN orgs o ON o.id = c.org_id
      WHERE c.object_key IS NULL
        AND o.registration_status IN ('tin_verified', 'field_verified')`,
  );

  let n = 0;
  for (const row of rows) {
    const title = row.kind === 'other' && row.kind_other ? row.kind_other : KIND_TITLE[row.kind] ?? 'Certificate';
    const pdf = certificatePdf([
      title,
      'DEMO SAMPLE DATA — not a real certificate',
      '',
      `Business: ${row.legal_name}`,
      `Certificate number: ${row.certificate_number ?? '—'}`,
      `Issued by: ${row.issued_by ?? '—'}`,
      `Issued on: ${row.issued_on ? day(new Date(row.issued_on)) : '—'}`,
      `Expires on: ${row.expires_on ? day(new Date(row.expires_on)) : '—'}`,
      '',
      'Uploaded with the business registration and shown to the',
      'field verifier and the approver inside the Injishi console.',
    ]);
    const objectKey = mintKey();
    await putObject(objectKey, pdf);
    await client.query(
      `INSERT INTO stored_objects (object_key, kind, mime, size_bytes, uploaded_by_user_id, created_at, updated_at)
       VALUES ($1, 'certificate', 'application/pdf', $2, $3, now(), now())
       ON CONFLICT (object_key) DO NOTHING`,
      [objectKey, pdf.byteLength, row.owner_id],
    );
    await client.query(`UPDATE org_certificates SET object_key = $1, updated_at = now() WHERE id = $2`, [
      objectKey,
      row.id,
    ]);
    n += 1;
  }
  return n;
}

/**
 * The gate: every business in either officer queue must have at least one
 * document whose bytes come back from the store.
 */
async function check(client) {
  const { rows } = await client.query(
    `SELECT o.id, o.legal_name, o.registration_status,
            (SELECT count(*) FROM org_certificates c WHERE c.org_id = o.id)::int AS certs
       FROM orgs o
      WHERE o.registration_status IN ('tin_verified', 'field_verified')
      ORDER BY o.legal_name`,
  );
  if (rows.length === 0) throw new Error('no business is waiting in either officer queue');

  let failures = 0;
  let openable = 0;
  let unchecked = 0;
  let expired = 0;
  for (const org of rows) {
    const { rows: docs } = await client.query(
      `SELECT c.object_key, c.verified_at, c.expires_on
         FROM org_certificates c
         JOIN stored_objects s ON s.object_key = c.object_key
        WHERE c.org_id = $1`,
      [org.id],
    );
    let withBytes = 0;
    for (const d of docs) {
      if (await objectExists(d.object_key)) {
        withBytes += 1;
        openable += 1;
        if (!d.verified_at) unchecked += 1;
        // `pg` hands a `date` column back as a Date, not a string: comparing it
        // against an ISO string silently answered false and reported no expiry
        // at all. Normalise before comparing.
        const expiresOn = d.expires_on instanceof Date ? day(d.expires_on) : d.expires_on;
        if (expiresOn && expiresOn < day(new Date())) expired += 1;
      }
    }
    const ok = withBytes > 0;
    if (!ok) failures += 1;
    console.log(
      `  ${ok ? 'OK  ' : 'FAIL'} ${org.legal_name} (${org.registration_status}): ` +
        `${withBytes} of ${org.certs} documents are openable`,
    );
  }

  console.log(
    `\n  ${rows.length} businesses queued, ${openable} openable documents, ` +
      `${unchecked} waiting to be checked, ${expired} expired`,
  );
  if (failures > 0) {
    throw new Error(`${failures} queued business(es) have no openable document`);
  }
  // A showcase with nothing left to do shows nothing: the console's whole point
  // is the unchecked pile in the verifier's queue.
  if (unchecked === 0) throw new Error('no document is left unchecked, so the console has nothing to demonstrate');
  if (expired === 0) throw new Error('no document is expired, so the expiry flag cannot be shown');
  console.log('DEMO DOCUMENTS READY');
}

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error('DATABASE_URL is not set.');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await assertSampleDatabase(client, 'seed-demo-documents.mjs');
    console.log(
      `Registration documents (${storageMode()} storage${storageMode() === 'live' ? `, bucket ${BUCKET()}` : `, ${LOCAL_ROOT()}`}).`,
    );
    if (!CHECK_ONLY) await seed(client);
    await check(client);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`\nseed-demo-documents: ${err.message}`);
  process.exit(1);
});
