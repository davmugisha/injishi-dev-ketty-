#!/usr/bin/env node
/**
 * PSF membership on a sample database (ADR-056 AC-21).
 *
 * Writes the eight membership tiers, one PSF membership officer who can sign
 * in, one application waiting in that officer's queue, and one self declared
 * membership, so the whole path can be walked without typing a registration.
 *
 * WHERE THE TIER PRICES COME FROM. Golden Circle is PSF's own info pack.
 * Indashyikirwa, Ordinary and Junior Giants come from an unverified summary
 * (ADR-056 rationale.md, "Tier prices and where they came from"), so each of
 * those carries a first benefit line saying the price is a placeholder. This
 * script only ever runs on a sample database, so no unverified price reaches a
 * real one: production gets its tiers from admin (AC-19).
 *
 * Ids live in the `de300000-0000-4000-8000-0056` block, so the demo persona
 * picker lists the officer and `seed-demo-catalogue.mjs --reset` finds the
 * rows. It reads two businesses `seed-demo-portfolio.mjs` writes, so it runs
 * after that script. Idempotent: every insert is ON CONFLICT DO NOTHING, which
 * also leaves a tier an admin edited on staging alone.
 *
 *   DATABASE_URL=... node scripts/seed-demo-psf.mjs
 */
import pg from 'pg';
import { assertSampleDatabase } from './sample-database.mjs';

const P = (n) => `de300000-0000-4000-8000-0056${String(n).padStart(8, '0')}`;
const OFFICER = {
  id: P(1),
  email: 'eric@demo.injishi.com',
  name: 'Eric Mugisha',
  nid: '1198980012345656',
};
const OFFICER_GRANT = P(2);
const APPLICATION = P(3);
const SELF_DECLARED = P(4);
/** Must equal PSF_CONSENT_VERSION in @injishi/contracts. */
const CONSENT_VERSION = '2026-09-27';

const PLACEHOLDER = 'Demo placeholder price and benefits. Confirm with PSF before relying on them.';

/** Golden Circle benefits, numbered as PSF's info pack prints them (no row 15). */
const GC = {
  1: 'Very high level meetings on urgent issues with local and international policy makers',
  2: 'Exclusive networking events hosted by Government or the PSF Chairman or CEO',
  3: 'Follow up on company specific issues with Government by PSF top executives',
  4: 'Tax advisory, and follow up on issues the member raises',
  5: 'Invitation to thematic breakfast meetings with high level speakers',
  6: 'Consideration for international and local events on PSF’s agenda (GBF, NBF, trade missions)',
  7: 'Consideration for high level Government business delegation travel',
  8: 'Consideration for overseas business travel organised by PSF partners, complimentary',
  9: 'Information on local and international business events on PSF’s agenda',
  10: 'Marketing and discounted advertising on PSF platforms, discounts on PSF products, a free web banner, recommendation for Quitus',
  11: 'Listing in the Golden Circle profiler and website, linked to your own site',
  12: 'Participation in public private dialogue platforms',
  13: 'Business to business forums with delegates from other countries',
  14: 'Participation at PSF’s Annual General Meeting',
  16: 'Access to the PSF Health Protection Scheme',
};
const gc = (...rows) => rows.map((n) => GC[n]);
const ALL_SILVER = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16];

const TIERS = [
  { code: 'golden_circle_platinum', family: 'golden_circle', nameEn: 'Golden Circle Platinum', priceKind: 'fixed', fee: 20_000_000,
    benefits: gc(1, 2, 3, 4, ...ALL_SILVER) },
  { code: 'golden_circle_diamond', family: 'golden_circle', nameEn: 'Golden Circle Diamond', priceKind: 'fixed', fee: 15_000_000,
    benefits: gc(2, 3, 4, ...ALL_SILVER) },
  { code: 'golden_circle_gold', family: 'golden_circle', nameEn: 'Golden Circle Gold', priceKind: 'fixed', fee: 10_000_000,
    benefits: gc(3, 4, ...ALL_SILVER) },
  { code: 'golden_circle_silver', family: 'golden_circle', nameEn: 'Golden Circle Silver', priceKind: 'fixed', fee: 5_000_000,
    benefits: gc(...ALL_SILVER) },
  { code: 'indashyikirwa', family: 'indashyikirwa', nameEn: 'Indashyikirwa', priceKind: 'range', min: 500_000, max: 3_000_000,
    benefits: [PLACEHOLDER, 'Sector level advocacy', 'Access to local business networks and specialised chambers', 'The price depends on your chamber and district'] },
  { code: 'ordinary_300k', family: 'ordinary', nameEn: 'Ordinary, 300,000 a year', priceKind: 'fixed', fee: 300_000,
    benefits: [PLACEHOLDER, 'Networking and market information', 'Standard advocacy', 'Regional trade fairs', 'The PSF health scheme',
      'Recommendation letters: Quitus Fiscal, travel visa endorsements, REMA environmental clearance'] },
  { code: 'ordinary_100k', family: 'ordinary', nameEn: 'Ordinary, 100,000 a year', priceKind: 'fixed', fee: 100_000,
    benefits: [PLACEHOLDER, 'Networking and market information', 'Standard advocacy', 'Regional trade fairs', 'The PSF health scheme',
      'No international trade fairs and no recommendation letters'] },
  { code: 'junior_giants', family: 'junior_giants', nameEn: 'Junior Giants', priceKind: 'set_by_psf',
    benefits: [PLACEHOLDER, 'For young entrepreneurs and early stage businesses', 'Capability building and process management', 'Leadership development'] },
];

async function seedTiers(c) {
  let order = 10;
  for (const t of TIERS) {
    await c.query(
      `INSERT INTO psf_membership_tiers
         (code, family, name_en, price_kind, annual_fee_rwf, annual_fee_min_rwf, annual_fee_max_rwf, benefits_en, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (code) DO NOTHING`,
      [t.code, t.family, t.nameEn, t.priceKind, t.fee ?? null, t.min ?? null, t.max ?? null, t.benefits, order],
    );
    order += 10;
  }
}

async function seedOfficer(c) {
  await c.query(
    `INSERT INTO users (id, email, email_verified, name) VALUES ($1, $2, true, $3) ON CONFLICT (id) DO NOTHING`,
    [OFFICER.id, OFFICER.email, OFFICER.name],
  );
  await c.query(
    `INSERT INTO user_profiles (user_id, display_name, national_id) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO NOTHING`,
    [OFFICER.id, OFFICER.name, OFFICER.nid],
  );
  await c.query(
    `INSERT INTO verified_identities (user_id, kyc_status, legal_full_name, verified_method, verified_at)
     VALUES ($1, 'verified', $2, 'manual', now()) ON CONFLICT (user_id) DO NOTHING`,
    [OFFICER.id, OFFICER.name],
  );
  await c.query(
    `INSERT INTO identity_documents
       (identity_id, document_type, document_number, issuing_country, status, is_primary, verified_at)
     VALUES ($1, 'national_id', $2, 'RW', 'active', true, now())
     ON CONFLICT (document_type, document_number, issuing_country) DO NOTHING`,
    [OFFICER.id, OFFICER.nid],
  );
  for (const role of ['guest', 'gov_oversight']) {
    const { rows } = await c.query(
      'SELECT 1 FROM user_roles WHERE user_id = $1 AND global_role = $2 AND revoked_at IS NULL LIMIT 1',
      [OFFICER.id, role],
    );
    if (rows.length === 0) {
      await c.query('INSERT INTO user_roles (user_id, global_role) VALUES ($1, $2)', [OFFICER.id, role]);
    }
  }
  // Country scope at PSF: the only posting this role allows (AC-10).
  await c.query(
    `INSERT INTO oversight_assignments
       (id, user_id, oversight_role, government_body_code, government_title, scope_level)
     VALUES ($1, $2, 'psf_membership_officer', 'PSF', 'Membership Officer', 'country')
     ON CONFLICT (id) DO NOTHING`,
    [OFFICER_GRANT, OFFICER.id],
  );
}

/** A portfolio business, with its owner's profile, by its demo legal name. */
async function business(c, legalName) {
  const { rows } = await c.query(
    `SELECT o.id, o.legal_name, o.tin, o.address_text, o.accommodation_class, o.psf_member, o.registration_status,
            m.user_id AS owner_id, u.email, u.name, p.phone_e164, p.national_id, p.dob::text AS dob, p.gender
       FROM orgs o
       JOIN org_memberships m ON m.org_id = o.id AND m.org_role = 'owner' AND m.status = 'active'
       JOIN users u ON u.id = m.user_id
       LEFT JOIN user_profiles p ON p.user_id = u.id
      WHERE o.legal_name = $1 AND o.id::text LIKE 'de300000-%'
      ORDER BY m.created_at
      LIMIT 1`,
    [legalName],
  );
  return rows[0] ?? null;
}

async function seedApplication(c) {
  const b = await business(c, 'Umucyo Garden Guest House');
  if (!b) throw new Error('Umucyo Garden Guest House is missing: run seed-demo-portfolio.mjs first.');
  if (b.psf_member) {
    throw new Error('Umucyo Garden Guest House answered Yes to PSF, so it cannot apply. Reseed seed-demo-portfolio.mjs on an empty database.');
  }
  const [firstName, ...rest] = b.name.split(' ');
  await c.query(
    `INSERT INTO psf_membership_applications
       (id, org_id, submitted_by_user_id, submitted_capacity, status, queued_at,
        requested_tier_code, quoted_price_kind, quoted_fee_rwf,
        company_name, registration_type, registration_number, website, street_address,
        company_type, ownership, business_activity, trade_direction, trade_countries,
        contact_role, first_name, last_name, gender, phone_e164, email,
        id_document_type, id_document_number, date_of_birth,
        consent_given_at, consent_version, created_at, updated_at)
     VALUES ($1, $2, $3, 'owner', 'submitted', now() - interval '3 days',
             'ordinary_300k', 'fixed', 300000,
             $4, 'tin', $5, NULL, $6,
             'sole_trader', 'rwandan_100', 'Accommodation: Guest house', 'none', '{}',
             'owner', $7, $8, $9, $10, $11,
             'national_id', $12, $13,
             now() - interval '4 days', $14, now() - interval '4 days', now() - interval '4 days')
     ON CONFLICT (id) DO NOTHING`,
    [
      APPLICATION, b.id, b.owner_id,
      b.legal_name, b.tin, b.address_text ?? 'Kigali',
      firstName, rest.join(' ') || firstName, b.gender === 'female' ? 'female' : 'male',
      b.phone_e164 ?? '+250788000101', b.email,
      b.national_id, b.dob ?? '1984-03-09',
      CONSENT_VERSION,
    ],
  );
}

async function seedSelfDeclared(c) {
  const b = await business(c, 'Kacyiru Jacaranda Suites');
  if (!b || !b.psf_member) return;
  await c.query(
    `INSERT INTO psf_memberships (id, org_id, source, membership_number, recorded_by_user_id)
     VALUES ($1, $2, 'self_declared', 'PSF/KGL/2019/0412', $3)
     ON CONFLICT (id) DO NOTHING`,
    [SELF_DECLARED, b.id, b.owner_id],
  );
}

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error('seed-demo-psf: DATABASE_URL is not set.');
  process.exit(1);
}
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await assertSampleDatabase(client, 'seed-demo-psf.mjs');
  await client.query('BEGIN');
  try {
    await seedTiers(client);
    await seedOfficer(client);
    await seedApplication(client);
    await seedSelfDeclared(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
  const { rows } = await client.query(
    `SELECT (SELECT count(*)::int FROM psf_membership_tiers) AS tiers,
            (SELECT count(*)::int FROM psf_membership_applications WHERE status = 'submitted') AS open,
            (SELECT count(*)::int FROM psf_memberships WHERE ended_at IS NULL) AS memberships`,
  );
  const r = rows[0];
  console.log(`PSF: ${r.tiers} tiers, ${r.open} open application(s), ${r.memberships} current membership(s). Officer: ${OFFICER.email}`);
} catch (error) {
  console.error(`seed-demo-psf: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
