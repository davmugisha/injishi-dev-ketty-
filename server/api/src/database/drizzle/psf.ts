/**
 * ADR-056  PSF MEMBERSHIP APPLICATION.
 *
 * Three tables behind one path: a hospitality business that is not a Private
 * Sector Federation member applies, a PSF membership officer decides, and a Yes
 * becomes a membership with a number and an expiry.
 *
 * - `psf_membership_tiers` is the catalogue admin edits. Prices are data, so a
 *   new PSF price list is an edit, never a migration.
 * - `psf_membership_applications` is the form as filed, one row per attempt.
 *   Its filed fields never change after submit; only status and decision do.
 * - `psf_memberships` is the live record. At most one current row per business.
 *
 * This is NOT the `PSF` row in `government_bodies` (D24 as amended by
 * ADR-056): officers of that body decide these applications, but nothing here
 * is read through `oversight_assignments`.
 *
 * THE RULES THE DATABASE HOLDS:
 * 1. One open application per business (partial unique index).
 * 2. One current membership per business (partial unique index).
 * 3. Every conditional field agrees with the value it depends on (checks):
 *    price columns with `price_kind`, `ownership_other` with `ownership`, the
 *    trade details with `trade_direction`, the decision fields with `status`.
 * 4. PSF's form knows two genders and two document types; so does the row.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { amount, timestamps } from './columns';
import {
  adapterModeEnum,
  documentTypeEnum,
  genderEnum,
  psfApplicationStatusEnum,
  psfBranchStatusEnum,
  psfCompanyTypeEnum,
  psfContactRoleEnum,
  psfDeclineReasonEnum,
  psfMembershipFamilyEnum,
  psfMembershipSourceEnum,
  psfOwnershipEnum,
  psfPriceKindEnum,
  psfSubmittedCapacityEnum,
  psfTradeDirectionEnum,
} from './enums';
import { districts, sectors } from './geography';
import { orgs } from './org';

export const psfMembershipTiers = pgTable(
  'psf_membership_tiers',
  {
    code: text('code').primaryKey(),
    family: psfMembershipFamilyEnum('family').notNull(),
    nameEn: text('name_en').notNull(),
    // Null until PSF supplies it; the screens show English instead.
    nameRw: text('name_rw'),
    priceKind: psfPriceKindEnum('price_kind').notNull(),
    annualFeeRwf: amount('annual_fee_rwf'),
    annualFeeMinRwf: amount('annual_fee_min_rwf'),
    annualFeeMaxRwf: amount('annual_fee_max_rwf'),
    benefitsEn: text('benefits_en')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    benefitsRw: text('benefits_rw').array(),
    sortOrder: smallint('sort_order').notNull(),
    active: boolean('active').notNull().default(true),
    updatedByUserId: uuid('updated_by_user_id').references(() => users.id),
    ...timestamps,
  },
  (t) => [
    check(
      'psf_membership_tiers_price_shape',
      sql`(${t.priceKind} = 'fixed' AND ${t.annualFeeRwf} IS NOT NULL AND ${t.annualFeeRwf} > 0
            AND ${t.annualFeeMinRwf} IS NULL AND ${t.annualFeeMaxRwf} IS NULL)
          OR (${t.priceKind} = 'range' AND ${t.annualFeeRwf} IS NULL
            AND ${t.annualFeeMinRwf} IS NOT NULL AND ${t.annualFeeMaxRwf} IS NOT NULL
            AND ${t.annualFeeMinRwf} > 0 AND ${t.annualFeeMinRwf} < ${t.annualFeeMaxRwf})
          OR (${t.priceKind} NOT IN ('fixed', 'range', 'set_by_psf') AND ${t.annualFeeRwf} IS NULL
            AND ${t.annualFeeMinRwf} IS NOT NULL AND ${t.annualFeeMinRwf} > 0 AND ${t.annualFeeMaxRwf} IS NULL)
          OR (${t.priceKind} = 'set_by_psf' AND ${t.annualFeeRwf} IS NULL
            AND ${t.annualFeeMinRwf} IS NULL AND ${t.annualFeeMaxRwf} IS NULL)`,
    ),
  ],
);

/**
 * What a membership band costs in a place (2026-10-20). A business no longer
 * types its own amount: PSF's officers set it. `district_id` null is the
 * national price, which a national officer sets; a district's own row (its
 * district or province officer sets it) wins inside that district. With no
 * row at all, the band's own starting price applies (`psfStartingFee`).
 *
 * The public form shows the price for the business's district and sends it
 * back; the API refuses a form whose price no longer matches, so nobody is
 * charged an amount they were not shown.
 */
export const psfTierFees = pgTable(
  'psf_tier_fees',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tierCode: text('tier_code')
      .notNull()
      .references(() => psfMembershipTiers.code),
    districtId: integer('district_id').references(() => districts.id),
    annualFeeRwf: amount('annual_fee_rwf').notNull(),
    setByUserId: uuid('set_by_user_id').references(() => users.id),
    ...timestamps,
  },
  (t) => [
    // One price per band per place; null (national) counts as a place.
    uniqueIndex('psf_tier_fees_place_uk').on(t.tierCode, sql`coalesce(${t.districtId}, 0)`),
    check('psf_tier_fees_positive', sql`${t.annualFeeRwf} > 0`),
  ],
);

export const psfMembershipApplications = pgTable(
  'psf_membership_applications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    // Null when the application came through the public PSF form
    // (`/psf/register`, 2026-10-19): nobody signed in, and the docID stands in.
    submittedByUserId: uuid('submitted_by_user_id').references(() => users.id),
    // The bearer key the public applicant tracks the application by
    // (`PSF-7K3M-Q9XD`, `newPsfDocId`). Random, never a counter. Every
    // application has one, a hotel's included.
    docId: text('doc_id').notNull(),
    // Where status news goes when there is no account: SMS always, mail when given.
    applicantPhoneE164: text('applicant_phone_e164'),
    applicantEmail: text('applicant_email'),
    submittedCapacity: psfSubmittedCapacityEnum('submitted_capacity').notNull(),
    status: psfApplicationStatusEnum('status').notNull().default('submitted'),
    // The first time it entered PSF's queue. Orders the queue and makes the
    // officer email go once. Whether it is IN the queue is derived from the
    // business's registration status, never read from this (ADR-056 AC-8).
    queuedAt: timestamp('queued_at', { withTimezone: true }),

    // The tier asked for, and the price as it was shown when it was sent.
    requestedTierCode: text('requested_tier_code')
      .notNull()
      .references(() => psfMembershipTiers.code),
    quotedPriceKind: psfPriceKindEnum('quoted_price_kind').notNull(),
    quotedFeeRwf: amount('quoted_fee_rwf'),
    quotedFeeMinRwf: amount('quoted_fee_min_rwf'),
    quotedFeeMaxRwf: amount('quoted_fee_max_rwf'),
    // What the business said it would pay a year, inside its band. Null only
    // for a tier PSF prices itself, whose amount the officer names.
    declaredFeeRwf: amount('declared_fee_rwf'),
    // How the business came in (0132): a new application, or a holder of an old PSF card joining the
    // new module (no fee now, a new number, the year on its card).
    intake: text('intake').$type<'new' | 'card_holder'>().notNull().default('new'),

    // Member profile, as filed.
    companyName: text('company_name').notNull(),
    // `tin` for a hotel (D24 makes it carry one). On the PSF path, whatever the
    // business registered with: `tin`, `rca`, `rgb`, `other` or `none`.
    registrationType: text('registration_type').notNull(),
    // Null only for a business registered nowhere yet (`none`).
    registrationNumber: text('registration_number'),
    website: text('website'),
    streetAddress: text('street_address').notNull(),
    companyType: psfCompanyTypeEnum('company_type').notNull(),
    ownership: psfOwnershipEnum('ownership').notNull(),
    ownershipOther: text('ownership_other'),
    businessActivity: text('business_activity').notNull(),
    tradeDirection: psfTradeDirectionEnum('trade_direction').notNull(),
    tradeGoods: text('trade_goods'),
    tradeCountries: text('trade_countries')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),

    // Personnel details, as filed.
    contactRole: psfContactRoleEnum('contact_role').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    gender: genderEnum('gender').notNull(),
    phoneE164: text('phone_e164').notNull(),
    email: text('email').notNull(),
    idDocumentType: documentTypeEnum('id_document_type').notNull(),
    idDocumentNumber: text('id_document_number').notNull(),
    dateOfBirth: date('date_of_birth').notNull(),

    // Consent to share the above with PSF (Law 058/2021).
    consentGivenAt: timestamp('consent_given_at', {
      withTimezone: true,
    }).notNull(),
    consentVersion: text('consent_version').notNull(),

    // The decision, set together on `member` or `declined`.
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decidedByUserId: uuid('decided_by_user_id').references(() => users.id),
    // A copy of the deciding officer's body code, as D25 keeps it.
    decisionBodyCode: text('decision_body_code'),
    declineReason: psfDeclineReasonEnum('decline_reason'),
    decisionNote: text('decision_note'),
    // Set on approval (the PSF path): the number PSF gave, and what the
    // business now owes, which is its declared amount unless PSF prices the tier.
    approvedMembershipNumber: text('approved_membership_number'),
    approvedFeeRwf: amount('approved_fee_rwf'),

    // The payment that makes an approved application a membership. Captured
    // through the payment seam into Injishi's account and passed on to PSF;
    // `remitted_at` is when it was, so finance can see what is still owed.
    paidAt: timestamp('paid_at', { withTimezone: true }),
    paidAmountRwf: amount('paid_amount_rwf'),
    paymentRef: text('payment_ref'),
    paymentMode: adapterModeEnum('payment_mode'),
    remittedAt: timestamp('remitted_at', { withTimezone: true }),
    remittanceRef: text('remittance_ref'),

    // THE PUBLIC PATH PAYS BEFORE REVIEW (2026-10-20): PSF approves only a
    // business that has paid. Nothing is refunded (2026-10-23): a decline
    // keeps the fee, and it goes on to PSF like an approval's.

    withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
    withdrawnByUserId: uuid('withdrawn_by_user_id').references(
      () => users.id,
    ),
    /**
     * Answers to the officer-configured dynamic fields on the membership form
     * (`psf_membership_form_fields`). Keys are field `key`s; values are string,
     * number, boolean or null. Fixed columns above stay the source of truth for
     * the core form; this bag only holds the extras.
     */
    extraAnswers: jsonb('extra_answers')
      .$type<Record<string, string | number | boolean | null>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    ...timestamps,
  },
  (t) => [
    // Open is `submitted` or `approved`, named by the three values it is NOT:
    // `approved` joined the enum in the same migration batch (see 0065), and an
    // index predicate may not cast an enum to text, which is not immutable.
    uniqueIndex('psf_membership_applications_one_open_uk')
      .on(t.orgId)
      .where(sql`${t.status} NOT IN ('member', 'declined', 'withdrawn')`),
    index('psf_membership_applications_org_idx').on(t.orgId),
    uniqueIndex('psf_membership_applications_doc_id_uk').on(t.docId),
    // Nobody signed in means somebody to tell: the public form always gives a phone.
    check(
      'psf_membership_applications_public_shape',
      sql`${t.submittedByUserId} IS NOT NULL OR ${t.applicantPhoneE164} IS NOT NULL`,
    ),
    index('psf_membership_applications_queue_idx').on(t.status, t.queuedAt),
    check(
      'psf_membership_applications_ownership_shape',
      sql`(${t.ownership} = 'other') = (${t.ownershipOther} IS NOT NULL)`,
    ),
    check(
      'psf_membership_applications_trade_shape',
      sql`(${t.tradeDirection} = 'none' AND ${t.tradeGoods} IS NULL AND cardinality(${t.tradeCountries}) = 0)
          OR (${t.tradeDirection} <> 'none' AND ${t.tradeGoods} IS NOT NULL AND cardinality(${t.tradeCountries}) > 0)`,
    ),
    check(
      'psf_membership_applications_person_shape',
      sql`${t.gender} IN ('male', 'female') AND ${t.idDocumentType} IN ('national_id', 'passport')`,
    ),
    check(
      'psf_membership_applications_decision_shape',
      sql`(${t.status} NOT IN ('submitted', 'withdrawn')) = (${t.decidedAt} IS NOT NULL AND ${t.decidedByUserId} IS NOT NULL AND ${t.decisionBodyCode} IS NOT NULL)
          AND (${t.status} = 'declined') = (${t.declineReason} IS NOT NULL)
          AND (${t.declineReason} IS DISTINCT FROM 'other' OR ${t.decisionNote} IS NOT NULL)
          AND (${t.status} = 'withdrawn') = (${t.withdrawnAt} IS NOT NULL AND ${t.withdrawnByUserId} IS NOT NULL)`,
    ),
    // An approval names a number and an amount; a payment is all of its parts
    // or none, lands only on a member, and a remittance only on a payment.
    check(
      'psf_membership_applications_payment_shape',
      sql`(${t.status} IN ('submitted', 'member', 'declined', 'withdrawn') OR (${t.approvedMembershipNumber} IS NOT NULL AND ${t.approvedFeeRwf} IS NOT NULL))
          AND ((${t.paidAt} IS NULL) = (${t.paidAmountRwf} IS NULL)
               AND (${t.paidAt} IS NULL) = (${t.paymentRef} IS NULL)
               AND (${t.paidAt} IS NULL) = (${t.paymentMode} IS NULL))
          AND (${t.paidAt} IS NULL OR ${t.status} IN ('submitted', 'member', 'declined'))
          AND (${t.remittedAt} IS NULL OR ${t.paidAt} IS NOT NULL)
          AND ((${t.remittedAt} IS NULL) = (${t.remittanceRef} IS NULL))`,
    ),
    // A business registered nowhere files no number, and every other one does.
    check(
      'psf_membership_applications_registration_shape',
      sql`(${t.registrationType} = 'none') = (${t.registrationNumber} IS NULL)`,
    ),
  ],
);

export const psfMemberships = pgTable(
  'psf_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    source: psfMembershipSourceEnum('source').notNull(),
    applicationId: uuid('application_id').references(
      () => psfMembershipApplications.id,
    ),
    tierCode: text('tier_code').references(() => psfMembershipTiers.code),
    membershipNumber: text('membership_number').notNull(),
    annualFeeRwf: amount('annual_fee_rwf'),
    startsOn: date('starts_on'),
    expiresOn: date('expires_on'),
    // The officer who confirmed it, or the registrant who declared it.
    recordedByUserId: uuid('recorded_by_user_id')
      .notNull()
      .references(() => users.id),
    // Set when the 30 day email goes, so it goes once (ADR-056 AC-18).
    expiryRemindedAt: timestamp('expiry_reminded_at', { withTimezone: true }),
    // Set on expiry or when a later membership replaces this one.
    endedAt: timestamp('ended_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('psf_memberships_one_current_uk')
      .on(t.orgId)
      .where(sql`${t.endedAt} IS NULL`),
    index('psf_memberships_expiry_idx').on(t.expiresOn),
    check(
      'psf_memberships_source_shape',
      sql`(${t.source} = 'psf_confirmed' AND ${t.applicationId} IS NOT NULL AND ${t.tierCode} IS NOT NULL
            AND ${t.annualFeeRwf} IS NOT NULL AND ${t.startsOn} IS NOT NULL AND ${t.expiresOn} IS NOT NULL
            AND ${t.expiresOn} > ${t.startsOn})
          OR (${t.source} = 'self_declared' AND ${t.applicationId} IS NULL)
          OR (${t.source} = 'psf_record' AND ${t.applicationId} IS NULL AND ${t.tierCode} IS NOT NULL
            AND ${t.startsOn} IS NOT NULL AND ${t.expiresOn} IS NOT NULL AND ${t.expiresOn} > ${t.startsOn})`,
    ),
  ],
);

/**
 * PSF's own list of its members (0121), uploaded by an officer: a claimed number whose number and TIN
 * match a row here is confirmed on the spot, with the row's tier and dates.
 */
export const psfMemberList = pgTable('psf_member_list', {
  id: uuid('id').primaryKey().defaultRandom(),
  membershipNumber: text('membership_number').notNull().unique('psf_member_list_number_uk'),
  legalName: text('legal_name'),
  tin: text('tin'),
  tierCode: text('tier_code').references(() => psfMembershipTiers.code),
  startsOn: date('starts_on'),
  expiresOn: date('expires_on'),
  uploadedByUserId: uuid('uploaded_by_user_id')
    .notNull()
    .references(() => users.id),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A PSF membership number a business typed (0121, 2026-10-30): a claim, not a membership, until PSF
 * confirms it, by its own list or by a District Manager. One open claim per business.
 */
export const psfMembershipClaims = pgTable(
  'psf_membership_claims',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    // Null when the member sent its card without the number (0131); the confirming officer types it.
    membershipNumber: text('membership_number'),
    status: text('status').$type<'claimed' | 'confirmed' | 'rejected'>().notNull().default('claimed'),
    claimedByUserId: uuid('claimed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    claimedAt: timestamp('claimed_at', { withTimezone: true }).notNull().defaultNow(),
    decidedByUserId: uuid('decided_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decisionNote: text('decision_note'),
    matchedBy: text('matched_by').$type<'member_list' | 'officer'>(),
    membershipId: uuid('membership_id').references(() => psfMemberships.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('psf_membership_claims_open_uk').on(t.orgId).where(sql`${t.status} = 'claimed'`),
    index('psf_membership_claims_status_idx').on(t.status, t.claimedAt),
    check('psf_membership_claims_status_ck', sql`${t.status} IN ('claimed', 'confirmed', 'rejected')`),
    check(
      'psf_membership_claims_matched_ck',
      sql`${t.matchedBy} IS NULL OR ${t.matchedBy} IN ('member_list', 'officer')`,
    ),
    check('psf_membership_claims_decided_ck', sql`(${t.status} = 'claimed') = (${t.decidedAt} IS NULL)`),
    check('psf_membership_claims_rejected_ck', sql`${t.status} <> 'rejected' OR ${t.decisionNote} IS NOT NULL`),
  ],
);

/**
 * One National ID check on the public PSF form (2026-10-19): the register was
 * asked, a code went to the phone it holds, and, once the code is read back,
 * a token that the submit spends. The same rules as `identity_challenges`
 * (a code lives ten minutes, five wrong guesses end it), with no user, because
 * nobody signs in. Nothing about the person is kept here past the token's
 * thirty minutes except on the application the submit files.
 */
export const psfIdentityChecks = pgTable(
  'psf_identity_checks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentNumber: text('document_number').notNull(),
    codeHash: text('code_hash').notNull(),
    codeExpiresAt: timestamp('code_expires_at', { withTimezone: true }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    /** The register's answer, written when the code is read back. */
    person: jsonb('person').$type<{
      fullName: string;
      dateOfBirth: string;
      gender: 'male' | 'female' | null;
      phoneE164: string | null;
      generated: boolean;
    }>(),
    tokenHash: text('token_hash'),
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    spentAt: timestamp('spent_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('psf_identity_checks_token_uk').on(t.tokenHash),
    index('psf_identity_checks_created_idx').on(t.createdAt),
  ],
);

/**
 * The other places a business trades from, as its public application listed
 * them (2026-10-23). Not `properties`: a PSF business has no workspace, and a
 * branch here is something PSF admits, not something listed.
 *
 * Each branch is decided by the PSF officer of ITS district, not the head
 * office's, so an officer's region reaches an application through a branch as
 * well as through the business. A branch has no name of its own: it trades
 * under the business's. Its place and street never change after submit; only
 * the decision does.
 */
export const psfApplicationBranches = pgTable(
  'psf_application_branches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => psfMembershipApplications.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    // No name: a branch trades under the business's own (2026-10-23).
    districtId: integer('district_id')
      .notNull()
      .references(() => districts.id),
    sectorId: integer('sector_id')
      .notNull()
      .references(() => sectors.id),
    street: text('street').notNull(),
    status: psfBranchStatusEnum('status').notNull().default('pending'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decidedByUserId: uuid('decided_by_user_id').references(() => users.id),
    decisionNote: text('decision_note'),
    ...timestamps,
  },
  (t) => [
    index('psf_application_branches_application_idx').on(t.applicationId),
    index('psf_application_branches_district_idx').on(t.districtId, t.status),
    // Decided is all of its parts, and a decline always says why.
    check(
      'psf_application_branches_decision_shape',
      sql`(${t.status} = 'pending') = (${t.decidedAt} IS NULL AND ${t.decidedByUserId} IS NULL)
          AND (${t.status} <> 'declined' OR ${t.decisionNote} IS NOT NULL)`,
    ),
  ],
);

export type PsfApplicationBranchRow = typeof psfApplicationBranches.$inferSelect;

/**
 * Officer-configured extras on the PSF membership form (registration + public).
 * National managers maintain the catalogue; applicants answer into
 * `psf_membership_applications.extra_answers`.
 */
export const psfMembershipFormFields = pgTable(
  'psf_membership_form_fields',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: text('key').notNull(),
    label: text('label').notNull(),
    helpText: text('help_text'),
    fieldType: text('field_type').notNull(),
    required: boolean('required').notNull().default(false),
    options: jsonb('options').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    sortOrder: smallint('sort_order').notNull().default(0),
    active: boolean('active').notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('psf_membership_form_fields_key_uk').on(t.key),
    index('psf_membership_form_fields_active_idx').on(t.active, t.sortOrder),
    check(
      'psf_membership_form_fields_type_ck',
      sql`${t.fieldType} IN ('text', 'textarea', 'number', 'boolean', 'select')`,
    ),
    check('psf_membership_form_fields_key_ck', sql`${t.key} ~ '^[a-z][a-z0-9_]{1,39}$'`),
  ],
);

export type PsfMembershipFormFieldRow = typeof psfMembershipFormFields.$inferSelect;

/**
 * PSF membership renewals (2026-11-02, migration 0127): the next year paid on
 * the tracking page. A paid renewal renews at once, with no officer; the year
 * runs on from the old end date, or from the payment for a lapsed membership,
 * and the band may change. Early renewal extends the current membership row; a
 * lapsed one gets a new row under the same number. One row per attempt.
 */
export const psfMembershipRenewals = pgTable(
  'psf_membership_renewals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    membershipId: uuid('membership_id')
      .notNull()
      .references(() => psfMemberships.id),
    applicationId: uuid('application_id').references(() => psfMembershipApplications.id),
    membershipNumber: text('membership_number').notNull(),
    tierCode: text('tier_code')
      .notNull()
      .references(() => psfMembershipTiers.code),
    amountRwf: amount('amount_rwf').notNull(),
    payerPhoneE164: text('payer_phone_e164').notNull(),
    status: text('status').$type<'pending' | 'paid' | 'failed'>().notNull().default('pending'),
    startsOn: date('starts_on').notNull(),
    expiresOn: date('expires_on').notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    paymentRef: text('payment_ref'),
    paymentMode: adapterModeEnum('payment_mode'),
    failure: text('failure'),
    resultMembershipId: uuid('result_membership_id').references(() => psfMemberships.id),
    remittedAt: timestamp('remitted_at', { withTimezone: true }),
    remittanceRef: text('remittance_ref'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('psf_membership_renewals_one_pending_uk')
      .on(t.orgId)
      .where(sql`${t.status} = 'pending'`),
    index('psf_membership_renewals_org_idx').on(t.orgId, t.createdAt),
    index('psf_membership_renewals_paid_idx')
      .on(t.paidAt)
      .where(sql`${t.status} = 'paid'`),
    check('psf_membership_renewals_status_ck', sql`${t.status} IN ('pending', 'paid', 'failed')`),
    check('psf_membership_renewals_amount_ck', sql`${t.amountRwf} > 0`),
    check('psf_membership_renewals_period_ck', sql`${t.expiresOn} > ${t.startsOn}`),
  ],
);
