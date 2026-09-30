#!/usr/bin/env node
/**
 * The broker side of the sample database (ADR-038 child 6, family `..15NN`).
 *
 * Every broker WORKSPACE the other seeds create had no `brokers` row behind it,
 * so the broker screens had nothing real to read and lived on a fixture. This
 * writes the rows a broker surface trades on:
 *
 *   - Samuel Kayitare (the demo broker persona): an opening grant of credits,
 *     two reveals that spent from it, a placement that became an active lease
 *     and was paid, one whose lease still awaits signatures, one converted
 *     earlier in the year, and one still open.
 *   - broker@injishi.com (the sign-in test account): a broker row and an
 *     opening grant, and nothing else, so `verify-broker.mjs` starts from a
 *     known state and can put it back.
 *
 * It references leases and listings the residence seeds own, by id, and only
 * ever sets `leases.broker_id` where it is still empty. Re-running is a no-op.
 * Every row is marked in its own `note` or id; fees and reveals carry no free
 * text, so their ids are the marking (`de300000-0000-4000-8000-0000000015NN`).
 *
 *   DATABASE_URL=… node scripts/seed-broker.mjs
 */
import pg from 'pg';

import { assertSampleDatabase } from './sample-database.mjs';

const B = (n) => `de300000-0000-4000-8000-0000000015${String(n).padStart(2, '0')}`;

const SAMUEL = 'de300000-0000-4000-8000-000000000006';
const INGORO = 'de300000-0000-4000-8000-000000000504';
const LAVENDER = '0f9a1b00-0002-4000-8000-000000000304';

/** Three leases the residence seeds write, each introduced by Samuel. */
const PLACED = [
  // Active and paid in full a few months ago.
  { placement: B(20), fee: B(30), lease: 'de300000-0000-4000-8000-000000001432', listing: INGORO, feeStatus: 'disbursed', monthsAgo: 5 },
  // Active and paid last month.
  { placement: B(21), fee: B(31), lease: 'de300000-0000-4000-8000-000000001430', listing: INGORO, feeStatus: 'disbursed', monthsAgo: 1 },
  // Registered with the broker on it, still waiting for signatures: the fee is pending.
  { placement: B(22), fee: B(32), lease: '0f9a1b00-0002-4000-8000-000000000403', listing: LAVENDER, feeStatus: 'pending', monthsAgo: 0 },
];

async function brokerFor(c, { id, email, userId, nationalId, name }) {
  const user = userId
    ? { rows: [{ id: userId }] }
    : await c.query(`SELECT id FROM users WHERE lower(email) = lower($1)`, [email]);
  const uid = user.rows[0]?.id;
  if (!uid) {
    console.log(`  skip ${email ?? userId}: no such user in this database`);
    return null;
  }
  const ws = await c.query(`SELECT 1 FROM workspaces WHERE user_id = $1 AND kind = 'broker'`, [uid]);
  if (ws.rowCount === 0) {
    console.log(`  skip ${email ?? userId}: holds no broker workspace`);
    return null;
  }
  const existing = await c.query(`SELECT id FROM brokers WHERE user_id = $1`, [uid]);
  if (existing.rows[0]) return existing.rows[0].id;
  const profile = await c.query(`SELECT email FROM users WHERE id = $1`, [uid]);
  await c.query(
    `INSERT INTO brokers (id, user_id, national_id, name, email, status)
     VALUES ($1, $2, $3, $4, $5, 'active')`,
    [id, uid, nationalId, name, profile.rows[0].email],
  );
  return id;
}

async function grant(c, { id, brokerId, delta, note, at }) {
  await c.query(
    `INSERT INTO broker_reveal_credits (id, broker_id, delta, reason, note, created_at)
     VALUES ($1, $2, $3, 'plan_grant', $4, $5)
     ON CONFLICT (id) DO NOTHING`,
    [id, brokerId, delta, note, at],
  );
}

function monthsAgo(n, day = 12) {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - n);
  d.setUTCDate(day);
  return d;
}

async function reveal(c, { id, spend, brokerId, listingId, at }) {
  const already = await c.query(`SELECT 1 FROM contact_reveals WHERE id = $1`, [id]);
  if (already.rowCount) return;
  const contact = await c.query(
    `SELECT o.id AS org_id,
            coalesce(nullif(p.contact_phone, ''), u.phone_number, up.phone_e164) AS phone,
            coalesce(nullif(p.contact_email, ''), u.email) AS email
       FROM listings l
       JOIN properties p ON p.id = l.property_id
       JOIN workspaces w ON w.id = l.workspace_id
       JOIN orgs o ON o.id = w.org_id
       LEFT JOIN org_memberships m ON m.org_id = o.id AND m.org_role = 'owner' AND m.status = 'active'
       LEFT JOIN users u ON u.id = m.user_id
       LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE l.id = $1
      ORDER BY m.created_at
      LIMIT 1`,
    [listingId],
  );
  const row = contact.rows[0];
  if (!row) throw new Error(`Listing ${listingId} is not in this database; run the residence seeds first.`);
  await c.query(
    `INSERT INTO contact_reveals (id, broker_id, listing_id, landlord_org_id, revealed_phone, revealed_email, revealed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, brokerId, listingId, row.org_id, row.phone, row.email, at],
  );
  await c.query(
    `INSERT INTO broker_reveal_credits (id, broker_id, delta, reason, reveal_id, created_at)
     VALUES ($1, $2, -1, 'reveal', $3, $4)`,
    [spend, brokerId, id, at],
  );
}

async function seedSamuel(c) {
  const brokerId = await brokerFor(c, {
    id: B(1),
    userId: SAMUEL,
    nationalId: '1198280012345606',
    name: 'Samuel Kayitare',
  });
  if (!brokerId) return;

  await grant(c, { id: B(2), brokerId, delta: 10, note: 'DEMO SAMPLE DATA: opening grant', at: monthsAgo(6, 2) });
  await reveal(c, { id: B(10), spend: B(11), brokerId, listingId: INGORO, at: monthsAgo(6, 4) });
  await reveal(c, { id: B(12), spend: B(13), brokerId, listingId: LAVENDER, at: monthsAgo(1, 3) });

  for (const p of PLACED) {
    const lease = await c.query(
      `SELECT id, org_id, workspace_id, monthly_rent_rwf, broker_id FROM leases WHERE id = $1`,
      [p.lease],
    );
    const l = lease.rows[0];
    if (!l) {
      console.log(`  skip placement ${p.placement}: lease ${p.lease} is not in this database`);
      continue;
    }
    if (l.broker_id && l.broker_id !== brokerId) {
      console.log(`  skip placement ${p.placement}: lease ${p.lease} already names another broker`);
      continue;
    }
    const at = monthsAgo(p.monthsAgo, 8);
    await c.query(`UPDATE leases SET broker_id = $1 WHERE id = $2 AND broker_id IS NULL`, [brokerId, p.lease]);
    await c.query(
      `INSERT INTO tenant_placements (id, broker_id, listing_id, landlord_org_id, status, lease_id, initiated_at)
       VALUES ($1, $2, $3, $4, 'converted', $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [p.placement, brokerId, p.listing, l.org_id, p.lease, at],
    );
    // One month's rent, the fee the placement-fee rule (F-R08) names.
    await c.query(
      `INSERT INTO placement_fees (id, lease_id, broker_id, workspace_id, amount_rwf, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT DO NOTHING`,
      [p.fee, p.lease, brokerId, l.workspace_id, l.monthly_rent_rwf, p.feeStatus, at, monthsAgo(p.monthsAgo, 20)],
    );
  }

  // Revealed and started, no lease yet: the row that reads "in progress".
  const ingoroOrg = await c.query(
    `SELECT w.org_id FROM listings l JOIN workspaces w ON w.id = l.workspace_id WHERE l.id = $1`,
    [INGORO],
  );
  await c.query(
    `INSERT INTO tenant_placements (id, broker_id, listing_id, landlord_org_id, status, initiated_at)
     VALUES ($1, $2, $3, $4, 'initiated', $5)
     ON CONFLICT (id) DO NOTHING`,
    [B(23), brokerId, INGORO, ingoroOrg.rows[0].org_id, monthsAgo(0, 2)],
  );
}

async function seedTestBroker(c) {
  const brokerId = await brokerFor(c, {
    id: '0f9a1b00-0015-4000-8000-000000000001',
    email: 'broker@injishi.com',
    nationalId: '9990000000001501',
    name: 'Test Broker',
  });
  if (!brokerId) return;
  await grant(c, {
    id: '0f9a1b00-0015-4000-8000-000000000002',
    brokerId,
    delta: 5,
    note: 'SAMPLE DATA: opening grant',
    at: monthsAgo(0, 1),
  });
}

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error('DATABASE_URL is not set.');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await assertSampleDatabase(client, 'seed-broker.mjs');
    await client.query('BEGIN');
    try {
      await seedSamuel(client);
      await seedTestBroker(client);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
    const { rows } = await client.query(
      `SELECT u.email,
              (SELECT coalesce(sum(delta), 0) FROM broker_reveal_credits c WHERE c.broker_id = b.id)::int AS balance,
              (SELECT count(*) FROM contact_reveals r WHERE r.broker_id = b.id)::int AS reveals,
              (SELECT count(*) FROM tenant_placements t WHERE t.broker_id = b.id)::int AS placements,
              (SELECT count(*) FROM placement_fees f WHERE f.broker_id = b.id)::int AS fees
         FROM brokers b JOIN users u ON u.id = b.user_id
        ORDER BY u.email`,
    );
    for (const r of rows) {
      console.log(`  ${r.email}: balance=${r.balance} reveals=${r.reveals} placements=${r.placements} fees=${r.fees}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`\nseed-broker: ${err.message}`);
  process.exit(1);
});
