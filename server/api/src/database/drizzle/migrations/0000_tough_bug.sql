CREATE TYPE "public"."adapter_mode" AS ENUM('mock', 'live');--> statement-breakpoint
CREATE TYPE "public"."adapter_name" AS ENUM('payment', 'ebm_vsdc', 'rra_tin', 'filing', 'mailer', 'maps');--> statement-breakpoint
CREATE TYPE "public"."adapter_status" AS ENUM('up', 'degraded', 'down');--> statement-breakpoint
CREATE TYPE "public"."announcement_state" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."approval_policy" AS ENUM('approve_all', 'approve_first_three');--> statement-breakpoint
CREATE TYPE "public"."audit_subject_type" AS ENUM('user', 'org', 'lease', 'booking', 'payment', 'config');--> statement-breakpoint
CREATE TYPE "public"."booking_mode" AS ENUM('instant_book', 'request_to_book');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('pending_approval', 'confirmed', 'declined', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."broker_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."cancellation_tier" AS ENUM('flexible', 'moderate', 'limited', 'firm', 'strict_extended_stay');--> statement-breakpoint
CREATE TYPE "public"."caution_status" AS ENUM('held', 'refunded', 'forfeited');--> statement-breakpoint
CREATE TYPE "public"."check_in_method" AS ENUM('front_desk', 'smart_lock', 'keypad', 'lockbox');--> statement-breakpoint
CREATE TYPE "public"."check_in_mode" AS ENUM('staffed', 'self');--> statement-breakpoint
CREATE TYPE "public"."claim_status" AS ENUM('unclaimed', 'claimed');--> statement-breakpoint
CREATE TYPE "public"."collection_visibility" AS ENUM('private', 'shared');--> statement-breakpoint
CREATE TYPE "public"."compliance_artifact_type" AS ENUM('ncsa_registration', 'dpo_of_record', 'dpia', 'processor_inventory_entry');--> statement-breakpoint
CREATE TYPE "public"."decline_reason" AS ENUM('host_declined', 'expired');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('national_id', 'passport', 'other');--> statement-breakpoint
CREATE TYPE "public"."domain_event_type" AS ENUM('booking_request_received', 'booking_approved', 'booking_declined', 'booking_expired', 'booking_cancelled', 'booking_no_show', 'stay_checkin_reminder', 'stay_checkout_reminder', 'review_request', 'review_window_closed', 'payment_captured', 'payment_payout_sent', 'payment_refund_processed', 'payment_placement_fee_disbursed', 'messaging_new_message', 'onboarding_tin_result', 'onboarding_activation_result', 'onboarding_rejection_reason', 'lease_signing_invitation', 'lease_move_out_notice', 'lease_renewal_decision');--> statement-breakpoint
CREATE TYPE "public"."domain_kind" AS ENUM('hospitality', 'residence');--> statement-breakpoint
CREATE TYPE "public"."dsr_request_type" AS ENUM('access', 'correction', 'deletion');--> statement-breakpoint
CREATE TYPE "public"."dsr_state" AS ENUM('received', 'fulfilled');--> statement-breakpoint
CREATE TYPE "public"."ebm_source" AS ENUM('booking', 'subscription');--> statement-breakpoint
CREATE TYPE "public"."ebm_status" AS ENUM('emitted', 'held', 'failed');--> statement-breakpoint
CREATE TYPE "public"."escalation_state" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."escalation_subject_type" AS ENUM('user', 'org', 'lease', 'booking', 'listing', 'review', 'message', 'payment');--> statement-breakpoint
CREATE TYPE "public"."escalation_type" AS ENUM('dispute', 'policy_violation', 'off_platform_leakage', 'listing_non_compliance', 'review_abuse');--> statement-breakpoint
CREATE TYPE "public"."escrow_source" AS ENUM('booking', 'caution');--> statement-breakpoint
CREATE TYPE "public"."escrow_status" AS ENUM('held', 'released', 'refunded_full', 'refunded_partial', 'forfeited');--> statement-breakpoint
CREATE TYPE "public"."filing_status" AS ENUM('pending', 'filed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."flag_scope" AS ENUM('global', 'district');--> statement-breakpoint
CREATE TYPE "public"."global_role" AS ENUM('admin', 'guest', 'broker', 'local_gov');--> statement-breakpoint
CREATE TYPE "public"."invitation_purpose" AS ENUM('staff', 'obo_claim');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('sent', 'accepted', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."lease_status" AS ENUM('draft', 'pending_signature', 'active', 'ending', 'ended', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."ledger_account_type" AS ENUM('asset', 'liability', 'revenue', 'clearing');--> statement-breakpoint
CREATE TYPE "public"."ledger_txn_kind" AS ENUM('capture', 'refund', 'forfeiture', 'payout', 'rent_settle', 'caution_settle', 'placement_disburse', 'subscription_charge', 'override', 'chargeback');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."maintenance_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."message_body_type" AS ENUM('text', 'image', 'voice');--> statement-breakpoint
CREATE TYPE "public"."money_override_action" AS ENUM('force_refund', 'retarget_payout', 'force_release', 'write_off', 'reverse');--> statement-breakpoint
CREATE TYPE "public"."money_override_state" AS ENUM('initiated', 'approved', 'applied');--> statement-breakpoint
CREATE TYPE "public"."notification_category" AS ENUM('booking', 'payment', 'stay', 'review', 'message', 'lease', 'onboarding', 'subscription', 'moderation', 'system', 'announcement');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('in_app', 'email');--> statement-breakpoint
CREATE TYPE "public"."notification_delivery_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."obo_claim_status" AS ENUM('registrant_held', 'owner_claimed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."org_registration_status" AS ENUM('submitted', 'tin_verified', 'active', 'rejected', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."org_role" AS ENUM('owner', 'manager', 'receptionist');--> statement-breakpoint
CREATE TYPE "public"."outbox_status" AS ENUM('pending', 'dispatched', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('captured', 'refunded_full', 'refunded_partial', 'forfeited', 'paid_out');--> statement-breakpoint
CREATE TYPE "public"."payout_destination" AS ENUM('momo', 'bank');--> statement-breakpoint
CREATE TYPE "public"."payout_payee_type" AS ENUM('host', 'landlord', 'broker');--> statement-breakpoint
CREATE TYPE "public"."payout_source" AS ENUM('booking', 'rent', 'placement_fee');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('scheduled', 'queued', 'paid', 'held');--> statement-breakpoint
CREATE TYPE "public"."placement_fee_status" AS ENUM('pending', 'disbursed');--> statement-breakpoint
CREATE TYPE "public"."placement_status" AS ENUM('initiated', 'converted', 'abandoned', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."plan_billing_period" AS ENUM('monthly');--> statement-breakpoint
CREATE TYPE "public"."rdb_classification_kind" AS ENUM('entity_group', 'accommodation_class', 'residence_class');--> statement-breakpoint
CREATE TYPE "public"."reconciliation_status" AS ENUM('clean', 'discrepancies_flagged');--> statement-breakpoint
CREATE TYPE "public"."record_data_class" AS ENUM('national_id', 'id_photo', 'contract', 'stay_identity', 'contact');--> statement-breakpoint
CREATE TYPE "public"."renewal_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."rent_status" AS ENUM('paid', 'due', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."review_side" AS ENUM('guest_to_host', 'host_to_guest');--> statement-breakpoint
CREATE TYPE "public"."room_status" AS ENUM('available', 'maintenance', 'out_of_service');--> statement-breakpoint
CREATE TYPE "public"."room_type_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."signer_role" AS ENUM('landlord', 'tenant');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('super_admin', 'ops', 'compliance', 'finance');--> statement-breakpoint
CREATE TYPE "public"."stay_lifecycle" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."stored_object_kind" AS ENUM('id_photo', 'contract', 'message_attachment', 'avatar', 'property_photo', 'filing_copy');--> statement-breakpoint
CREATE TYPE "public"."subscription_invoice_status" AS ENUM('pending', 'paid', 'failed');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'canceled', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."support_ticket_state" AS ENUM('open', 'resolved', 'reopened', 'closed');--> statement-breakpoint
CREATE TYPE "public"."tax_code" AS ENUM('TAX_A', 'TAX_B', 'TAX_C', 'TAX_D');--> statement-breakpoint
CREATE TYPE "public"."thread_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."tin_type" AS ENUM('host', 'injishi');--> statement-breakpoint
CREATE TYPE "public"."tin_verification_result" AS ENUM('pending', 'verified', 'failed');--> statement-breakpoint
CREATE TYPE "public"."translation_status" AS ENUM('translated', 'missing', 'needs_review');--> statement-breakpoint
CREATE TYPE "public"."workspace_kind" AS ENUM('business', 'broker', 'personal');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider_id" text NOT NULL,
	"account_id" text NOT NULL,
	"password" text,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"scope" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "adapter_health_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"adapter" "adapter_name" NOT NULL,
	"mode" "adapter_mode" NOT NULL,
	"status" "adapter_status" NOT NULL,
	"error_rate" numeric,
	"latency_ms" integer,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"staff_roles" "staff_role"[] NOT NULL,
	"two_factor_enrolled" boolean DEFAULT false NOT NULL,
	"admin_session_policy" jsonb,
	"granted_by_user_id" uuid,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "amenities" (
	"code" text PRIMARY KEY NOT NULL,
	"category" text,
	"label_en" text NOT NULL,
	"label_rw" text,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_name" text NOT NULL,
	"opaque_actor_id" text,
	"district_id" integer,
	"workspace_kind" "workspace_kind",
	"props" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"audience" jsonb,
	"body_en" text,
	"body_rw" text,
	"publish_at" timestamp with time zone,
	"state" "announcement_state" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "arrival_guides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"wifi" text,
	"lock_code" text,
	"directions" text,
	"house_manual" text,
	"reveal_on_staffed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "arrival_guides_property_id_unique" UNIQUE("property_id")
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"impersonated_user_id" uuid,
	"subject_type" "audit_subject_type",
	"subject_id" uuid,
	"event_type" text NOT NULL,
	"payload_diff" jsonb,
	"reason" text,
	"district_id" integer,
	"prev_hash" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"room_type_id" uuid NOT NULL,
	"guest_user_id" uuid,
	"workspace_id" uuid NOT NULL,
	"check_in" date NOT NULL,
	"check_out" date NOT NULL,
	"guest_count" integer DEFAULT 1 NOT NULL,
	"status" "booking_status" NOT NULL,
	"booking_mode" "booking_mode" NOT NULL,
	"locked_nightly_rate_rwf" bigint,
	"locked_cancellation_tier" "cancellation_tier",
	"nonrefundable" boolean DEFAULT false NOT NULL,
	"gross_rwf" bigint,
	"currency" char(3) DEFAULT 'RWF' NOT NULL,
	"payment_status" "payment_status",
	"decline_reason" "decline_reason",
	"approval_expires_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_reference_uk" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "brokers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"national_id" text NOT NULL,
	"name" text,
	"phone" text,
	"email" text,
	"status" "broker_status" DEFAULT 'active' NOT NULL,
	"license_info" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brokers_user_uk" UNIQUE("user_id"),
	CONSTRAINT "brokers_national_id_uk" UNIQUE("national_id")
);
--> statement-breakpoint
CREATE TABLE "caution_holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lease_id" uuid NOT NULL,
	"amount_rwf" bigint,
	"currency" char(3) DEFAULT 'RWF' NOT NULL,
	"status" "caution_status" DEFAULT 'held' NOT NULL,
	"escrow_id" uuid,
	"held_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "caution_holds_lease_uk" UNIQUE("lease_id")
);
--> statement-breakpoint
CREATE TABLE "caution_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lease_id" uuid NOT NULL,
	"caution_hold_id" uuid NOT NULL,
	"refunded_rwf" bigint,
	"forfeited_rwf" bigint,
	"currency" char(3) DEFAULT 'RWF' NOT NULL,
	"reason" text,
	"evidence" jsonb,
	"is_disputed" boolean DEFAULT false NOT NULL,
	"settled_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "caution_settlements_lease_uk" UNIQUE("lease_id")
);
--> statement-breakpoint
CREATE TABLE "cells" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sector_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_items" (
	"collection_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_items_collection_id_property_id_pk" PRIMARY KEY("collection_id","property_id")
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid,
	"name" text NOT NULL,
	"share_token" text,
	"visibility" "collection_visibility" DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artifact_type" "compliance_artifact_type" NOT NULL,
	"details" jsonb,
	"processor_name" text,
	"review_due_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "config_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_type" text NOT NULL,
	"value" jsonb,
	"effective_from" timestamp with time zone,
	"effective_to" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"locked_on_use" boolean DEFAULT false NOT NULL,
	"reversible" boolean DEFAULT true NOT NULL,
	"last_actor_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_reveals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"broker_id" uuid NOT NULL,
	"listing_id" uuid,
	"landlord_org_id" uuid,
	"revealed_phone" text,
	"revealed_email" text,
	"revealed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_filings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lease_id" uuid NOT NULL,
	"status" "filing_status" DEFAULT 'pending' NOT NULL,
	"clock_start_at" timestamp with time zone,
	"due_by" timestamp with time zone,
	"filing_copy_object_id" uuid,
	"attempts" integer DEFAULT 0 NOT NULL,
	"failure_reason" text,
	"adapter_mode" "adapter_mode" DEFAULT 'mock' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contract_filings_lease_uk" UNIQUE("lease_id")
);
--> statement-breakpoint
CREATE TABLE "data_subject_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_user_id" uuid,
	"request_type" "dsr_request_type" NOT NULL,
	"state" "dsr_state" DEFAULT 'received' NOT NULL,
	"retention_exception_applied" boolean DEFAULT false NOT NULL,
	"dual_authorized" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "date_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_type_id" uuid NOT NULL,
	"day" date NOT NULL,
	"custom_nightly_rate_rwf" bigint,
	"blocked" boolean DEFAULT false NOT NULL,
	"min_nights" integer,
	"max_nights" integer,
	"host_private_note" text
);
--> statement-breakpoint
CREATE TABLE "districts" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"province_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ebm_invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ebm_invoice_id" uuid NOT NULL,
	"description" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_rwf" bigint,
	"tax_code" "tax_code" NOT NULL,
	"tax_rate" numeric,
	"line_total_rwf" bigint,
	"currency" char(3) DEFAULT 'RWF' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ebm_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "ebm_source" NOT NULL,
	"booking_id" uuid,
	"subscription_invoice_id" uuid,
	"tin" text,
	"tin_type" "tin_type" NOT NULL,
	"status" "ebm_status" DEFAULT 'held' NOT NULL,
	"adapter_mode" "adapter_mode" DEFAULT 'mock' NOT NULL,
	"payload" jsonb,
	"attempts" integer DEFAULT 0 NOT NULL,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ebm_invoices_idempotency_key_uk" UNIQUE("idempotency_key"),
	CONSTRAINT "ebm_invoices_source_shape" CHECK (("ebm_invoices"."source" = 'booking' AND "ebm_invoices"."booking_id" IS NOT NULL AND "ebm_invoices"."subscription_invoice_id" IS NULL)
          OR ("ebm_invoices"."source" = 'subscription' AND "ebm_invoices"."subscription_invoice_id" IS NOT NULL AND "ebm_invoices"."booking_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_key" text NOT NULL,
	"subject_en" text,
	"subject_rw" text,
	"body_en" text,
	"body_rw" text,
	"version" integer DEFAULT 1 NOT NULL,
	"is_transactional" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escalations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_type" "escalation_subject_type",
	"subject_id" uuid,
	"type" "escalation_type" NOT NULL,
	"state" "escalation_state" DEFAULT 'open' NOT NULL,
	"owner_user_id" uuid,
	"resolution_note" text,
	"district_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escrows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"source" "escrow_source" NOT NULL,
	"booking_id" uuid,
	"caution_hold_id" uuid,
	"amount_rwf" bigint,
	"currency" char(3) DEFAULT 'RWF' NOT NULL,
	"status" "escrow_status" DEFAULT 'held' NOT NULL,
	"adapter_ref" text,
	"adapter_mode" "adapter_mode" DEFAULT 'mock' NOT NULL,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "escrows_idempotency_key_uk" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" jsonb,
	"scope" "flag_scope" DEFAULT 'global' NOT NULL,
	"district_id" integer,
	"effective_from" timestamp with time zone,
	"last_actor_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guest_stays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid,
	"guest_user_id" uuid,
	"room_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"check_in_mode" "check_in_mode" NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"entry_at" timestamp with time zone NOT NULL,
	"planned_exit_at" timestamp with time zone,
	"actual_exit_at" timestamp with time zone,
	"price_rwf" bigint,
	"currency" char(3) DEFAULT 'RWF' NOT NULL,
	"lifecycle" "stay_lifecycle" DEFAULT 'open' NOT NULL,
	"claim_code" text,
	"claim_status" "claim_status" DEFAULT 'unclaimed' NOT NULL,
	"claimed_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "impersonation_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_user_id" uuid NOT NULL,
	"target_user_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"actions" jsonb
);
--> statement-breakpoint
CREATE TABLE "lease_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lease_id" uuid NOT NULL,
	"email" text NOT NULL,
	"token" text NOT NULL,
	"status" "invitation_status" DEFAULT 'sent' NOT NULL,
	"accepted_by_user_id" uuid,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lease_invitations_token_uk" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "lease_renewals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lease_id" uuid NOT NULL,
	"requested_by_user_id" uuid,
	"requested_end_date" date,
	"status" "renewal_status" DEFAULT 'pending' NOT NULL,
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lease_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lease_id" uuid NOT NULL,
	"signer_role" "signer_role" NOT NULL,
	"signer_user_id" uuid,
	"signer_email" text,
	"ip_address" "inet",
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"tenant_user_id" uuid,
	"broker_id" uuid,
	"monthly_rent_rwf" bigint,
	"caution_rwf" bigint,
	"currency" char(3) DEFAULT 'RWF' NOT NULL,
	"start_date" date,
	"end_date" date,
	"status" "lease_status" DEFAULT 'draft' NOT NULL,
	"contract_content" jsonb,
	"contract_object_id" uuid,
	"landlord_signed_at" timestamp with time zone,
	"tenant_signed_at" timestamp with time zone,
	"supersedes_lease_id" uuid,
	"tenant_name" text,
	"tenant_national_id" text,
	"tenant_email" text,
	"tenant_phone" text,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"type" "ledger_account_type" NOT NULL,
	"workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_accounts_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"amount_rwf" bigint NOT NULL,
	"currency" char(3) DEFAULT 'RWF' NOT NULL,
	"workspace_id" uuid,
	"related_type" text,
	"related_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "ledger_txn_kind" NOT NULL,
	"idempotency_key" text,
	"adapter_mode" "adapter_mode" DEFAULT 'mock' NOT NULL,
	"memo" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_transactions_idempotency_key_uk" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"status" "listing_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listings_property_uk" UNIQUE("property_id")
);
--> statement-breakpoint
CREATE TABLE "maintenance_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"author_user_id" uuid,
	"note" text,
	"photo_object_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lease_id" uuid NOT NULL,
	"raised_by_user_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"status" "maintenance_status" DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"stored_object_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"sender_user_id" uuid,
	"body_type" "message_body_type" DEFAULT 'text' NOT NULL,
	"body" text,
	"voice_duration_s" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_voice_duration_cap" CHECK ("messages"."voice_duration_s" IS NULL OR "messages"."voice_duration_s" <= 60)
);
--> statement-breakpoint
CREATE TABLE "money_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_type" text,
	"subject_id" uuid,
	"action" "money_override_action" NOT NULL,
	"reason" text NOT NULL,
	"initiated_by_user_id" uuid NOT NULL,
	"approved_by_user_id" uuid,
	"state" "money_override_state" DEFAULT 'initiated' NOT NULL,
	"reversible" boolean DEFAULT false NOT NULL,
	"idempotency_key" text,
	"ledger_transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "money_overrides_idempotency_key_uk" UNIQUE("idempotency_key"),
	CONSTRAINT "money_overrides_dual_auth" CHECK ("money_overrides"."approved_by_user_id" IS NULL OR "money_overrides"."approved_by_user_id" <> "money_overrides"."initiated_by_user_id")
);
--> statement-breakpoint
CREATE TABLE "move_out_notices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lease_id" uuid NOT NULL,
	"filed_by_user_id" uuid,
	"move_out_date" date NOT NULL,
	"message" text,
	"notice_given_days" integer,
	"is_short_notice" boolean DEFAULT false NOT NULL,
	"filed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category" "notification_category" NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid,
	"category" "notification_category" NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"title" text,
	"body" text,
	"deep_link" text,
	"is_transactional" boolean DEFAULT false NOT NULL,
	"delivery_status" "notification_delivery_status" DEFAULT 'pending' NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "obo_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"registrant_user_id" uuid NOT NULL,
	"intended_owner_name" text NOT NULL,
	"intended_owner_national_id" text,
	"intended_owner_email" text,
	"claim_status" "obo_claim_status" DEFAULT 'registrant_held' NOT NULL,
	"payout_locked" boolean DEFAULT true NOT NULL,
	"claim_invitation_id" uuid,
	"claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"email" text NOT NULL,
	"org_role" "org_role" NOT NULL,
	"purpose" "invitation_purpose" DEFAULT 'staff' NOT NULL,
	"token" text NOT NULL,
	"status" "invitation_status" DEFAULT 'sent' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_invitations_token_uk" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "org_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"org_role" "org_role" NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"invited_by_user_id" uuid,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_memberships_org_user_uk" UNIQUE("org_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "orgs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legal_name" text NOT NULL,
	"domain" "domain_kind" NOT NULL,
	"rdb_entity_group" text,
	"accommodation_class" text,
	"residence_class" text,
	"tourism_license_number" text,
	"rha_member" boolean DEFAULT false NOT NULL,
	"eac_star_grade" smallint,
	"tin" text NOT NULL,
	"upi" text,
	"registration_status" "org_registration_status" DEFAULT 'submitted' NOT NULL,
	"district_id" integer,
	"village_id" integer,
	"address_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orgs_tin_uk" UNIQUE("tin"),
	CONSTRAINT "orgs_domain_shape" CHECK (("orgs"."domain" = 'hospitality' AND "orgs"."accommodation_class" IS NOT NULL)
          OR ("orgs"."domain" = 'residence' AND "orgs"."residence_class" IS NOT NULL AND "orgs"."tourism_license_number" IS NULL)),
	CONSTRAINT "orgs_eac_star_grade_range" CHECK ("orgs"."eac_star_grade" IS NULL OR ("orgs"."eac_star_grade" BETWEEN 1 AND 5))
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" uuid,
	"event_type" "domain_event_type" NOT NULL,
	"payload" jsonb,
	"workspace_id" uuid,
	"dedupe_key" text NOT NULL,
	"status" "outbox_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outbox_events_dedupe_key_uk" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"payee_type" "payout_payee_type" NOT NULL,
	"destination" "payout_destination",
	"destination_ref" text,
	"amount_rwf" bigint,
	"currency" char(3) DEFAULT 'RWF' NOT NULL,
	"source" "payout_source" NOT NULL,
	"status" "payout_status" DEFAULT 'scheduled' NOT NULL,
	"scheduled_release_at" timestamp with time zone,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payouts_idempotency_key_uk" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "placement_fees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lease_id" uuid NOT NULL,
	"broker_id" uuid NOT NULL,
	"workspace_id" uuid,
	"amount_rwf" bigint,
	"currency" char(3) DEFAULT 'RWF' NOT NULL,
	"status" "placement_fee_status" DEFAULT 'pending' NOT NULL,
	"payout_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "placement_fees_lease_uk" UNIQUE("lease_id")
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"village_id" integer,
	"district_id" integer,
	"latitude" numeric,
	"longitude" numeric,
	"location_privacy" boolean DEFAULT false NOT NULL,
	"timezone" text DEFAULT 'Africa/Kigali' NOT NULL,
	"check_in_time" time,
	"check_out_time" time,
	"house_rules" text,
	"photo_object_keys" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_amenities" (
	"property_id" uuid NOT NULL,
	"amenity_code" text NOT NULL,
	"detail" jsonb,
	CONSTRAINT "property_amenities_property_id_amenity_code_pk" PRIMARY KEY("property_id","amenity_code")
);
--> statement-breakpoint
CREATE TABLE "provinces" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "queue_health_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"queue" text NOT NULL,
	"depth" integer,
	"failed" integer,
	"dead_letter" integer,
	"throughput" numeric,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rdb_classifications" (
	"code" text PRIMARY KEY NOT NULL,
	"kind" "rdb_classification_kind" NOT NULL,
	"parent_code" text,
	"label_en" text NOT NULL,
	"label_rw" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reconciliation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "reconciliation_status" NOT NULL,
	"report" jsonb,
	"adapter_mode" "adapter_mode" DEFAULT 'mock' NOT NULL,
	"ran_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "record_access_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"subject_user_id" uuid,
	"subject_ref" uuid,
	"data_class" "record_data_class" NOT NULL,
	"reason" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rent_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lease_id" uuid NOT NULL,
	"period_month" date NOT NULL,
	"amount_rwf" bigint,
	"paid_amount_rwf" bigint DEFAULT 0,
	"currency" char(3) DEFAULT 'RWF' NOT NULL,
	"status" "rent_status" DEFAULT 'due' NOT NULL,
	"due_date" date,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stay_id" uuid NOT NULL,
	"side" "review_side" NOT NULL,
	"workspace_id" uuid,
	"overall_rating" smallint,
	"cleanliness" smallint,
	"accuracy" smallint,
	"check_in" smallint,
	"communication" smallint,
	"location" smallint,
	"value" smallint,
	"comment" text,
	"moderation_state" text DEFAULT 'visible' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_stay_side_uk" UNIQUE("stay_id","side"),
	CONSTRAINT "reviews_side_shape" CHECK (("reviews"."side" = 'guest_to_host')
          OR ("reviews"."cleanliness" IS NULL AND "reviews"."accuracy" IS NULL AND "reviews"."check_in" IS NULL
              AND "reviews"."communication" IS NULL AND "reviews"."location" IS NULL AND "reviews"."value" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "room_type_amenities" (
	"room_type_id" uuid NOT NULL,
	"amenity_code" text NOT NULL,
	"detail" jsonb,
	CONSTRAINT "room_type_amenities_room_type_id_amenity_code_pk" PRIMARY KEY("room_type_id","amenity_code")
);
--> statement-breakpoint
CREATE TABLE "room_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"domain" "domain_kind" NOT NULL,
	"capacity" integer,
	"room_count" integer DEFAULT 1 NOT NULL,
	"base_price_rwf" bigint,
	"caution_rwf" bigint,
	"currency" char(3) DEFAULT 'RWF' NOT NULL,
	"booking_mode" "booking_mode",
	"approval_policy" "approval_policy",
	"cancellation_tier" "cancellation_tier",
	"nonrefundable_eligible" boolean DEFAULT false NOT NULL,
	"min_stay" integer,
	"max_stay" integer,
	"advance_notice_hours" integer,
	"check_in_method" "check_in_method",
	"weekly_discount_pct" numeric,
	"monthly_discount_pct" numeric,
	"amenity_detail" jsonb,
	"status" "room_type_status" DEFAULT 'active' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_types_approval_policy_shape" CHECK (("room_types"."booking_mode" = 'request_to_book') OR ("room_types"."approval_policy" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_type_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"label" text,
	"status" "room_status" DEFAULT 'available' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_dashboard_scopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid,
	"metric_set" jsonb,
	"district_id" integer,
	"date_range" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sectors" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"district_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"active_workspace_id" uuid,
	"ip_address" text,
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "spaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stay_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guest_stay_id" uuid NOT NULL,
	"full_name" text,
	"id_number" text,
	"document_type" "document_type",
	"id_photo_object_id" uuid,
	"address_text" text,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stay_identities_guest_stay_id_unique" UNIQUE("guest_stay_id")
);
--> statement-breakpoint
CREATE TABLE "stored_objects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"object_key" text NOT NULL,
	"kind" "stored_object_kind" NOT NULL,
	"mime" text,
	"size_bytes" bigint,
	"uploaded_by_user_id" uuid,
	"workspace_id" uuid,
	"legal_hold" boolean DEFAULT false NOT NULL,
	"retention_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stored_objects_object_key_unique" UNIQUE("object_key")
);
--> statement-breakpoint
CREATE TABLE "subscription_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"amount_rwf" bigint,
	"currency" char(3) DEFAULT 'RWF' NOT NULL,
	"period_start" date,
	"period_end" date,
	"status" "subscription_invoice_status" DEFAULT 'pending' NOT NULL,
	"ebm_invoice_id" uuid,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_invoices_idempotency_key_uk" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"tier" integer,
	"price_rwf" bigint,
	"currency" char(3) DEFAULT 'RWF' NOT NULL,
	"billing_period" "plan_billing_period" DEFAULT 'monthly' NOT NULL,
	"room_count_limit" integer,
	"feature_set" jsonb,
	"effective_from" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_plans_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"plan_id" uuid,
	"workspace_id" uuid,
	"status" "subscription_status" DEFAULT 'trialing' NOT NULL,
	"current_period_start" date,
	"current_period_end" date,
	"canceled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_org_uk" UNIQUE("org_id")
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_user_id" uuid,
	"workspace_context" text,
	"category" text,
	"state" "support_ticket_state" DEFAULT 'open' NOT NULL,
	"first_response_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"csat" integer,
	"escalation_id" uuid,
	"impersonation_session_id" uuid,
	"domain" "domain_kind",
	"district_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_placements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"broker_id" uuid NOT NULL,
	"listing_id" uuid,
	"landlord_org_id" uuid,
	"status" "placement_status" DEFAULT 'initiated' NOT NULL,
	"lease_id" uuid,
	"initiated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"booking_id" uuid,
	"guest_stay_id" uuid,
	"lease_id" uuid,
	"status" "thread_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "threads_scope_exactly_one" CHECK ((CASE WHEN "threads"."booking_id" IS NOT NULL THEN 1 ELSE 0 END
           + CASE WHEN "threads"."guest_stay_id" IS NOT NULL THEN 1 ELSE 0 END
           + CASE WHEN "threads"."lease_id" IS NOT NULL THEN 1 ELSE 0 END) = 1)
);
--> statement-breakpoint
CREATE TABLE "tin_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"tin" text NOT NULL,
	"result" "tin_verification_result" DEFAULT 'pending' NOT NULL,
	"latency_ms" integer,
	"adapter_mode" "adapter_mode" DEFAULT 'mock' NOT NULL,
	"raw_response" jsonb,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "translation_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value_en" text,
	"value_rw" text,
	"status" "translation_status" DEFAULT 'missing' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" text,
	"avatar_object_key" text,
	"phone_e164" text,
	"national_id" text,
	"dob" date,
	"village_id" integer,
	"district_id" integer,
	"address_text" text,
	"two_factor_enrolled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"global_role" "global_role" NOT NULL,
	"district_id" integer,
	"granted_by_user_id" uuid,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"name" text,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "villages" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"cell_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visitor_access_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lease_id" uuid NOT NULL,
	"requested_by_user_id" uuid,
	"for_date" date,
	"reason" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visitor_log_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lease_id" uuid NOT NULL,
	"visitor_name" text,
	"visitor_phone" text,
	"relation" text,
	"arrival_at" timestamp with time zone,
	"departure_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "workspace_kind" NOT NULL,
	"org_id" uuid,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_kind_shape" CHECK (("workspaces"."kind" = 'business' AND "workspaces"."org_id" IS NOT NULL AND "workspaces"."user_id" IS NULL)
          OR ("workspaces"."kind" IN ('broker', 'personal') AND "workspaces"."user_id" IS NOT NULL AND "workspaces"."org_id" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_granted_by_user_id_users_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arrival_guides" ADD CONSTRAINT "arrival_guides_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_impersonated_user_id_users_id_fk" FOREIGN KEY ("impersonated_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_room_type_id_room_types_id_fk" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_guest_user_id_users_id_fk" FOREIGN KEY ("guest_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brokers" ADD CONSTRAINT "brokers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caution_holds" ADD CONSTRAINT "caution_holds_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caution_holds" ADD CONSTRAINT "caution_holds_escrow_id_escrows_id_fk" FOREIGN KEY ("escrow_id") REFERENCES "public"."escrows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caution_settlements" ADD CONSTRAINT "caution_settlements_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caution_settlements" ADD CONSTRAINT "caution_settlements_caution_hold_id_caution_holds_id_fk" FOREIGN KEY ("caution_hold_id") REFERENCES "public"."caution_holds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cells" ADD CONSTRAINT "cells_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "config_entries" ADD CONSTRAINT "config_entries_last_actor_user_id_users_id_fk" FOREIGN KEY ("last_actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_reveals" ADD CONSTRAINT "contact_reveals_broker_id_brokers_id_fk" FOREIGN KEY ("broker_id") REFERENCES "public"."brokers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_reveals" ADD CONSTRAINT "contact_reveals_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_reveals" ADD CONSTRAINT "contact_reveals_landlord_org_id_orgs_id_fk" FOREIGN KEY ("landlord_org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_filings" ADD CONSTRAINT "contract_filings_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_filings" ADD CONSTRAINT "contract_filings_filing_copy_object_id_stored_objects_id_fk" FOREIGN KEY ("filing_copy_object_id") REFERENCES "public"."stored_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_subject_requests" ADD CONSTRAINT "data_subject_requests_subject_user_id_users_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "date_overrides" ADD CONSTRAINT "date_overrides_room_type_id_room_types_id_fk" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "districts" ADD CONSTRAINT "districts_province_id_provinces_id_fk" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ebm_invoice_lines" ADD CONSTRAINT "ebm_invoice_lines_ebm_invoice_id_ebm_invoices_id_fk" FOREIGN KEY ("ebm_invoice_id") REFERENCES "public"."ebm_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ebm_invoices" ADD CONSTRAINT "ebm_invoices_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ebm_invoices" ADD CONSTRAINT "ebm_invoices_subscription_invoice_id_subscription_invoices_id_fk" FOREIGN KEY ("subscription_invoice_id") REFERENCES "public"."subscription_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrows" ADD CONSTRAINT "escrows_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrows" ADD CONSTRAINT "escrows_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrows" ADD CONSTRAINT "escrows_caution_hold_id_caution_holds_id_fk" FOREIGN KEY ("caution_hold_id") REFERENCES "public"."caution_holds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_last_actor_user_id_users_id_fk" FOREIGN KEY ("last_actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_stays" ADD CONSTRAINT "guest_stays_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_stays" ADD CONSTRAINT "guest_stays_guest_user_id_users_id_fk" FOREIGN KEY ("guest_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_stays" ADD CONSTRAINT "guest_stays_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_stays" ADD CONSTRAINT "guest_stays_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_stays" ADD CONSTRAINT "guest_stays_claimed_by_user_id_users_id_fk" FOREIGN KEY ("claimed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_staff_user_id_users_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_invitations" ADD CONSTRAINT "lease_invitations_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_invitations" ADD CONSTRAINT "lease_invitations_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_renewals" ADD CONSTRAINT "lease_renewals_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_renewals" ADD CONSTRAINT "lease_renewals_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_renewals" ADD CONSTRAINT "lease_renewals_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_signatures" ADD CONSTRAINT "lease_signatures_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_signatures" ADD CONSTRAINT "lease_signatures_signer_user_id_users_id_fk" FOREIGN KEY ("signer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_tenant_user_id_users_id_fk" FOREIGN KEY ("tenant_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_broker_id_brokers_id_fk" FOREIGN KEY ("broker_id") REFERENCES "public"."brokers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_contract_object_id_stored_objects_id_fk" FOREIGN KEY ("contract_object_id") REFERENCES "public"."stored_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_supersedes_lease_id_leases_id_fk" FOREIGN KEY ("supersedes_lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transaction_id_ledger_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."ledger_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_ledger_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_events" ADD CONSTRAINT "maintenance_events_ticket_id_maintenance_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."maintenance_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_events" ADD CONSTRAINT "maintenance_events_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_events" ADD CONSTRAINT "maintenance_events_photo_object_id_stored_objects_id_fk" FOREIGN KEY ("photo_object_id") REFERENCES "public"."stored_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_raised_by_user_id_users_id_fk" FOREIGN KEY ("raised_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_stored_object_id_stored_objects_id_fk" FOREIGN KEY ("stored_object_id") REFERENCES "public"."stored_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_overrides" ADD CONSTRAINT "money_overrides_initiated_by_user_id_users_id_fk" FOREIGN KEY ("initiated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_overrides" ADD CONSTRAINT "money_overrides_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_overrides" ADD CONSTRAINT "money_overrides_ledger_transaction_id_ledger_transactions_id_fk" FOREIGN KEY ("ledger_transaction_id") REFERENCES "public"."ledger_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "move_out_notices" ADD CONSTRAINT "move_out_notices_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "move_out_notices" ADD CONSTRAINT "move_out_notices_filed_by_user_id_users_id_fk" FOREIGN KEY ("filed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obo_registrations" ADD CONSTRAINT "obo_registrations_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obo_registrations" ADD CONSTRAINT "obo_registrations_registrant_user_id_users_id_fk" FOREIGN KEY ("registrant_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obo_registrations" ADD CONSTRAINT "obo_registrations_claim_invitation_id_org_invitations_id_fk" FOREIGN KEY ("claim_invitation_id") REFERENCES "public"."org_invitations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_invitations" ADD CONSTRAINT "org_invitations_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_invitations" ADD CONSTRAINT "org_invitations_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_memberships" ADD CONSTRAINT "org_memberships_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_memberships" ADD CONSTRAINT "org_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_memberships" ADD CONSTRAINT "org_memberships_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orgs" ADD CONSTRAINT "orgs_rdb_entity_group_rdb_classifications_code_fk" FOREIGN KEY ("rdb_entity_group") REFERENCES "public"."rdb_classifications"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orgs" ADD CONSTRAINT "orgs_accommodation_class_rdb_classifications_code_fk" FOREIGN KEY ("accommodation_class") REFERENCES "public"."rdb_classifications"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orgs" ADD CONSTRAINT "orgs_residence_class_rdb_classifications_code_fk" FOREIGN KEY ("residence_class") REFERENCES "public"."rdb_classifications"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orgs" ADD CONSTRAINT "orgs_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orgs" ADD CONSTRAINT "orgs_village_id_villages_id_fk" FOREIGN KEY ("village_id") REFERENCES "public"."villages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placement_fees" ADD CONSTRAINT "placement_fees_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placement_fees" ADD CONSTRAINT "placement_fees_broker_id_brokers_id_fk" FOREIGN KEY ("broker_id") REFERENCES "public"."brokers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placement_fees" ADD CONSTRAINT "placement_fees_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placement_fees" ADD CONSTRAINT "placement_fees_payout_id_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."payouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_village_id_villages_id_fk" FOREIGN KEY ("village_id") REFERENCES "public"."villages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_amenities" ADD CONSTRAINT "property_amenities_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_amenities" ADD CONSTRAINT "property_amenities_amenity_code_amenities_code_fk" FOREIGN KEY ("amenity_code") REFERENCES "public"."amenities"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rdb_classifications" ADD CONSTRAINT "rdb_classifications_parent_code_rdb_classifications_code_fk" FOREIGN KEY ("parent_code") REFERENCES "public"."rdb_classifications"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_access_logs" ADD CONSTRAINT "record_access_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_access_logs" ADD CONSTRAINT "record_access_logs_subject_user_id_users_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_charges" ADD CONSTRAINT "rent_charges_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_stay_id_guest_stays_id_fk" FOREIGN KEY ("stay_id") REFERENCES "public"."guest_stays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_type_amenities" ADD CONSTRAINT "room_type_amenities_room_type_id_room_types_id_fk" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_type_amenities" ADD CONSTRAINT "room_type_amenities_amenity_code_amenities_code_fk" FOREIGN KEY ("amenity_code") REFERENCES "public"."amenities"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_types" ADD CONSTRAINT "room_types_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_types" ADD CONSTRAINT "room_types_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_room_type_id_room_types_id_fk" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_dashboard_scopes" ADD CONSTRAINT "saved_dashboard_scopes_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sectors" ADD CONSTRAINT "sectors_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_active_workspace_id_workspaces_id_fk" FOREIGN KEY ("active_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stay_identities" ADD CONSTRAINT "stay_identities_guest_stay_id_guest_stays_id_fk" FOREIGN KEY ("guest_stay_id") REFERENCES "public"."guest_stays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stay_identities" ADD CONSTRAINT "stay_identities_id_photo_object_id_stored_objects_id_fk" FOREIGN KEY ("id_photo_object_id") REFERENCES "public"."stored_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stored_objects" ADD CONSTRAINT "stored_objects_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stored_objects" ADD CONSTRAINT "stored_objects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_ebm_invoice_id_ebm_invoices_id_fk" FOREIGN KEY ("ebm_invoice_id") REFERENCES "public"."ebm_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_requester_user_id_users_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_escalation_id_escalations_id_fk" FOREIGN KEY ("escalation_id") REFERENCES "public"."escalations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_impersonation_session_id_impersonation_sessions_id_fk" FOREIGN KEY ("impersonation_session_id") REFERENCES "public"."impersonation_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_placements" ADD CONSTRAINT "tenant_placements_broker_id_brokers_id_fk" FOREIGN KEY ("broker_id") REFERENCES "public"."brokers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_placements" ADD CONSTRAINT "tenant_placements_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_placements" ADD CONSTRAINT "tenant_placements_landlord_org_id_orgs_id_fk" FOREIGN KEY ("landlord_org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_placements" ADD CONSTRAINT "tenant_placements_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_guest_stay_id_guest_stays_id_fk" FOREIGN KEY ("guest_stay_id") REFERENCES "public"."guest_stays"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tin_verifications" ADD CONSTRAINT "tin_verifications_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_village_id_villages_id_fk" FOREIGN KEY ("village_id") REFERENCES "public"."villages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_granted_by_user_id_users_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "villages" ADD CONSTRAINT "villages_cell_id_cells_id_fk" FOREIGN KEY ("cell_id") REFERENCES "public"."cells"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_access_requests" ADD CONSTRAINT "visitor_access_requests_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_access_requests" ADD CONSTRAINT "visitor_access_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_log_entries" ADD CONSTRAINT "visitor_log_entries_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_account_uk" ON "accounts" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_events_actor_idx" ON "audit_events" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_events_subject_idx" ON "audit_events" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "audit_events_occurred_idx" ON "audit_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "bookings_room_type_idx" ON "bookings" USING btree ("room_type_id");--> statement-breakpoint
CREATE INDEX "bookings_guest_idx" ON "bookings" USING btree ("guest_user_id");--> statement-breakpoint
CREATE INDEX "bookings_workspace_status_idx" ON "bookings" USING btree ("workspace_id","status","check_in");--> statement-breakpoint
CREATE INDEX "config_entries_type_idx" ON "config_entries" USING btree ("config_type");--> statement-breakpoint
CREATE UNIQUE INDEX "date_overrides_room_type_day_uk" ON "date_overrides" USING btree ("room_type_id","day");--> statement-breakpoint
CREATE INDEX "email_templates_key_idx" ON "email_templates" USING btree ("template_key");--> statement-breakpoint
CREATE INDEX "feature_flags_key_idx" ON "feature_flags" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "guest_stays_claim_code_uk" ON "guest_stays" USING btree ("claim_code") WHERE "guest_stays"."claim_code" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "guest_stays_workspace_idx" ON "guest_stays" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "guest_stays_room_idx" ON "guest_stays" USING btree ("room_id");--> statement-breakpoint
CREATE UNIQUE INDEX "leases_active_room_uk" ON "leases" USING btree ("room_id") WHERE "leases"."status" = 'active';--> statement-breakpoint
CREATE INDEX "leases_org_idx" ON "leases" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "leases_tenant_idx" ON "leases" USING btree ("tenant_user_id");--> statement-breakpoint
CREATE INDEX "leases_workspace_status_idx" ON "leases" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "ledger_accounts_workspace_idx" ON "ledger_accounts" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_transaction_idx" ON "ledger_entries" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_account_idx" ON "ledger_entries" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_related_idx" ON "ledger_entries" USING btree ("related_type","related_id");--> statement-breakpoint
CREATE INDEX "messages_thread_idx" ON "messages" USING btree ("thread_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_uk" ON "notification_preferences" USING btree ("user_id","category","channel");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "org_invitations_org_idx" ON "org_invitations" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "org_memberships_user_idx" ON "org_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "orgs_district_idx" ON "orgs" USING btree ("district_id");--> statement-breakpoint
CREATE INDEX "orgs_registration_status_idx" ON "orgs" USING btree ("registration_status");--> statement-breakpoint
CREATE INDEX "outbox_events_pending_idx" ON "outbox_events" USING btree ("available_at") WHERE "outbox_events"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "payouts_workspace_status_idx" ON "payouts" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "properties_org_idx" ON "properties" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "properties_district_idx" ON "properties" USING btree ("district_id");--> statement-breakpoint
CREATE INDEX "properties_workspace_idx" ON "properties" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "record_access_logs_actor_idx" ON "record_access_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rent_charges_lease_period_uk" ON "rent_charges" USING btree ("lease_id","period_month");--> statement-breakpoint
CREATE INDEX "room_types_property_idx" ON "room_types" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "room_types_domain_idx" ON "room_types" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "rooms_room_type_idx" ON "rooms" USING btree ("room_type_id");--> statement-breakpoint
CREATE INDEX "threads_workspace_idx" ON "threads" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "translation_entries_key_uk" ON "translation_entries" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "user_roles_active_uk" ON "user_roles" USING btree ("user_id","global_role") WHERE "user_roles"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "user_roles_user_idx" ON "user_roles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_uk" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_business_org_uk" ON "workspaces" USING btree ("org_id") WHERE "workspaces"."kind" = 'business';--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_broker_user_uk" ON "workspaces" USING btree ("user_id") WHERE "workspaces"."kind" = 'broker';--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_personal_user_uk" ON "workspaces" USING btree ("user_id") WHERE "workspaces"."kind" = 'personal';