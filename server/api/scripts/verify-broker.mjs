// Verify the broker surface over HTTP (ADR-038 child 6).
//
// Every claim below is a real request over a real session against a running
// API, with the database read independently to check what was WRITTEN, not
// only what was answered. It proves:
//
//   - the directory lists real published residence listings, contact hidden
//     until revealed, vacancy matching the lease table;
//   - a reveal spends exactly one credit, a repeat spends none, three presses
//     at once make one reveal and one charge, and an empty balance is refused
//     with 402 and nothing written;
//   - a placement needs a reveal first, and a second press returns the first;
//   - one broker never sees another's placements or fees, and the demo broker's
//     earnings total what `placement_fees` holds;
//   - a business workspace and a suspended broker are refused.
//
// It MUTATES the `broker@injishi.com` broker, then puts it back to exactly what
// `seed-broker.mjs` writes. The Samuel persona is only read. Run it against a
// SAMPLE database with the API up:
//
//   VERIFY_API_URL=http://localhost:8020 \
//   DATABASE_URL=postgres://injishi:injishi@127.0.0.1:5432/injishi_broker \
//   node scripts/verify-broker.mjs
//
// Three sign ins per run (broker@, samuel@, landlord@), one each: inside the
// five per hour OTP cap, but a sixth run within the hour for one account is a
// 429. On a sample database `delete from auth_otp_requests;` clears it.
import pg from 'pg';

import { assertSampleDatabase } from './sample-database.mjs';

const API = process.env.VERIFY_API_URL || 'http://localhost:8000';
const OTP = process.env.VERIFY_OTP_CODE || '123456';
const DB = process.env.DATABASE_URL?.trim();

const INGORO = 'de300000-0000-4000-8000-000000000504';
const LAVENDER = '0f9a1b00-0002-4000-8000-000000000304';
const TEST_BROKER = '0f9a1b00-0015-4000-8000-000000000001';
const TEST_GRANT = '0f9a1b00-0015-4000-8000-000000000002';

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
  if (sent.status === 429) throw new Error(`${email} is OTP rate limited; on a sample database: delete from auth_otp_requests;`);
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

async function as(email, method, path, workspaceId) {
  const cookie = await sessionFor(email);
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { cookie, origin: 'http://localhost:3000', ...(workspaceId ? { 'x-workspace-id': workspaceId } : {}) },
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, json, message: String(json?.message ?? '') };
}

async function workspaceOf(email, kind) {
  const { json } = await as(email, 'GET', '/api/v1/me/workspaces');
  const rows = Array.isArray(json) ? json : (json?.workspaces ?? []);
  return rows.find((w) => w.kind === kind)?.workspaceId ?? null;
}

async function resetTestBroker(db) {
  await db.query(`DELETE FROM tenant_placements WHERE broker_id = $1`, [TEST_BROKER]);
  await db.query(`DELETE FROM broker_reveal_credits WHERE broker_id = $1`, [TEST_BROKER]);
  await db.query(`DELETE FROM contact_reveals WHERE broker_id = $1`, [TEST_BROKER]);
  await db.query(`UPDATE brokers SET status = 'active' WHERE id = $1`, [TEST_BROKER]);
  await db.query(
    `INSERT INTO broker_reveal_credits (id, broker_id, delta, reason, note)
     VALUES ($1, $2, 5, 'plan_grant', 'SAMPLE DATA: opening grant')`,
    [TEST_GRANT, TEST_BROKER],
  );
}

const count = async (db, sql, params) => Number((await db.query(sql, params)).rows[0].n);

async function main() {
  if (!DB) throw new Error('DATABASE_URL is not set; point it at the database the API at VERIFY_API_URL serves.');
  const db = new pg.Client({ connectionString: DB });
  await db.connect();
  try {
    await assertSampleDatabase(db, 'verify-broker.mjs');
    const exists = await count(db, `SELECT count(*) n FROM brokers WHERE id = $1`, [TEST_BROKER]);
    if (!exists) throw new Error('broker@injishi.com has no broker row; run seed-broker.mjs first.');
    await resetTestBroker(db);

    console.log(`\nVerifying the broker surface against ${API}\n`);
    const mine = await workspaceOf('broker@injishi.com', 'broker');
    const samuel = await workspaceOf('samuel@demo.injishi.com', 'broker');
    const landlord = await workspaceOf('landlord@injishi.com', 'business');
    if (!mine || !samuel || !landlord) throw new Error('a seeded workspace is missing');
    const B = (method, path) => as('broker@injishi.com', method, `/api/v1/ops/broker${path}`, mine);

    console.log('=== Directory: real listings, contact hidden ===');
    {
      const r = await B('GET', '/directory');
      check('GET /directory is 200', r.status === 200, r.status);
      const ids = (r.json?.listings ?? []).map((l) => l.listingId);
      const expected = (
        await db.query(
          `SELECT l.id FROM listings l JOIN workspaces w ON w.id = l.workspace_id JOIN orgs o ON o.id = w.org_id
            WHERE l.status = 'published' AND o.domain = 'residence' AND o.registration_status = 'active' ORDER BY 1`,
        )
      ).rows.map((x) => x.id);
      check('lists exactly the published residence listings of active orgs', JSON.stringify([...ids].sort()) === JSON.stringify(expected), `${ids} vs ${expected}`);
      check('no listing carries a contact before a reveal', (r.json?.listings ?? []).every((l) => l.contact === null));
      check('balance is the seeded grant', r.json?.balance === 5, r.json?.balance);
      const ingoro = r.json?.listings?.find((l) => l.listingId === INGORO);
      const vacant = await count(
        db,
        `SELECT count(*) n FROM rooms r JOIN room_types rt ON rt.id = r.room_type_id JOIN listings l ON l.property_id = rt.property_id
          WHERE l.id = $1 AND rt.domain = 'residence' AND rt.status = 'active'
            AND NOT EXISTS (SELECT 1 FROM leases le WHERE le.room_id = r.id AND le.status = 'active')`,
        [INGORO],
      );
      const served = (ingoro?.units ?? []).reduce((s, u) => s + u.vacantUnits, 0);
      check('Ingoro vacancy matches the lease table', served === vacant, `${served} vs ${vacant}`);
      check('every Ingoro unit has a rent', (ingoro?.units ?? []).length > 0 && ingoro.units.every((u) => u.monthlyRentRwf > 0));
    }

    console.log('=== A placement needs a reveal first ===');
    {
      const r = await B('POST', `/directory/${INGORO}/placements`);
      check('placement before a reveal is 409', r.status === 409, `${r.status} ${r.message}`);
      check('and writes no placement', (await count(db, `SELECT count(*) n FROM tenant_placements WHERE broker_id = $1`, [TEST_BROKER])) === 0);
    }

    console.log('=== Reveal spends one credit, once ===');
    {
      const r = await B('POST', `/directory/${INGORO}/reveal`);
      check('reveal is 200 and charged', r.status === 200 && r.json?.charged === true, `${r.status} ${JSON.stringify(r.json)}`);
      check('balance drops by one', r.json?.balance === 4, r.json?.balance);
      check('the contact comes back', Boolean(r.json?.contact?.email || r.json?.contact?.phone));
      const again = await B('POST', `/directory/${INGORO}/reveal`);
      check('a repeat is not charged', again.status === 200 && again.json?.charged === false, JSON.stringify(again.json));
      check('and returns the same reveal', again.json?.contact?.revealedAt === r.json?.contact?.revealedAt);
      check('one reveal row', (await count(db, `SELECT count(*) n FROM contact_reveals WHERE broker_id = $1 AND listing_id = $2`, [TEST_BROKER, INGORO])) === 1);
      check('ledger sum is 4', (await count(db, `SELECT coalesce(sum(delta),0) n FROM broker_reveal_credits WHERE broker_id = $1`, [TEST_BROKER])) === 4);
    }

    console.log('=== An empty balance is refused with nothing written ===');
    {
      await db.query(`INSERT INTO broker_reveal_credits (broker_id, delta, reason, note) VALUES ($1, -4, 'correction', 'verify-broker drain')`, [TEST_BROKER]);
      const r = await B('POST', `/directory/${LAVENDER}/reveal`);
      check('reveal with 0 credits is 402', r.status === 402, `${r.status} ${r.message}`);
      check('the refusal names the balance', /you have 0/.test(r.message), r.message);
      check('no reveal row written', (await count(db, `SELECT count(*) n FROM contact_reveals WHERE broker_id = $1 AND listing_id = $2`, [TEST_BROKER, LAVENDER])) === 0);
      check('no ledger row written', (await count(db, `SELECT count(*) n FROM broker_reveal_credits WHERE broker_id = $1`, [TEST_BROKER])) === 3);
    }

    console.log('=== Three presses at once: one reveal, one charge ===');
    {
      await db.query(`INSERT INTO broker_reveal_credits (broker_id, delta, reason, note) VALUES ($1, 3, 'refund', 'verify-broker top up')`, [TEST_BROKER]);
      const all = await Promise.all([1, 2, 3].map(() => B('POST', `/directory/${LAVENDER}/reveal`)));
      check('all three answer 200', all.every((r) => r.status === 200), all.map((r) => r.status).join(','));
      check('exactly one was charged', all.filter((r) => r.json?.charged).length === 1, all.map((r) => r.json?.charged).join(','));
      check('one reveal row', (await count(db, `SELECT count(*) n FROM contact_reveals WHERE broker_id = $1 AND listing_id = $2`, [TEST_BROKER, LAVENDER])) === 1);
      check('ledger sum is 2', (await count(db, `SELECT coalesce(sum(delta),0) n FROM broker_reveal_credits WHERE broker_id = $1`, [TEST_BROKER])) === 2);
    }

    console.log('=== Placement after a reveal, idempotent ===');
    let placementId;
    {
      const r = await B('POST', `/directory/${INGORO}/placements`);
      check('placement is 200 and initiated', r.status === 200 && r.json?.status === 'initiated', `${r.status} ${r.message}`);
      placementId = r.json?.id;
      const again = await B('POST', `/directory/${INGORO}/placements`);
      check('a second press returns the same placement', again.json?.id === placementId);
      check('one placement row', (await count(db, `SELECT count(*) n FROM tenant_placements WHERE broker_id = $1`, [TEST_BROKER])) === 1);
      const dir = await B('GET', '/directory');
      check('the directory names the open placement', dir.json?.listings?.find((l) => l.listingId === INGORO)?.openPlacementId === placementId);
    }

    console.log('=== Placements, earnings and credits are the broker\'s own ===');
    {
      const p = await B('GET', '/placements');
      check('placements lists only this broker\'s one', p.json?.placements?.length === 1 && p.json.placements[0].id === placementId, JSON.stringify(p.json?.placements?.map((x) => x.id)));
      const e = await B('GET', '/earnings');
      check('earnings has no fees', e.status === 200 && e.json?.fees?.length === 0 && e.json?.pendingRwf === 0);
      const c = await B('GET', '/credits');
      check('credits balance is the entry sum', c.json?.balance === 2 && c.json.entries.reduce((s, x) => s + x.delta, 0) === 2);
      check('a spend names the property it revealed', c.json?.entries?.some((x) => x.reason === 'reveal' && x.propertyName));

      const S = (path) => as('samuel@demo.injishi.com', 'GET', `/api/v1/ops/broker${path}`, samuel);
      const sp = await S('/placements');
      const samuelRows = await count(db, `SELECT count(*) n FROM tenant_placements t JOIN brokers b ON b.id = t.broker_id WHERE b.user_id = 'de300000-0000-4000-8000-000000000006'`);
      check('Samuel sees his own placements', sp.json?.placements?.length === samuelRows && samuelRows > 0, `${sp.json?.placements?.length} vs ${samuelRows}`);
      check('and not the test broker\'s', !sp.json?.placements?.some((x) => x.id === placementId));
      const se = await S('/earnings');
      const sums = (
        await db.query(
          `SELECT coalesce(sum(f.amount_rwf) FILTER (WHERE f.status = 'pending'), 0)::int AS pending,
                  coalesce(sum(f.amount_rwf) FILTER (WHERE f.status = 'disbursed' AND f.updated_at >= date_trunc('year', now())), 0)::int AS paid
             FROM placement_fees f JOIN brokers b ON b.id = f.broker_id WHERE b.user_id = 'de300000-0000-4000-8000-000000000006'`,
        )
      ).rows[0];
      check('Samuel\'s pending total matches placement_fees', se.json?.pendingRwf === sums.pending && sums.pending > 0, `${se.json?.pendingRwf} vs ${sums.pending}`);
      check('Samuel\'s disbursed this year matches placement_fees', se.json?.disbursedThisYearRwf === sums.paid, `${se.json?.disbursedThisYearRwf} vs ${sums.paid}`);

      const cross = await as('broker@injishi.com', 'GET', '/api/v1/ops/broker/placements', samuel);
      check('naming another broker\'s workspace is refused', cross.status === 403, cross.status);
    }

    console.log('=== Refusals ===');
    {
      const biz = await as('landlord@injishi.com', 'GET', '/api/v1/ops/broker/directory', landlord);
      check('a business workspace is refused', biz.status === 403, `${biz.status} ${biz.message}`);
      await db.query(`UPDATE brokers SET status = 'suspended' WHERE id = $1`, [TEST_BROKER]);
      const read = await B('GET', '/directory');
      check('a suspended broker still reads', read.status === 200 && read.json?.brokerStatus === 'suspended');
      const write = await B('POST', `/directory/${INGORO}/placements`);
      check('a suspended broker is refused a write with 422', write.status === 422, `${write.status} ${write.message}`);
    }

  } finally {
    // Put the test broker back even when a check threw part way.
    await resetTestBroker(db).catch(() => {});
    await db.end();
  }

  console.log(`\n${checks - failures}/${checks} checks passed`);
  if (failures) {
    console.log('BROKER VERIFY FAILED');
    process.exit(1);
  }
  console.log('BROKER VERIFY PASSED');
}

main().catch((err) => {
  console.error(`\nverify-broker: ${err.message}`);
  process.exit(1);
});
