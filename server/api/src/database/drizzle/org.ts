/**
 * §4.3 ORG & onboarding.
 *
 * Carved out of the single 3,956-line `schema.ts` along the section headers
 * that file already carried. Every declaration below is byte-identical to the
 * one it replaced; only the import lines are new. `schema.ts` re-exports this
 * module, so `drizzle.config.ts`, every migration and every importer still see
 * one schema at one path.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  char,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { timestamps } from './columns';
import { adapterModeEnum, documentTypeEnum, domainKindEnum, genderEnum, globalRoleEnum, identityDocumentStatusEnum, invitationPurposeEnum, invitationStatusEnum, kycStatusEnum, oboClaimStatusEnum, orgCertificateKindEnum, orgCertificateStatusEnum, orgMembershipStatusEnum, orgRegistrationStatusEnum, orgRoleEnum, oversightRoleEnum, oversightScopeLevelEnum, rdbClassificationKindEnum, registrationRejectionReasonEnum, registrationReviewDecisionEnum, registrationTransitionTriggerEnum, tinVerificationResultEnum, workspaceKindEnum } from './enums';
import { cells, districts, provinces, sectors, villages } from './geography';
import { storedObjects } from './hospitality';
import { properties } from './inventory';

export const rdbClassifications = pgTable('rdb_classifications', {
  code: text('code').primaryKey(),
  kind: rdbClassificationKindEnum('kind').notNull(),
  parentCode: text('parent_code').references(
    (): AnyPgColumn => rdbClassifications.code,
  ),
  labelEn: text('label_en').notNull(),
  labelRw: text('label_rw').notNull(),
  active: boolean('active').notNull().default(true),
});


export const orgs = pgTable(
  'orgs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    legalName: text('legal_name').notNull(),
    domain: domainKindEnum('domain').notNull(),
    rdbEntityGroup: text('rdb_entity_group').references(
      () => rdbClassifications.code,
    ),
    accommodationClass: text('accommodation_class').references(
      () => rdbClassifications.code,
    ),
    // D24: `accommodation_class = 'other'` is the honest escape from a fixed
    // vocabulary — the registrant names the class themselves. Required with it
    // and forbidden without it, so 'other' can never mean "unspecified".
    accommodationClassOther: text('accommodation_class_other'),
    residenceClass: text('residence_class').references(
      () => rdbClassifications.code,
    ),
    tourismLicenseNumber: text('tourism_license_number'),
    // D24: replaces `rha_member`. The Chamber of Tourism is the body a
    // hospitality business joins under the current framing, not the RHA — and
    // the old answer is not a valid answer to the new question, which is why
    // this is a new column and a dropped one rather than a rename.
    chamberOfTourismMember: boolean('chamber_of_tourism_member')
      .notNull()
      .default(false),
    // D24: OPTIONAL Private Sector Federation membership the business elects to
    // hold. NOT the `PSF` row in `government_bodies` — that is the institution
    // that assigns oversight officers. Same acronym, unrelated relations; never
    // join or display these two as one.
    psfMember: boolean('psf_member').notNull().default(false),
    eacStarGrade: smallint('eac_star_grade'),
    // D24: nullable, because TIN is for businesses and UPI is for residences.
    // The old NOT NULL forced a residential landlord to invent a TIN to exist.
    // Still unique when present — KYB dedup depends on it.
    tin: text('tin'),
    upi: text('upi'),
    registrationStatus: orgRegistrationStatusEnum('registration_status')
      .notNull()
      .default('pending_payment'),
    districtId: integer('district_id').references(() => districts.id),
    // D24: the wizard collects Province -> District -> Sector. `village_id`
    // stays and stays optional so nothing that already captured one loses it.
    sectorId: integer('sector_id').references(() => sectors.id),
    villageId: integer('village_id').references(() => villages.id),
    addressText: text('address_text'),
    /**
     * The operator contract this business accepted (ADR-053, AC-R8).
     *
     * A date string from `OPERATOR_CONTRACT_VERSION`, because the document is
     * rendered from code and a version stored anywhere else can drift from the
     * document it names. Nullable, and all three columns move together
     * (`orgs_contract_shape`), so every business registered before this existed
     * validates with no backfill. There is no re acceptance flow; see ADR-053.
     */
    contractVersion: text('contract_version'),
    contractAcceptedAt: timestamp('contract_accepted_at', { withTimezone: true }),
    contractAcceptedByUserId: uuid('contract_accepted_by_user_id').references(
      () => users.id,
    ),
    ...timestamps,
  },
  (t) => [
    unique('orgs_tin_uk').on(t.tin),
    index('orgs_district_idx').on(t.districtId),
    index('orgs_registration_status_idx').on(t.registrationStatus),
    check(
      'orgs_domain_shape',
      sql`(${t.domain} = 'hospitality' AND ${t.accommodationClass} IS NOT NULL)
          OR (${t.domain} = 'residence' AND ${t.residenceClass} IS NOT NULL AND ${t.tourismLicenseNumber} IS NULL AND NOT ${t.psfMember})`,
    ),
    // D24: TIN for businesses, UPI for residences. The identifier a registration
    // is checked against differs by domain, so requiring both would block half
    // the registrants and requiring neither would let an unidentifiable org in.
    check(
      'orgs_identifier_shape',
      sql`(${t.domain} = 'hospitality' AND ${t.tin} IS NOT NULL)
          OR (${t.domain} = 'residence' AND ${t.upi} IS NOT NULL)`,
    ),
    check(
      'orgs_accommodation_class_other_shape',
      sql`(${t.accommodationClass} = 'other' AND ${t.accommodationClassOther} IS NOT NULL)
          OR (${t.accommodationClass} IS DISTINCT FROM 'other' AND ${t.accommodationClassOther} IS NULL)`,
    ),
    check(
      'orgs_eac_star_grade_range',
      sql`${t.eacStarGrade} IS NULL OR (${t.eacStarGrade} BETWEEN 1 AND 5)`,
    ),
    // An acceptance is a version, a moment and a person, or it is nothing. Half
    // of one is a record nobody can stand behind.
    check(
      'orgs_contract_shape',
      sql`(${t.contractVersion} IS NULL AND ${t.contractAcceptedAt} IS NULL AND ${t.contractAcceptedByUserId} IS NULL)
          OR (${t.contractVersion} IS NOT NULL AND ${t.contractAcceptedAt} IS NOT NULL AND ${t.contractAcceptedByUserId} IS NOT NULL)`,
    ),
  ],
);


export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: workspaceKindEnum('kind').notNull(),
    orgId: uuid('org_id').references(() => orgs.id),
    userId: uuid('user_id').references(() => users.id),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('workspaces_business_org_uk')
      .on(t.orgId)
      .where(sql`${t.kind} = 'business'`),
    uniqueIndex('workspaces_broker_user_uk')
      .on(t.userId)
      .where(sql`${t.kind} = 'broker'`),
    uniqueIndex('workspaces_personal_user_uk')
      .on(t.userId)
      .where(sql`${t.kind} = 'personal'`),
    check(
      'workspaces_kind_shape',
      sql`(${t.kind} = 'business' AND ${t.orgId} IS NOT NULL AND ${t.userId} IS NULL)
          OR (${t.kind} IN ('broker', 'personal') AND ${t.userId} IS NOT NULL AND ${t.orgId} IS NULL)`,
    ),
  ],
);


export const userProfiles = pgTable(
  'user_profiles',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    displayName: text('display_name'),
    /** The language the person reads Injishi in (the guest account's choice). */
    locale: text('locale').notNull().default('en'),
    avatarObjectKey: text('avatar_object_key'),
    phoneE164: text('phone_e164'),
    // Demoted (Decision A): uniqueness now lives in `identity_documents`. Kept as
    // a denormalized, non-unique mirror of the primary document for cheap display;
    // NEVER the identity anchor. Populated from `identity_documents.is_primary`.
    nationalId: text('national_id'),
    dob: date('dob'),
    gender: genderEnum('gender'),
    // D24: THE ADDRESS DISCRIMINATOR. 'RW' means the Rwandan hierarchy below
    // applies and `address_text` carries only the street line. Anything else
    // means the hierarchy is null and `address_text` carries a full
    // international address — a non-Rwandan address must never hold a Rwandan
    // sector id, which is what the check below enforces.
    country: char('country', { length: 2 }).notNull().default('RW'),
    sectorId: integer('sector_id').references(() => sectors.id),
    villageId: integer('village_id').references(() => villages.id),
    districtId: integer('district_id').references(() => districts.id),
    addressText: text('address_text'),
    twoFactorEnrolled: boolean('two_factor_enrolled').notNull().default(false),
    ...timestamps,
  },
  (t) => [
    check('user_profiles_locale', sql`${t.locale} IN ('en', 'rw', 'fr')`),
    check(
      'user_profiles_address_country_shape',
      sql`${t.country} = 'RW'
          OR (${t.districtId} IS NULL AND ${t.sectorId} IS NULL AND ${t.villageId} IS NULL)`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// §4.2  IDENTITY LAYER  (Decision A — uniqueness anchor moves email -> gov ID)
//
// `users` (Better Auth) stays the LOGIN, still unique by lower(email) - but
// email is now a login key, not the identity anchor. `verified_identities` is
// the KYC'd human a privilege attaches to; `identity_documents` carries the
// uniqueness constraint that makes "one human = one account" true, promoting the
// pattern that already existed narrowly on `brokers.national_id`.
// ---------------------------------------------------------------------------


export const verifiedIdentities = pgTable('verified_identities', {
  // PK == FK: exactly one KYC record per login (1:1 with users).
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  kycStatus: kycStatusEnum('kyc_status').notNull().default('unverified'),
  legalFullName: text('legal_full_name'),
  dob: date('dob'),
  // nid_scan | manual | nida_api (future). Free text: the verification method
  // set is expected to grow (an adapter, not a branching enum).
  verifiedMethod: text('verified_method'),
  verifiedByUserId: uuid('verified_by_user_id').references(() => users.id),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  ...timestamps,
});


/**
 * A National ID lookup waiting for its code (ADR-060).
 *
 * The register answered with a person and a phone; the code went to that phone
 * and the person is revealed only to whoever types it back. `codeHash` is the
 * SHA-256 of the six digits, as `two_factor_challenges` does, so a read of this
 * table is not a working verification. The row is deleted when it is spent,
 * and dies at its expiry or its attempts cap. The document number is kept only
 * so the confirm can bind the SAME number the code was sent for.
 */
export const identityChallenges = pgTable(
  'identity_challenges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    documentNumber: text('document_number').notNull(),
    codeHash: text('code_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    ...timestamps,
  },
  (t) => [index('identity_challenges_user_id_idx').on(t.userId)],
);

/**
 * The registration wizard's answers between steps, one row per person
 * (ADR-060). `payload` is a `RegistrationDraft`, which by its contract never
 * holds an ID number. Deleted when the registration is created.
 */
export const registrationDrafts = pgTable('registration_drafts', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  payload: jsonb('payload').notNull(),
  ...timestamps,
});

export const identityDocuments = pgTable(
  'identity_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identityId: uuid('identity_id')
      .notNull()
      .references(() => verifiedIdentities.userId, { onDelete: 'cascade' }),
    documentType: documentTypeEnum('document_type').notNull(),
    // PII: every read writes a `record_access_logs` row (§10, data_class national_id).
    documentNumber: text('document_number').notNull(),
    // ISO-3166-1 alpha-2; in the unique key so two countries reusing a number
    // (dual citizen) never collide. Default 'RW'.
    issuingCountry: char('issuing_country', { length: 2 })
      .notNull()
      .default('RW'),
    status: identityDocumentStatusEnum('status').notNull().default('active'),
    isPrimary: boolean('is_primary').notNull().default(false),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    // THE new "one human, one account" enforcement point (Decision A). A second
    // signup presenting an already-registered document is blocked and routed to
    // account recovery, never a second identity.
    unique('identity_documents_type_number_country_uk').on(
      t.documentType,
      t.documentNumber,
      t.issuingCountry,
    ),
    index('identity_documents_identity_idx').on(t.identityId),
    // Account identity is a national_id or passport, never 'other' (the shared
    // document_type enum keeps 'other' for stay_identities walk-in capture).
    check(
      'identity_documents_account_type_shape',
      sql`${t.documentType} IN ('national_id', 'passport')`,
    ),
    // At most one primary document per identity.
    uniqueIndex('identity_documents_primary_uk')
      .on(t.identityId)
      .where(sql`${t.isPrimary}`),
  ],
);


export const userRoles = pgTable(
  'user_roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    globalRole: globalRoleEnum('global_role').notNull(),
    districtId: integer('district_id').references(() => districts.id),
    grantedByUserId: uuid('granted_by_user_id').references(() => users.id),
    grantedAt: timestamp('granted_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('user_roles_active_uk')
      .on(t.userId, t.globalRole)
      .where(sql`${t.revokedAt} IS NULL`),
    index('user_roles_user_idx').on(t.userId),
  ],
);


export const orgMemberships = pgTable(
  'org_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    orgRole: orgRoleEnum('org_role').notNull(),
    status: orgMembershipStatusEnum('status').notNull().default('active'),
    invitedByUserId: uuid('invited_by_user_id').references(() => users.id),
    removedAt: timestamp('removed_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique('org_memberships_org_user_uk').on(t.orgId, t.userId),
    index('org_memberships_user_idx').on(t.userId),
  ],
);

/**
 * What THIS business decided its staff roles mean (ADR-055).
 *
 * A DELTA table, not a permission list. One row says "this business moved this
 * permission on (or off) this role"; a permission no row names still resolves
 * from the platform's default set. Storing the whole set instead would freeze
 * each role at the day it was last edited, so a permission added to the platform
 * next quarter would reach every business that had never opened the screen and
 * none that had.
 *
 * Two CHECK constraints carry the security argument into the database, where it
 * survives a script nobody reviewed:
 *
 *  - `org_role` is never `owner`. The screen that writes here sits behind
 *    `team.manage`, which only an owner holds, so an owner able to edit `owner`
 *    could withdraw their own way back in. There is no second door.
 *  - `permission` is never `team.manage`. Granting it would hand the recipient
 *    this very screen, from which they could grant themselves the rest and
 *    re-role the owner out of their own business.
 *
 * `permission` is `text` rather than an enum on purpose. The permission
 * vocabulary lives in `@injishi/contracts` and changes with a release, not with
 * a migration; an enum here would mean a migration for every new permission and
 * a database that could refuse a value the code had already shipped. The CHECK
 * above pins the one value that is a boundary, the service validates the rest
 * against `Permission.options`, and `effectivePermissionsForRole` ignores any
 * row it does not recognise — so an unknown value is inert rather than
 * dangerous.
 */
export const orgRolePermissions = pgTable(
  'org_role_permissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    orgRole: orgRoleEnum('org_role').notNull(),
    permission: text('permission').notNull(),
    /** True grants what the default withholds; false withdraws what it gives. */
    granted: boolean('granted').notNull(),
    /** Who decided. Kept when that account is removed, so the record survives. */
    setByUserId: uuid('set_by_user_id').references(() => users.id),
    ...timestamps,
  },
  (t) => [
    unique('org_role_permissions_role_permission_uk').on(
      t.orgId,
      t.orgRole,
      t.permission,
    ),
    index('org_role_permissions_org_idx').on(t.orgId),
    check('org_role_permissions_not_owner', sql`${t.orgRole} <> 'owner'`),
    check(
      'org_role_permissions_not_locked',
      sql`${t.permission} <> 'team.manage'`,
    ),
  ],
);


export const orgInvitations = pgTable(
  'org_invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    orgRole: orgRoleEnum('org_role').notNull(),
    purpose: invitationPurposeEnum('purpose').notNull().default('staff'),
    token: text('token').notNull(),
    status: invitationStatusEnum('status').notNull().default('sent'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedByUserId: uuid('accepted_by_user_id').references(() => users.id),
    /**
     * ADR-054: the branches the invited member will be limited to. Null means
     * every branch. Copied into `org_membership_branches` on accept; an array
     * rather than rows because an invitation is a proposal, not a grant.
     */
    branchPropertyIds: uuid('branch_property_ids').array(),
    /**
     * The name the inviter typed for the person, so the Team screen can say
     * who is invited before they have an account to read a name from. Nullable:
     * invitations that predate it carry only the address.
     */
    inviteeName: text('invitee_name'),
    ...timestamps,
  },
  (t) => [
    unique('org_invitations_token_uk').on(t.token),
    index('org_invitations_org_idx').on(t.orgId),
  ],
);


export const oboRegistrations = pgTable('obo_registrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  registrantUserId: uuid('registrant_user_id')
    .notNull()
    .references(() => users.id),
  intendedOwnerName: text('intended_owner_name').notNull(),
  intendedOwnerNationalId: text('intended_owner_national_id'),
  intendedOwnerEmail: text('intended_owner_email'),
  claimStatus: oboClaimStatusEnum('claim_status')
    .notNull()
    .default('registrant_held'),
  payoutLocked: boolean('payout_locked').notNull().default(true),
  claimInvitationId: uuid('claim_invitation_id').references(
    () => orgInvitations.id,
  ),
  claimedAt: timestamp('claimed_at', { withTimezone: true }),
  ...timestamps,
});


/**
 * §4.3a  The documents a business attaches to its registration (D24).
 *
 * Rows, not columns. A hotel carries an RDB grade certificate and the form then
 * offers "add other certificates", so the tail is open — a column per type would
 * need a migration every time a body invents a form.
 *
 * The GRADE itself stays on `orgs.eac_star_grade`; this table carries the
 * EVIDENCE. A certificate can expire without the graded fact changing.
 */
export const orgCertificates = pgTable(
  'org_certificates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    kind: orgCertificateKindEnum('kind').notNull(),
    kindOther: text('kind_other'),
    objectKey: text('object_key').references(
      (): AnyPgColumn => storedObjects.objectKey,
    ),
    certificateNumber: text('certificate_number'),
    // Free text: not every issuer is a row in `government_bodies`, and forcing
    // one would either block an upload or pollute the oversight catalog.
    issuedBy: text('issued_by'),
    issuedOn: date('issued_on'),
    expiresOn: date('expires_on'),
    // Set when a field verifier confirms the document at the
    // tin_verified -> field_verified gate.
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    verifiedByUserId: uuid('verified_by_user_id').references(() => users.id),
    /**
     * The branch the document is about (a tourism licence, a fire certificate),
     * or null when it is about the business itself (incorporation, tax
     * clearance). Kept when the branch is archived, as the history it is.
     */
    propertyId: uuid('property_id').references((): AnyPgColumn => properties.id, {
      onDelete: 'set null',
    }),
    /**
     * `requested`: asked of the issuer and not yet granted, so there is no
     * number or expiry yet. `on_file`: the document exists. Expired and expiring
     * are read from `expires_on`, never stored, so they cannot go stale.
     */
    status: orgCertificateStatusEnum('status').notNull().default('on_file'),
    /** What is still open about this document ("renewal in draft", "inspection follow-up open"), or null. */
    followUp: text('follow_up'),
    ...timestamps,
  },
  (t) => [
    index('org_certificates_org_idx').on(t.orgId),
    index('org_certificates_property_idx').on(t.propertyId),
    // Only the expiring ones are swept for renewal reminders.
    index('org_certificates_expiry_idx')
      .on(t.expiresOn)
      .where(sql`${t.expiresOn} IS NOT NULL`),
    check(
      'org_certificates_kind_other_shape',
      sql`(${t.kind} = 'other' AND ${t.kindOther} IS NOT NULL)
          OR (${t.kind} <> 'other' AND ${t.kindOther} IS NULL)`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// §4.4  GOVERNMENT OVERSIGHT  (Decision B — configurable oversight layer)
//
// `government_bodies` is an admin-managed CATALOG (mirrors rdb_classifications):
// add a body without a migration. `oversight_assignments` is the configurable
// grant that binds a KYC'd government employee (a normal account) to an
// oversight function, a body, a free-text government title, and a region scope.
// These rows drive the SEPARATE government console (never the admin panel, never
// a shared session) - Injishi grants seats, it is not a .gov platform.
// ---------------------------------------------------------------------------


export const governmentBodies = pgTable('government_bodies', {
  code: text('code').primaryKey(), // RRA | PSF | MINALOC | ...
  nameEn: text('name_en').notNull(),
  nameRw: text('name_rw').notNull(),
  abbreviation: text('abbreviation'),
  active: boolean('active').notNull().default(true),
  ...timestamps,
});


export const oversightAssignments = pgTable(
  'oversight_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // A KYC'd government employee's normal account (paired with global_role
    // `gov_oversight` for the console seat; this row carries the specifics).
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    oversightRole: oversightRoleEnum('oversight_role').notNull(),
    governmentBodyCode: text('government_body_code')
      .notNull()
      .references(() => governmentBodies.code),
    // The government's own title today (e.g. "BDO", "Business Registration
    // Officer"). Three coexisting layers: enum = DB name, admin panel = label,
    // this = the government's title.
    governmentTitle: text('government_title'),
    scopeLevel: oversightScopeLevelEnum('scope_level').notNull(),
    provinceId: integer('province_id').references(() => provinces.id),
    districtId: integer('district_id').references(() => districts.id),
    // P5: a local leader's sector, cell and village. Every level above the one
    // the post covers is filled in too (a village leader's row names the cell,
    // sector and district), so "who covers this district" is one column.
    sectorId: integer('sector_id').references(() => sectors.id),
    cellId: integer('cell_id').references(() => cells.id),
    villageId: integer('village_id').references(() => villages.id),
    assignedByUserId: uuid('assigned_by_user_id').references(() => users.id),
    grantedAt: timestamp('granted_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [
    index('oversight_assignments_user_idx').on(t.userId),
    index('oversight_assignments_body_idx').on(t.governmentBodyCode),
    // One active grant per (user, role, exact scope). Scope is the
    // (province, district, sector, cell, village) path - all NULL == country.
    uniqueIndex('oversight_assignments_active_uk')
      .on(t.userId, t.oversightRole, t.scopeLevel, t.provinceId, t.districtId, t.sectorId, t.cellId, t.villageId)
      .where(sql`${t.revokedAt} IS NULL`),
    // Who holds a post in an area: guest routing reads this on every filing.
    index('oversight_assignments_area_idx')
      .on(t.oversightRole, t.districtId, t.sectorId, t.cellId, t.villageId)
      .where(sql`${t.revokedAt} IS NULL`),
    // Scope shape: country -> no ids; province -> province only; district ->
    // district (province optional as a denormalized parent) and nothing below;
    // sector, cell and village -> their own id and every level above it down
    // to the district. Compared as text: the three new levels are added in the
    // same migration run that writes this check (blueprint 1.1).
    check(
      'oversight_assignments_scope_shape',
      sql`(${t.scopeLevel}::text = 'country' AND ${t.provinceId} IS NULL AND ${t.districtId} IS NULL AND ${t.sectorId} IS NULL AND ${t.cellId} IS NULL AND ${t.villageId} IS NULL)
          OR (${t.scopeLevel}::text = 'province' AND ${t.provinceId} IS NOT NULL AND ${t.districtId} IS NULL AND ${t.sectorId} IS NULL AND ${t.cellId} IS NULL AND ${t.villageId} IS NULL)
          OR (${t.scopeLevel}::text = 'district' AND ${t.districtId} IS NOT NULL AND ${t.sectorId} IS NULL AND ${t.cellId} IS NULL AND ${t.villageId} IS NULL)
          OR (${t.scopeLevel}::text = 'sector' AND ${t.districtId} IS NOT NULL AND ${t.sectorId} IS NOT NULL AND ${t.cellId} IS NULL AND ${t.villageId} IS NULL)
          OR (${t.scopeLevel}::text = 'cell' AND ${t.districtId} IS NOT NULL AND ${t.sectorId} IS NOT NULL AND ${t.cellId} IS NOT NULL AND ${t.villageId} IS NULL)
          OR (${t.scopeLevel}::text = 'village' AND ${t.districtId} IS NOT NULL AND ${t.sectorId} IS NOT NULL AND ${t.cellId} IS NOT NULL AND ${t.villageId} IS NOT NULL)`,
    ),
    // Which level each role is appointed at (P5): a local leader covers exactly
    // one level, a business reviewer or tax officer the country, a province or
    // a district. The same pairs as `OVERSIGHT_ROLE_SCOPES` in contracts.
    check(
      'oversight_assignments_role_scope',
      sql`(${t.oversightRole}::text IN ('village_leader', 'dgie_village') AND ${t.scopeLevel}::text = 'village')
          OR (${t.oversightRole}::text = 'dasso' AND ${t.scopeLevel}::text = 'sector')
          OR (${t.oversightRole}::text IN ('cell_executive', 'dgie_cell') AND ${t.scopeLevel}::text = 'cell')
          OR (${t.oversightRole}::text = 'sector_executive' AND ${t.scopeLevel}::text = 'sector')
          OR (${t.oversightRole}::text IN ('district_officer', 'district_immigration') AND ${t.scopeLevel}::text = 'district')
          OR (${t.oversightRole}::text = 'dgie_province' AND ${t.scopeLevel}::text = 'province')
          OR (${t.oversightRole}::text = 'dgie_national' AND ${t.scopeLevel}::text = 'country')
          OR (${t.oversightRole}::text IN ('business_field_verifier', 'business_approver', 'tax_compliance_officer', 'psf_membership_officer')
              AND ${t.scopeLevel}::text IN ('country', 'province', 'district'))`,
    ),
    // NOTE: Separation of duties (same user must not be both
    // `business_field_verifier` and `business_approver` in one scope) is a
    // cross-row rule Postgres CHECK cannot express (no subquery) - enforced in
    // the application layer (oversight application service), consistent with the
    // schema's stated posture on cross-table domain checks.
  ],
);


/**
 * §4.4a  D25 — the human gate decisions, one row per decision.
 *
 * The deliberate twin of `tin_verifications`: that table records every AUTOMATIC
 * check, this one records every HUMAN one. Both are append only, both keep the
 * outcome of a check that has since been superseded, and `orgs.registration_status`
 * remains the current state that the two of them explain.
 *
 * `stage` is the status the org was IN when the decision was taken, not the one
 * it moved to. A review at `tin_verified` is therefore the field verification
 * gate, and one at `field_verified` is the approval gate. Reusing
 * `org_registration_status` rather than minting a parallel gate enum keeps the
 * pipeline with one vocabulary: the same value names the state, the guard on
 * `advance()`, and the review that caused the move.
 *
 * The body and the title are COPIED here rather than joined from
 * `oversight_assignments`. An assignment can be revoked, and F-S03 §9 requires
 * that a decision already taken keeps the officer, body and title as they stood
 * at the time. A join would rewrite history every time a posting changed.
 */
export const orgRegistrationReviews = pgTable(
  'org_registration_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    stage: orgRegistrationStatusEnum('stage').notNull(),
    decision: registrationReviewDecisionEnum('decision').notNull(),
    decidedByUserId: uuid('decided_by_user_id')
      .notNull()
      .references(() => users.id),
    oversightRole: oversightRoleEnum('oversight_role').notNull(),
    // As of the decision. Never re-read from the assignment (see above).
    governmentBodyCode: text('government_body_code')
      .notNull()
      .references(() => governmentBodies.code),
    governmentTitle: text('government_title'),
    reasonCode: registrationRejectionReasonEnum('reason_code'),
    notes: text('notes'),
    decidedAt: timestamp('decided_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('org_registration_reviews_org_idx').on(t.orgId, t.decidedAt),
    // Separation of duties reads the LATEST passed field verification for an
    // org, so that lookup gets its own covering index.
    index('org_registration_reviews_stage_idx').on(
      t.orgId,
      t.stage,
      t.decision,
    ),
    // Only the two HUMAN gates. An RRA outcome belongs in `tin_verifications`,
    // and letting one land here would make "who decided this" ambiguous.
    check(
      'org_registration_reviews_stage_shape',
      sql`${t.stage} IN ('tin_verified', 'field_verified')`,
    ),
    // The gate and the function that owns it must agree. Without this a
    // verifier could write an approval row and the pipeline would believe it.
    check(
      'org_registration_reviews_role_shape',
      sql`(${t.stage} = 'tin_verified' AND ${t.oversightRole} = 'business_field_verifier')
          OR (${t.stage} = 'field_verified' AND ${t.oversightRole} = 'business_approver')`,
    ),
    // A rejection owes a reason; a pass must not carry one.
    check(
      'org_registration_reviews_reason_shape',
      sql`(${t.decision} = 'rejected' AND ${t.reasonCode} IS NOT NULL)
          OR (${t.decision} = 'passed' AND ${t.reasonCode} IS NULL)`,
    ),
  ],
);


/**
 * Every move a registration makes (ADR-053, AC-R6, AC-R7).
 *
 * Append only, one row per status change, written in the SAME transaction as
 * the change. The same shape as `tin_verifications` and
 * `org_registration_reviews`: `orgs.registration_status` is the current state
 * and these three tables explain how it got there.
 *
 * Preferred over timestamp columns on `orgs` because a rejected registration
 * resubmits, and columns would overwrite the record of the first wait — and the
 * slowest cases, the ones worth measuring, are exactly the resubmitted ones.
 *
 * `from_status` is null on the creation row and no other, which is what makes a
 * business's first event findable and bounds the `pending_payment` wait nothing
 * could measure before.
 */
export const orgRegistrationEvents = pgTable(
  'org_registration_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    fromStatus: orgRegistrationStatusEnum('from_status'),
    toStatus: orgRegistrationStatusEnum('to_status').notNull(),
    trigger: registrationTransitionTriggerEnum('trigger').notNull(),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('org_registration_events_org_idx').on(t.orgId, t.occurredAt),
    // A person moved it, or the system did. Never a person-shaped trigger with
    // nobody behind it, and never a system move that claims an actor.
    check(
      'org_registration_events_actor_shape',
      sql`(${t.trigger} = 'system' AND ${t.actorUserId} IS NULL)
          OR (${t.trigger} <> 'system' AND ${t.actorUserId} IS NOT NULL)`,
    ),
  ],
);

export const tinVerifications = pgTable('tin_verifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  tin: text('tin').notNull(),
  result: tinVerificationResultEnum('result').notNull().default('pending'),
  latencyMs: integer('latency_ms'),
  adapterMode: adapterModeEnum('adapter_mode').notNull().default('mock'),
  rawResponse: jsonb('raw_response'),
  checkedAt: timestamp('checked_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ===========================================================================
// §5.2-5.7  INVENTORY
// ===========================================================================
