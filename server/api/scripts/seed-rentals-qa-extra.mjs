#!/usr/bin/env node
/**
 * Extra QA rows for feat/revamp testing DB: more users, broker-offer units, and
 * guest registrations (Rwandan + foreign) so dashboards and origin filters have data.
 *
 *   DATABASE_URL=postgres://injishi:injishi@127.0.0.1:5434/injishi \
 *     node scripts/seed-rentals-qa-extra.mjs
 */
import pg from 'pg';

const ID = (n) => `a1000000-0000-4000-8000-00000000${String(n).padStart(4, '0')}`;

async function ensureUser(c, { id, email, name }) {
  const existing = await c.query(`SELECT id FROM users WHERE lower(email) = lower($1)`, [email]);
  if (existing.rows[0]) return existing.rows[0].id;
  await c.query(
    `INSERT INTO users (id, email, name, email_verified, created_at, updated_at)
     VALUES ($1, lower($2), $3, true, now(), now())`,
    [id, email, name],
  );
  return id;
}

async function ensurePersonalWorkspace(c, userId, workspaceId) {
  const existing = await c.query(
    `SELECT id FROM workspaces WHERE user_id = $1 AND kind = 'personal'`,
    [userId],
  );
  if (existing.rows[0]) return existing.rows[0].id;
  await c.query(
    `INSERT INTO workspaces (id, kind, user_id, created_at, updated_at)
     VALUES ($1, 'personal', $2, now(), now())`,
    [workspaceId, userId],
  );
  return workspaceId;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL required');
  const pool = new pg.Pool({ connectionString: url });
  const c = await pool.connect();
  try {
    console.log('Rentals QA extras…');

    const users = [
      { id: ID(1), email: 'landlord2@injishi.test', name: 'Claire Mukamana', ws: ID(101) },
      { id: ID(2), email: 'landlord3@injishi.test', name: 'Jean Pierre Habimana', ws: ID(102) },
      { id: ID(3), email: 'broker2@injishi.test', name: 'Divine Uwase', ws: ID(103) },
      { id: ID(4), email: 'tenant6@injishi.test', name: 'Kevin Niyonsenga', ws: ID(104) },
      { id: ID(5), email: 'tenant7@injishi.test', name: 'Ange Irakoze', ws: ID(105) },
    ];
    for (const u of users) {
      const uid = await ensureUser(c, u);
      await ensurePersonalWorkspace(c, uid, u.ws);
      console.log(`  user ${u.email}`);
    }

    const b2 = (await c.query(`SELECT id FROM users WHERE lower(email)='broker2@injishi.test'`)).rows[0]?.id;
    if (b2) {
      const hasBrokerWs = await c.query(
        `SELECT 1 FROM workspaces WHERE user_id = $1 AND kind = 'broker'`,
        [b2],
      );
      if (hasBrokerWs.rowCount === 0) {
        await c.query(
          `INSERT INTO workspaces (id, kind, user_id, created_at, updated_at)
           VALUES ($1, 'broker', $2, now(), now())`,
          [ID(200), b2],
        );
      }
      await c.query(
        `INSERT INTO brokers (id, user_id, national_id, name, status, home_district_id, created_at, updated_at)
         VALUES ($1, $2, '1199480078912345', 'Divine Uwase', 'active', 102, now(), now())
         ON CONFLICT (id) DO NOTHING`,
        [ID(201), b2],
      );
      // unique on user_id may also apply
      const hasBroker = await c.query(`SELECT id FROM brokers WHERE user_id = $1`, [b2]);
      if (hasBroker.rowCount === 0) {
        await c.query(
          `INSERT INTO brokers (user_id, national_id, name, status, home_district_id, created_at, updated_at)
           VALUES ($1, '1199480078912345', 'Divine Uwase', 'active', 102, now(), now())`,
          [b2],
        );
      }
      console.log('  broker2 ready');
    }

    // Offer vacant active units to brokers (fixed fee).
    const offered = await c.query(
      `UPDATE rental_units
       SET broker_offer = true,
           broker_fee_kind = 'fixed',
           broker_fee_rwf = COALESCE(NULLIF(broker_fee_rwf, 0), 150000),
           broker_fee_percent = NULL
       WHERE state = 'active'
         AND asking_rent_rwf IS NOT NULL
         AND broker_offer = false
         AND id IN (
           SELECT id FROM rental_units
           WHERE state = 'active' AND asking_rent_rwf IS NOT NULL
           ORDER BY created_at NULLS LAST
           LIMIT 10
         )
       RETURNING id`,
    );
    console.log(`  broker_offer on ${offered.rowCount} unit(s)`);

    // Guest registrations for leader origin filters.
    const host = await c.query(
      `SELECT l.id AS lease_id, l.org_id, l.workspace_id, l.unit_id, l.property_id,
              t.user_id AS tenant_user_id, p.village_id, v.cell_id, p.sector_id, p.district_id
       FROM leases l
       JOIN tenants t ON t.id = l.tenant_id
       JOIN properties p ON p.id = l.property_id
       LEFT JOIN villages v ON v.id = p.village_id
       WHERE l.status = 'active' AND t.user_id IS NOT NULL
       LIMIT 1`,
    );
    if (host.rows[0]) {
      const h = host.rows[0];
      const guests = [
        { id: ID(301), name: 'Uwimana Marie', nat: 'RW', phone: '+250788111001' },
        { id: ID(302), name: 'James Otieno', nat: 'KE', phone: '+254712111002' },
        { id: ID(303), name: 'Fatuma Hassan', nat: 'TZ', phone: '+255712111003' },
        { id: ID(304), name: 'Nkurunziza Paul', nat: 'RW', phone: '+250788111004' },
        { id: ID(305), name: 'Sarah Kimani', nat: 'KE', phone: '+254712111005' },
      ];
      for (const g of guests) {
        const originVillage = g.nat === 'RW' ? h.village_id : null;
        await c.query(
          `INSERT INTO guest_registrations (
             id, org_id, workspace_id, host_kind, registered_by_user_id, lease_id, unit_id, property_id,
             full_name, phone, nationality, relationship, origin_country, origin_village_id,
             arrival_on, departure_on, status,
             village_id, cell_id, sector_id, district_id,
             created_at, updated_at
           ) VALUES (
             $1, $2, $3, 'tenant', $4, $5, $6, $7,
             $8, $9, $10, 'friend', $10, $11,
             CURRENT_DATE, CURRENT_DATE + 5, 'submitted',
             $12, $13, $14, $15,
             now(), now()
           )
           ON CONFLICT (id) DO NOTHING`,
          [
            g.id,
            h.org_id,
            h.workspace_id,
            h.tenant_user_id,
            h.lease_id,
            h.unit_id,
            h.property_id,
            g.name,
            g.phone,
            g.nat,
            originVillage,
            h.village_id,
            h.cell_id,
            h.sector_id,
            h.district_id,
          ],
        );
      }
      console.log(`  ${guests.length} guest registration(s)`);
    } else {
      console.log('  skip guests: no active lease with tenant login + property');
    }

    // MapLibre pins need property coordinates (Gasabo / Kigali samples).
    const coords = await c.query(
      `UPDATE properties SET
         latitude = CASE name
           WHEN 'Amani Residences' THEN -1.9442
           WHEN 'QA Heights' THEN -1.9518
           ELSE COALESCE(latitude, -1.9480)
         END,
         longitude = CASE name
           WHEN 'Amani Residences' THEN 30.1065
           WHEN 'QA Heights' THEN 30.0921
           ELSE COALESCE(longitude, 30.1000)
         END,
         updated_at = now()
       WHERE archived_at IS NULL
         AND (latitude IS NULL OR longitude IS NULL)
       RETURNING name, latitude, longitude`,
    );
    console.log(`  coords on ${coords.rowCount} propert(y/ies)`);

    console.log('Done.');
  } finally {
    c.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
