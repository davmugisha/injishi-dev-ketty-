/**
 * every pgEnum (§4-§10).
 *
 * Carved out of the single 3,956-line `schema.ts` along the section headers
 * that file already carried. Every declaration below is byte-identical to the
 * one it replaced; only the import lines are new. `schema.ts` re-exports this
 * module, so `drizzle.config.ts`, every migration and every importer still see
 * one schema at one path.
 */
import {
  DepositRefundMethod,
  IdKind,
  LeaseActorRole,
  LeaseChargeKind,
  LeaseChargeStatus,
  LeaseDepositStatus,
  LeaseEventKind,
  LeasePaymentChannel,
  LeasePaymentMethod,
  LeasePaymentStatus,
  LeaseReminderChannel,
  LeaseReminderKind,
  LeaseSigningMethod,
  LeaseStatus,
  RentalUnitState,
  TaxpayerKind,
  UnitKitchen,
} from '@injishi/contracts';
import {
  pgEnum,
} from 'drizzle-orm/pg-core';

// §4 identity / access / org
export const globalRoleEnum = pgEnum('global_role', [
  'admin',
  'guest',
  'broker',
  // Renamed from `local_gov` (Decision B): "has a government console seat".
  // RRA tax compliance is national, not local - the old name was too narrow.
  // The specific oversight function comes from `oversight_assignments`.
  'gov_oversight',
]);

export const orgRoleEnum = pgEnum('org_role', [
  'owner',
  'manager',
  'receptionist',
  // ADR-069 D-a: the accountant and the HR officer, each with a default set of
  // its own rather than a manager's. Migration 0063 adds both `BEFORE
  // 'housekeeper'`, so the database lists the roles in the order
  // `@injishi/contracts` does.
  'finance',
  'hr',
  // Spec 0002 (D-b): the operator app has always shipped a housekeeper role
  // driving its own surface (the housekeeping phone, not a desktop), while this
  // enum stopped at `receptionist`. Promoting the database closes that drift.
  // `mfp-demo.md` treats Housekeeper as a permission ROLE, separate from the
  // person's POSITION ("Room attendant"), which is why it belongs here.
  'housekeeper',
]);

export const workspaceKindEnum = pgEnum('workspace_kind', [
  'business',
  'broker',
  'personal',
]);

/** hospitality | residence - reused for orgs.domain, room_types.domain, support_tickets.domain. */
export const domainKindEnum = pgEnum('domain_kind', [
  'hospitality',
  'residence',
]);

export const rdbClassificationKindEnum = pgEnum('rdb_classification_kind', [
  'entity_group',
  'accommodation_class',
  'residence_class',
]);

export const orgRegistrationStatusEnum = pgEnum('org_registration_status', [
  // D23: the entry state. An org is created here, and the one-time registration
  // fee settling is the ONLY exit — which is what keeps unpaid registrations out
  // of a government officer's queue. A `rejected` org resubmits to `submitted`,
  // never back to here: the fee is once per org, ever (see subscription_invoices).
  'pending_payment',
  'submitted',
  'tin_verified',
  // Oversight gates (Decision B) inserted between tin_verified and active.
  // Whether they BLOCK activation or are advisory is a per-district
  // `feature_flags` policy (spec §5), not a schema concern.
  'field_verified',
  'approved',
  'active',
  'rejected',
  'suspended',
]);

/**
 * Who moved a registration (ADR-053, AC-R6).
 *
 * The calling SURFACE, not a person's role: a registrant route writes
 * `registrant`, an oversight route `officer`, an admin route `staff`, and the
 * TIN adapter and its retry sweep `system` with no actor at all.
 */
export const registrationTransitionTriggerEnum = pgEnum(
  'registration_transition_trigger',
  ['registrant', 'officer', 'staff', 'system'],
);

/**
 * A membership's lifecycle (ADR-053, AC-R10).
 *
 * It was free `text` carrying these two words, the only lifecycle column on the
 * registration path that the database did not enumerate, so a typo in a write
 * produced a membership that was neither active nor removed.
 */
export const orgMembershipStatusEnum = pgEnum('org_membership_status', [
  'active',
  'removed',
]);

/** sent | accepted | expired | revoked - reused by org_invitations & lease_invitations. */
export const invitationStatusEnum = pgEnum('invitation_status', [
  'sent',
  'accepted',
  'expired',
  'revoked',
]);

export const invitationPurposeEnum = pgEnum('invitation_purpose', [
  'staff',
  'obo_claim',
]);

export const oboClaimStatusEnum = pgEnum('obo_claim_status', [
  'registrant_held',
  'owner_claimed',
  'expired',
]);

/** mock | live - shared adapter mode. */
export const adapterModeEnum = pgEnum('adapter_mode', ['mock', 'live']);

/**
 * Where one press of confirm got to, on a rail that answers asynchronously
 * (ADR-047 D-j).
 *
 * Every Rwandan mobile money rail works the same way: the provider accepts the
 * instruction, pushes a prompt to a handset, and the customer leaves our app to
 * approve it in the MoMo app or on `*182#`. The answer arrives later, by
 * callback. So there is a real state between "asked" and "paid", and it needs a
 * name and a row — not a 402 and a message telling the guest to press the
 * button again.
 *
 * `unknown` is deliberately absent. A row is `prompting` until something
 * ANSWERS: a provider callback, a poll that reads settled, or the sweep that
 * expires it. "We do not know yet" is what `prompting` already means, and a
 * second name for it would let a caller treat not-knowing as an outcome.
 */
export const paymentAttemptStateEnum = pgEnum('payment_attempt_state', [
  /** Accepted by the provider, waiting on a person and their handset. */
  'prompting',
  /** Settled, and the booking behind it is written. */
  'confirmed',
  /** The provider or the customer said no. Nothing was taken. */
  'refused',
  /** Nobody answered inside the window. Voided or refunded. */
  'expired',
]);

/**
 * What a payment attempt pays for (ADR-050 catalog child, D-n amended).
 *
 * The table was built for bookings, and a pay now order waits on a handset in
 * exactly the same way. One table with a purpose rather than a sibling, because
 * two copies of the poll and the sweep would drift. Completion branches on it.
 */
export const paymentAttemptPurposeEnum = pgEnum('payment_attempt_purpose', [
  'booking',
  'service_order',
]);

export const tinVerificationResultEnum = pgEnum('tin_verification_result', [
  'pending',
  'verified',
  'failed',
]);


/** D25: what a government officer decided at one gate. */
export const registrationReviewDecisionEnum = pgEnum(
  'registration_review_decision',
  ['passed', 'rejected'],
);


/**
 * D25: why a registration was refused, as a CODE rather than free prose.
 *
 * Coded because F-S03 §6 promises a resumable rejection: the registrant has to
 * be told which part to correct, and a paragraph typed by an officer cannot
 * drive a form back to the right step. `other` keeps the free-text escape, and
 * `notes` carries the officer's own words either way.
 */
export const registrationRejectionReasonEnum = pgEnum(
  'registration_rejection_reason',
  [
    'tin_not_found',
    'tin_mismatch',
    'premises_not_found',
    'documents_invalid',
    'documents_expired',
    'not_operating',
    'ownership_unclear',
    'duplicate_business',
    'other',
  ],
);


// D24 — registration form fields.
//
// `prefer_not_to_say` is a RECORDED ANSWER and is deliberately distinct from
// NULL, which means the question was never asked. Reporting needs to tell those
// two apart, and a nullable boolean cannot.
export const genderEnum = pgEnum('gender', [
  'female',
  'male',
  'other',
  'prefer_not_to_say',
]);


/**
 * The documents a business attaches to its registration (D24, §4.3a).
 * A list, not columns: the form offers "add other certificates", so the tail is
 * open and a column per certificate type would need a migration per form.
 */
/** Whether a business document exists yet: asked of its issuer, or on file (Compliance → Licences). */
export const orgCertificateStatusEnum = pgEnum('org_certificate_status', ['requested', 'on_file']);

export const orgCertificateKindEnum = pgEnum('org_certificate_kind', [
  'rdb_grade',
  'tourism_license',
  'tax_clearance',
  'fire_safety',
  'health_inspection',
  'other',
  // The registration artboard's rows (2026-10-19): the RDB certificate, the
  // PSF certificate, and a residence's land title.
  'rdb_certificate',
  'psf_certificate',
  'land_title',
]);


// §4.2 identity layer (Decision A) — KYC state + document lifecycle.
export const kycStatusEnum = pgEnum('kyc_status', [
  'unverified',
  'pending',
  'verified',
  'rejected',
]);

export const identityDocumentStatusEnum = pgEnum('identity_document_status', [
  'active',
  'superseded',
]);


// §4.4 government oversight (Decision B) — stable function enum + scope level.
// The APPROVAL PIPELINE BRANCHES on oversight_role, so it is an enum (stable),
// while the government BODY is an admin-managed catalog (no migration to add one).
export const oversightRoleEnum = pgEnum('oversight_role', [
  'tax_compliance_officer',
  'business_field_verifier',
  'business_approver',
  // ADR-056: decides PSF membership applications. Posted at the PSF body with
  // country scope only (OVERSIGHT_ROLE_POSTING in @injishi/contracts).
  'psf_membership_officer',
]);

export const oversightScopeLevelEnum = pgEnum('oversight_scope_level', [
  'country',
  'province',
  'district',
]);


// §5 inventory
export const roomStatusEnum = pgEnum('room_status', [
  'available',
  'maintenance',
  'out_of_service',
]);

export const bookingModeEnum = pgEnum('booking_mode', [
  'instant_book',
  'request_to_book',
]);

export const approvalPolicyEnum = pgEnum('approval_policy', [
  'approve_all',
  'approve_first_three',
]);

export const cancellationTierEnum = pgEnum('cancellation_tier', [
  'flexible',
  'moderate',
  'limited',
  'firm',
  'strict_extended_stay',
]);

export const checkInMethodEnum = pgEnum('check_in_method', [
  'front_desk',
  'smart_lock',
  'keypad',
  'lockbox',
]);

export const listingStatusEnum = pgEnum('listing_status', [
  'draft',
  'published',
]);

export const roomTypeStatusEnum = pgEnum('room_type_status', [
  'active',
  'archived',
]);


// §5.8 listing inventory (F-L03/F-L04/F-L09) - the rate-plan + bed model.
/** A rate plan retires like a room type: soft, snapshot retained. */
export const ratePlanStatusEnum = pgEnum('rate_plan_status', [
  'active',
  'archived',
]);

/**
 * How a child rate plan derives from its parent (F-L03 "rate relations", e.g.
 * Non-refundable = Flexible - 10%). NOT to be confused with occupancy offsets
 * (F-L05), which the industry also calls "derived" - a documented collision.
 */
export const rateDerivationKindEnum = pgEnum('rate_derivation_kind', [
  'percentage',
  'fixed_amount',
]);

/**
 * Housekeeping state (F-L09 / F-P04). ORTHOGONAL to `rooms.status`: a checkout
 * makes a room `dirty` without taking it out of service.
 */
export const housekeepingStatusEnum = pgEnum('housekeeping_status', [
  'clean',
  'dirty',
  'inspected',
  'out_of_order',
]);


// §6 hospitality
export const bookingStatusEnum = pgEnum('booking_status', [
  'pending_approval',
  'confirmed',
  'declined',
  'cancelled',
  'no_show',
]);

export const declineReasonEnum = pgEnum('decline_reason', [
  'host_declined',
  'expired',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'captured',
  'refunded_full',
  'refunded_partial',
  'forfeited',
  'paid_out',
]);

export const checkInModeEnum = pgEnum('check_in_mode', ['staffed', 'self']);

export const stayLifecycleEnum = pgEnum('stay_lifecycle', ['open', 'closed']);

export const claimStatusEnum = pgEnum('claim_status', ['unclaimed', 'claimed']);

export const reviewSideEnum = pgEnum('review_side', [
  'guest_to_host',
  'host_to_guest',
]);

export const documentTypeEnum = pgEnum('document_type', [
  'national_id',
  'passport',
  'other',
]);

export const collectionVisibilityEnum = pgEnum('collection_visibility', [
  'private',
  'shared',
]);

/**
 * §14.8. A `department_request` thread is scoped to a guest's occupancy AND a
 * department, so one stay can hold several threads, one per department
 * contacted. The existing `threads_scope_exactly_one` check is untouched: the
 * department is a second axis, not a fourth subject.
 */
export const threadKindEnum = pgEnum('thread_kind', [
  'reservation',
  'department_request',
  'dispute',
]);


export const threadStatusEnum = pgEnum('thread_status', ['active', 'archived']);

export const messageBodyTypeEnum = pgEnum('message_body_type', [
  'text',
  'image',
  'voice',
  // ADR-050 D-s: a line the platform writes, such as an order's status change.
  // It has no sender and never counts as a staff reply.
  'system',
  // Rentals (migration 0073): a document sent in a lease or placement thread.
  'file',
]);

export const storedObjectKindEnum = pgEnum('stored_object_kind', [
  'id_photo',
  'contract',
  'message_attachment',
  'avatar',
  'property_photo',
  'filing_copy',
  // D24: an org's registration documents ride the same retention and legal-hold
  // machinery as every other stored object rather than a private upload path.
  'certificate',
  // ADR-049: a training certificate PDF. A SEPARATE kind from 'certificate',
  // which is a document a business uploads ABOUT itself. This one is a document
  // the platform issues about a person, is never uploaded by anybody, and is
  // reachable only by its holder or by staff through a signed url. Sharing one
  // kind would put the two under one retention rule and one access rule, and
  // they need neither in common.
  'training_certificate',
  // ADR-058, the people file. Three kinds because they are read by three
  // different sets of people: a photo is a work field anyone reading files
  // may see, a document is `people.manage` only, and an attachment follows the
  // record it hangs on (a note, a policy, an announcement, a disciplinary act).
  'staff_photo',
  'staff_document',
  'hr_attachment',
  // 058-payroll: a bank or MoMo file, or a PAYE or RSSB declaration. Wages and
  // account numbers: `payroll.run` only, never shown to the person.
  'hr_pay_file',
  // Rentals (migration 0073). A unit's photos and video tour; a signer's drawn
  // signature; a lease's contract PDF (plain and signed, under legal hold); a
  // recorded payment's slip; the proof a lease was filed with RRA.
  'unit_photo',
  'unit_video',
  'lease_signature',
  'lease_contract',
  'payment_receipt',
  'filing_proof',
]);


// §7 residence
/**
 * Where a lease stands: `LeaseStatus` in contracts (rentals vocab). Migration
 * 0077 swapped the type to add `signed` (both sides signed, not started yet).
 */
export const leaseStatusEnum = pgEnum('lease_status', LeaseStatus.options);

export const signerRoleEnum = pgEnum('signer_role', ['landlord', 'tenant']);

export const cautionStatusEnum = pgEnum('caution_status', [
  'held',
  'refunded',
  'forfeited',
]);

export const renewalStatusEnum = pgEnum('renewal_status', [
  'pending',
  'approved',
  'rejected',
]);

/**
 * ADR-016 D16. Widened from , which could not express a ticket
 * somebody had picked up, and had no way to say a ticket was raised in error.
 */
export const maintenanceStatusEnum = pgEnum('maintenance_status', [
  'open',
  'assigned',
  'in_progress',
  'resolved',
  'closed',
  'cancelled',
]);

export const maintenanceCategoryEnum = pgEnum('maintenance_category', [
  'plumbing',
  'electrical',
  'hvac',
  'appliance',
  'furniture',
  'it_tech',
  'safety',
  'other',
  // A residence's repairs (real-data 1.3.1): locks, doors and windows; a repaint before letting.
  'doors_windows',
  'decoration',
]);

export const maintenancePriorityEnum = pgEnum('maintenance_priority', [
  'low',
  'normal',
  'high',
  'urgent',
]);

/** Who raised it, which is not the same question as what role they hold. */
export const maintenanceRaisedByRoleEnum = pgEnum('maintenance_raised_by_role', [
  'guest',
  'tenant',
  'staff',
  'housekeeper',
]);

export const brokerStatusEnum = pgEnum('broker_status', [
  'active',
  'suspended',
]);

export const placementStatusEnum = pgEnum('placement_status', [
  'initiated',
  'converted',
  'abandoned',
  'unavailable',
]);

export const filingStatusEnum = pgEnum('filing_status', [
  'pending',
  'filed',
  'failed',
]);


// §7b rentals (blueprint 1.1, migrations 0074-0080).
//
// Every rentals status and kind is a zod enum in
// `packages/contracts/src/rentals/vocab.ts`, and the database type is built
// from its `.options`, so the API, the apps and Postgres hold one list.
// `rentals-vocab.spec.ts` fails the build if a type and its zod list drift.
// To add a value: add it to vocab.ts, then a migration (ADD VALUE when nothing
// in the same run uses it; otherwise swap the type, see migration 0077).
export const rentalUnitStateEnum = pgEnum('rental_unit_state', RentalUnitState.options);
export const unitKitchenEnum = pgEnum('unit_kitchen', UnitKitchen.options);
export const idKindEnum = pgEnum('id_kind', IdKind.options);
export const taxpayerKindEnum = pgEnum('taxpayer_kind', TaxpayerKind.options);
export const leaseSigningMethodEnum = pgEnum('lease_signing_method', LeaseSigningMethod.options);
export const leaseActorRoleEnum = pgEnum('lease_actor_role', LeaseActorRole.options);
export const leaseEventKindEnum = pgEnum('lease_event_kind', LeaseEventKind.options);
export const leaseChargeKindEnum = pgEnum('lease_charge_kind', LeaseChargeKind.options);
export const leaseChargeStatusEnum = pgEnum('lease_charge_status', LeaseChargeStatus.options);
export const leasePaymentChannelEnum = pgEnum('lease_payment_channel', LeasePaymentChannel.options);
export const leasePaymentMethodEnum = pgEnum('lease_payment_method', LeasePaymentMethod.options);
export const leasePaymentStatusEnum = pgEnum('lease_payment_status', LeasePaymentStatus.options);
export const leaseDepositStatusEnum = pgEnum('lease_deposit_status', LeaseDepositStatus.options);
export const depositRefundMethodEnum = pgEnum('deposit_refund_method', DepositRefundMethod.options);
export const leaseReminderKindEnum = pgEnum('lease_reminder_kind', LeaseReminderKind.options);
export const leaseReminderChannelEnum = pgEnum('lease_reminder_channel', LeaseReminderChannel.options);


// §8 money
export const ledgerAccountTypeEnum = pgEnum('ledger_account_type', [
  'asset',
  'liability',
  'revenue',
  'clearing',
]);

export const ledgerTxnKindEnum = pgEnum('ledger_txn_kind', [
  'capture',
  'refund',
  'forfeiture',
  'payout',
  'rent_settle',
  'caution_settle',
  'placement_disburse',
  'subscription_charge',
  'override',
  'chargeback',
  /**
   * ADR-016 D-o. A folio charge posting to its account, and a folio payment
   * posting cash. Without these two no folio event is representable at all:
   * `ledger_entries.transaction_id` is NOT NULL and every value above
   * describes something other than a guest bill, so the money path stopped at
   * a column nobody had looked at.
   */
  'folio_post',
  'folio_settle',
]);

export const escrowSourceEnum = pgEnum('escrow_source', ['booking', 'caution']);

export const escrowStatusEnum = pgEnum('escrow_status', [
  'held',
  'released',
  'refunded_full',
  'refunded_partial',
  'forfeited',
]);

export const payoutPayeeTypeEnum = pgEnum('payout_payee_type', [
  'host',
  'landlord',
  'broker',
  // Rentals (migration 0073): a deposit refunded to a tenant, a fixer paid by a landlord.
  'tenant',
  'vendor',
]);

export const payoutDestinationEnum = pgEnum('payout_destination', [
  'momo',
  'bank',
  // Rentals (migration 0073): a landlord's MoMo Pay merchant code.
  'momo_pay',
]);

export const payoutSourceEnum = pgEnum('payout_source', [
  'booking',
  'rent',
  'placement_fee',
  // Rentals (migration 0073).
  'deposit_refund',
  'repair',
]);

export const payoutStatusEnum = pgEnum('payout_status', [
  'scheduled',
  'queued',
  'paid',
  'held',
  // Rentals (migration 0073): the rail refused the transfer.
  'failed',
]);

export const planBillingPeriodEnum = pgEnum('plan_billing_period', ['monthly']);

/** The three registration paths a registrant picks between (D21 §8.3a). */
export const registrationBusinessTypeEnum = pgEnum(
  'registration_business_type',
  ['hospitality', 'residence', 'broker'],
);

/**
 * What a `subscription_invoices` row is for (D21). Despite the table's name it
 * is the org's whole invoice ledger — a registration fee needs exactly the same
 * amount / pending→paid→failed retry / EBM-under-Injishi-TIN machinery, so two
 * columns beat a second table duplicating all of it.
 */
export const invoiceKindEnum = pgEnum('invoice_kind', [
  'registration_fee',
  'subscription',
]);

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'trialing',
  'active',
  'past_due',
  'canceled',
  'suspended',
]);

export const subscriptionInvoiceStatusEnum = pgEnum(
  'subscription_invoice_status',
  ['pending', 'paid', 'failed'],
);

export const placementFeeStatusEnum = pgEnum('placement_fee_status', [
  'pending',
  'disbursed',
]);

/**
 * Where a fiscal document comes from (ADR-050 D-a).
 *
 * `booking` is the prepayment, which under `EBM_SIGN_AT=checkout` raises a
 * proforma rather than a sale. `folio` is the stay's bill, signed once at
 * close. `outlet_order` is a sale that stands on its own: a pay now order, or a
 * tenant outlet declaring its own turnover at fulfilment.
 */
export const ebmSourceEnum = pgEnum('ebm_source', [
  'booking',
  'subscription',
  'folio',
  'outlet_order',
]);

/**
 * §15's receipt types (ADR-050 D-e).
 *
 * There is deliberately NO `copy` value. A copy has no VSDC answer of its own,
 * so a row for one could never reach `emitted`. `CS` and `CR` are render time
 * labels, counted in `ebm_receipt_copies`, never rows here.
 */
export const ebmReceiptTypeEnum = pgEnum('ebm_receipt_type', [
  'normal',
  'training',
  'proforma',
]);

/** Sale or refund. Immutable after insert (ADR-050 D-d). */
export const ebmTransactionTypeEnum = pgEnum('ebm_transaction_type', [
  'sale',
  'refund',
]);

export const tinTypeEnum = pgEnum('tin_type', ['host', 'injishi']);

export const ebmStatusEnum = pgEnum('ebm_status', [
  'emitted',
  'held',
  'failed',
]);

/**
 * A business's link to its RRA EBM account (ADR-041). There is no
 * `not_connected` value: a business that never connected has no row, and
 * inventing a row to say so would make "absent" and "set up then removed"
 * look the same.
 */
export const ebmConnectionStatusEnum = pgEnum('ebm_connection_status', [
  'connected',
  'revoked',
]);

export const taxCodeEnum = pgEnum('tax_code', [
  'TAX_A',
  'TAX_B',
  'TAX_C',
  'TAX_D',
]);

export const reconciliationStatusEnum = pgEnum('reconciliation_status', [
  'clean',
  'discrepancies_flagged',
]);

export const moneyOverrideActionEnum = pgEnum('money_override_action', [
  'force_refund',
  'retarget_payout',
  'force_release',
  'write_off',
  'reverse',
]);

export const moneyOverrideStateEnum = pgEnum('money_override_state', [
  'initiated',
  'approved',
  'applied',
]);


// §9 events / notifications
export const domainEventTypeEnum = pgEnum('domain_event_type', [
  'booking_request_received',
  'booking_approved',
  'booking_declined',
  'booking_expired',
  'booking_cancelled',
  'booking_no_show',
  'stay_checkin_reminder',
  'stay_checkout_reminder',
  'review_request',
  'review_window_closed',
  'payment_captured',
  'payment_payout_sent',
  'payment_refund_processed',
  'payment_placement_fee_disbursed',
  'messaging_new_message',
  'onboarding_tin_result',
  'onboarding_activation_result',
  'onboarding_rejection_reason',
  'lease_signing_invitation',
  'lease_move_out_notice',
  'lease_renewal_decision',
  /**
   * ADR-050 D-v. The realtime gateway's six event names, dotted because the
   * name IS the channel a client subscribes to. Every one is written to
   * `outbox_events` in the same transaction as the change it reports; nothing
   * publishes to Redis directly, so a client that misses a frame re-reads and
   * is correct.
   */
  'order.status',
  'thread.message',
  'housekeeping.task',
  'folio.balance',
  'ebm.health',
  'ebm.sale',
  /**
   * ADR-058 058-reports-automations AC-AU1: the closed list of HR triggers, all
   * added at once in their own migration (0058) so every HR slice writes its
   * events as it is built and the delivery slice only adds rules. Ids only in
   * the payload, as every outbox row. The realtime fan out ignores them.
   */
  'leave.requested',
  'leave.step2_pending',
  'leave.decided',
  'allocation.decided',
  'roster.published',
  'roster.changed',
  'shift_request.decided',
  'swap.requested',
  'attendance.flagged',
  'attendance_request.decided',
  'document.requested',
  'document.expiring',
  'contract.ending',
  'payslip.confirmed',
  'claim.decided',
  'pay_account.changed',
  'ticket.created',
  'ticket.status_changed',
  'interview.scheduled',
  'offer.sent',
  'onboarding.link_sent',
  'resignation.decided',
  'asset.expiring',
  'announcement.published',
  'feedback.requested',
  'exit_task.assigned',
  'onboarding_task.assigned',
  /**
   * Rentals (migration 0073, blueprint 2.8): written to the outbox in the same
   * transaction as the change, fanned out to in-app, email and the live
   * connection. Faults, guests and broker plans add theirs with their phases.
   */
  'lease.sent',
  'lease.signed',
  'lease.activated',
  'lease.ending',
  'lease.ended',
  'rent.charged',
  'rent.reminder',
  'rent.paid',
  'rent.payment_failed',
  'payout.paid',
  'payout.failed',
  'notice.filed',
  'notice.acknowledged',
  'deposit.settled',
]);

export const notificationCategoryEnum = pgEnum('notification_category', [
  'booking',
  'payment',
  'stay',
  'review',
  'message',
  'lease',
  'onboarding',
  'subscription',
  'moderation',
  'system',
  'announcement',
]);

export const notificationChannelEnum = pgEnum('notification_channel', [
  'in_app',
  'email',
]);

export const notificationDeliveryStatusEnum = pgEnum(
  'notification_delivery_status',
  ['pending', 'sent', 'failed'],
);

export const outboxStatusEnum = pgEnum('outbox_status', [
  'pending',
  'dispatched',
  'failed',
]);


// §10 admin / governance
export const staffRoleEnum = pgEnum('staff_role', [
  'super_admin',
  'ops',
  'compliance',
  'finance',
  // ADR-049: the narrowest staff role in the system. A trainer holds four
  // training powers and no `admin.*` power at all, which is exactly why the
  // console needed a per-section route guard: sidebar hiding was enough while
  // every staff role could safely see every section.
  'trainer',
]);

export const auditSubjectTypeEnum = pgEnum('audit_subject_type', [
  'user',
  'org',
  'lease',
  'booking',
  'payment',
  'config',
  // ADR-009: publishing and unpublishing change what the public can see and
  // what money can be taken for, so both write an audit row. Without this value
  // there is no honest way to name the subject of that row.
  'property',
  // The admin console's write actions (migration 0029). Suspending a broker was
  // filed as `user` with the broker's USER id, and re-issuing a stay's claim
  // code wrote a null subject type — so "every audit row about this broker"
  // could only be answered by reading the payload, and a stay's rows could not
  // be found by subject at all. An audit trail you cannot query by subject is a
  // log, not a trail.
  'broker',
  'guest_stay',
  // ADR-049: issuing and withdrawing a training certificate are both audited
  // (AC-22), and they need a subject type of their own. Filing them as `user`
  // with the holder's id is precisely the mistake the paragraph above records
  // for brokers: "every audit row about this certificate" would then only be
  // answerable by reading payloads. The subject is the certificate, so the
  // subject type names one.
  'training_certificate',
  // ADR-058 AC-U5: every person initiated HR action is audited against the
  // file it touched, and a bulk pay run action against the run.
  'employee',
  'pay_run',
  // Rentals (migration 0073): a tenant record, a unit, where rent is paid out,
  // and a deposit settlement are each audited against themselves.
  'tenant',
  'rental_unit',
  'payout_account',
  'deposit',
]);

export const recordDataClassEnum = pgEnum('record_data_class', [
  'national_id',
  'id_photo',
  'contract',
  'stay_identity',
  'contact',
]);

export const adapterNameEnum = pgEnum('adapter_name', [
  'payment',
  'ebm_vsdc',
  'rra_tin',
  'filing',
  'mailer',
  'maps',
]);

export const adapterStatusEnum = pgEnum('adapter_status', [
  'up',
  'degraded',
  'down',
]);

export const flagScopeEnum = pgEnum('flag_scope', ['global', 'district']);

export const escalationSubjectTypeEnum = pgEnum('escalation_subject_type', [
  'user',
  'org',
  'lease',
  'booking',
  'listing',
  'review',
  'message',
  'payment',
]);

export const escalationTypeEnum = pgEnum('escalation_type', [
  'dispute',
  'policy_violation',
  'off_platform_leakage',
  'listing_non_compliance',
  'review_abuse',
]);

export const escalationStateEnum = pgEnum('escalation_state', [
  'open',
  'resolved',
]);

export const announcementStateEnum = pgEnum('announcement_state', [
  'draft',
  'published',
]);

export const complianceArtifactTypeEnum = pgEnum('compliance_artifact_type', [
  'ncsa_registration',
  'dpo_of_record',
  'dpia',
  'processor_inventory_entry',
]);

export const dsrRequestTypeEnum = pgEnum('dsr_request_type', [
  'access',
  'correction',
  'deletion',
]);

export const dsrStateEnum = pgEnum('dsr_state', ['received', 'fulfilled']);

export const supportTicketStateEnum = pgEnum('support_ticket_state', [
  'open',
  'resolved',
  'reopened',
  'closed',
]);

export const translationStatusEnum = pgEnum('translation_status', [
  'translated',
  'missing',
  'needs_review',
]);

// ===========================================================================
// §4.1  AUTH  (owned by Better Auth; defined here with uuid ids as FK targets)
// ===========================================================================

/**
 * Which channel a sign-in code was spent on (ADR-039): the send cap's ledger
 * (`auth_otp_requests`) is keyed by identifier AND channel, so SMS and email
 * budgets for one person are counted apart.
 */
export const otpChannelEnum = pgEnum('otp_channel', ['sms', 'email']);

/** Where a phone link challenge stands (ADR-039). Mirrors `PhoneLinkStage` in @injishi/auth. */
export const phoneLinkStageEnum = pgEnum('phone_link_stage', [
  'sms_sent',
  'phone_proved',
  'email_sent',
]);

// ===========================================================================
// ADR-049  TRAINING, LIVE ATTENDANCE AND THE DIGITAL CERTIFICATE
// ===========================================================================

/**
 * A session's life.
 *
 * `draft` is a trainer's proposal and never appears publicly. `published` is
 * the only state `/training` shows, and only a platform admin holding
 * `training.session.publish` reaches it. `cancelled` is terminal. `completed`
 * is what closing the roster leaves behind.
 *
 * There is deliberately NO value for an online session, here or anywhere: a
 * session is a time, a venue and a trainer, and making one joinable over a link
 * would be a migration and a decision rather than a field somebody slips in.
 */
export const trainingSessionStatusEnum = pgEnum('training_session_status', [
  'draft',
  'published',
  'cancelled',
  'completed',
]);

/**
 * A registration's life.
 *
 * `withdrawn` and `released` are separate values on purpose: the first is the
 * learner pulling out, the second is the company cancelling the session under
 * them. Collapsing them would tell somebody they changed their mind when they
 * did not.
 */
export const trainingRegistrationStatusEnum = pgEnum(
  'training_registration_status',
  ['registered', 'attended', 'absent', 'withdrawn', 'released'],
);

/** Whether a person registered themselves or a trainer added them in the room. */
export const trainingRegistrationSourceEnum = pgEnum(
  'training_registration_source',
  ['self', 'walk_in'],
);

/**
 * One trainer's decision about one registrant.
 *
 * Two values and no `unknown`: a registrant nobody has decided about has no
 * row, which is a different fact from a row that says nothing. Closing the
 * roster is what turns every missing row into an `absent` one.
 */
export const trainingAttendanceDecisionEnum = pgEnum(
  'training_attendance_decision',
  ['present', 'absent'],
);

// ===========================================================================
// §6.8  THE GUEST'S OWN STAY  (claiming it, asking for money back, an offer)
// ===========================================================================

/**
 * Where one request for money back has got to.
 *
 * `submitted` is the guest asking. `approved` and `rejected` are the property
 * answering, and both are terminal — a rejected request is not re-opened, the
 * guest raises a new one, so the decision that was made stays on the record
 * next to the words it was made with. `withdrawn` is the guest changing their
 * mind, which is a different fact from the property refusing and must not be
 * filed as one.
 *
 * There is deliberately no `paid` value. Money moving is the payment rail's
 * fact and it is recorded on the booking and in the ledger; a second copy here
 * would be a second answer to "was this refunded".
 */
export const stayRefundStateEnum = pgEnum('stay_refund_state', [
  'submitted',
  'approved',
  'rejected',
  'withdrawn',
]);

/**
 * Why the GUEST says they are owed money, as a code rather than only prose.
 *
 * Coded because the reason decides which house rule answers it: an overcharge
 * is a bill question and a noise complaint is a service one, and a property
 * that can only read paragraphs cannot route either. `other` keeps the escape
 * hatch, and `detail` carries the guest's own words in every case.
 */
export const stayRefundReasonEnum = pgEnum('stay_refund_reason', [
  'service_failure',
  'room_not_as_described',
  'cleanliness',
  'noise',
  'maintenance_unresolved',
  'overcharged',
  'early_departure',
  'changed_plans',
  'other',
]);

/**
 * Why the PROPERTY refused, as a code (the mirror of D25's rejection reasons).
 *
 * A refusal a guest cannot act on is a refusal they escalate. Each value names
 * a rule of the accommodation that the guest was told about before they paid —
 * the rate they picked, the window they were inside, the nights they slept —
 * so the answer can be worded as the rule rather than as an opinion, and so a
 * dispute can be argued about the rule instead of about the staffer.
 */
export const stayRefundRefusalReasonEnum = pgEnum(
  'stay_refund_refusal_reason',
  [
    'non_refundable_rate',
    'outside_cancellation_window',
    'nights_already_consumed',
    'no_show_policy',
    'house_rules_breach',
    'damage_to_property',
    'third_party_booking',
    'not_reported_during_stay',
    'duplicate_request',
    'other',
  ],
);

/** An offer's life. Soft retirement, because a redemption history outlives it. */
export const offerStatusEnum = pgEnum('offer_status', [
  'draft',
  'active',
  'archived',
]);

/** A percentage off, or a flat number of francs off. */
export const offerDiscountKindEnum = pgEnum('offer_discount_kind', [
  'percentage',
  'fixed_amount',
]);

/**
 * What the money comes off.
 *
 * `room` discounts the accommodation, `service` a department's charges (room
 * service, the spa), `folio` the whole bill. The scope is what decides which
 * charge line the discount posts against, which decides which department's
 * declared revenue it reduces — so it is a fiscal choice, not a label.
 */
export const offerScopeEnum = pgEnum('offer_scope', [
  'room',
  'service',
  'folio',
]);

/**
 * Who may take it.
 *
 * `anyone` is a public offer, readable by a stranger browsing the property.
 * `in_house` is for guests who are actually in the building tonight, which is
 * the one a hotel uses to fill its restaurant. The distinction is enforced
 * server-side on redemption, never only in what is listed.
 */
export const offerAudienceEnum = pgEnum('offer_audience', [
  'anyone',
  'in_house',
]);

/**
 * ADR-056  PSF MEMBERSHIP APPLICATION.
 *
 * The membership families and the shape of a tier's price are enums because
 * the form branches on them; the tiers themselves are catalogue rows admin
 * edits (`psf_membership_tiers`), so a new price is never a migration.
 */
export const psfMembershipFamilyEnum = pgEnum('psf_membership_family', [
  'golden_circle',
  'indashyikirwa',
  'ordinary',
  'junior_giants',
]);

/** A fixed amount, a min to max range, or a price only PSF can quote. */
export const psfPriceKindEnum = pgEnum('psf_price_kind', [
  'fixed',
  'range',
  'set_by_psf',
]);

/**
 * `submitted` is the only open state; the other three are terminal. Applying
 * again writes a new row, so a decision is never overwritten by a later one.
 */
export const psfApplicationStatusEnum = pgEnum('psf_application_status', [
  'submitted',
  'member',
  'declined',
  'withdrawn',
]);

/** Who sent it: the owner, or the agent while an on behalf claim is open. */
export const psfSubmittedCapacityEnum = pgEnum('psf_submitted_capacity', [
  'owner',
  'on_behalf_of',
]);

/** PSF's form, "Company type", as printed. */
export const psfCompanyTypeEnum = pgEnum('psf_company_type', [
  'cooperative',
  'ngo',
  'partly_state_owned',
  'private_company',
  'public_company',
  'sole_trader',
]);

/** PSF's form, "Ownership", as printed. `other` carries a text. */
export const psfOwnershipEnum = pgEnum('psf_ownership', [
  'foreign_100',
  'rwandan_100',
  'franchise',
  'joint_venture',
  'foreign_representative',
  'other',
]);

export const psfTradeDirectionEnum = pgEnum('psf_trade_direction', [
  'none',
  'export',
  'import',
  'both',
]);

/** PSF's form, "Role/Function", as printed. */
export const psfContactRoleEnum = pgEnum('psf_contact_role', [
  'owner',
  'managing_director',
  'ceo',
  'chairman',
]);

export const psfDeclineReasonEnum = pgEnum('psf_decline_reason', [
  'details_incomplete',
  'not_eligible_for_tier',
  'business_not_recognised',
  'other',
]);

/**
 * `psf_confirmed` is a PSF officer's decision in Injishi. `self_declared` is a
 * Yes at registration that came with a membership number nobody has checked.
 */
export const psfMembershipSourceEnum = pgEnum('psf_membership_source', [
  'psf_confirmed',
  'self_declared',
]);
