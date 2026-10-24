#!/usr/bin/env node
/**
 * PSF membership on a sample database (ADR-056 AC-21, and the PSF path).
 *
 * Writes PSF's tiers as the owner gave them on 2026-10-15, two PSF membership
 * officers who can sign in (one for the whole country, one for Kicukiro), a
 * hotel's application waiting in the queue, one self declared membership, and
 * a register of PSF businesses in every standing: paid and waiting on PSF,
 * members, declined (the fee kept: nothing is refunded, 2026-10-23), and one
 * whose payment did not go through. There is no registration fee on the PSF
 * path (2026-10-23). PSF reviews only paid applications (2026-10-20), so no business is
 * approved and unpaid. So the whole path, from the PSF page to a
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
 *   DATABASE_URL=... node scripts/seed-demo-psf.mjs           write what is missing
 *   DATABASE_URL=... node scripts/seed-demo-psf.mjs --reset   rewrite the PSF businesses, fresh dates
 */
import contracts from '@injishi/contracts';
import pg from 'pg';
import { assertSampleDatabase } from './sample-database.mjs';

const { districtLetters, formatBusinessCode, defaultPsfMembershipDates, formatPsfMembershipNumber, newPsfDocId } = contracts;

const P = (n) => `de300000-0000-4000-8000-0056${String(n).padStart(8, '0')}`;
/** People who own the demo PSF businesses and are not personas. */
const G = (n) => `de300000-0000-4000-8001-0056${String(n).padStart(8, '0')}`;

/**
 * The PSF officers, one per level (2026-10-19): Eric for the whole country,
 * Aline for Kigali City (every district in it), and Olivier and Jean Bosco for
 * Kicukiro and Gasabo. Nyarugenge has no district officer on purpose, so the
 * province's report shows a district Aline covers herself.
 */
const OFFICERS = [
  {
    id: P(1), email: 'eric@demo.injishi.com', name: 'Eric Mugisha', nid: '1198980012345656', grant: P(2),
    title: 'PSF National Manager', label: 'Rwanda',
    scope: { level: 'country', provinceId: null, districtId: null },
  },
  {
    id: P(23), email: 'aline@demo.injishi.com', name: 'Aline Mukamana', nid: '1198870056000023', grant: P(24),
    title: 'PSF Provincial Manager', label: 'Kigali City',
    scope: { level: 'province', provinceId: 1, districtId: null },
  },
  {
    id: P(20), email: 'olivier@demo.injishi.com', name: 'Olivier Nkurunziza', nid: '1199180056000020', grant: P(22),
    title: 'PSF District Manager', label: 'Kicukiro',
    scope: { level: 'district', provinceId: 1, districtId: 103 },
  },
  {
    id: P(25), email: 'bosco@demo.injishi.com', name: 'Jean Bosco Habyarimana', nid: '1198780056000025', grant: P(26),
    title: 'PSF District Manager', label: 'Gasabo',
    scope: { level: 'district', provinceId: 1, districtId: 102 },
  },
];
const APPLICATION = P(3);
const SELF_DECLARED = P(4);
/** Must equal PSF_CONSENT_VERSION in @injishi/contracts. */
const CONSENT_VERSION = '2026-09-27';

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
 * The register of PSF businesses, as the PUBLIC PSF PATH writes them
 * (2026-10-19): no account, no workspace, no owner membership. Each has an
 * application with a docID (`PSF-DEM0-0001`…, fixed so a walkthrough can type
 * one), the applicant's phone and email on it, and nobody signed in behind it.
 *
 * The first nine are named and placed for the story the officers tell; the
 * rest (`generated`) spread over nine months and five districts so the
 * officer console's report has a trend, a funnel and a district table to show.
 */
const NAMED = [
  {
    n: 1, name: 'Gahaya Metal Works', district: 'Kicukiro', sector: 'Gikondo', street: 'KK 15 Rd, Gikondo',
    association: 'apromet', kind: 'tin', tin: '999056001', groups: ['women'], daysAgo: 21,
    owner: { name: 'Chantal Mukandayisenga', gender: 'female', dob: '1990-06-14' },
    standing: 'applied', tier: 'indatwa_100k', declared: 150_000, company: 'private_company',
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
    standing: 'member', tier: 'indashyikirwa', declared: 600_000, paidDaysAgo: 40, company: 'private_company',
    activity: 'Wholesale of fresh food',
  },
  {
    n: 4, name: 'Kigarama Community Pharmacy', district: 'Kicukiro', sector: 'Kigarama', street: 'KK 506 St, Kigarama',
    association: 'appor', kind: 'tin', tin: '999056004', groups: ['pwd'], daysAgo: 5,
    owner: { name: 'Jean Paul Nsengiyumva', gender: 'male', dob: '1986-08-09' },
    standing: 'fee_due', tier: 'indatwa_50k', declared: 60_000, company: 'private_company',
    activity: 'Community pharmacy',
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
    standing: 'member', tier: 'golden_circle', declared: 6_000_000, paidDaysAgo: 95, company: 'private_company',
    activity: 'Freight forwarding and logistics',
  },
  {
    n: 8, name: 'Muhoza Potato Growers Cooperative', district: 'Musanze', sector: 'Muhoza', street: 'Muhoza market',
    association: 'agriculture_other', kind: 'rca', registrationNumber: 'RCA/1120/2021', groups: ['women'], daysAgo: 80,
    owner: { name: 'Vestine Nyirahabimana', gender: 'female', dob: '1975-03-30' },
    standing: 'member', tier: 'indatwa_50k', declared: 60_000, paidDaysAgo: 70, company: 'cooperative',
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

/** A small deterministic generator, so a reseed draws the same register. */
function rng(seed) {
  let x = seed >>> 0;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 2 ** 32;
  };
}
const FIRST = { female: ['Grace', 'Josiane', 'Divine', 'Ange', 'Solange', 'Clarisse', 'Yvonne', 'Esther', 'Diane', 'Aimée'],
  male: ['Emmanuel', 'Olivier', 'Theogene', 'Didier', 'Fabrice', 'Jean Claude', 'Pacifique', 'Gilbert', 'Alexis', 'Moses'] };
const LAST = ['Uwimana', 'Niyonsaba', 'Mugabo', 'Habyarimana', 'Ingabire', 'Nshimiyimana', 'Mukamana', 'Kayitesi', 'Hakizimana', 'Uwamahoro', 'Niyigena', 'Byiringiro'];
const TRADES = [
  ['Bakery', 'Bread and pastries', 'industry_other'],
  ['Hardware Store', 'Building materials and tools', 'acgdr'],
  ['Coffee Roasters', 'Coffee roasting and export', 'coffee_cooperatives'],
  ['Salon & Spa', 'Hair and beauty services', 'services_other'],
  ['Auto Garage', 'Vehicle repair and spare parts', 'services_other'],
  ['Printing House', 'Printing and branding', 'industry_other'],
  ['Dairy Collective', 'Milk collection and yoghurt', 'agriculture_other'],
  ['Tech Hub', 'Software and IT services', 'ict_chamber'],
  ['Pharmacy', 'Retail pharmacy', 'appor'],
  ['Poultry Farm', 'Eggs and broilers', 'poultry'],
  ['Tailoring Studio', 'Tailoring and fashion', 'rta'],
  ['Fresh Mart', 'Groceries and fresh produce', 'acgdr'],
];
const GENERATED_DISTRICTS = ['Kicukiro', 'Gasabo', 'Nyarugenge', 'Gasabo', 'Kicukiro', 'Musanze', 'Rubavu', 'Nyarugenge', 'Huye'];
const STANDINGS = ['member', 'member', 'member', 'applied', 'declined', 'applied', 'member', 'applied', 'member', 'fee_due'];
const TIER_FOR = [
  ['indatwa_10k', 12_000], ['indatwa_20k', 25_000], ['indatwa_20k', 40_000], ['indatwa_50k', 55_000],
  ['indatwa_100k', 120_000], ['indashyikirwa', 300_000], ['indatwa_50k', 80_000], ['indashyikirwa', 950_000],
];
const GENERATED_COUNT = 40;

function generated() {
  const r = rng(56);
  const out = [];
  for (let i = 0; i < GENERATED_COUNT; i += 1) {
    const gender = r() < 0.48 ? 'female' : 'male';
    const first = FIRST[gender][Math.floor(r() * 10)];
    const last = LAST[Math.floor(r() * LAST.length)];
    const trade = TRADES[i % TRADES.length];
    const district = GENERATED_DISTRICTS[i % GENERATED_DISTRICTS.length];
    const [tier, declared] = TIER_FOR[Math.floor(r() * TIER_FOR.length)];
    // Spread over nine months, newest first; the youngest are still waiting.
    const daysAgo = 3 + Math.floor((i / GENERATED_COUNT) * 265 + r() * 6);
    let standing = STANDINGS[i % STANDINGS.length];
    if (daysAgo < 15 && standing === 'member') standing = 'applied';
    // An application still waiting after six weeks is neglect, not a demo: the
    // older ones are decided, and a few in the last weeks run past the week.
    if (daysAgo > 40 && (standing === 'applied' || standing === 'fee_due')) standing = i % 2 ? 'member' : 'declined';
    const kindRoll = r();
    const kind = kindRoll < 0.45 ? 'tin' : kindRoll < 0.6 ? 'rca' : kindRoll < 0.7 ? 'other' : 'none';
    const groups = [];
    if (gender === 'female' && r() < 0.6) groups.push('women');
    if (r() < 0.25) groups.push('youth');
    if (r() < 0.07) groups.push('pwd');
    out.push({
      n: 20 + i,
      // Trade and family name step apart, so no two businesses share a name.
      name: `${LAST[(i + Math.floor(i / TRADES.length)) % LAST.length]} ${trade[0]}`,
      district,
      sector: null,
      street: `${district === 'Gasabo' ? 'KG' : district === 'Nyarugenge' ? 'KN' : district === 'Kicukiro' ? 'KK' : 'RN'} ${10 + i * 7} St`,
      association: trade[2],
      kind,
      tin: kind === 'tin' ? `9990561${String(i).padStart(2, '0')}` : undefined,
      registrationNumber: kind === 'rca' ? `RCA/${2000 + i}/2024` : kind === 'other' ? `RDB/${4100 + i}` : undefined,
      groups,
      daysAgo,
      owner: { name: `${first} ${last}`, gender, dob: `19${70 + Math.floor(r() * 30)}-0${1 + Math.floor(r() * 9)}-1${Math.floor(r() * 9)}` },
      standing,
      tier,
      declared,
      // Decided in one to twelve days; paid within a fortnight of that.
      waitDays: 1 + Math.floor(r() * 12),
      paidAfter: 1 + Math.floor(r() * 14),
      company: kind === 'rca' ? 'cooperative' : r() < 0.5 ? 'sole_trader' : 'private_company',
      activity: trade[1],
      decline: standing === 'declined'
        ? r() < 0.5
          ? { reason: 'details_incomplete', note: 'The street address and the contact phone do not match the business. Correct them and apply again.' }
          : { reason: 'not_eligible_for_tier', note: 'This band is for a larger turnover. Apply for a lower Indatwa band.' }
        : null,
    });
  }
  return out;
}
const BUSINESSES = [...NAMED, ...generated()];

const ago = (days, hours = 0) => new Date(Date.now() - days * 86_400_000 - hours * 3_600_000);
const kigaliDate = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali' }).format(d);
/** Fixed, typeable docIDs for the demo: `PSF-DEM0-0001`. Crockford has no O, so DEM0 ends in a zero. */
const demoDocId = (n) => `PSF-DEM0-${String(n).padStart(4, '0')}`;
const randomDocId = () => newPsfDocId((k) => crypto.getRandomValues(new Uint8Array(k)));

/**
 * A few district prices (2026-10-20), so the officer's Fees screen and the
 * form's read-only amount show both kinds: Gasabo prices two Indatwa bands
 * its own way, Kicukiro one; every other band and district uses the band's
 * starting price. Officers change these in the console; a re-run only puts
 * back a price that was cleared, never one an officer changed.
 */
async function seedDistrictFees(c) {
  const officer = (email) => OFFICERS.find((o) => o.email === email);
  const rows = [
    ['bosco@demo.injishi.com', 'indatwa_20k', 25_000],
    ['bosco@demo.injishi.com', 'indatwa_10k', 12_000],
    ['olivier@demo.injishi.com', 'indatwa_50k', 60_000],
  ];
  for (const [email, tier, amount] of rows) {
    const o = officer(email);
    await c.query(
      `INSERT INTO psf_tier_fees (tier_code, district_id, annual_fee_rwf, set_by_user_id)
       VALUES ($1, $2, $3, $4) ON CONFLICT (tier_code, coalesce(district_id, 0)) DO NOTHING`,
      [tier, o.scope.districtId, amount, o.id],
    );
  }
}

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
  for (const o of OFFICERS) {
    await seedUser(c, { ...o, roles: ['guest', 'gov_oversight'] });
    // At PSF, for the region the officer covers (AC-10 as the PSF path widened it).
    await c.query(
      `INSERT INTO oversight_assignments
         (id, user_id, oversight_role, government_body_code, government_title, scope_level, province_id, district_id)
       VALUES ($1, $2, 'psf_membership_officer', 'PSF', $6, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET government_title = EXCLUDED.government_title`,
      [o.grant, o.id, o.scope.level, o.scope.provinceId, o.scope.districtId, o.title],
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
  if (b.psf_member) {
    console.log('Umucyo Garden Guest House is already a PSF member; its demo application is not written.');
    return;
  }
  const [firstName, ...rest] = b.name.split(' ');
  await c.query(
    `INSERT INTO psf_membership_applications
       (id, org_id, submitted_by_user_id, submitted_capacity, status, queued_at, doc_id,
        requested_tier_code, quoted_price_kind, quoted_fee_min_rwf, quoted_fee_max_rwf, declared_fee_rwf,
        company_name, registration_type, registration_number, website, street_address,
        company_type, ownership, business_activity, trade_direction, trade_countries,
        contact_role, first_name, last_name, gender, phone_e164, email,
        id_document_type, id_document_number, date_of_birth,
        consent_given_at, consent_version, created_at, updated_at)
     VALUES ($1, $2, $3, 'owner', 'submitted', now() - interval '3 days', $15,
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
      CONSENT_VERSION, randomDocId(),
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

/** A district's sector by name, or, for a generated business, the n-th of its sectors. */
async function place(c, district, sector, n) {
  const { rows } = sector
    ? await c.query(
        `SELECT d.id AS district_id, d.name AS district_name, d.province_id, s.id AS sector_id
           FROM sectors s JOIN districts d ON d.id = s.district_id
          WHERE lower(d.name) = lower($1) AND lower(s.name) = lower($2)`,
        [district, sector],
      )
    : await c.query(
        `SELECT d.id AS district_id, d.name AS district_name, d.province_id, s.id AS sector_id
           FROM sectors s JOIN districts d ON d.id = s.district_id
          WHERE lower(d.name) = lower($1)
          ORDER BY s.id OFFSET $2 LIMIT 1`,
        [district, n % 8],
      );
  if (rows.length === 0) throw new Error(`Sector not found: ${sector ?? `#${n}`} in ${district}. Run seed-geography.mjs first.`);
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

/**
 * The demo PSF businesses an earlier version of this seed wrote with an owner
 * account and a workspace (the portal the public path retired). Deleted, child
 * to parent, so this run can write them the way the public form does.
 */
async function purgePortalBusinesses(c, all = false) {
  const { rows } = await c.query(
    `SELECT o.id FROM orgs o
      WHERE o.domain = 'enterprise' AND o.id::text LIKE 'de300000-0000-4000-8000-0056%'
        AND ($1 OR EXISTS (SELECT 1 FROM workspaces w WHERE w.org_id = o.id))`,
    [all],
  );
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return 0;
  await c.query('DELETE FROM psf_memberships WHERE org_id = ANY($1)', [ids]);
  await c.query('DELETE FROM psf_membership_applications WHERE org_id = ANY($1)', [ids]);
  await c.query('DELETE FROM subscription_invoices WHERE org_id = ANY($1)', [ids]);
  await c.query('DELETE FROM org_registration_events WHERE org_id = ANY($1)', [ids]);
  await c.query('DELETE FROM tin_verifications WHERE org_id = ANY($1)', [ids]);
  await c.query('DELETE FROM org_memberships WHERE org_id = ANY($1)', [ids]);
  await c.query('DELETE FROM workspaces WHERE org_id = ANY($1)', [ids]);
  await c.query('DELETE FROM orgs WHERE id = ANY($1)', [ids]);
  return ids.length;
}

/** Who decides an application in this district: its own officer, else the province's, else the country's. */
function deciderFor(where) {
  return (
    OFFICERS.find((o) => o.scope.level === 'district' && o.scope.districtId === where.district_id) ??
    OFFICERS.find((o) => o.scope.level === 'province' && o.scope.provinceId === where.province_id) ??
    OFFICERS.find((o) => o.scope.level === 'country')
  );
}

/** The next membership number in a district's run, `PSF/KIC/2026/0007`. */
const membershipRuns = new Map();
async function nextMembershipNumber(c, letters, year) {
  const key = `${letters}/${year}`;
  if (!membershipRuns.has(key)) {
    const { rows } = await c.query(
      `SELECT coalesce(max(split_part(num, '/', 4)::int), 0) AS n FROM (
         SELECT approved_membership_number AS num FROM psf_membership_applications WHERE approved_membership_number LIKE $1
         UNION ALL SELECT membership_number FROM psf_memberships WHERE membership_number LIKE $1) x
        WHERE num ~ $2`,
      [`PSF/${letters}/${year}/%`, `^PSF/${letters}/${year}/[0-9]+$`],
    );
    membershipRuns.set(key, Number(rows[0].n));
  }
  const n = membershipRuns.get(key) + 1;
  membershipRuns.set(key, n);
  return formatPsfMembershipNumber(letters, year, n);
}

/** One PSF business, registered on the public form, and where it stands with PSF. */
async function seedPsfBusiness(c, b) {
  const where = await place(c, b.district, b.sector, b.n);
  const orgId = P(100 + b.n);
  const created = ago(b.daysAgo, 3);
  const feePaid = b.standing !== 'fee_due';
  const paid = new Date(created.getTime() + 4 * 60_000);
  const { rowCount, rows: inserted } = await c.query(
    `INSERT INTO orgs
       (id, legal_name, domain, tin, registration_kind, registration_number, psf_association_code, owner_groups,
        psf_member, registration_status, district_id, sector_id, address_text, created_at, updated_at)
     VALUES ($1, $2, 'enterprise', $3, $4, $5, $6, $7::psf_owner_group[], $8, $9, $10, $11, $12, $13, $14)
     ON CONFLICT (id) DO UPDATE SET legal_name = EXCLUDED.legal_name
     RETURNING (xmax = 0) AS inserted`,
    [
      orgId, b.name, b.kind === 'tin' ? b.tin : null, b.kind,
      b.kind === 'tin' || b.kind === 'none' ? null : b.registrationNumber, b.association,
      b.groups, b.standing === 'member', feePaid ? 'active' : 'pending_payment',
      where.district_id, where.sector_id, b.street, created, feePaid ? paid : created,
    ],
  );
  if (rowCount === 0 || !inserted[0]?.inserted) {
    // Already written: keep its name in step with this file, and the filed form's with it.
    await c.query('UPDATE psf_membership_applications SET company_name = $2 WHERE org_id = $1', [orgId, b.name]);
    return { orgId, written: false };
  }

  const code = feePaid ? await nextBusinessCode(c, where.district_id, where.district_name) : null;
  if (code) await c.query('UPDATE orgs SET business_code = $2 WHERE id = $1', [orgId, code]);
  if (b.kind === 'tin' && feePaid) {
    await c.query(
      `INSERT INTO tin_verifications (id, org_id, tin, result, latency_ms, adapter_mode, raw_response, checked_at)
       VALUES ($1, $2, $3, 'verified', $4, 'mock', $5, $6) ON CONFLICT (id) DO NOTHING`,
      [P(500 + b.n), orgId, b.tin, 300 + b.n * 17, JSON.stringify({ mock: true, tin: b.tin, status: 'VALID', source: 'seed-demo-psf' }), paid],
    );
  }
  // The trail the public path writes: the system created it, the payment moved it.
  const events = [{ from: null, to: 'pending_payment', at: created }];
  if (feePaid) {
    events.push({ from: 'pending_payment', to: 'submitted', at: paid });
    events.push({ from: 'submitted', to: 'active', at: new Date(paid.getTime() + 2_000) });
  }
  let i = 0;
  for (const ev of events) {
    i += 1;
    await c.query(
      `INSERT INTO org_registration_events (id, org_id, from_status, to_status, trigger, actor_user_id, occurred_at)
       VALUES ($1, $2, $3, $4, 'system', NULL, $5) ON CONFLICT (id) DO NOTHING`,
      [P(600 + b.n * 10 + i), orgId, ev.from, ev.to, ev.at],
    );
  }
  await seedPsfApplication(c, b, orgId, where, created, feePaid ? paid : null);
  return { orgId, written: true, code };
}

async function seedPsfApplication(c, b, orgId, where, created, feePaidAt) {
  const { rows: tiers } = await c.query('SELECT * FROM psf_membership_tiers WHERE code = $1', [b.tier]);
  const tier = tiers[0];
  if (!tier) throw new Error(`Tier ${b.tier} is missing.`);
  const appId = P(700 + b.n);
  const queued = feePaidAt ? new Date(feePaidAt.getTime() + 3_000) : null;
  const waitDays = b.waitDays ?? 2;
  const decided = ['member', 'declined'].includes(b.standing);
  // A member's membership starts the day PSF approved it; `paidDaysAgo` names that day.
  const decidedAt =
    decided && queued
      ? b.standing === 'member' && b.paidDaysAgo !== undefined
        ? ago(b.paidDaysAgo)
        : new Date(Math.min(Date.now() - 3_600_000, queued.getTime() + waitDays * 86_400_000 + 5 * 3_600_000))
      : null;
  // The membership fee is the one payment, at submit; a decline keeps it.
  const paidAt = feePaidAt;
  const officer = deciderFor(where);
  const [firstName, ...rest] = b.owner.name.split(' ');
  const phone = `+2507880${String(560000 + b.n).slice(-6)}`;
  const email = b.n % 3 === 0 ? null : `${firstName.toLowerCase().replace(/[^a-z]/g, '')}.${(rest.at(-1) ?? 'x').toLowerCase().replace(/[^a-z]/g, '')}@guests.demo.injishi.com`;
  const nid = `1${b.owner.dob.slice(0, 4)}${b.owner.gender === 'female' ? '7' : '8'}00560${String(b.n).padStart(4, "0")}0`;

  const status =
    b.standing === 'applied' || b.standing === 'fee_due' ? 'submitted' : b.standing === 'member' ? 'member' : 'declined';
  const registrationNumber = b.kind === 'tin' ? b.tin : b.kind === 'none' ? null : b.registrationNumber;
  const year = Number(kigaliDate(decidedAt ?? new Date()).slice(0, 4));
  const number = status === 'member'
    ? await nextMembershipNumber(c, districtLetters(where.district_id, where.district_name), year)
    : null;
  const trading = b.association === 'actr' || b.association === 'coffee_cooperatives';

  await c.query(
    `INSERT INTO psf_membership_applications
       (id, org_id, submitted_by_user_id, submitted_capacity, status, queued_at, doc_id,
        applicant_phone_e164, applicant_email,
        requested_tier_code, quoted_price_kind, quoted_fee_rwf, quoted_fee_min_rwf, quoted_fee_max_rwf, declared_fee_rwf,
        company_name, registration_type, registration_number, website, street_address,
        company_type, ownership, business_activity, trade_direction, trade_goods, trade_countries,
        contact_role, first_name, last_name, gender, phone_e164, email,
        id_document_type, id_document_number, date_of_birth, consent_given_at, consent_version,
        decided_at, decided_by_user_id, decision_body_code, decline_reason, decision_note,
        approved_membership_number, approved_fee_rwf,
        paid_at, paid_amount_rwf, payment_ref, payment_mode,
        created_at, updated_at)
     VALUES ($1, $2, NULL, 'owner', $3, $4, $5,
             $6, $7,
             $8, $9, $10, $11, $12, $13,
             $14, $15, $16, NULL, $17,
             $18, 'rwandan_100', $19, $20, $21, $22,
             'owner', $23, $24, $25, $6, $26,
             'national_id', $27, $28, $29, $30,
             $31, $32, $33, $34, $35,
             $36, $37,
             $38, $39, $40, $41,
             $29, $42)
     ON CONFLICT (id) DO NOTHING`,
    [
      appId, orgId, status, queued, demoDocId(b.n),
      phone, email,
      tier.code, tier.price_kind, tier.annual_fee_rwf, tier.annual_fee_min_rwf, tier.annual_fee_max_rwf, b.declared,
      b.name, b.kind, registrationNumber, b.street,
      b.company, b.activity,
      trading ? (b.association === 'actr' ? 'both' : 'export') : 'none',
      trading ? (b.association === 'actr' ? 'Shoes, cloth and household goods' : 'Green coffee') : null,
      trading ? (b.association === 'actr' ? ['CD'] : ['US', 'BE']) : [],
      firstName, rest.join(' ') || firstName, b.owner.gender === 'female' ? 'female' : 'male', email ?? '',
      nid, b.owner.dob, created, CONSENT_VERSION,
      decidedAt, decidedAt ? officer.id : null, decidedAt ? 'PSF' : null,
      b.standing === 'declined' ? b.decline.reason : null, b.standing === 'declined' ? b.decline.note : null,
      number, number ? b.declared : null,
      paidAt, paidAt ? b.declared : null, paidAt ? `mock_one_time_fee_seed-demo-psf:${appId}` : null, paidAt ? 'mock' : null,
      decidedAt ?? paidAt ?? created,
    ],
  );

  if (b.standing === 'member') {
    const { startsOn, expiresOn } = defaultPsfMembershipDates(kigaliDate(decidedAt));
    await c.query(
      `INSERT INTO psf_memberships
         (id, org_id, source, application_id, tier_code, membership_number, annual_fee_rwf, starts_on, expires_on, recorded_by_user_id, created_at, updated_at)
       VALUES ($1, $2, 'psf_confirmed', $3, $4, $5, $6, $7, $8, $9, $10, $10)
       ON CONFLICT (id) DO NOTHING`,
      [P(800 + b.n), orgId, appId, tier.code, number, b.declared, startsOn, expiresOn, officer.id, decidedAt],
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
    await seedOfficers(client);
    await seedDistrictFees(client);
    // `--reset` rewrites every demo PSF business, with fresh dates.
    const purged = await purgePortalBusinesses(client, process.argv.includes('--reset'));
    if (purged) console.log(`Rewriting ${purged} demo PSF business(es) on the public path.`);
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
  console.log(`Officers: ${OFFICERS.map((o) => `${o.email} (${o.label})`).join(', ')}. Track an application at /psf/track/PSF-DEM0-0001.`);
} catch (error) {
  console.error(`seed-demo-psf: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
