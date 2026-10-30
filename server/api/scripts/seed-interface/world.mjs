/**
 * The interface's world: the businesses, branches, rooms and the eighteen people the new interface
 * (apps/app) is drawn around. Every area module seeds on top of this.
 *
 *   Amahoro Hospitality Ltd   hotel group: Isangano Lakeside Hotel (Rubavu, 42 rooms, head office)
 *                             and Ishyamba Forest Lodge (Nyamagabe, 18 tents)
 *   Amahoro Residences Ltd    landlord: Kacyiru Court Residences (Gasabo)
 *   Emmanuel Twagira          a broker (a broker workspace hangs off a person, never an org)
 *   Alice Mukeshimana         district approver for Rubavu (MINALOC)
 *   Josiane Mukamurenzi       PSF membership officer
 *   Kevin Mugisha             Injishi operations (platform staff, the `ops` lens)
 *
 * Roles the platform does not have yet are mapped to the nearest one and listed in ROLE_GAPS, so
 * the gap is visible rather than quiet: there is no storekeeper, technician, waiter or outlet
 * supervisor org role (`org_role` is owner, manager, receptionist, finance, hr, housekeeper).
 *
 * TINs come from the 999 block and UPIs from the demo range, so no seeded business can collide
 * with, or be mistaken for, a real taxpayer.
 */
import { businessKindFor } from '../business-kind.mjs';
import { syntheticCoordFor } from '../synthetic-coords.mjs';
import { districtId, iid, kigaliAt, sectorId, userId } from './lib.mjs';

export const ORG = {
  hotel: iid('org', 'amahoro-hospitality'),
  residences: iid('org', 'amahoro-residences'),
};
export const WORKSPACE = {
  hotel: iid('workspace', 'amahoro-hospitality'),
  residences: iid('workspace', 'amahoro-residences'),
  broker: iid('workspace', 'broker:broker'),
  personal: (personaId) => iid('workspace', `personal:${personaId}`),
};
export const PROPERTY = {
  isangano: iid('property', 'isangano'),
  ishyamba: iid('property', 'ishyamba'),
  kacyiru: iid('property', 'kacyiru'),
};

const ORGS = [
  {
    id: ORG.hotel,
    legalName: 'Amahoro Hospitality Ltd',
    domain: 'hospitality',
    tin: '999100001',
    entityGroup: 'accommodation',
    accommodationClass: 'hotel',
    district: 'Rubavu',
    workspaceId: WORKSPACE.hotel,
  },
  {
    // A residence carries a UPI and no TIN (D24, `orgs_identifier_shape`).
    id: ORG.residences,
    legalName: 'Amahoro Residences Ltd',
    domain: 'residence',
    upi: '1/02/09/01/9001',
    entityGroup: 'accommodation',
    residenceClass: 'residential_landlord',
    district: 'Gasabo',
    workspaceId: WORKSPACE.residences,
  },
];

const PROPERTIES = [
  {
    id: PROPERTY.isangano,
    orgId: ORG.hotel,
    workspaceId: WORKSPACE.hotel,
    slug: 'isangano-lakeside-hotel',
    name: 'Isangano Lakeside Hotel',
    description: 'A fictional demo hotel: forty-two rooms on the Lake Kivu shore in Gisenyi.',
    district: 'Rubavu',
    sector: 'Gisenyi',
    street: 'Lake Kivu shore road',
    checkIn: '14:00',
    checkOut: '11:00',
    houseRules: 'No smoking indoors. Quiet hours from 22:00. Valid ID required at check-in.',
    isHeadOffice: true,
    rraBranchId: '00',
  },
  {
    id: PROPERTY.ishyamba,
    orgId: ORG.hotel,
    workspaceId: WORKSPACE.hotel,
    slug: 'ishyamba-forest-lodge',
    name: 'Ishyamba Forest Lodge',
    description: 'A fictional demo lodge: eighteen tents at the edge of the Nyungwe forest.',
    district: 'Nyamagabe',
    sector: 'Kitabi',
    street: 'Kitabi, on the Nyungwe road',
    checkIn: '13:00',
    checkOut: '10:30',
    houseRules: 'No fires outside the lodge fire pit. Quiet hours from 21:30.',
    isHeadOffice: false,
    rraBranchId: '01',
  },
  {
    id: PROPERTY.kacyiru,
    orgId: ORG.residences,
    workspaceId: WORKSPACE.residences,
    slug: 'kacyiru-court-residences',
    name: 'Kacyiru Court Residences',
    description: 'A fictional demo residence: twenty-four furnished apartments in Kacyiru.',
    district: 'Gasabo',
    sector: 'Kacyiru',
    street: 'KG 7 Ave',
    checkIn: '12:00',
    checkOut: '11:00',
    houseRules: 'Visitors sign in at the gate. Quiet hours from 22:00.',
    isHeadOffice: true,
    rraBranchId: null,
  },
];

/** Persona → org role, and the branches it is limited to (none = every branch). */
const MEMBERSHIPS = [
  { persona: 'owner', orgId: ORG.hotel, role: 'owner' },
  { persona: 'manager', orgId: ORG.hotel, role: 'manager' },
  { persona: 'frontdesk', orgId: ORG.hotel, role: 'receptionist', branches: ['isangano'] },
  { persona: 'finance', orgId: ORG.hotel, role: 'finance' },
  { persona: 'hr', orgId: ORG.hotel, role: 'hr' },
  { persona: 'store', orgId: ORG.hotel, role: 'housekeeper', branches: ['isangano', 'ishyamba'] },
  { persona: 'housekeeper', orgId: ORG.hotel, role: 'housekeeper', branches: ['isangano'] },
  { persona: 'supervisor', orgId: ORG.hotel, role: 'housekeeper', branches: ['isangano'] },
  { persona: 'technician', orgId: ORG.hotel, role: 'housekeeper', branches: ['isangano'] },
  { persona: 'waiter', orgId: ORG.hotel, role: 'receptionist', branches: ['isangano'] },
  { persona: 'outlet', orgId: ORG.hotel, role: 'manager', branches: ['isangano'] },
  { persona: 'owner', orgId: ORG.residences, role: 'owner' },
  { persona: 'residence', orgId: ORG.residences, role: 'manager' },
];

/** The interface roles the platform cannot hold yet, and what each is seeded as. */
export const ROLE_GAPS = [
  { persona: 'store', wanted: 'storekeeper', seededAs: 'housekeeper' },
  { persona: 'supervisor', wanted: 'housekeeping supervisor', seededAs: 'housekeeper (head of Housekeeping)' },
  { persona: 'technician', wanted: 'maintenance technician', seededAs: 'housekeeper (Engineering)' },
  { persona: 'waiter', wanted: 'waiter and cashier', seededAs: 'receptionist' },
  { persona: 'outlet', wanted: 'outlet supervisor', seededAs: 'manager' },
];

/** Global roles beyond `guest`, and platform staff lenses. */
const EXTRA_ROLES = {
  broker: ['broker'],
  officer: ['gov_oversight'],
  psf: ['gov_oversight'],
  ops: ['admin'],
};
const STAFF_ROLES = { ops: ['ops'] };

const ASSIGNMENTS = [
  {
    persona: 'officer',
    role: 'business_approver',
    body: 'MINALOC',
    title: 'Business Development Officer',
    scope: 'district',
    district: 'Rubavu',
  },
  { persona: 'psf', role: 'psf_membership_officer', body: 'PSF', title: 'Membership Officer', scope: 'country' },
];

/** Isangano's four room types (frontdesk.roomTypes) and Ishyamba's tents (only its count is in the fixtures). */
function roomTypes(fx) {
  const rooms = fx('operations.rooms');
  const countOf = (name) => rooms.filter((r) => r.type === name).length;
  const isangano = fx('frontdesk.roomTypes').map((t) => ({
    key: t.id,
    id: iid('room-type', `isangano:${t.id}`),
    ratePlanId: iid('rate-plan', `isangano:${t.id}:standard`),
    propertyId: PROPERTY.isangano,
    workspaceId: WORKSPACE.hotel,
    name: t.name,
    sleeps: t.sleeps,
    roomCount: countOf(t.name),
    priceRwf: t.rate,
  }));
  // The owner's property card gives Ishyamba an average daily rate of RWF 104,300; its base rate is that, rounded.
  const ishyamba = {
    key: 'tent',
    id: iid('room-type', 'ishyamba:tent'),
    ratePlanId: iid('rate-plan', 'ishyamba:tent:standard'),
    propertyId: PROPERTY.ishyamba,
    workspaceId: WORKSPACE.hotel,
    name: 'Forest Tent',
    sleeps: 2,
    roomCount: 18,
    priceRwf: 105000,
  };
  return [...isangano, ishyamba];
}

const HOUSEKEEPING = { clean: 'clean', inspected: 'inspected', dirty: 'dirty', occupied: 'clean', ooo: 'out_of_order' };

function roomsOf(fx, types) {
  const byName = new Map(types.map((t) => [t.name, t]));
  const isangano = fx('operations.rooms').map((r) => {
    const type = byName.get(r.type);
    if (!type) throw new Error(`operations.rooms ${r.id} names an unknown room type "${r.type}"`);
    return {
      id: iid('room', `isangano:${r.id}`),
      label: String(r.id),
      roomTypeId: type.id,
      propertyId: PROPERTY.isangano,
      workspaceId: WORKSPACE.hotel,
      status: r.status === 'ooo' ? 'maintenance' : 'available',
      housekeeping: HOUSEKEEPING[r.status] ?? 'clean',
    };
  });
  const tent = types.find((t) => t.key === 'tent');
  const tents = Array.from({ length: tent.roomCount }, (_, i) => ({
    id: iid('room', `ishyamba:T${i + 1}`),
    label: `T${i + 1}`,
    roomTypeId: tent.id,
    propertyId: PROPERTY.ishyamba,
    workspaceId: WORKSPACE.hotel,
    status: 'available',
    housekeeping: 'clean',
  }));
  return [...isangano, ...tents];
}

/** Room uuid by label at a property: `roomId('isangano', '204')`. */
export const roomId = (property, label) => iid('room', `${property}:${label}`);
export const roomTypeId = (property, key) => iid('room-type', `${property}:${key}`);

async function upsertPerson(c, persona, index) {
  const id = userId(persona.id);
  // An account that signed in before the seed ran (Better Auth creates it on first sign-in) keeps its id;
  // the seed adopts it by email rather than failing on the unique email.
  const { rows: existing } = await c.query('SELECT id FROM users WHERE lower(email) = lower($1)', [persona.email]);
  if (existing.length > 0 && existing[0].id !== id) {
    throw new Error(
      `${persona.email} already belongs to user ${existing[0].id}, not the seeded ${id}. ` +
        'Delete that account (or reset this sample database) and seed again.',
    );
  }
  await c.query(
    `INSERT INTO users (id, email, email_verified, name) VALUES ($1, $2, true, $3)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
    [id, persona.email, persona.name],
  );
  const nid = `1199${String(index + 1).padStart(2, '0')}7000000000`.slice(0, 16);
  await c.query(
    `INSERT INTO user_profiles (user_id, display_name, national_id) VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name`,
    [id, persona.name, nid],
  );
  await c.query(
    `INSERT INTO verified_identities (user_id, kyc_status, legal_full_name, verified_method, verified_at)
     VALUES ($1, 'verified', $2, 'manual', now()) ON CONFLICT (user_id) DO NOTHING`,
    [id, persona.name],
  );
  await c.query(
    `INSERT INTO identity_documents
       (identity_id, document_type, document_number, issuing_country, status, is_primary, verified_at)
     VALUES ($1, 'national_id', $2, 'RW', 'active', true, now())
     ON CONFLICT (document_type, document_number, issuing_country) DO NOTHING`,
    [id, nid],
  );
  for (const role of ['guest', ...(EXTRA_ROLES[persona.id] ?? [])]) {
    const { rows } = await c.query(
      'SELECT 1 FROM user_roles WHERE user_id = $1 AND global_role = $2 AND revoked_at IS NULL LIMIT 1',
      [id, role],
    );
    if (rows.length === 0) await c.query('INSERT INTO user_roles (user_id, global_role) VALUES ($1, $2)', [id, role]);
  }
  if (STAFF_ROLES[persona.id]) {
    await c.query(
      `INSERT INTO admin_users (user_id, staff_roles, two_factor_enrolled) VALUES ($1, $2, false)
       ON CONFLICT (user_id) DO UPDATE SET staff_roles = EXCLUDED.staff_roles, revoked_at = NULL`,
      [id, STAFF_ROLES[persona.id]],
    );
  }
  // Personal workspace: the API may already have made one at first sign-in (unique per user).
  await c.query(
    `INSERT INTO workspaces (id, kind, user_id) VALUES ($1, 'personal', $2) ON CONFLICT DO NOTHING`,
    [WORKSPACE.personal(persona.id), id],
  );
}

export async function seedWorld(ctx) {
  const { c, fx, personas, log } = ctx;

  for (const o of ORGS) {
    await c.query(
      `INSERT INTO orgs (id, legal_name, domain, rdb_entity_group, accommodation_class,
                         residence_class, tin, upi, registration_status, district_id, business_kind)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9, $10)
       ON CONFLICT (id) DO UPDATE SET legal_name = EXCLUDED.legal_name, registration_status = 'active'`,
      [o.id, o.legalName, o.domain, o.entityGroup, o.accommodationClass ?? null, o.residenceClass ?? null,
        o.tin ?? null, o.upi ?? null, await districtId(c, o.district),
        businessKindFor({ domain: o.domain, accommodationClass: o.accommodationClass })],
    );
    await c.query(
      `INSERT INTO workspaces (id, kind, org_id) VALUES ($1, 'business', $2) ON CONFLICT DO NOTHING`,
      [o.workspaceId, o.id],
    );
  }

  const order = Object.keys(personas);
  for (const [i, personaId] of order.entries()) await upsertPerson(c, personas[personaId], i);

  await c.query(
    `INSERT INTO workspaces (id, kind, user_id) VALUES ($1, 'broker', $2) ON CONFLICT DO NOTHING`,
    [WORKSPACE.broker, userId('broker')],
  );

  for (const pr of PROPERTIES) {
    const [lat, lng] = syntheticCoordFor({ district: pr.district, seed: pr.slug });
    await c.query(
      `INSERT INTO properties
         (id, org_id, workspace_id, name, description, sector_id, district_id, latitude, longitude,
          address_text, check_in_time, check_out_time, house_rules, slug, is_head_office, rra_branch_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`,
      [pr.id, pr.orgId, pr.workspaceId, pr.name, pr.description, await sectorId(c, pr.district, pr.sector),
        await districtId(c, pr.district), lat, lng, pr.street, pr.checkIn, pr.checkOut, pr.houseRules, pr.slug,
        pr.isHeadOffice, pr.rraBranchId],
    );
  }

  const propertyKey = Object.fromEntries(Object.entries(PROPERTY).map(([k, v]) => [k, v]));
  for (const m of MEMBERSHIPS) {
    const uid = userId(m.persona);
    const { rows } = await c.query(
      `SELECT id FROM org_memberships WHERE org_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`,
      [m.orgId, uid],
    );
    let membershipId = rows[0]?.id;
    if (!membershipId) {
      membershipId = iid('membership', `${m.orgId}:${m.persona}`);
      await c.query(
        `INSERT INTO org_memberships (id, org_id, user_id, org_role) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
        [membershipId, m.orgId, uid, m.role],
      );
    } else {
      await c.query('UPDATE org_memberships SET org_role = $2 WHERE id = $1', [membershipId, m.role]);
    }
    const branches = (m.branches ?? []).map((b) => propertyKey[b]);
    await c.query(
      `DELETE FROM org_membership_branches WHERE org_membership_id = $1 AND NOT (property_id = ANY($2::uuid[]))`,
      [membershipId, branches],
    );
    for (const propertyId of branches) {
      await c.query(
        `INSERT INTO org_membership_branches (org_membership_id, property_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [membershipId, propertyId],
      );
    }
  }

  for (const a of ASSIGNMENTS) {
    await c.query(
      `INSERT INTO oversight_assignments
         (id, user_id, oversight_role, government_body_code, government_title, scope_level, district_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`,
      [iid('assignment', a.persona), userId(a.persona), a.role, a.body, a.title, a.scope,
        a.district ? await districtId(c, a.district) : null],
    );
  }

  const types = roomTypes(fx);
  for (const t of types) {
    await c.query(
      `INSERT INTO room_types
         (id, property_id, workspace_id, name, domain, max_guests, capacity, room_count, base_price_rwf,
          booking_mode, approval_policy, cancellation_tier)
       VALUES ($1, $2, $3, $4, 'hospitality', $5, $5, $6, $7, 'instant_book', NULL, 'flexible')
       ON CONFLICT (id) DO UPDATE SET room_count = EXCLUDED.room_count`,
      [t.id, t.propertyId, t.workspaceId, t.name, t.sleeps, t.roomCount, t.priceRwf],
    );
    await c.query(
      `INSERT INTO rate_plans
         (id, room_type_id, workspace_id, name, is_default, base_price_rwf, base_occupancy, booking_mode,
          approval_policy, cancellation_tier)
       VALUES ($1, $2, $3, 'Standard rate', true, $4, $5, 'instant_book', NULL, 'flexible')
       ON CONFLICT (id) DO NOTHING`,
      [t.ratePlanId, t.id, t.workspaceId, t.priceRwf, Math.min(2, t.sleeps)],
    );
  }

  const rooms = roomsOf(fx, types);
  for (const r of rooms) {
    await c.query(
      `INSERT INTO rooms
         (id, room_type_id, property_id, workspace_id, label, status, housekeeping_status, housekeeping_updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, housekeeping_status = EXCLUDED.housekeeping_status`,
      [r.id, r.roomTypeId, r.propertyId, r.workspaceId, r.label, r.status, r.housekeeping, kigaliAt('07:30')],
    );
  }

  log(`world: ${ORGS.length} businesses, ${PROPERTIES.length} branches, ${order.length} people, ` +
    `${MEMBERSHIPS.length} memberships, ${types.length} room types, ${rooms.length} rooms`);
  for (const g of ROLE_GAPS) log(`  role gap: ${g.persona} wants "${g.wanted}", seeded as ${g.seededAs}`);
}
