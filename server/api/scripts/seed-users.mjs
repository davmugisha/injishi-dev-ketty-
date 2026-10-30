// Seed a set of representative Users (the Better-Auth identity), their
// user_profiles and global user_roles, AND the grants that decide what each of
// them can actually open. Every person is a Guest (F-S01); supply / broker /
// admin / gov_oversight add roles on top.
//
// WHY THE GRANTS ARE HERE. A global role is not a workspace. `user_roles` says
// what kind of person someone is; `workspaces`, `org_memberships`,
// `oversight_assignments` and `admin_users` are what `GET /api/v1/me/*`
// actually reads, and until this script wrote them every seeded account
// resolved to an EMPTY workspace list. That was invisible while the apps had no
// sign-in gate — they rendered demo fixtures for everybody, so nobody noticed
// the API was answering "you hold nothing". With the gate in front, an empty
// answer is the whole experience: sign in, and be told there is nothing here.
//
// So identity and grant are seeded together, in one script, because seeding one
// without the other produces an account that can sign in and do nothing.
//
// NOT A COPY OF THE DEMO ROSTER. `seed-demo.mjs` owns that, refuses to run
// against DATABASE_URL, and stays that way — this is a small, separate set of
// `@injishi.com` logins for driving the real apps, one per shape of access.
//
// Idempotent throughout: every write checks first or uses ON CONFLICT, so
// re-running changes nothing. Matches users on lower(email).
//
// Run with DATABASE_URL set:
//   pnpm --filter @injishi/api exec node scripts/seed-users.mjs
import pg from 'pg';

import { upsertGovernmentBodies } from './reference-data.mjs';
import { businessKindFor } from './business-kind.mjs';
import { assertSampleDatabase } from './sample-database.mjs';

/** Stable ids, so a re-run updates the same rows instead of making new ones. */
const ORG_RESIDENCE = '0f9a1b00-0002-4000-8000-000000000001';

/**
 * The business that is NOT active, so the registration gate has something to
 * refuse (D20, D23).
 *
 * Every other seeded org is `active`, which left `permissionsForWorkspace`'s
 * empty-set branch — the rule that an owner of a business still in the pipeline
 * holds the role and none of its powers — with no account exercising it and no
 * test covering it either. The tracker claimed four tests in
 * `packages/contracts/tests/authz.test.mjs`; that file does not exist.
 */
const ORG_PENDING = '0f9a1b00-0003-4000-8000-000000000001';

/**
 * Umurage Hospitality Ltd, the hotel `seed-content.mjs` writes (its `IDS.org`),
 * reused rather than forked.
 *
 * By id, never "the oldest hospitality org". That lookup held only on a
 * database where this script ran before the later seeds: `seed-demo-portfolio.mjs`
 * backdates its pipeline businesses, so on a fully seeded database the oldest
 * is Umwezi Terrace Hotel, and a rerun handed host@, manager@ and the rest a
 * second membership in a demo registrant's business (staging, 2026-10-26).
 */
const ORG_HOSPITALITY = '0f9a1b00-0000-4000-8000-000000000001';

/**
 * The roster.
 *
 * `roles` are GLOBAL roles (`user_roles`). `grants` are what the person can
 * open, and they are a different thing entirely — the two are listed side by
 * side here so the difference is impossible to miss while reading.
 *
 * Every account gets a `personal` workspace. That is not filler: personal is
 * the workspace a human being holds by being a person (their trips, their
 * leases, their messages), and an account without one has nowhere to land after
 * sign-in even when it holds nothing else.
 */
const USERS = [
  {
    email: 'admin@injishi.com',
    name: 'Injishi Admin',
    roles: ['admin', 'guest'],
    // The only account that opens the control tower at :3001.
    grants: { personal: true, staffRoles: ['super_admin'] },
  },
  {
    email: 'host@injishi.com',
    name: 'Aline Uwase',
    roles: ['guest'], // Host is an OrgRole; global identity stays Guest.
    // Owner of the seeded hospitality business → the Host workspace in PMS.
    grants: { personal: true, org: 'hospitality', orgRole: 'owner' },
  },
  {
    email: 'landlord@injishi.com',
    name: 'Jean Bosco Habimana',
    roles: ['guest'], // Landlord is an OrgRole too.
    // Owner of a RESIDENCE business. Host and Landlord are the same kind of
    // row (`business`); the org's domain is the only thing that tells them
    // apart, which is why this one exists at all.
    grants: { personal: true, org: 'residence', orgRole: 'owner' },
  },
  /*
   * The non-owner roles (ADR-035, D-d).
   *
   * Until these existed, `manager`, `receptionist` and `housekeeper` were
   * defined in `@injishi/contracts`, enforced by `WorkspaceGuard`, and held by
   * NOBODY. So "a receptionist sees less" was an assertion no run had ever
   * checked, and the only way to look at a smaller surface was the operator
   * app's "View as" picker, which was a costume rather than a grant and is now
   * gone (ADR-035, D-c).
   *
   * They join the SAME two seeded businesses rather than getting orgs of their
   * own. A second hotel would prove nothing about roles and would double the
   * fixture that has to stay true.
   *
   * What each one is for, and what a run should be able to show:
   *   manager      — everything operational, money and Integrations included,
   *                  but NO People leaf: `team.manage` became owner-only on
   *                  2026-09-12, because deciding who works here outlives a
   *                  manager's tenure. `ebm.manage` deliberately stayed with
   *                  the manager (ADR-041, D-o). Manager holds 22 of 23.
   *   receptionist — Front desk and Services only: no Rooms, no Money, no
   *                  Property admin
   *   housekeeper  — Room status and Maintenance, and nothing else
   *
   * This comment used to say "no Settings leaf (owner only)", which was never
   * true in the code: `manager` was `new Set(ALL)`, byte-identical to `owner`,
   * and `navFor` showed Settings to both. A boundary described in a comment and
   * enforced nowhere is how the two came to differ in name only.
   */
  {
    email: 'manager@injishi.com',
    name: 'Patrick Nsengimana',
    roles: ['guest'],
    grants: { personal: true, org: 'hospitality', orgRole: 'manager' },
  },
  {
    email: 'reception@injishi.com',
    name: 'Diane Ingabire',
    roles: ['guest'],
    grants: { personal: true, org: 'hospitality', orgRole: 'receptionist' },
  },
  {
    email: 'housekeeper@injishi.com',
    name: 'Beatha Mukandayisenga',
    roles: ['guest'],
    grants: { personal: true, org: 'hospitality', orgRole: 'housekeeper' },
  },
  {
    email: 'resident-manager@injishi.com',
    name: 'Solange Uwimana',
    roles: ['guest'],
    // The residence side needs a non-owner too: the landlord nav drops its
    // Business section for anyone who is not the owner, and nothing proved it.
    grants: { personal: true, org: 'residence', orgRole: 'manager' },
  },
  {
    email: 'broker@injishi.com',
    name: 'Claudine Mukamana',
    roles: ['broker', 'guest'],
    grants: { personal: true, broker: true },
  },
  {
    email: 'guest@injishi.com',
    name: 'Eric Niyonzima',
    roles: ['guest'],
    // Holds nothing but a personal workspace: the plain-marketplace case.
    grants: { personal: true },
  },
  {
    email: 'localgov@injishi.com',
    name: 'Nyarugenge District Office',
    roles: ['gov_oversight', 'guest'],
    districtId: 101, // Nyarugenge (Kigali) — seeded geography.
    // An oversight console is a district-scoped ASSIGNMENT, not a workspace
    // row. `/me/oversight` serves it separately for exactly that reason.
    grants: {
      personal: true,
      oversight: { role: 'business_field_verifier', title: 'Field Verifier' },
    },
  },
  {
    /*
     * The second console (ADR-035, D-d).
     *
     * A field verifier alone cannot demonstrate the oversight surface, because
     * the two consoles refuse different people and the separation of duties
     * check needs TWO officers to have anything to compare. With only
     * `localgov@injishi.com` seeded, `violatesSeparationOfDuties` had no case
     * where it should pass and no case where it should refuse.
     */
    email: 'approver@injishi.com',
    name: 'Nyarugenge District Approver',
    roles: ['gov_oversight', 'guest'],
    districtId: 101,
    grants: {
      personal: true,
      oversight: { role: 'business_approver', title: 'Approving Officer' },
    },
  },
  {
    /*
     * The registration gate, as a person (D20, D23).
     *
     * Owner of a business still at `submitted`. `permissionsForWorkspace`
     * returns an EMPTY set for any org that is not `active`, so this account
     * signs in, SEES the workspace listed — the registrant opens it to watch
     * the pipeline, which is why it is listed at every stage — and holds no
     * power in it. A guarded write is refused with the registration STAGE
     * named (`REGISTRATION_STAGE_MESSAGE`), never with "your role cannot".
     *
     * `RESIDENCE_ORG` explains why the landlord is not this account: an owner
     * who can do nothing makes a terrible first run. It needed to be a separate
     * person, and nobody had written one.
     */
    email: 'pending@injishi.com',
    name: 'Chantal Mukamurenzi',
    roles: ['guest'],
    grants: { personal: true, org: 'pending', orgRole: 'owner' },
  },
  {
    /*
     * Both hats at once (ADR-029).
     *
     * The government console now lives inside the operator app, on the operator
     * origin, behind the operator's session. `GET /api/v1/me/oversight` carries
     * `SessionGuard` alone, so an ordinary marketplace session reaches it, and
     * `OversightGuard` asks only whether the caller holds an assignment — never
     * which door the session came through.
     *
     * Nothing leaked, but only because no seeded account held both an org role
     * and an assignment. That was the seed's doing, not a control, so the risk
     * AGENTS.md names in full had nothing testing it. This account holds both
     * deliberately: a manager at the seeded hotel who is ALSO a district
     * approver.
     *
     * A manager rather than an owner, so the two grants cannot be confused for
     * one; and an approver rather than a verifier, so it pairs with
     * `localgov@` for the separation-of-duties check.
     */
    email: 'dualhat@injishi.com',
    name: 'Emmanuel Rwigema',
    roles: ['gov_oversight', 'guest'],
    districtId: 101,
    grants: {
      personal: true,
      org: 'hospitality',
      orgRole: 'manager',
      oversight: { role: 'business_approver', title: 'Approving Officer' },
    },
  },
  /*
   * Every remaining role, one account each (2026-10-26).
   *
   * Until these existed, this roster stopped at the roles of 2026-09-12. The
   * two office roles (ADR-069 D-a) were held only by demo personas, three of
   * the five staff roles and the tax console by nobody at all, so "a
   * compliance staffer cannot see money" or "a trainer reaches Training and
   * nothing else" was, again, an assertion no sign in could check.
   *
   * The office roles join the seeded hotel, like the desk and the
   * housekeeper. The staff accounts hold one role each, so each one shows its
   * own set and nothing borrowed from a second role. They also hold the
   * `admin` global role, as `bootstrap-admin.mjs` gives every staff grant.
   */
  {
    email: 'finance@injishi.com',
    name: 'Janvier Hakizimana',
    roles: ['guest'],
    grants: { personal: true, org: 'hospitality', orgRole: 'finance' },
  },
  {
    email: 'hr@injishi.com',
    name: 'Pacifique Uwimbabazi',
    roles: ['guest'],
    grants: { personal: true, org: 'hospitality', orgRole: 'hr' },
  },
  {
    email: 'admin-ops@injishi.com',
    name: 'Thierry Nshimiyimana',
    roles: ['admin', 'guest'],
    grants: { personal: true, staffRoles: ['ops'] },
  },
  {
    email: 'admin-compliance@injishi.com',
    name: 'Clementine Mukandoli',
    roles: ['admin', 'guest'],
    grants: { personal: true, staffRoles: ['compliance'] },
  },
  {
    // Injishi's own finance desk, not a business's: `finance@` is the hotel's.
    email: 'admin-finance@injishi.com',
    name: 'Fabrice Ndayisaba',
    roles: ['admin', 'guest'],
    grants: { personal: true, staffRoles: ['finance'] },
  },
  {
    // ADR-049: holds the four training powers and no `admin.*` power at all.
    email: 'admin-trainer@injishi.com',
    name: 'Esperance Umutoni',
    roles: ['admin', 'guest'],
    grants: { personal: true, staffRoles: ['trainer'] },
  },
  {
    // The tax console gates nothing in the registration pipeline, so it pairs
    // with neither `localgov@` nor `approver@`; it shares their district.
    email: 'taxofficer@injishi.com',
    name: 'Nyarugenge District Tax Officer',
    roles: ['gov_oversight', 'guest'],
    districtId: 101,
    grants: {
      personal: true,
      oversight: { role: 'tax_compliance_officer', title: 'Tax Compliance Officer' },
    },
  },
  {
    // ADR-056 AC-10: a PSF membership officer is posted at PSF, country wide,
    // and nowhere else, so this one carries no district.
    email: 'psf@injishi.com',
    name: 'PSF Membership Office',
    roles: ['gov_oversight', 'guest'],
    grants: {
      personal: true,
      oversight: {
        role: 'psf_membership_officer',
        title: 'Membership Officer',
        body: 'PSF',
        scope: 'country',
      },
    },
  },
];

/**
 * The government body an assignment hangs off unless it names its own (PSF
 * does). Both come from the reference catalogue, `reference-data.mjs`, which
 * `main` writes before any assignment, so there is one copy of each.
 */
const DEFAULT_GOV_BODY = 'MINALOC';

/** The residence business, so the Landlord workspace has something to be. */
const RESIDENCE_ORG = {
  id: ORG_RESIDENCE,
  legalName: 'Lavender Hill Residences Ltd',
  domain: 'residence',
  // Required by the `orgs_domain_shape` check: a residence org must name a
  // residence_class (and must NOT carry a tourism licence), exactly as a
  // hospitality org must name an accommodation_class. The constraint is the
  // schema refusing to hold a business whose domain and paperwork disagree.
  residenceClass: 'residential_landlord',
  // A residence business is identified by its UPI (the land parcel), not by a
  // TIN. `orgs_identifier_shape` states exactly that, and it is a CHECK rather
  // than a convention: hospitality must carry a tin, residence must carry a
  // upi. Seeding a residence org with a tin and no upi makes the row unable to
  // survive its own migration.
  upi: '1/03/06/04/1187',
  districtId: 101,
  // `active` on purpose. `permissionsForWorkspace` returns an EMPTY set for an
  // org at any earlier stage (D20, D23), so a landlord seeded at `submitted`
  // would sign in, see their workspace listed, and hold no power in it — a
  // correct behaviour that makes a terrible first run.
  registrationStatus: 'active',
};

/**
 * The business in the registration pipeline, for `pending@injishi.com`.
 *
 * Hospitality rather than residence so it carries a `tin`
 * (`orgs_identifier_shape`) and an `accommodation_class`
 * (`orgs_domain_shape`) — a residence one would need a UPI and the point here
 * is the STATUS, not the paperwork.
 *
 * The TIN sits in the `999` block, the same marking `seed-demo-catalogue.mjs`
 * uses, so a row that is obviously not a real taxpayer cannot be mistaken for
 * one if this database is ever looked at by a human.
 *
 * It is `9999` rather than `999000NNN` because the catalogue mints its TINs as
 * `999` plus a zero-padded index (`999000001` upward, one per property), and
 * `orgs_tin_uk` is unique. The first spelling here was `999000042`, which
 * collided with the catalogue's forty-second property and failed the whole
 * seed recipe at its last step. Anything added to this file that needs a TIN
 * must stay clear of that range.
 *
 * `submitted` specifically: it is the first stage after the fee is taken, so
 * the refusal names a stage the registrant has actually reached.
 */
const PENDING_ORG = {
  id: ORG_PENDING,
  legalName: 'Rugando Guest House Ltd (registration in progress)',
  domain: 'hospitality',
  accommodationClass: 'guest_house',
  tin: '999900042',
  districtId: 101,
  registrationStatus: 'submitted',
};

async function upsertUser(client, u) {
  // Insert the identity if this email is new; return the resolved user id.
  const existing = await client.query(
    'SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1',
    [u.email],
  );
  if (existing.rows.length > 0) return { id: existing.rows[0].id, created: false };

  const inserted = await client.query(
    'INSERT INTO users (email, email_verified, name) VALUES ($1, true, $2) RETURNING id',
    [u.email, u.name],
  );
  return { id: inserted.rows[0].id, created: true };
}

async function upsertProfile(client, userId, u) {
  await client.query(
    `INSERT INTO user_profiles (user_id, display_name, district_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name`,
    [userId, u.name, u.districtId ?? null],
  );
}

async function upsertRoles(client, userId, u) {
  for (const role of u.roles) {
    const has = await client.query(
      `SELECT 1 FROM user_roles
       WHERE user_id = $1 AND global_role = $2 AND revoked_at IS NULL LIMIT 1`,
      [userId, role],
    );
    if (has.rows.length > 0) continue;
    await client.query(
      `INSERT INTO user_roles (user_id, global_role, district_id)
       VALUES ($1, $2, $3)`,
      [userId, role, role === 'gov_oversight' ? (u.districtId ?? null) : null],
    );
  }
}

/**
 * The residence business, and the hospitality one's id.
 *
 * Hospitality is looked up rather than inserted: the reference data already
 * seeds one, and a second would give the Host workspace two candidate orgs.
 * Returns null when it is absent, so the caller can say so instead of silently
 * skipping the grant.
 */
async function resolveOrgs(client) {
  // By id (see ORG_HOSPITALITY): the Host workspace must resolve to the seeded
  // hotel and nothing else, never the pending org and never a demo business.
  const hospitality = await client.query(
    `SELECT id FROM orgs WHERE id = $1 AND domain = 'hospitality'`,
    [ORG_HOSPITALITY],
  );

  await client.query(
    `INSERT INTO orgs (id, legal_name, domain, residence_class, upi, district_id,
                       registration_status, business_kind)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE
       SET registration_status = EXCLUDED.registration_status,
           upi = EXCLUDED.upi`,
    [
      RESIDENCE_ORG.id,
      RESIDENCE_ORG.legalName,
      RESIDENCE_ORG.domain,
      RESIDENCE_ORG.residenceClass,
      RESIDENCE_ORG.upi,
      RESIDENCE_ORG.districtId,
      RESIDENCE_ORG.registrationStatus,
      businessKindFor({ domain: RESIDENCE_ORG.domain }),
    ],
  );

  // The one org that is deliberately not `active`. `registration_status` is in
  // the DO UPDATE set, so a re-run puts it back to `submitted` even if a run of
  // the registration pipeline advanced it — this row exists to be pending.
  await client.query(
    `INSERT INTO orgs (id, legal_name, domain, accommodation_class, tin,
                       district_id, registration_status, business_kind)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE
       SET registration_status = EXCLUDED.registration_status,
           tin = EXCLUDED.tin`,
    [
      PENDING_ORG.id,
      PENDING_ORG.legalName,
      PENDING_ORG.domain,
      PENDING_ORG.accommodationClass,
      PENDING_ORG.tin,
      PENDING_ORG.districtId,
      PENDING_ORG.registrationStatus,
      businessKindFor({ domain: PENDING_ORG.domain, accommodationClass: PENDING_ORG.accommodationClass }),
    ],
  );

  return {
    hospitality: hospitality.rows[0]?.id ?? null,
    residence: RESIDENCE_ORG.id,
    pending: PENDING_ORG.id,
  };
}

/**
 * The `business` workspace row for an org.
 *
 * One per org, enforced by `workspaces_business_org_uk`. The membership is what
 * grants a PERSON access; this row is what they are granted access TO, and both
 * have to exist before `/me/workspaces` returns anything.
 */
async function upsertBusinessWorkspace(client, orgId) {
  const existing = await client.query(
    `SELECT id FROM workspaces WHERE kind = 'business' AND org_id = $1 LIMIT 1`,
    [orgId],
  );
  if (existing.rows.length > 0) return existing.rows[0].id;

  const inserted = await client.query(
    `INSERT INTO workspaces (kind, org_id) VALUES ('business', $1) RETURNING id`,
    [orgId],
  );
  return inserted.rows[0].id;
}

/** A `personal` or `broker` workspace, which belong to a user rather than an org. */
async function upsertSoloWorkspace(client, userId, kind) {
  const existing = await client.query(
    `SELECT id FROM workspaces WHERE kind = $2 AND user_id = $1 LIMIT 1`,
    [userId, kind],
  );
  if (existing.rows.length > 0) return existing.rows[0].id;

  const inserted = await client.query(
    `INSERT INTO workspaces (kind, user_id) VALUES ($2, $1) RETURNING id`,
    [userId, kind],
  );
  return inserted.rows[0].id;
}

/** The membership that turns "this business exists" into "you may open it". */
async function upsertMembership(client, orgId, userId, orgRole) {
  await client.query(
    `INSERT INTO org_memberships (org_id, user_id, org_role, status)
     VALUES ($1, $2, $3, 'active')
     ON CONFLICT (org_id, user_id)
     DO UPDATE SET org_role = EXCLUDED.org_role, status = 'active', removed_at = NULL`,
    [orgId, userId, orgRole],
  );
}

/**
 * A government assignment, district scoped unless it says otherwise. Revoked
 * rows are revived, not duplicated.
 */
async function upsertOversight(client, userId, u) {
  const { role, title, body = DEFAULT_GOV_BODY, scope = 'district' } = u.grants.oversight;
  const existing = await client.query(
    `SELECT id FROM oversight_assignments
     WHERE user_id = $1 AND oversight_role = $2 LIMIT 1`,
    [userId, role],
  );
  if (existing.rows.length > 0) {
    await client.query(
      `UPDATE oversight_assignments SET revoked_at = NULL WHERE id = $1`,
      [existing.rows[0].id],
    );
    return;
  }
  await client.query(
    `INSERT INTO oversight_assignments
       (user_id, oversight_role, government_body_code, government_title,
        scope_level, district_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    // `oversight_assignments_scope_shape`: a country grant names no district.
    [userId, role, body, title, scope, scope === 'district' ? (u.districtId ?? null) : null],
  );
}

/**
 * The platform staff row the admin console gates on.
 *
 * `revoked_at` is cleared on conflict rather than left alone: a re-run is meant
 * to restore the seeded state, and a revoked super admin that stays revoked
 * would leave the console permanently shut with no obvious cause.
 */
async function upsertStaff(client, userId, staffRoles) {
  await client.query(
    `INSERT INTO admin_users (user_id, staff_roles, two_factor_enrolled)
     VALUES ($1, $2, false)
     ON CONFLICT (user_id)
     DO UPDATE SET staff_roles = EXCLUDED.staff_roles, revoked_at = NULL`,
    [userId, staffRoles],
  );
}

/** Everything one person holds. Returns a short description, for the log. */
async function grantAll(client, userId, u, orgs) {
  const g = u.grants ?? {};
  const held = [];

  if (g.personal) {
    await upsertSoloWorkspace(client, userId, 'personal');
    held.push('personal');
  }
  if (g.broker) {
    await upsertSoloWorkspace(client, userId, 'broker');
    held.push('broker');
  }
  if (g.org) {
    const orgId = orgs[g.org];
    if (!orgId) {
      held.push(`${g.org}:MISSING-ORG`);
    } else {
      await upsertBusinessWorkspace(client, orgId);
      await upsertMembership(client, orgId, userId, g.orgRole);
      held.push(`${g.org}(${g.orgRole})`);
    }
  }
  if (g.oversight) {
    await upsertOversight(client, userId, u);
    held.push(`oversight:${g.oversight.role}`);
  }
  if (g.staffRoles) {
    await upsertStaff(client, userId, g.staffRoles);
    held.push(`staff[${g.staffRoles.join(', ')}]`);
  }

  return held.length > 0 ? held.join(' ') : 'nothing';
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  // ADR-043: sample data only ever goes into a database marked sample.
  await assertSampleDatabase(client, 'seed-users.mjs');
  try {
    await upsertGovernmentBodies(client);
    const orgs = await resolveOrgs(client);
    if (!orgs.hospitality) {
      console.warn(
        'WARNING: no hospitality org found, so the Host workspace is not\n' +
          '         granted. Run `node scripts/seed-content.mjs` first.',
      );
    }

    for (const u of USERS) {
      const { id, created } = await upsertUser(client, u);
      await upsertProfile(client, id, u);
      await upsertRoles(client, id, u);
      const held = await grantAll(client, id, u, orgs);
      console.log(
        `${created ? 'created' : 'exists '}  ${u.email.padEnd(28)} roles=[${u.roles.join(', ')}]  holds=${held}`,
      );
    }

    const { rows } = await client.query('SELECT count(*)::int AS n FROM users');
    console.log(`\nusers total = ${rows[0].n}`);
    console.log(
      'Sign in with any address above. A demo process takes the fixed demo code;\n' +
        'anywhere else the code is mailed: staging, and a laptop on staging, to the\n' +
        'inbox at mail-staging.injishi.com, a local stack to http://localhost:8025.',
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
