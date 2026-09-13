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
 * Who moved a registration (ADR-049, AC-R6).
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
 * A membership's lifecycle (ADR-049, AC-R10).
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
export const orgCertificateKindEnum = pgEnum('org_certificate_kind', [
  'rdb_grade',
  'tourism_license',
  'tax_clearance',
  'fire_safety',
  'health_inspection',
  'other',
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
]);


// §7 residence
export const leaseStatusEnum = pgEnum('lease_status', [
  'draft',
  'pending_signature',
  'active',
  'ending',
  'ended',
  'cancelled',
]);

export const signerRoleEnum = pgEnum('signer_role', ['landlord', 'tenant']);

export const rentStatusEnum = pgEnum('rent_status', ['paid', 'due', 'overdue']);

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
]);

export const payoutDestinationEnum = pgEnum('payout_destination', [
  'momo',
  'bank',
]);

export const payoutSourceEnum = pgEnum('payout_source', [
  'booking',
  'rent',
  'placement_fee',
]);

export const payoutStatusEnum = pgEnum('payout_status', [
  'scheduled',
  'queued',
  'paid',
  'held',
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

export const ebmSourceEnum = pgEnum('ebm_source', ['booking', 'subscription']);

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
