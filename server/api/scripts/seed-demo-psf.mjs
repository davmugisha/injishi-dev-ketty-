#!/usr/bin/env node
/**
 * PSF membership on a sample database (ADR-056 AC-21, and the PSF path).
 *
 * Writes PSF's tiers as the owner gave them on 2026-10-15, the PSF path's
 * registration fee, two PSF membership officers who can sign in (one for the
 * whole country, one for Kicukiro), a hotel's application waiting in the
 * queue, one self declared membership, and a register of PSF businesses in
 * every standing: applied, approved and waiting to pay, paid members, declined,
 * and registered without applying. So the whole path, from the PSF page to a
 * paid membership and the officer's register, can be walked without typing a
 * registration.
 *
 * WHERE THE TIER PRICES COME FROM. The owner, 2026-10-15, from PSF: Golden
 * Circle from 5,000,000 a year, Indashyikirwa 200,000 to 4,000,000, and Indatwa
 * in four bands from 10,000 to 199,999. The bands are written without gaps
 * (Indashyikirwa runs to 4,999,999 so it meets Golden Circle; Indatwa's top band
 * stops at 199,999 so it does not overlap Indashyikirwa), as agreed. Golden
 * Circle's benefits are PSF's own info pack; the other benefit lines are drafted
 * for the demo, and admin replaces them with PSF's words in production, where
 * tiers come from Configuration > PSF tiers, never from this script.
 *
 * The old eight tiers (four Golden Circle levels, two Ordinary, Junior Giants,
 * and the old Indashyikirwa price) are retired, not deleted: an application
 * that names one still reads it.
 *
 * Ids live in the `de300000-0000-4000-8000-0056` block, so the demo persona
 * picker lists the two officers and the PSF business owner Chantal, and
 * `seed-demo-catalogue.mjs --reset` finds the rows. The other owners are not
 * personas: they live in `de300000-0000-4000-8001-0056` with
 * `@guests.demo.injishi.com` addresses, outside the picker. It reads two
 * businesses `seed-demo-portfolio.mjs` writes, so it runs after that script.
 * Idempotent: a re-run writes nothing new, and only corrects the tier prices.
 *
 *   DATABASE_URL=... node scripts/seed-demo-psf.mjs
 */
import contracts from '@injishi/contracts';
import pg from 'pg';
import { assertSampleDatabase } from './sample-database.mjs';

const { districtLetters, formatBusinessCode, defaultPsfMembershipDates } = contracts;

const P = (n) => `de300000-0000-4000-8000-0056${String(n).padStart(8, '0')}`;
/** People who own the demo PSF businesses and are not personas. */
const G = (n) => `de300000-0000-4000-8001-0056${String(n).padStart(8, '0')}`;

const OFFICER = {
  id: P(1),
  email: 'eric@demo.injishi.com',
  name: 'Eric Mugisha',
  nid: '1198980012345656',
  grant: P(2),
  scope: { level: 'country', provinceId: null, districtId: null },
};
/** A PSF officer posted to one district: sees Kicukiro's businesses, and only those. */
const DISTRICT_OFFICER = {
  id: P(20),
  email: 'olivier@demo.injishi.com',
  name: 'Olivier Nkurunziza',
  nid: '1199180056000020',
  grant: P(22),
  scope: { level: 'district', provinceId: 1, districtId: 103 },
};
const APPLICATION = P(3);
const SELF_DECLARED = P(4);
/** Must equal PSF_CONSENT_VERSION in @injishi/contracts. */
const CONSENT_VERSION = '2026-09-27';
/** The PSF path's registration fee (owner, 2026-10-15). */
const ENTERPRISE_FEE_RWF = 5000;

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

const INDASHYIKIRWA_BENEFITS = [
  'Recognition as a business champion of your district',
  'A seat in your district’s public private dialogue',
  'Advocacy on the issues of your sector',
  'Networking with district and national business leaders',
  'Invitations to PSF trade fairs and business forums',
];
const INDATWA_BENEFITS = [
  'Advocacy through your association and cluster',
  'Market information and business opportunities',
  'Training and capacity building for your business',
  'Places at PSF trade fairs and exhibitions',
];

/** The tiers as the owner gave them, 2026-10-15. */
const TIERS = [
  { code: 'golden_circle', family: 'golden_circle', nameEn: 'Golden Circle', priceKind: 'minimum', min: 5_000_000,
    benefits: Object.values(GC) },
  { code: 'indashyikirwa', family: 'indashyikirwa', nameEn: 'Indashyikirwa', priceKind: 'range', min: 200_000, max: 4_999_999,
    benefits: INDASHYIKIRWA_BENEFITS },
  { code: 'indatwa_100k', family: 'indatwa', nameEn: 'Indatwa, 100,000 to 199,999', priceKind: 'range', min: 100_000, max: 199_999,
    benefits: INDATWA_BENEFITS },
  { code: 'indatwa_50k', family: 'indatwa', nameEn: 'Indatwa, 50,000 to 99,999', priceKind: 'range', min: 50_000, max: 99_999,
    benefits: INDATWA_BENEFITS },
  { code: 'indatwa_20k', family: 'indatwa', nameEn: 'Indatwa, 20,000 to 49,999', priceKind: 'range', min: 20_000, max: 49_999,
    benefits: INDATWA_BENEFITS },
  { code: 'indatwa_10k', family: 'indatwa', nameEn: 'Indatwa, 10,000 to 19,999', priceKind: 'range', min: 10_000, max: 19_999,
    benefits: INDATWA_BENEFITS },
];
/** The first line the previous version of this seed wrote on unconfirmed prices. */
const OLD_PLACEHOLDER = 'Demo placeholder price and benefits. Confirm with PSF before relying on them.';

/** Retired 2026-10-15. Kept, inactive, for whatever already names them. */
const RETIRED = [
  'golden_circle_platinum', 'golden_circle_diamond', 'golden_circle_gold', 'golden_circle_silver',
  'ordinary_300k', 'ordinary_100k', 'junior_giants',
];

/**
 * The register of PSF businesses. `standing` is where each stands with PSF,
 * and each is in a district the two officers divide differently: the Kicukiro
 * officer sees the first five, the country officer all nine.
 */
const BUSINESSES = [
  {
    n: 1, name: 'Gahaya Metal Works', district: 'Kicukiro', sector: 'Gikondo', street: 'KK 15 Rd, Gikondo',
    association: 'apromet', kind: 'tin', tin: '999056001', groups: ['women'], daysAgo: 21,
    owner: { persona: true, id: P(21), email: 'chantal@demo.injishi.com', name: 'Chantal Mukandayisenga', gender: 'female', dob: '1990-06-14', nid: '1199070056000021' },
    standing: 'awaiting_payment', tier: 'indatwa_100k', declared: 150_000, number: 'PSF/KIC/2026/0118', company: 'private_company',
    activity: 'Metal fabrication: gates, windows and furniture',
  },
  {
    n: 2, name: 'Niboye Tailors Cooperative', district: 'Kicukiro', sector: 'Niboye', street: 'KK 342 St, Niboye',
    association: 'rta', kind: 'rca', registrationNumber: 'RCA/0384/2023', groups: ['women', 'youth'], daysAgo: 9,
    owner: { name: 'Claudine Mukeshimana', gender: 'female', dob: '1997-02-03' },
    standing: 'applied', tier: 'indatwa_20k', declared: 30_000, company: 'cooperative',
    activity: 'Tailoring and garment making',
  },
  {
    n: 3, name: 'Kanombe Fresh Foods', district: 'Kicukiro', sector: 'Kanombe', street: 'KK 21 Ave, Kanombe',
    association: 'acgdr', kind: 'tin', tin: '999056003', groups: [], daysAgo: 64,
    owner: { name: 'Patrick Habimana', gender: 'male', dob: '1982-11-20' },
    standing: 'member', tier: 'indashyikirwa', declared: 600_000, number: 'PSF/KIC/2026/0057', paidDaysAgo: 40, company: 'private_company',
    activity: 'Wholesale of fresh food',
  },
  {
    n: 4, name: 'Kigarama Community Pharmacy', district: 'Kicukiro', sector: 'Kigarama', street: 'KK 506 St, Kigarama',
    association: 'appor', kind: 'tin', tin: '999056004', groups: ['pwd'], daysAgo: 5,
    owner: { name: 'Jean Paul Nsengiyumva', gender: 'male', dob: '1986-08-09' },
    standing: 'not_applied',
  },
  {
    n: 5, name: 'Masaka Maize Millers', district: 'Kicukiro', sector: 'Masaka', street: 'Masaka trading centre',
    association: 'ammirwa', kind: 'none', groups: ['youth'], daysAgo: 30,
    owner: { name: 'Eric Twagirayezu', gender: 'male', dob: '1999-04-27' },
    standing: 'declined', tier: 'indatwa_10k', declared: 10_000, company: 'sole_trader',
    activity: 'Maize milling',
    decline: { reason: 'details_incomplete', note: 'Give the street address of the mill, and the phone of the person in charge.' },
  },
  {
    n: 6, name: 'Gisozi Furniture Works', district: 'Gasabo', sector: 'Gisozi', street: 'KG 9 Ave, Gisozi',
    association: 'rwvca', kind: 'tin', tin: '999056006', groups: [], daysAgo: 12,
    owner: { name: 'Innocent Ndayisaba', gender: 'male', dob: '1979-01-15' },
    standing: 'applied', tier: 'indatwa_50k', declared: 75_000, company: 'private_company',
    activity: 'Furniture making',
  },
  {
    n: 7, name: 'Kigali Heights Logistics', district: 'Gasabo', sector: 'Kimihurura', street: 'KG 7 Ave, Kimihurura',
    association: 'rwaffa', kind: 'tin', tin: '999056007', groups: [], daysAgo: 120,
    owner: { name: 'Aline Uwase', gender: 'female', dob: '1984-09-02' },
    standing: 'member', tier: 'golden_circle', declared: 6_000_000, number: 'PSF/GC/2026/0012', paidDaysAgo: 95, company: 'private_company',
    activity: 'Freight forwarding and logistics',
  },
  {
    n: 8, name: 'Muhoza Potato Growers Cooperative', district: 'Musanze', sector: 'Muhoza', street: 'Muhoza market',
    association: 'agriculture_other', kind: 'rca', registrationNumber: 'RCA/1120/2021', groups: ['women'], daysAgo: 80,
    owner: { name: 'Vestine Nyirahabimana', gender: 'female', dob: '1975-03-30' },
    standing: 'member', tier: 'indatwa_50k', declared: 60_000, number: 'PSF/MUS/2026/0031', paidDaysAgo: 70, company: 'cooperative',
    activity: 'Potato farming and marketing',
  },
  {
    n: 9, name: 'Gisenyi Cross-Border Traders', district: 'Rubavu', sector: 'Gisenyi', street: 'Petite Barrière, Gisenyi',
    association: 'actr', kind: 'none', groups: ['pwd'], daysAgo: 7,
    owner: { name: 'Samuel Bizimana', gender: 'male', dob: '1991-12-11' },
    standing: 'applied', tier: 'indatwa_10k', declared: 15_000, company: 'sole_trader',
    activity: 'Cross-border trade',
  },
];

const ago = (days, hours = 0) => new Date(Date.now() - days * 86_400_000 - hours * 3_600_000);
const kigaliDate = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali' }).format(d);

async function seedTiers(c) {
  let order = 10;
  for (const t of TIERS) {
    // The price is the owner's, so a re-run corrects it. The benefits an admin
    // may have edited on staging are left alone, unless they are still the old
    // seed's placeholder, which says the price is unconfirmed and no longer is.
    await c.query(
      `INSERT INTO psf_membership_tiers
         (code, family, name_en, price_kind, annual_fee_rwf, annual_fee_min_rwf, annual_fee_max_rwf, benefits_en, sort_order, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
       ON CONFLICT (code) DO UPDATE SET
         family = EXCLUDED.family, name_en = EXCLUDED.name_en, price_kind = EXCLUDED.price_kind,
         annual_fee_rwf = EXCLUDED.annual_fee_rwf, annual_fee_min_rwf = EXCLUDED.annual_fee_min_rwf,
         annual_fee_max_rwf = EXCLUDED.annual_fee_max_rwf, sort_order = EXCLUDED.sort_order,
         benefits_en = CASE WHEN $10 = ANY(psf_membership_tiers.benefits_en)
                            THEN EXCLUDED.benefits_en ELSE psf_membership_tiers.benefits_en END,
         active = true, updated_at = now()`,
      [t.code, t.family, t.nameEn, t.priceKind, t.fee ?? null, t.min ?? null, t.max ?? null, t.benefits, order, OLD_PLACEHOLDER],
    );
    order += 10;
  }
  await c.query(
    `UPDATE psf_membership_tiers SET active = false, updated_at = now() WHERE code = ANY($1) AND active`,
    [RETIRED],
  );
}

/** The PSF path's fee, written the way seed-content writes the others: on the amount. */
async function seedFee(c) {
  await c.query(
    `INSERT INTO registration_fees (business_type, amount_rwf, effective_from, active)
     SELECT 'enterprise', $1, now(), true
      WHERE NOT EXISTS (SELECT 1 FROM registration_fees
                         WHERE business_type = 'enterprise' AND active AND amount_rwf = $1 AND effective_from <= now())`,
    [ENTERPRISE_FEE_RWF],
  );
}

async function seedUser(c, p) {
  await c.query(
    `INSERT INTO users (id, email, email_verified, name, created_at, updated_at)
     VALUES ($1, $2, true, $3, $4, $4) ON CONFLICT (id) DO NOTHING`,
    [p.id, p.email, p.name, p.since ?? ago(90)],
  );
  await c.query(
    `INSERT INTO user_profiles (user_id, display_name, national_id, phone_e164, dob, gender, district_id, sector_id, address_text)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (user_id) DO NOTHING`,
    [p.id, p.name, p.nid, p.phone ?? null, p.dob ?? null, p.gender ?? null, p.districtId ?? null, p.sectorId ?? null, p.street ?? null],
  );
  await c.query(
    `INSERT INTO verified_identities (user_id, kyc_status, legal_full_name, verified_method, verified_at)
     VALUES ($1, 'verified', $2, 'manual', $3) ON CONFLICT (user_id) DO NOTHING`,
    [p.id, p.name, p.since ?? ago(90)],
  );
  await c.query(
    `INSERT INTO identity_documents
       (identity_id, document_type, document_number, issuing_country, status, is_primary, verified_at)
     VALUES ($1, 'national_id', $2, 'RW', 'active', true, $3)
     ON CONFLICT (document_type, document_number, issuing_country) DO NOTHING`,
    [p.id, p.nid, p.since ?? ago(90)],
  );
  for (const role of p.roles ?? ['guest']) {
    const { rows } = await c.query(
      'SELECT 1 FROM user_roles WHERE user_id = $1 AND global_role = $2 AND revoked_at IS NULL LIMIT 1',
      [p.id, role],
    );
    if (rows.length === 0) await c.query('INSERT INTO user_roles (user_id, global_role) VALUES ($1, $2)', [p.id, role]);
  }
}

async function seedOfficers(c) {
  for (const o of [OFFICER, DISTRICT_OFFICER]) {
    await seedUser(c, { ...o, roles: ['guest', 'gov_oversight'] });
    // At PSF, for the region the officer covers (AC-10 as the PSF path widened it).
    await c.query(
      `INSERT INTO oversight_assignments
         (id, user_id, oversight_role, government_body_code, government_title, scope_level, province_id, district_id)
       VALUES ($1, $2, 'psf_membership_officer', 'PSF', 'Membership Officer', $3, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      [o.grant, o.id, o.scope.level, o.scope.provinceId, o.scope.districtId],
    );
  }
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

/** A hotel's application, waiting in the queue: the hospitality door PSF also takes. */
async function seedHotelApplication(c) {
  const b = await business(c, 'Umucyo Garden Guest House');
  if (!b) throw new Error('Umucyo Garden Guest House is missing: run seed-demo-portfolio.mjs first.');
  // Already a member (a verifier paid its membership, or it answered Yes): it
  // has nothing to apply for, and the rest of the seed still has work to do.
  if (b.psf_member) {
    console.log('Umucyo Garden Guest House is already a PSF member; its demo application is not written.');
    return;
  }
  const [firstName, ...rest] = b.name.split(' ');
  await c.query(
    `INSERT INTO psf_membership_applications
       (id, org_id, submitted_by_user_id, submitted_capacity, status, queued_at,
        requested_tier_code, quoted_price_kind, quoted_fee_min_rwf, quoted_fee_max_rwf, declared_fee_rwf,
        company_name, registration_type, registration_number, website, street_address,
        company_type, ownership, business_activity, trade_direction, trade_countries,
        contact_role, first_name, last_name, gender, phone_e164, email,
        id_document_type, id_document_number, date_of_birth,
        consent_given_at, consent_version, created_at, updated_at)
     VALUES ($1, $2, $3, 'owner', 'submitted', now() - interval '3 days',
             'indatwa_100k', 'range', 100000, 199999, 120000,
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

async function place(c, district, sector) {
  const { rows } = await c.query(
    `SELECT d.id AS district_id, d.name AS district_name, s.id AS sector_id
       FROM sectors s JOIN districts d ON d.id = s.district_id
      WHERE lower(d.name) = lower($1) AND lower(s.name) = lower($2)`,
    [district, sector],
  );
  if (rows.length === 0) throw new Error(`Sector not found: ${sector} in ${district}. Run seed-geography.mjs first.`);
  return rows[0];
}

/** The next code in a district, drawn the way the API draws it (`issueBusinessCode`). */
async function nextBusinessCode(c, districtId, districtName) {
  const { rows } = await c.query(
    `INSERT INTO business_code_counters (district_id, last_number) VALUES ($1, 1)
     ON CONFLICT (district_id) DO UPDATE SET last_number = business_code_counters.last_number + 1, updated_at = now()
     RETURNING last_number`,
    [districtId],
  );
  return formatBusinessCode(districtLetters(districtId, districtName), rows[0].last_number);
}

function ownerOf(b, where) {
  const o = b.owner;
  const local = o.name.toLowerCase().normalize('NFD').replace(/[^a-z ]/g, '').trim().replace(/\s+/g, '.');
  return {
    id: o.id ?? G(b.n),
    email: o.email ?? `${local}@guests.demo.injishi.com`,
    name: o.name,
    nid: o.nid ?? `11990800560${String(b.n).padStart(5, '0')}`,
    phone: `+2507880560${String(b.n).padStart(2, '0')}`,
    dob: o.dob,
    gender: o.gender,
    districtId: where.district_id,
    sectorId: where.sector_id,
    street: b.street,
    since: ago(b.daysAgo, 2),
  };
}

/** One PSF business, registered through the PSF path, and where it stands with PSF. */
async function seedPsfBusiness(c, b) {
  const where = await place(c, b.district, b.sector);
  const owner = ownerOf(b, where);
  await seedUser(c, owner);

  const orgId = P(100 + b.n);
  const created = ago(b.daysAgo);
  const paid = new Date(created.getTime() + 6 * 60_000);
  const { rowCount } = await c.query(
    `INSERT INTO orgs
       (id, legal_name, domain, tin, registration_kind, registration_number, psf_association_code, owner_groups,
        psf_member, registration_status, district_id, sector_id, address_text, created_at, updated_at)
     VALUES ($1, $2, 'enterprise', $3, $4, $5, $6, $7::psf_owner_group[], $8, 'active', $9, $10, $11, $12, $13)
     ON CONFLICT (id) DO NOTHING`,
    [
      orgId, b.name, b.kind === 'tin' ? b.tin : null, b.kind, b.registrationNumber ?? null, b.association,
      b.groups, b.standing === 'member', where.district_id, where.sector_id, b.street, created, paid,
    ],
  );
  if (rowCount === 0) return { orgId, written: false };

  // The code, drawn only for a business this run wrote, so a re-run draws none.
  const code = await nextBusinessCode(c, where.district_id, where.district_name);
  await c.query('UPDATE orgs SET business_code = $2 WHERE id = $1', [orgId, code]);

  await c.query(
    `INSERT INTO workspaces (id, kind, org_id, created_at, updated_at) VALUES ($1, 'business', $2, $3, $3)
     ON CONFLICT (id) DO NOTHING`,
    [P(200 + b.n), orgId, created],
  );
  await c.query(
    `INSERT INTO org_memberships (id, org_id, user_id, org_role, created_at, updated_at)
     VALUES ($1, $2, $3, 'owner', $4, $4) ON CONFLICT (id) DO NOTHING`,
    [P(300 + b.n), orgId, owner.id, created],
  );
  await c.query(
    `INSERT INTO subscription_invoices (id, org_id, invoice_kind, amount_rwf, status, idempotency_key, created_at, updated_at)
     VALUES ($1, $2, 'registration_fee', $3, 'paid', $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
    [P(400 + b.n), orgId, ENTERPRISE_FEE_RWF, `registration_fee:${orgId}`, created, paid],
  );
  if (b.kind === 'tin') {
    await c.query(
      `INSERT INTO tin_verifications (id, org_id, tin, result, latency_ms, adapter_mode, raw_response, checked_at)
       VALUES ($1, $2, $3, 'verified', $4, 'mock', $5, $6) ON CONFLICT (id) DO NOTHING`,
      [P(500 + b.n), orgId, b.tin, 300 + b.n * 17, JSON.stringify({ mock: true, tin: b.tin, status: 'VALID', source: 'seed-demo-psf' }), paid],
    );
  }
  // The trail the API writes: created, paid, registered (the PSF path has no officer gate).
  const events = [
    { from: null, to: 'pending_payment', trigger: 'registrant', actor: owner.id, at: created },
    { from: 'pending_payment', to: 'submitted', trigger: 'registrant', actor: owner.id, at: paid },
    { from: 'submitted', to: 'active', trigger: 'system', actor: null, at: new Date(paid.getTime() + 2_000) },
  ];
  let i = 0;
  for (const ev of events) {
    i += 1;
    await c.query(
      `INSERT INTO org_registration_events (id, org_id, from_status, to_status, trigger, actor_user_id, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`,
      [P(600 + b.n * 10 + i), orgId, ev.from, ev.to, ev.trigger, ev.actor, ev.at],
    );
  }

  if (b.standing !== 'not_applied') await seedPsfApplication(c, b, orgId, owner, created);
  return { orgId, written: true, code };
}

async function seedPsfApplication(c, b, orgId, owner, registered) {
  const { rows: tiers } = await c.query('SELECT * FROM psf_membership_tiers WHERE code = $1', [b.tier]);
  const tier = tiers[0];
  if (!tier) throw new Error(`Tier ${b.tier} is missing.`);
  const appId = P(700 + b.n);
  const sent = new Date(registered.getTime() + 3_600_000);
  const queued = new Date(sent.getTime() + 1_000);
  const decidedAt = b.standing === 'applied' ? null : new Date(sent.getTime() + 2 * 86_400_000);
  const officer = b.district === 'Kicukiro' ? DISTRICT_OFFICER : OFFICER;
  const paidAt = b.standing === 'member' ? ago(b.paidDaysAgo) : null;
  const [firstName, ...rest] = owner.name.split(' ');

  const status =
    b.standing === 'applied' ? 'submitted'
      : b.standing === 'awaiting_payment' ? 'approved'
        : b.standing === 'member' ? 'member'
          : 'declined';
  const registrationType = b.kind;
  const registrationNumber = b.kind === 'tin' ? b.tin : b.kind === 'none' ? null : b.registrationNumber;

  await c.query(
    `INSERT INTO psf_membership_applications
       (id, org_id, submitted_by_user_id, submitted_capacity, status, queued_at,
        requested_tier_code, quoted_price_kind, quoted_fee_rwf, quoted_fee_min_rwf, quoted_fee_max_rwf, declared_fee_rwf,
        company_name, registration_type, registration_number, website, street_address,
        company_type, ownership, business_activity, trade_direction, trade_goods, trade_countries,
        contact_role, first_name, last_name, gender, phone_e164, email,
        id_document_type, id_document_number, date_of_birth, consent_given_at, consent_version,
        decided_at, decided_by_user_id, decision_body_code, decline_reason, decision_note,
        approved_membership_number, approved_fee_rwf,
        paid_at, paid_amount_rwf, payment_ref, payment_mode,
        created_at, updated_at)
     VALUES ($1, $2, $3, 'owner', $4, $5,
             $6, $7, $8, $9, $10, $11,
             $12, $13, $14, NULL, $15,
             $16, 'rwandan_100', $17, $18, $19, $20,
             'owner', $21, $22, $23, $24, $25,
             'national_id', $26, $27, $28, $29,
             $30, $31, $32, $33, $34,
             $35, $36,
             $37, $38, $39, $40,
             $28, $41)
     ON CONFLICT (id) DO NOTHING`,
    [
      appId, orgId, owner.id, status, queued,
      tier.code, tier.price_kind, tier.annual_fee_rwf, tier.annual_fee_min_rwf, tier.annual_fee_max_rwf, b.declared,
      b.name, registrationType, registrationNumber, b.street,
      b.company, b.activity,
      b.association === 'actr' ? 'both' : 'none',
      b.association === 'actr' ? 'Shoes, cloth and household goods' : null,
      b.association === 'actr' ? ['CD'] : [],
      firstName, rest.join(' ') || firstName, owner.gender === 'female' ? 'female' : 'male', owner.phone, owner.email,
      owner.nid, owner.dob, sent, CONSENT_VERSION,
      decidedAt, decidedAt ? officer.id : null, decidedAt ? 'PSF' : null,
      b.standing === 'declined' ? b.decline.reason : null, b.standing === 'declined' ? b.decline.note : null,
      status === 'approved' || status === 'member' ? b.number : null,
      status === 'approved' || status === 'member' ? b.declared : null,
      paidAt, paidAt ? b.declared : null, paidAt ? `mock_one_time_fee_seed-demo-psf:${appId}` : null, paidAt ? 'mock' : null,
      paidAt ?? decidedAt ?? sent,
    ],
  );

  if (b.standing === 'member') {
    const { startsOn, expiresOn } = defaultPsfMembershipDates(kigaliDate(paidAt));
    await c.query(
      `INSERT INTO psf_memberships
         (id, org_id, source, application_id, tier_code, membership_number, annual_fee_rwf, starts_on, expires_on, recorded_by_user_id, created_at, updated_at)
       VALUES ($1, $2, 'psf_confirmed', $3, $4, $5, $6, $7, $8, $9, $10, $10)
       ON CONFLICT (id) DO NOTHING`,
      [P(800 + b.n), orgId, appId, tier.code, b.number, b.declared, startsOn, expiresOn, owner.id, paidAt],
    );
  }
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
  const written = [];
  try {
    await seedTiers(client);
    await seedFee(client);
    await seedOfficers(client);
    await seedHotelApplication(client);
    await seedSelfDeclared(client);
    for (const b of BUSINESSES) {
      const r = await seedPsfBusiness(client, b);
      if (r.written) written.push(`${r.code} ${b.name}`);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
  const { rows } = await client.query(
    `SELECT (SELECT count(*)::int FROM psf_membership_tiers WHERE active) AS tiers,
            (SELECT count(*)::int FROM orgs WHERE domain = 'enterprise') AS businesses,
            (SELECT count(*)::int FROM psf_membership_applications WHERE status IN ('submitted', 'approved')) AS open,
            (SELECT count(*)::int FROM psf_memberships WHERE ended_at IS NULL) AS memberships`,
  );
  const r = rows[0];
  console.log(
    `PSF: ${r.tiers} active tiers, ${r.businesses} PSF businesses, ${r.open} open application(s), ${r.memberships} current membership(s).`,
  );
  if (written.length) console.log(`New: ${written.join(', ')}`);
  console.log(`Officers: ${OFFICER.email} (Rwanda), ${DISTRICT_OFFICER.email} (Kicukiro). Business owner: chantal@demo.injishi.com`);
} catch (error) {
  console.error(`seed-demo-psf: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
