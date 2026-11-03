/**
 * §7 RESIDENCE.
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
  check,
  date,
  foreignKey,
  index,
  inet,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { districts } from './geography';
import { amount, currency, timestamps } from './columns';
// Lazy only (inside `references`): interface-operations imports this module back.
// Lazy only too: rentals.ts (the rentals leaf) imports this module back.
import { WorkOrderEventKind } from '@injishi/contracts';

import { adapterModeEnum, brokerFeeKindEnum, brokerStatusEnum, idKindEnum, moveOutNoticeChannelEnum, moveOutNoticeStatusEnum, moveOutReasonEnum, leaseChargeKindEnum, leaseChargeStatusEnum, leaseSigningMethodEnum, paymentAttemptPurposeEnum, paymentAttemptStateEnum, cautionStatusEnum, escrowSourceEnum, escrowStatusEnum, invitationStatusEnum, leaseStatusEnum, maintenanceAssigneeKindEnum, maintenanceCategoryEnum, maintenancePhotoPhaseEnum, maintenancePriorityEnum, maintenanceRaisedByRoleEnum, maintenanceStatusEnum, placementStatusEnum, renewalStatusEnum, signerRoleEnum } from './enums';
import { bookings, guestStays, storedObjects } from './hospitality';
import { listings, properties, rentalUnits, rooms, spaces } from './inventory';
import { departments, serviceOrders } from './operations';
import { orgs, workspaces } from './org';

export const brokers = pgTable(
  'brokers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    nationalId: text('national_id').notNull(),
    name: text('name'),
    phone: text('phone'),
    email: text('email'),
    status: brokerStatusEnum('status').notNull().default('active'),
    licenseInfo: jsonb('license_info'),
    /** The district the broker works in: the free District plan shows the homes there. */
    homeDistrictId: integer('home_district_id').references(() => districts.id),
    /** The last move of the home district; on the free plan it may move once per 30 days. */
    homeDistrictChangedAt: timestamp('home_district_changed_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique('brokers_user_uk').on(t.userId),
    unique('brokers_national_id_uk').on(t.nationalId),
  ],
);


/**
 * A tenant, as one landlord business knows them: a real record, not text on a
 * lease (blueprint 1.2). One per person per business, found again by email
 * when the same person rents a second time.
 *
 * `user_id` is null until the person accepts the lease invitation and signs
 * in; then it links their account, and their own pages read through it. A
 * tenant is reached by email or phone, so at least one is required (rows
 * carried over from the old lease text by migration 0076 may predate that
 * rule; see the migration). The email is stored lower case; the phone in
 * E.164; an ID number with no spaces or dashes, letters upper case.
 */
export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    userId: uuid('user_id').references(() => users.id),
    fullName: text('full_name').notNull(),
    email: text('email'),
    phone: text('phone'),
    idKind: idKindEnum('id_kind'),
    idNumber: text('id_number'),
    /** ISO 3166-1 alpha-2 ("RW"). */
    nationality: text('nationality'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('tenants_workspace_email_uk')
      .on(t.workspaceId, sql`lower(${t.email})`)
      .where(sql`${t.email} IS NOT NULL`),
    uniqueIndex('tenants_workspace_user_uk')
      .on(t.workspaceId, t.userId)
      .where(sql`${t.userId} IS NOT NULL`),
    index('tenants_user_idx').on(t.userId),
    check('tenants_name_present', sql`length(btrim(${t.fullName})) > 0`),
    check('tenants_contact_present', sql`${t.email} IS NOT NULL OR ${t.phone} IS NOT NULL`),
    check('tenants_email_lower', sql`${t.email} IS NULL OR ${t.email} = lower(${t.email})`),
    check('tenants_phone_e164', sql`${t.phone} IS NULL OR ${t.phone} ~ '^[+][1-9][0-9]{7,14}$'`),
    check(
      'tenants_id_shape',
      sql`(${t.idKind} IS NULL AND ${t.idNumber} IS NULL)
        OR (${t.idKind} = 'national_id' AND ${t.idNumber} ~ '^[0-9]{16}$')
        OR (${t.idKind} = 'passport' AND ${t.idNumber} ~ '^[A-Z0-9]{5,20}$')`,
    ),
    check('tenants_nationality_shape', sql`${t.nationality} IS NULL OR ${t.nationality} ~ '^[A-Z]{2}$'`),
  ],
);

/**
 * A lease: one tenant, one unit, the terms both signed (blueprint 1.2).
 *
 * Where it stands is `status` (`LEASE_TRANSITIONS` in contracts; the API is
 * the only thing that moves it), and each status carries its moment: signed,
 * activated, ending since, ended on, cancelled. The money terms are the
 * lease's own copy (rent, deposit, due day 1 to 28, grace and notice days), so
 * changing a landlord's defaults never changes a signed lease. Rent is charged
 * by calendar month from `billing_starts_on` (`rentSchedule` in contracts).
 *
 * Two live leases (out for signature, signed, active, ending) can never hold
 * one unit over overlapping days: `leases_unit_no_overlap`, an EXCLUDE
 * constraint over `btree_gist` added by hand in migration 0077, because
 * drizzle-kit has no EXCLUDE. It is
 *   EXCLUDE USING gist (unit_id WITH =,
 *     daterange(start_date, coalesce(ended_on, end_date), '[]') WITH &&)
 *   WHERE (status IN ('pending_signature', 'signed', 'active', 'ending'))
 *
 * The columns under LEGACY are the first residence screens' and migration 0089
 * drops them; nothing new may read or write them.
 */
export const leases = pgTable(
  'leases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    /** "L-KC-014": the number on the contract and in every conversation about it. Unique per workspace. */
    reference: text('reference').notNull(),
    /** The property the unit stands in. */
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id),
    /** The unit let. Migration 0076 set it to `room_id`: units kept their room's id. */
    unitId: uuid('unit_id')
      .notNull()
      .references(() => rentalUnits.id),
    /** The one signing tenant. Other people living there are `occupants`. */
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    brokerId: uuid('broker_id').references(() => brokers.id),
    /** The broker's placement that brought this tenant, when there was one. */
    placementId: uuid('placement_id').references((): AnyPgColumn => tenantPlacements.id),
    status: leaseStatusEnum('status').notNull().default('draft'),
    startDate: date('start_date').notNull(),
    /** The last day of the lease, inclusive. */
    endDate: date('end_date').notNull(),
    /**
     * The first day rent is charged here: the start date, or later for a
     * tenancy that began before it came onto Injishi.
     */
    billingStartsOn: date('billing_starts_on').notNull(),
    monthlyRentRwf: amount('monthly_rent_rwf').notNull(),
    currency: currency(),
    /** The deposit agreed; 0 when the lease takes none. */
    depositRwf: amount('deposit_rwf').notNull(),
    /** The day of the month rent falls due (1 to 28, so it exists in every month). */
    rentDueDay: integer('rent_due_day').notNull(),
    /** Days after the due day before rent counts as late. */
    graceDays: integer('grace_days').notNull().default(5),
    /** Written notice either party owes before the tenancy ends; at least 15 days. */
    noticeDays: integer('notice_days').notNull().default(15),
    /** The people who live there with the tenant and do not sign ("Ines Habineza"). */
    occupants: text('occupants')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    otherTerms: text('other_terms'),
    /** The lease this one renews: a renewal is a new lease. */
    supersedesLeaseId: uuid('supersedes_lease_id').references(
      (): AnyPgColumn => leases.id,
    ),
    /** The contract version out for signature, or signed. */
    currentVersionId: uuid('current_version_id').references(
      (): AnyPgColumn => leaseContractVersions.id,
    ),
    signedAt: timestamp('signed_at', { withTimezone: true }),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    endingSince: timestamp('ending_since', { withTimezone: true }),
    /** The day the tenant moved out: the lease's real last day. */
    endedOn: date('ended_on'),
    endReason: text('end_reason'),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelReason: text('cancel_reason'),
    version: integer('version').notNull().default(0),
    // --- LEGACY, dropped by migration 0089 ---
    /**
     * @deprecated the unit is `unit_id` (same id). Nullable since migration
     * 0082: a lease on a unit made after the rebuild has no room behind it.
     */
    roomId: uuid('room_id').references(() => rooms.id),
    /** @deprecated the tenant's account is `tenants.user_id`. */
    tenantUserId: uuid('tenant_user_id').references(() => users.id),
    /** @deprecated `deposit_rwf`. */
    cautionRwf: amount('caution_rwf'),
    /** @deprecated `lease_contract_versions`. */
    contractContent: jsonb('contract_content'),
    /** @deprecated `lease_contract_versions.pdf_object_id`. */
    contractObjectId: uuid('contract_object_id').references(
      () => storedObjects.id,
    ),
    /** @deprecated `lease_signatures`. */
    landlordSignedAt: timestamp('landlord_signed_at', { withTimezone: true }),
    /** @deprecated `lease_signatures`. */
    tenantSignedAt: timestamp('tenant_signed_at', { withTimezone: true }),
    /** @deprecated `tenants`. */
    tenantName: text('tenant_name'),
    /** @deprecated `tenants`. */
    tenantNationalId: text('tenant_national_id'),
    /** @deprecated `tenants`. */
    tenantEmail: text('tenant_email'),
    /** @deprecated `tenants`. */
    tenantPhone: text('tenant_phone'),
    ...timestamps,
  },
  (t) => [
    index('leases_org_idx').on(t.orgId),
    index('leases_unit_idx').on(t.unitId),
    index('leases_tenant_id_idx').on(t.tenantId),
    index('leases_tenant_idx').on(t.tenantUserId),
    index('leases_workspace_status_idx').on(t.workspaceId, t.status),
    uniqueIndex('leases_workspace_reference_uk').on(t.workspaceId, t.reference),
    check('leases_dates_order', sql`${t.endDate} > ${t.startDate}`),
    check(
      'leases_billing_window',
      sql`${t.billingStartsOn} >= ${t.startDate} AND ${t.billingStartsOn} <= ${t.endDate}`,
    ),
    check('leases_rent_positive', sql`${t.monthlyRentRwf} > 0`),
    check('leases_deposit_not_negative', sql`${t.depositRwf} >= 0`),
    check('leases_rent_due_day_in_month', sql`${t.rentDueDay} BETWEEN 1 AND 28`),
    check(
      'leases_terms_range',
      sql`${t.graceDays} BETWEEN 0 AND 31 AND ${t.noticeDays} BETWEEN 15 AND 180`,
    ),
    check('leases_occupants_limit', sql`cardinality(${t.occupants}) <= 12`),
    check('leases_reference_present', sql`length(btrim(${t.reference})) > 0`),
    check('leases_ended_after_start', sql`${t.endedOn} IS NULL OR ${t.endedOn} >= ${t.startDate}`),
    check(
      'leases_signed_shape',
      sql`${t.status} NOT IN ('signed', 'active', 'ending', 'ended') OR ${t.signedAt} IS NOT NULL`,
    ),
    check(
      'leases_activated_shape',
      sql`${t.status} NOT IN ('active', 'ending', 'ended') OR ${t.activatedAt} IS NOT NULL`,
    ),
    check('leases_ending_shape', sql`${t.status} <> 'ending' OR ${t.endingSince} IS NOT NULL`),
    check('leases_ended_shape', sql`(${t.status} = 'ended') = (${t.endedOn} IS NOT NULL)`),
    check('leases_cancelled_shape', sql`(${t.status} = 'cancelled') = (${t.cancelledAt} IS NOT NULL)`),
  ],
);

/**
 * Each version of a lease's contract: what was shown and signed (blueprint 1.2).
 *
 * `content` is the LeaseContract JSON (template version 3: parties, premises,
 * terms, clauses) and `content_hash` its SHA-256 over the canonical JSON
 * (`contractHash` in contracts), which every signature repeats. Editing terms
 * after the landlord signed makes a new version. Template version 0 marks a
 * version migration 0077 carried over from before versions existed: its
 * content is the old `contract_content` with the lease terms of that day, and
 * its hash is SHA-256 of that JSON as Postgres prints it.
 */
export const leaseContractVersions = pgTable(
  'lease_contract_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leaseId: uuid('lease_id')
      .notNull()
      .references(() => leases.id),
    version: integer('version').notNull(),
    templateVersion: integer('template_version').notNull(),
    content: jsonb('content').notNull(),
    contentHash: text('content_hash').notNull(),
    /** The contract as a PDF, before signatures. */
    pdfObjectId: uuid('pdf_object_id').references(() => storedObjects.id),
    /** The signed copy with its audit trail page, made after the second signature. */
    signedPdfObjectId: uuid('signed_pdf_object_id'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('lease_contract_versions_lease_version_uk').on(t.leaseId, t.version),
    // Named: the generated name is longer than Postgres's 63 characters.
    foreignKey({
      name: 'lease_contract_versions_signed_pdf_fk',
      columns: [t.signedPdfObjectId],
      foreignColumns: [storedObjects.id],
    }),
    // What `lease_signatures` points its (version, hash) pair at.
    unique('lease_contract_versions_id_hash_uk').on(t.id, t.contentHash),
    check('lease_contract_versions_version_positive', sql`${t.version} >= 1`),
    check('lease_contract_versions_template_known', sql`${t.templateVersion} >= 0`),
    check('lease_contract_versions_hash_shape', sql`${t.contentHash} ~ '^[a-f0-9]{64}$'`),
  ],
);

/**
 * A signature on one version of a lease. Rows are only ever added; a signature
 * that no longer stands (terms edited after the landlord signed) gets
 * `voided_at`, and a new one is added on the new version.
 *
 * `(version_id, document_hash)` points at the version's `(id, content_hash)`,
 * so a signature can only repeat the hash of the contract it signs. The
 * evidence is the typed name, the drawn signature (optional), how the signer
 * proved it was them (`method`) and when, their IP and browser. A `legacy`
 * signature was carried over by migration 0077 from the old signed-at times:
 * it may have no account and no evidence, and nothing new is ever `legacy`.
 *
 * The key to `leases` is NO ACTION, so deleting a signed lease is refused.
 */
export const leaseSignatures = pgTable(
  'lease_signatures',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leaseId: uuid('lease_id')
      .notNull()
      .references(() => leases.id),
    versionId: uuid('version_id').notNull(),
    signerRole: signerRoleEnum('signer_role').notNull(),
    signerUserId: uuid('signer_user_id').references(() => users.id),
    signerEmail: text('signer_email'),
    typedName: text('typed_name'),
    /** The drawn signature, a PNG. */
    signatureObjectId: uuid('signature_object_id').references(() => storedObjects.id),
    documentHash: text('document_hash').notNull(),
    method: leaseSigningMethodEnum('method').notNull(),
    /** When the emailed code or the password was checked. */
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    ipAddress: inet('ip_address'),
    userAgent: text('user_agent'),
    signedAt: timestamp('signed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    /** Why a legacy signature exists, or why one was voided. */
    note: text('note'),
  },
  (t) => [
    index('lease_signatures_lease_idx').on(t.leaseId),
    foreignKey({
      name: 'lease_signatures_version_hash_fk',
      columns: [t.versionId, t.documentHash],
      foreignColumns: [leaseContractVersions.id, leaseContractVersions.contentHash],
    }),
    uniqueIndex('lease_signatures_live_uk')
      .on(t.versionId, t.signerRole)
      .where(sql`${t.voidedAt} IS NULL`),
    check(
      'lease_signatures_evidence',
      sql`${t.method} = 'legacy' OR (${t.signerUserId} IS NOT NULL AND ${t.typedName} IS NOT NULL AND ${t.verifiedAt} IS NOT NULL)`,
    ),
  ],
);

/**
 * A one-time code emailed to a signer, typed back to sign (10 minutes, at most
 * 5 tries). Only its hash is kept. One live (unconsumed) code per signer per
 * lease: asking again replaces it.
 */
export const leaseSigningCodes = pgTable(
  'lease_signing_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leaseId: uuid('lease_id')
      .notNull()
      .references(() => leases.id, { onDelete: 'cascade' }),
    versionId: uuid('version_id')
      .notNull()
      .references(() => leaseContractVersions.id),
    signerRole: signerRoleEnum('signer_role').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    email: text('email').notNull(),
    codeHash: text('code_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('lease_signing_codes_live_uk')
      .on(t.leaseId, t.signerRole, t.userId)
      .where(sql`${t.consumedAt} IS NULL`),
    check('lease_signing_codes_attempts_range', sql`${t.attempts} BETWEEN 0 AND 5`),
    check('lease_signing_codes_email_lower', sql`${t.email} = lower(${t.email})`),
  ],
);


/**
 * What a lease asks the tenant to pay: a calendar month's rent, or the deposit
 * (blueprint 1.2; `rent_charges` renamed by migration 0078).
 *
 * A rent charge covers `period_start` to `period_end` inside one calendar
 * month (the first and last months of a lease may be partial, prorated by
 * day; `rentSchedule` in contracts) and falls due on `due_on`. It is raised 7
 * days ahead. The deposit charge has no period and is due on the start date.
 * `paid_rwf` is always the sum of the live allocations to the charge
 * (`lease_payment_allocations`); overdue is worked out (open, and past
 * `due_on` plus the lease's grace days), never stored.
 */
export const leaseCharges = pgTable(
  'lease_charges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leaseId: uuid('lease_id')
      .notNull()
      .references(() => leases.id, { onDelete: 'cascade' }),
    kind: leaseChargeKindEnum('kind').notNull().default('rent'),
    periodStart: date('period_start'),
    periodEnd: date('period_end'),
    dueOn: date('due_on').notNull(),
    amountRwf: amount('amount_rwf').notNull(),
    paidRwf: amount('paid_rwf').notNull().default(0),
    currency: currency(),
    status: leaseChargeStatusEnum('status').notNull().default('open'),
    waivedReason: text('waived_reason'),
    /** When the last franc arrived. */
    paidAt: timestamp('paid_at', { withTimezone: true }),
    /** @deprecated LEGACY, dropped by migration 0089: a payment carries the client key now. */
    idempotencyKey: text('idempotency_key'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('lease_charges_rent_period_uk')
      .on(t.leaseId, t.periodStart)
      .where(sql`${t.kind} = 'rent'`),
    uniqueIndex('lease_charges_deposit_uk')
      .on(t.leaseId)
      .where(sql`${t.kind} = 'deposit'`),
    unique('lease_charges_idempotency_key_uk').on(t.idempotencyKey),
    index('lease_charges_open_due_idx')
      .on(t.dueOn)
      .where(sql`${t.status} = 'open'`),
    check('lease_charges_amount_positive', sql`${t.amountRwf} > 0`),
    check(
      'lease_charges_period_shape',
      sql`(${t.kind} = 'rent' AND ${t.periodStart} IS NOT NULL AND ${t.periodEnd} IS NOT NULL AND ${t.periodEnd} >= ${t.periodStart})
        OR (${t.kind} = 'deposit' AND ${t.periodStart} IS NULL AND ${t.periodEnd} IS NULL)`,
    ),
    check('lease_charges_waived_shape', sql`(${t.status} = 'waived') = (${t.waivedReason} IS NOT NULL)`),
    check('lease_charges_paid_range', sql`${t.paidRwf} BETWEEN 0 AND ${t.amountRwf}`),
    check('lease_charges_paid_shape', sql`(${t.status} = 'paid') = (${t.paidRwf} = ${t.amountRwf})`),
    check('lease_charges_paid_at_shape', sql`${t.status} <> 'paid' OR ${t.paidAt} IS NOT NULL`),
  ],
);

export const escrows = pgTable(
  'escrows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    source: escrowSourceEnum('source').notNull(),
    bookingId: uuid('booking_id').references(() => bookings.id),
    cautionHoldId: uuid('caution_hold_id').references(
      (): AnyPgColumn => cautionHolds.id,
    ),
    amountRwf: amount('amount_rwf'),
    currency: currency(),
    status: escrowStatusEnum('status').notNull().default('held'),
    adapterRef: text('adapter_ref'),
    adapterMode: adapterModeEnum('adapter_mode').notNull().default('mock'),
    idempotencyKey: text('idempotency_key'),
    /**
     * SHA-256 (first 16 hex) of the stay the attempt asked for: room type,
     * dates, guests, refundability (review 3.4). A replay on the same attempt
     * token with a DIFFERENT stay is refused rather than answered with the
     * first booking; without this a retried press could hand a guest dates
     * they never asked for.
     */
    attemptFingerprint: text('attempt_fingerprint'),
    ...timestamps,
  },
  (t) => [
    unique('escrows_idempotency_key_uk').on(t.idempotencyKey),
    index('escrows_workspace_idx').on(t.workspaceId),
    index('escrows_booking_idx').on(t.bookingId),
    check(
      'escrows_amount_non_negative',
      sql`${t.amountRwf} IS NULL OR ${t.amountRwf} >= 0`,
    ),
  ],
);

/**
 * The durable record of money that still has to move (review 3.3).
 *
 * A compensating refund, void or release used to exist only as a Redis job,
 * and as a log line when Redis refused it. This row is written BEFORE the job
 * is queued, so a queue outage during a payment incident — exactly when these
 * spike — loses nothing. The worker stamps `done_at` when the provider
 * confirms; a one-minute sweep re-queues anything due and undone. Redis is the
 * wake-up; this table is the truth.
 */
export const paymentCompensations = pgTable(
  'payment_compensations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: text('kind').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    workspaceId: uuid('workspace_id').notNull(),
    originalRef: text('original_ref').notNull(),
    amountRwf: amount('amount_rwf').notNull(),
    bookingId: uuid('booking_id'),
    memo: text('memo').notNull(),
    attempts: integer('attempts').notNull().default(0),
    nextAt: timestamp('next_at', { withTimezone: true }).notNull().defaultNow(),
    lastError: text('last_error'),
    doneAt: timestamp('done_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique('payment_compensations_key_uk').on(t.idempotencyKey),
    // The three jobs `PaymentCompensationService` writes and `rowToJob` reads
    // back (platform audit step 3). A row of any other kind was silently
    // skipped by the sweep forever; now it cannot be written.
    check(
      'payment_compensations_kind_known',
      sql`${t.kind} IN ('refund', 'void-pending', 'release-escrow')`,
    ),
    index('payment_compensations_due_idx')
      .on(t.nextAt)
      .where(sql`${t.doneAt} IS NULL`),
  ],
);


/**
 * One press of confirm on a rail that answers later (ADR-047 D-j).
 *
 * ## Why this table has to exist
 *
 * Every Rwandan mobile money rail pushes a prompt to a handset and settles
 * afterwards: the customer LEAVES our app, approves in the MoMo app or on
 * `*182#`, and the answer arrives by callback. Until now the API had nowhere to
 * put that interval. `BookingService` refused an unsettled capture with a 402
 * and told the guest to press the button again — a human being polling a
 * payment provider by hand — and the mock adapter's own comment explains that
 * it always reports `settled` because doing otherwise "would refuse every
 * booking in development". The async path every real payment on this platform
 * will take was therefore unreachable end to end.
 *
 * A row here is what the provider's callback lands on, what a poll reads, and
 * what the sweep expires. Without it the money is in flight with no record on
 * our side, and the only trace of a guest's charge is a token in their browser.
 *
 * It follows `payment_compensations` above: written BEFORE anyone waits on it,
 * so a crash, a closed tab or a Redis outage loses nothing.
 *
 * ## What it deliberately does not hold
 *
 * The payer's number, unmasked. `payer_masked` is `078••••456` — enough for
 * support to match a person to an attempt, never enough to charge anybody. A
 * card token is not stored at all: it is a bearer credential for one charge and
 * the capture already has it.
 *
 * ## Why the stay is copied onto the row
 *
 * Because the booking does not exist yet. When the callback arrives the server
 * has to write the reservation the guest actually asked for, and the only other
 * copy of that intent is in a browser that may be closed. `attempt_fingerprint`
 * is the same hash `escrows` carries, so a settled attempt cannot be completed
 * into a different stay from the one that was quoted.
 */
export const paymentAttempts = pgTable(
  'payment_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /**
     * The capture's idempotency key — `<workspace>:booking-capture:<token>`.
     *
     * Unique, and it is the whole deduplication of this table: one press of
     * confirm is one attempt, however many times a client or a callback
     * arrives. It is also the key the void runs on if this expires.
     */
    idempotencyKey: text('idempotency_key').notNull(),
    /** The uuid the browser minted for this press, as the client addresses it. */
    attemptToken: text('attempt_token').notNull(),
    guestUserId: uuid('guest_user_id')
      .notNull()
      .references(() => users.id),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),

    /**
     * What this attempt pays for (ADR-050 catalog child, D-n amended). A
     * `booking` carries the stay below; a `service_order` carries the order it
     * settles and none of the stay. `payment_attempts_purpose_shape` holds it.
     */
    purpose: paymentAttemptPurposeEnum('purpose').notNull().default('booking'),
    /** The pay now order this attempt settles. */
    serviceOrderId: uuid('service_order_id').references(
      (): AnyPgColumn => serviceOrders.id,
    ),
    /**
     * The org's pending registration invoice a `registration_fee` attempt pays
     * (073-gtbank-payments AC-16). A refused or expired attempt leaves the
     * invoice payable, so one invoice may have several attempts. Its foreign
     * key to `subscription_invoices` is hand written in migration 0073
     * (money.ts imports this file).
     */
    subscriptionInvoiceId: uuid('subscription_invoice_id'),
    /**
     * The reservation change a `booking_change` attempt pays the difference of (migration 0120). Its
     * foreign key to `booking_changes` is written in that migration (hospitality.ts imports this file).
     */
    bookingChangeId: uuid('booking_change_id'),
    /** Set on a `broker_group` attempt: the broker's group of rooms it pays for (0126). FK in the SQL. */
    brokerGroupId: uuid('broker_group_id'),

    // --- the stay this attempt is for, because no booking exists yet ---
    // Null on a `service_order` attempt, which has no stay.
    roomTypeId: uuid('room_type_id'),
    checkIn: date('check_in'),
    checkOut: date('check_out'),
    guestCount: integer('guest_count'),
    nonrefundable: boolean('nonrefundable').notNull().default(false),
    attemptFingerprint: text('attempt_fingerprint').notNull(),

    // --- the money, and the rail it is on ---
    amountRwf: amount('amount_rwf'),
    currency: currency(),
    adapterRef: text('adapter_ref'),
    adapterMode: adapterModeEnum('adapter_mode').notNull().default('mock'),
    /** `mobile_money` or `card`. */
    instrumentKind: text('instrument_kind').notNull(),
    /** `mtn_momo` / `airtel_money`, or null for a card. */
    network: text('network'),
    /** `078••••456`. Never the whole number, never a card token. */
    payerMasked: text('payer_masked'),

    state: paymentAttemptStateEnum('state').notNull().default('prompting'),
    /**
     * When an unanswered prompt stops being worth waiting for.
     *
     * Both rails abandon an unanswered prompt within minutes, and a guest
     * staring at a spinner needs an end. Past this the sweep voids the capture
     * and the attempt reads `expired`.
     */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    settledAt: timestamp('settled_at', { withTimezone: true }),
    /** Set when the attempt completed into a reservation. */
    bookingId: uuid('booking_id').references(() => bookings.id),
    /** Why it ended, when it ended badly. Shown to the guest as given. */
    failureReason: text('failure_reason'),
    ...timestamps,
  },
  (t) => [
    unique('payment_attempts_idempotency_key_uk').on(t.idempotencyKey),
    // The guest's own poll: "where did my payment get to".
    index('payment_attempts_guest_idx').on(t.guestUserId, t.attemptToken),
    // The provider's callback arrives with its own reference and nothing else.
    index('payment_attempts_adapter_ref_idx').on(t.adapterRef),
    index('payment_attempts_booking_idx').on(t.bookingId),
    // The sweep reads only what is still waiting, so the index stays the size
    // of prompts in flight rather than of every payment ever made.
    index('payment_attempts_expiry_idx')
      .on(t.expiresAt)
      .where(sql`${t.state} = 'prompting'`),
    index('payment_attempts_subscription_invoice_idx').on(t.subscriptionInvoiceId),
    /** Each purpose carries its own inputs and none of the other's. */
    check(
      'payment_attempts_purpose_shape',
      sql`(${t.purpose} = 'booking'
            AND ${t.roomTypeId} IS NOT NULL AND ${t.checkIn} IS NOT NULL
            AND ${t.checkOut} IS NOT NULL AND ${t.guestCount} IS NOT NULL
            AND ${t.serviceOrderId} IS NULL AND ${t.subscriptionInvoiceId} IS NULL)
        OR (${t.purpose} = 'service_order'
            AND ${t.serviceOrderId} IS NOT NULL
            AND ${t.roomTypeId} IS NULL AND ${t.checkIn} IS NULL
            AND ${t.checkOut} IS NULL AND ${t.guestCount} IS NULL
            AND ${t.subscriptionInvoiceId} IS NULL)
        OR (${t.purpose} = 'registration_fee'
            AND ${t.subscriptionInvoiceId} IS NOT NULL
            AND ${t.serviceOrderId} IS NULL
            AND ${t.roomTypeId} IS NULL AND ${t.checkIn} IS NULL
            AND ${t.checkOut} IS NULL AND ${t.guestCount} IS NULL)
        OR (${t.purpose}::text = 'booking_change'
            AND ${t.bookingChangeId} IS NOT NULL AND ${t.bookingId} IS NOT NULL
            AND ${t.serviceOrderId} IS NULL AND ${t.subscriptionInvoiceId} IS NULL
            AND ${t.roomTypeId} IS NULL AND ${t.checkIn} IS NULL
            AND ${t.checkOut} IS NULL AND ${t.guestCount} IS NULL)`,
    ),
  ],
);


export const cautionHolds = pgTable(
  'caution_holds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leaseId: uuid('lease_id')
      .notNull()
      .references(() => leases.id),
    amountRwf: amount('amount_rwf'),
    currency: currency(),
    status: cautionStatusEnum('status').notNull().default('held'),
    escrowId: uuid('escrow_id').references(() => escrows.id),
    heldAt: timestamp('held_at', { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [unique('caution_holds_lease_uk').on(t.leaseId)],
);


export const cautionSettlements = pgTable(
  'caution_settlements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leaseId: uuid('lease_id')
      .notNull()
      .references(() => leases.id),
    cautionHoldId: uuid('caution_hold_id')
      .notNull()
      .references(() => cautionHolds.id),
    refundedRwf: amount('refunded_rwf'),
    forfeitedRwf: amount('forfeited_rwf'),
    currency: currency(),
    reason: text('reason'),
    evidence: jsonb('evidence'),
    isDisputed: boolean('is_disputed').notNull().default(false),
    settledAt: timestamp('settled_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    /**
     * Returning a deposit moves money, so it carries a client key too
     * (ADR-012, AC-14).
     *
     * The one-settlement-per-lease unique below already makes a repeat fail,
     * but it fails with a constraint violation rather than returning what the
     * first call decided. The key is what lets a retry answer "here is the
     * settlement you already made" instead of an error the desk has to guess at.
     */
    idempotencyKey: text('idempotency_key'),
  },
  (t) => [
    unique('caution_settlements_lease_uk').on(t.leaseId),
    unique('caution_settlements_idempotency_key_uk').on(t.idempotencyKey),
  ],
);


/**
 * Notice that a tenancy will end early (blueprint 1.2, reshaped by migration
 * 0082): given by the tenant (on Injishi, or by letter or in person, which the
 * landlord records) or by the landlord. One live (not withdrawn) notice per
 * lease. The landlord acknowledges it, which moves the lease to `ending`; the
 * tenant may withdraw it, which moves an ending lease back to `active`. The
 * day the tenant actually left is `leases.ended_on`, never stored here.
 *
 * `notice_days` is how far ahead it was given (`move_out_on - filed_on`), and
 * `is_short_notice` whether that was less than the lease asks for.
 */
export const moveOutNotices = pgTable(
  'move_out_notices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leaseId: uuid('lease_id')
      .notNull()
      .references(() => leases.id, { onDelete: 'cascade' }),
    filedByRole: signerRoleEnum('filed_by_role').notNull(),
    filedByUserId: uuid('filed_by_user_id').references(() => users.id),
    channel: moveOutNoticeChannelEnum('channel').notNull(),
    /** The Kigali day it was given. */
    filedOn: date('filed_on').notNull(),
    moveOutOn: date('move_out_on').notNull(),
    reasonCode: moveOutReasonEnum('reason_code').notNull(),
    message: text('message'),
    noticeDays: integer('notice_days').notNull(),
    isShortNotice: boolean('is_short_notice').notNull().default(false),
    status: moveOutNoticeStatusEnum('status').notNull().default('submitted'),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    acknowledgedByUserId: uuid('acknowledged_by_user_id').references(() => users.id),
    withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
    filedAt: timestamp('filed_at', { withTimezone: true }).notNull().defaultNow(),
    /** When the landlord was nudged about a notice still to acknowledge (WP 1.7, migration 0092): once. */
    nudgedAt: timestamp('nudged_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('move_out_notices_live_uk')
      .on(t.leaseId)
      .where(sql`${t.status} <> 'withdrawn'`),
    check('move_out_notices_dates_order', sql`${t.moveOutOn} > ${t.filedOn}`),
    check('move_out_notices_days_shape', sql`${t.noticeDays} = ${t.moveOutOn} - ${t.filedOn}`),
    check(
      'move_out_notices_acknowledged_shape',
      sql`${t.status} <> 'acknowledged' OR ${t.acknowledgedAt} IS NOT NULL`,
    ),
    check('move_out_notices_withdrawn_shape', sql`(${t.status} = 'withdrawn') = (${t.withdrawnAt} IS NOT NULL)`),
  ],
);


/**
 * A renewal: a tenant's request (`kind = 'tenant_request'`, the original use) or, since real-data
 * 1.3.1, the landlord's OFFER of new terms, which the tenant accepts or declines and both sides then
 * sign as an amendment. `status` keeps its old meaning for both kinds (pending, approved, rejected);
 * an offer's finer state is `offer_status`.
 */
export const leaseRenewals = pgTable(
  'lease_renewals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leaseId: uuid('lease_id')
      .notNull()
      .references(() => leases.id, { onDelete: 'cascade' }),
    requestedByUserId: uuid('requested_by_user_id').references(() => users.id),
    requestedEndDate: date('requested_end_date'),
    status: renewalStatusEnum('status').notNull().default('pending'),
    decidedByUserId: uuid('decided_by_user_id').references(() => users.id),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    // --- The landlord's offer (real-data 1.3.1) ---
    kind: text('kind').notNull().default('tenant_request'),
    offerStatus: text('offer_status'),
    offeredRentRwf: amount('offered_rent_rwf'),
    termMonths: integer('term_months'),
    startsOn: date('starts_on'),
    answerBy: date('answer_by'),
    depositTopupRwf: amount('deposit_topup_rwf'),
    otherTerms: text('other_terms'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    openedAt: timestamp('opened_at', { withTimezone: true }),
    remindedAt: timestamp('reminded_at', { withTimezone: true }),
    answeredAt: timestamp('answered_at', { withTimezone: true }),
    /** When the amendment carried the last of both signatures. */
    signedAt: timestamp('signed_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('lease_renewals_lease_idx').on(t.leaseId),
    check('lease_renewals_kind_known', sql`${t.kind} IN ('tenant_request', 'landlord_offer')`),
    check(
      'lease_renewals_offer_shape',
      sql`${t.kind} = 'tenant_request' OR (${t.offerStatus} IN ('open', 'accepted', 'declined', 'withdrawn', 'signed')
            AND ${t.offeredRentRwf} > 0 AND ${t.termMonths} > 0 AND ${t.startsOn} IS NOT NULL
            AND ${t.requestedEndDate} IS NOT NULL AND ${t.answerBy} IS NOT NULL)`,
    ),
  ],
);


export const maintenanceTickets = pgTable(
  'maintenance_tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /**
     * ADR-016 D16: NULLABLE now. It was NOT NULL, which meant a maintenance
     * ticket could not exist without a lease and a hotel has no lease. The
     * `ticket.advance` command ADR-012 shipped was therefore residence only and
     * nobody reading its route would have guessed.
     */
    leaseId: uuid('lease_id').references(() => leases.id, {
      onDelete: 'cascade',
    }),
    /** The hospitality half: a work order raised against a room. */
    roomId: uuid('room_id').references(() => rooms.id, { onDelete: 'cascade' }),
    spaceId: uuid('space_id').references(() => spaces.id, {
      onDelete: 'cascade',
    }),
    guestStayId: uuid('guest_stay_id').references(() => guestStays.id),
    propertyId: uuid('property_id').references(() => properties.id, {
      onDelete: 'cascade',
    }),
    orgId: uuid('org_id').references(() => orgs.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    /** Engineering. Stays nullable: a ticket raised before it exists is real. */
    departmentId: uuid('department_id').references(
      (): AnyPgColumn => departments.id,
    ),
    raisedByUserId: uuid('raised_by_user_id').references(() => users.id),
    raisedByRole: maintenanceRaisedByRoleEnum('raised_by_role'),
    title: text('title').notNull(),
    description: text('description'),
    category: maintenanceCategoryEnum('category'),
    priority: maintenancePriorityEnum('priority').notNull().default('normal'),
    photoObjectKeys: jsonb('photo_object_keys'),
    status: maintenanceStatusEnum('status').notNull().default('open'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    // --- The hotel's work order (real-data 1.2.3) ---
    /** "WO-318": what people say on the radio. Unique per workspace. */
    reference: text('reference'),
    assignedToUserId: uuid('assigned_to_user_id').references(() => users.id),
    /** An outside firm doing the work, when no staff member is. */
    assignedContractor: text('assigned_contractor'),
    assetId: uuid('asset_id').references((): AnyPgColumn => assets.id, {
      onDelete: 'set null',
    }),
    scheduledFor: date('scheduled_for'),
    /** How it reached us: "staff app", "front desk · guest complaint", "planned schedule". */
    raisedVia: text('raised_via'),
    /** What the fault means for the operation while it is open. */
    impactNote: text('impact_note'),
    /** What must be true before the room goes back on sale. */
    releaseNote: text('release_note'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    verifiedByUserId: uuid('verified_by_user_id').references(() => users.id),
    // --- A residence repair (real-data 1.3.1) ---
    /** The tenant's answer to "may staff let themselves in if nobody is home". Null: not asked (a common area). */
    staffMayEnter: boolean('staff_may_enter'),
    /** The time on `scheduled_for`: "10:00", "after 17:00". */
    visitWindow: text('visit_window'),
    /** Who pays: the landlord, the tenant (misuse), or not decided yet. */
    costBearer: text('cost_bearer'),
    costNote: text('cost_note'),
    // --- The shared ticket lifecycle (rentals P4, migration 0087) ---
    /** The rented unit a fault is in. A tenant's fault names its lease too. */
    unitId: uuid('unit_id').references(() => rentalUnits.id),
    /** Who it is handed to: `member` (assigned_to_user_id) or `contractor` (assigned_contractor). */
    assigneeKind: maintenanceAssigneeKindEnum('assignee_kind'),
    /** The outside fixer's phone, E.164, so the landlord can call or pay them. */
    assignedContractorPhone: text('assigned_contractor_phone'),
    /** When the landlord marked a tenant's report seen. */
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    /** Why it will not be fixed, as the tenant is told. Set exactly while the status is `wont_fix`. */
    wontFixReason: text('wont_fix_reason'),
    /** How many times it went back to open after being settled. */
    reopenedCount: integer('reopened_count').notNull().default(0),
    ...timestamps,
  },
  (t) => [
    check(
      'maintenance_tickets_cost_bearer_known',
      sql`${t.costBearer} IS NULL OR ${t.costBearer} IN ('landlord', 'tenant', 'to_be_decided')`,
    ),
    index('maintenance_tickets_workspace_status_idx').on(
      t.workspaceId,
      t.status,
    ),
    uniqueIndex('maintenance_tickets_workspace_reference_uk')
      .on(t.workspaceId, t.reference)
      .where(sql`${t.reference} IS NOT NULL`),
    index('maintenance_tickets_property_idx').on(t.propertyId),
    index('maintenance_tickets_room_idx').on(t.roomId),
    index('maintenance_tickets_lease_idx').on(t.leaseId),
    index('maintenance_tickets_unit_idx').on(t.unitId),
    /**
     * A ticket has to be ABOUT something. With `lease_id` now nullable, nothing
     * else would stop a row that names no subject at all, and a work order
     * nobody can locate is worse than no work order. A rented unit counts
     * (rentals P4): a landlord's fault on a vacant unit has no lease.
     */
    check(
      'maintenance_tickets_subject_at_least_one',
      sql`${t.roomId} IS NOT NULL OR ${t.spaceId} IS NOT NULL OR ${t.leaseId} IS NOT NULL OR ${t.unitId} IS NOT NULL`,
    ),
    check(
      'maintenance_tickets_assignee_shape',
      sql`${t.assigneeKind} IS NULL
        OR (${t.assigneeKind} = 'member' AND ${t.assignedToUserId} IS NOT NULL AND ${t.assignedContractor} IS NULL)
        OR (${t.assigneeKind} = 'contractor' AND ${t.assignedContractor} IS NOT NULL AND ${t.assignedToUserId} IS NULL)`,
    ),
    check(
      'maintenance_tickets_contractor_phone_shape',
      sql`${t.assignedContractorPhone} IS NULL
        OR (${t.assigneeKind} = 'contractor' AND ${t.assignedContractorPhone} ~ '^[+][1-9][0-9]{7,14}$')`,
    ),
    check('maintenance_tickets_wont_fix_reason', sql`(${t.status} = 'wont_fix') = (${t.wontFixReason} IS NOT NULL)`),
    check('maintenance_tickets_acknowledged_shape', sql`${t.status} <> 'acknowledged' OR ${t.acknowledgedAt} IS NOT NULL`),
    check('maintenance_tickets_reopened_count_range', sql`${t.reopenedCount} >= 0`),
  ],
);


/**
 * What a step on a work order's timeline was (real-data 1.2.3). A plain note is `note`.
 * The list is `WorkOrderEventKind` in contracts; rentals P4 (migration 0087)
 * added the shared lifecycle's steps a hotel order never takes and `paid`.
 */
export const maintenanceEventKindEnum = pgEnum('maintenance_event_kind', WorkOrderEventKind.options);

export const maintenanceEvents = pgTable(
  'maintenance_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => maintenanceTickets.id, { onDelete: 'cascade' }),
    authorUserId: uuid('author_user_id').references(() => users.id),
    /** Who wrote it, which is not the same question as what role they hold (rentals P4). */
    authorRole: maintenanceRaisedByRoleEnum('author_role'),
    kind: maintenanceEventKindEnum('kind').notNull().default('note'),
    note: text('note'),
    photoObjectId: uuid('photo_object_id').references(() => storedObjects.id),
    /** A move along the lifecycle says where it went from and to (rentals P4). */
    fromStatus: maintenanceStatusEnum('from_status'),
    toStatus: maintenanceStatusEnum('to_status'),
    /** Whether the tenant's own timeline shows it. Team notes and payments never are. */
    visibleToTenant: boolean('visible_to_tenant').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('maintenance_events_ticket_idx').on(t.ticketId, t.createdAt)],
);

/**
 * A ticket's photos (rentals P4, migration 0087): what the tenant saw when
 * they reported it, the work as it went, and the fix. At most four in each
 * phase (the service checks, under the ticket's lock). Replaces the
 * `photo_object_keys` jsonb, which 0087 copied in.
 */
export const maintenancePhotos = pgTable(
  'maintenance_photos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => maintenanceTickets.id, { onDelete: 'cascade' }),
    storedObjectId: uuid('stored_object_id')
      .notNull()
      .references(() => storedObjects.id),
    position: integer('position').notNull().default(0),
    phase: maintenancePhotoPhaseEnum('phase').notNull().default('report'),
    caption: text('caption'),
    uploadedByUserId: uuid('uploaded_by_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('maintenance_photos_object_uk').on(t.ticketId, t.storedObjectId),
    index('maintenance_photos_ticket_idx').on(t.ticketId, t.phase, t.position),
    check('maintenance_photos_position_range', sql`${t.position} BETWEEN 0 AND 99`),
  ],
);


/**
 * The gate's book of who came in (real-data 1.3.1 widened it).
 *
 * `lease_id` was NOT NULL, so the log could only hold a visit to a tenancy. A gate also admits a
 * surveyor to a vacant unit and a technician to the roof, and refusing to write those down is how a
 * compound loses track of who is inside. It is nullable now; the row must still say WHERE: a lease,
 * a unit or the property, and `workspace_id` scopes it for the business that runs the gate.
 */
export const visitorLogEntries = pgTable(
  'visitor_log_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leaseId: uuid('lease_id').references(() => leases.id, { onDelete: 'cascade' }),
    visitorName: text('visitor_name'),
    visitorPhone: text('visitor_phone'),
    relation: text('relation'),
    arrivalAt: timestamp('arrival_at', { withTimezone: true }),
    departureAt: timestamp('departure_at', { withTimezone: true }),
    // --- real-data 1.3.1 ---
    workspaceId: uuid('workspace_id').references(() => workspaces.id),
    propertyId: uuid('property_id').references(() => properties.id),
    roomId: uuid('room_id').references(() => rooms.id),
    /** The gate code the visitor showed, when they had one. Lazy: `visitor_passes` imports this module. */
    visitorPassId: uuid('visitor_pass_id').references((): AnyPgColumn => visitorPasses.id, {
      onDelete: 'set null',
    }),
    /** A place that is not a unit: "Block C · roof". */
    place: text('place'),
    /** "Code 3302 · pre-registered", "Approved by Solange", "Resident came to the gate". */
    admittedHow: text('admitted_how'),
    /** Who wrote it down at the gate (a guard on the gate tablet has no account). */
    recordedBy: text('recorded_by'),
  },
  (t) => [
    index('visitor_log_entries_scope_arrival_idx').on(t.workspaceId, t.arrivalAt),
    check(
      'visitor_log_entries_located',
      sql`${t.leaseId} IS NOT NULL OR ${t.roomId} IS NOT NULL OR ${t.propertyId} IS NOT NULL`,
    ),
  ],
);


/**
 * Something the gate or a resident asks management to decide: an overnight stay longer than the
 * house rule allows, a delivery with nobody home, an entry without a code (real-data 1.3.1 gave it a
 * decision; before, a request was written and nothing could answer it).
 */
export const visitorAccessRequests = pgTable(
  'visitor_access_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leaseId: uuid('lease_id')
      .notNull()
      .references(() => leases.id, { onDelete: 'cascade' }),
    requestedByUserId: uuid('requested_by_user_id').references(() => users.id),
    forDate: date('for_date'),
    reason: text('reason'),
    requestedAt: timestamp('requested_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    // --- real-data 1.3.1 ---
    kind: text('kind').notNull().default('overnight'),
    visitorName: text('visitor_name'),
    /** The last night of an overnight stay. */
    toDate: date('to_date'),
    status: text('status').notNull().default('open'),
    decidedByUserId: uuid('decided_by_user_id').references(() => users.id),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
  },
  (t) => [
    index('visitor_access_requests_lease_idx').on(t.leaseId, t.status),
    check('visitor_access_requests_kind_known', sql`${t.kind} IN ('overnight', 'delivery', 'gate_entry')`),
    check('visitor_access_requests_status_known', sql`${t.status} IN ('open', 'approved', 'declined')`),
    check(
      'visitor_access_requests_decided_shape',
      sql`(${t.status} = 'open') = (${t.decidedAt} IS NULL)`,
    ),
  ],
);


/**
 * The invitation to the tenant to read and sign (blueprint 1.2). The link
 * carries a random token; only its SHA-256 is kept (`token_hash`). It lasts 14
 * days and can be sent again (`last_sent_at`, `send_count`). One `sent`
 * invitation per lease at a time.
 */
export const leaseInvitations = pgTable(
  'lease_invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leaseId: uuid('lease_id')
      .notNull()
      .references(() => leases.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    email: text('email').notNull(),
    tokenHash: text('token_hash').notNull(),
    status: invitationStatusEnum('status').notNull().default('sent'),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
    lastSentAt: timestamp('last_sent_at', { withTimezone: true }).notNull().defaultNow(),
    sendCount: integer('send_count').notNull().default(1),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    acceptedByUserId: uuid('accepted_by_user_id').references(() => users.id),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique('lease_invitations_token_hash_uk').on(t.tokenHash),
    uniqueIndex('lease_invitations_live_uk')
      .on(t.leaseId)
      .where(sql`${t.status} = 'sent'`),
    check('lease_invitations_token_hash_shape', sql`${t.tokenHash} ~ '^[a-f0-9]{64}$'`),
    check('lease_invitations_email_lower', sql`${t.email} = lower(${t.email})`),
    check('lease_invitations_send_count_positive', sql`${t.sendCount} >= 1`),
    check('lease_invitations_accepted_shape', sql`(${t.status} = 'accepted') = (${t.acceptedAt} IS NOT NULL)`),
    check('lease_invitations_revoked_shape', sql`(${t.status} = 'revoked') = (${t.revokedAt} IS NOT NULL)`),
  ],
);


export const contactReveals = pgTable('contact_reveals', {
  id: uuid('id').primaryKey().defaultRandom(),
  brokerId: uuid('broker_id')
    .notNull()
    .references(() => brokers.id),
  listingId: uuid('listing_id').references(() => listings.id),
  landlordOrgId: uuid('landlord_org_id').references(() => orgs.id),
  /** The opted-in unit the broker revealed the landlord from (2026-10-25). */
  unitId: uuid('unit_id').references(() => rentalUnits.id),
  revealedName: text('revealed_name'),
  revealedPhone: text('revealed_phone'),
  revealedEmail: text('revealed_email'),
  revealedAt: timestamp('revealed_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [
  // One reveal per broker and landlord: a landlord's contact is the same on every unit.
  uniqueIndex('contact_reveals_broker_org_uk').on(t.brokerId, t.landlordOrgId).where(sql`${t.landlordOrgId} IS NOT NULL`),
]);


/**
 * A broker's reveal credits, as a ledger rather than a counter (ADR-038 child 0,
 * AC-S13).
 *
 * The balance is `sum(delta)` for a broker. Positive rows grant, negative rows
 * spend. Nothing decrements a column, so a balance can always be explained by
 * the rows that produced it, and a bad spend is corrected by another row rather
 * than by editing history.
 *
 * `reveal_id` is unique, which is the whole double-spend defence: a second
 * attempt to charge the same reveal CONFLICTS instead of deducting twice, with
 * no lock and no read-modify-write. It is the same trick the booking capture
 * already plays with `idempotency_key`.
 */
export const brokerRevealCredits = pgTable(
  'broker_reveal_credits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brokerId: uuid('broker_id')
      .notNull()
      .references(() => brokers.id),
    /** Positive grants, negative spends. Credits, not money. */
    delta: integer('delta').notNull(),
    /** 'plan_grant' | 'reveal' | 'refund' | 'correction'. */
    reason: text('reason').notNull(),
    /** Set when `reason` is 'reveal'. Null for every other reason. */
    revealId: uuid('reveal_id').references(() => contactReveals.id),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('broker_reveal_credits_broker_idx').on(t.brokerId, t.createdAt),
    // One spend per reveal. This is the constraint, not an optimisation.
    unique('broker_reveal_credits_reveal_uk').on(t.revealId),
  ],
);


export const tenantPlacements = pgTable('tenant_placements', {
  id: uuid('id').primaryKey().defaultRandom(),
  brokerId: uuid('broker_id')
    .notNull()
    .references(() => brokers.id),
  listingId: uuid('listing_id').references(() => listings.id),
  landlordOrgId: uuid('landlord_org_id').references(() => orgs.id),
  status: placementStatusEnum('status').notNull().default('initiated'),
  leaseId: uuid('lease_id').references(() => leases.id),
  /** The unit the broker has a tenant for (2026-10-25), and the landlord's business it is in. */
  unitId: uuid('unit_id').references(() => rentalUnits.id),
  workspaceId: uuid('workspace_id').references(() => workspaces.id),
  /** Who the broker says they bring, and a word to the landlord. */
  tenantName: text('tenant_name'),
  note: text('note'),
  /** The unit's broker fee when the placement started. */
  feeKind: brokerFeeKindEnum('fee_kind'),
  feePercent: integer('fee_percent'),
  feeRwf: amount('fee_rwf'),
  initiatedAt: timestamp('initiated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  ...timestamps,
}, (t) => [
  index('tenant_placements_broker_idx').on(t.brokerId, t.initiatedAt),
  index('tenant_placements_workspace_idx').on(t.workspaceId, t.initiatedAt),
  // One open placement per broker and unit: a second press finds the first.
  uniqueIndex('tenant_placements_open_unit_uk').on(t.brokerId, t.unitId).where(sql`${t.status} = 'initiated' AND ${t.unitId} IS NOT NULL`),
]);


// ===========================================================================
// Shared: MESSAGING (§6.7)
// ===========================================================================

// Defined here rather than in its interface-* file because maintenance_tickets.asset_id references it: a base schema file never imports an
// interface one, which is what made the import cycles the api-cycles ratchet refused.
/** Equipment the property maintains (an ice machine, a projector, a generator), where it stands. */
export const assets = pgTable(
  'assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    roomId: uuid('room_id').references(() => rooms.id, { onDelete: 'set null' }),
    spaceId: uuid('space_id').references(() => spaces.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    kind: text('kind'),
    model: text('model'),
    installedOn: date('installed_on'),
    ...timestamps,
  },
  (t) => [index('assets_property_idx').on(t.propertyId), index('assets_workspace_idx').on(t.workspaceId)],
);

// Defined here rather than in its interface-* file because a residence row's visitor_pass_id references it: a base schema file never imports an
// interface one, which is what made the import cycles the api-cycles ratchet refused.
/**
 * A gate code: who may come in, to which unit, between when and when.
 *
 * A code is four digits and unique among the codes still in use at the building (`expected` or
 * `approved`), which the partial index holds when two people ask at once. A used or expired code may
 * come round again. A management pass for a vacant unit has no lease.
 */
export const visitorPasses = pgTable(
  'visitor_passes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id),
    leaseId: uuid('lease_id').references(() => leases.id),
    /** The repair a contractor's pass was arranged for. */
    maintenanceTicketId: uuid('maintenance_ticket_id').references(() => maintenanceTickets.id, {
      onDelete: 'set null',
    }),
    kind: text('kind').notNull().default('guest'),
    visitorName: text('visitor_name').notNull(),
    code: text('code').notNull(),
    validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
    validTo: timestamp('valid_to', { withTimezone: true }).notNull(),
    overnight: boolean('overnight').notNull().default(false),
    status: text('status').notNull().default('expected'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    /** Registered by the tenant rather than by management. */
    byTenant: boolean('by_tenant').notNull().default(false),
    usedAt: timestamp('used_at', { withTimezone: true }),
    leftAt: timestamp('left_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('visitor_passes_live_code_uk')
      .on(t.propertyId, t.code)
      .where(sql`${t.status} IN ('expected', 'approved')`),
    index('visitor_passes_scope_status_idx').on(t.workspaceId, t.status, t.validFrom),
    index('visitor_passes_lease_idx').on(t.leaseId),
    check('visitor_passes_window', sql`${t.validTo} > ${t.validFrom}`),
    check('visitor_passes_code_shape', sql`${t.code} ~ '^[0-9]{4}$'`),
    check('visitor_passes_kind_known', sql`${t.kind} IN ('guest', 'contractor')`),
    check('visitor_passes_status_known', sql`${t.status} IN ('expected', 'approved', 'used', 'expired', 'revoked')`),
  ],
);
