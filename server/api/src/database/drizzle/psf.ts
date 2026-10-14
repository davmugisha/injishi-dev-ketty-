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
  documentTypeEnum,
  genderEnum,
  psfApplicationStatusEnum,
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
          OR (${t.priceKind} = 'set_by_psf' AND ${t.annualFeeRwf} IS NULL
            AND ${t.annualFeeMinRwf} IS NULL AND ${t.annualFeeMaxRwf} IS NULL)`,
    ),
  ],
);

export const psfMembershipApplications = pgTable(
  'psf_membership_applications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    submittedByUserId: uuid('submitted_by_user_id')
      .notNull()
      .references(() => users.id),
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

    // Member profile, as filed.
    companyName: text('company_name').notNull(),
    // `tin` in v1: a hospitality business always carries one (D24).
    registrationType: text('registration_type').notNull(),
    registrationNumber: text('registration_number').notNull(),
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

    withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
    withdrawnByUserId: uuid('withdrawn_by_user_id').references(
      () => users.id,
    ),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('psf_membership_applications_one_open_uk')
      .on(t.orgId)
      .where(sql`${t.status} = 'submitted'`),
    index('psf_membership_applications_org_idx').on(t.orgId),
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
      sql`(${t.status} IN ('member', 'declined')) = (${t.decidedAt} IS NOT NULL AND ${t.decidedByUserId} IS NOT NULL AND ${t.decisionBodyCode} IS NOT NULL)
          AND (${t.status} = 'declined') = (${t.declineReason} IS NOT NULL)
          AND (${t.declineReason} IS DISTINCT FROM 'other' OR ${t.decisionNote} IS NOT NULL)
          AND (${t.status} = 'withdrawn') = (${t.withdrawnAt} IS NOT NULL AND ${t.withdrawnByUserId} IS NOT NULL)`,
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
          OR (${t.source} = 'self_declared' AND ${t.applicationId} IS NULL)`,
    ),
  ],
);
