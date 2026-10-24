-- Rentals rebuild, P1 (blueprint 1.5, step 2): every new rentals enum type, and one rentals
-- settings row per landlord.
--
-- The types are built from packages/contracts/src/rentals/vocab.ts (rentals-vocab.spec.ts keeps
-- them equal). They are created here, in their own types, so every later migration in this run
-- can use their values at once.
CREATE TYPE "public"."deposit_refund_method" AS ENUM('gateway', 'recorded', 'none');--> statement-breakpoint
CREATE TYPE "public"."id_kind" AS ENUM('national_id', 'passport');--> statement-breakpoint
CREATE TYPE "public"."lease_actor_role" AS ENUM('landlord', 'tenant', 'system', 'broker');--> statement-breakpoint
CREATE TYPE "public"."lease_charge_kind" AS ENUM('rent', 'deposit');--> statement-breakpoint
CREATE TYPE "public"."lease_charge_status" AS ENUM('open', 'paid', 'waived');--> statement-breakpoint
CREATE TYPE "public"."lease_deposit_status" AS ENUM('awaiting', 'held', 'settled');--> statement-breakpoint
CREATE TYPE "public"."lease_event_kind" AS ENUM('created', 'terms_edited', 'tenant_updated', 'landlord_signed', 'landlord_signature_voided', 'invitation_sent', 'invitation_resent', 'invitation_accepted', 'tenant_signed', 'signed_copy_ready', 'started', 'cancelled', 'charge_raised', 'charge_waived', 'payment_received', 'payment_recorded', 'payment_failed', 'payment_reversed', 'reminder_sent', 'deposit_received', 'deposit_settled', 'deposit_disputed', 'notice_filed', 'notice_acknowledged', 'notice_withdrawn', 'ending', 'moved_out', 'filing_due', 'filed', 'renewed', 'broker_rated');--> statement-breakpoint
CREATE TYPE "public"."lease_payment_channel" AS ENUM('gateway', 'recorded');--> statement-breakpoint
CREATE TYPE "public"."lease_payment_method" AS ENUM('mtn_momo', 'airtel_money', 'card', 'bank_transfer', 'cash', 'other');--> statement-breakpoint
CREATE TYPE "public"."lease_payment_status" AS ENUM('pending', 'succeeded', 'failed', 'expired', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."lease_reminder_channel" AS ENUM('in_app', 'email', 'in_app_email', 'sms', 'call', 'letter');--> statement-breakpoint
CREATE TYPE "public"."lease_reminder_kind" AS ENUM('upcoming', 'due', 'overdue', 'manual');--> statement-breakpoint
CREATE TYPE "public"."lease_signing_method" AS ENUM('email_code', 'password', 'legacy');--> statement-breakpoint
CREATE TYPE "public"."rental_unit_state" AS ENUM('active', 'off_market', 'retired');--> statement-breakpoint
CREATE TYPE "public"."taxpayer_kind" AS ENUM('individual', 'company');--> statement-breakpoint
CREATE TYPE "public"."unit_kitchen" AS ENUM('own', 'shared', 'none');--> statement-breakpoint
CREATE TABLE "landlord_profiles" (
	"org_id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"taxpayer_kind" "taxpayer_kind",
	"signatory_name" text,
	"signatory_id_kind" "id_kind",
	"signatory_id_number" text,
	"contact_phone" text,
	"contact_email" text,
	"default_grace_days" integer DEFAULT 5 NOT NULL,
	"default_notice_days" integer DEFAULT 15 NOT NULL,
	"broker_fee_percent" integer,
	"auto_start_leases" boolean DEFAULT true NOT NULL,
	"setup_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "landlord_profiles_workspace_uk" UNIQUE("workspace_id"),
	CONSTRAINT "landlord_profiles_grace_days_range" CHECK ("landlord_profiles"."default_grace_days" BETWEEN 0 AND 31),
	CONSTRAINT "landlord_profiles_notice_days_range" CHECK ("landlord_profiles"."default_notice_days" BETWEEN 15 AND 180),
	CONSTRAINT "landlord_profiles_broker_fee_range" CHECK ("landlord_profiles"."broker_fee_percent" IS NULL OR "landlord_profiles"."broker_fee_percent" BETWEEN 0 AND 200),
	CONSTRAINT "landlord_profiles_signatory_id_shape" CHECK (("landlord_profiles"."signatory_id_kind" IS NULL AND "landlord_profiles"."signatory_id_number" IS NULL)
        OR ("landlord_profiles"."signatory_id_kind" = 'national_id' AND "landlord_profiles"."signatory_id_number" ~ '^[0-9]{16}$')
        OR ("landlord_profiles"."signatory_id_kind" = 'passport' AND "landlord_profiles"."signatory_id_number" ~ '^[A-Z0-9]{5,20}$')),
	CONSTRAINT "landlord_profiles_contact_shape" CHECK (("landlord_profiles"."contact_email" IS NULL OR "landlord_profiles"."contact_email" = lower("landlord_profiles"."contact_email"))
        AND ("landlord_profiles"."contact_phone" IS NULL OR "landlord_profiles"."contact_phone" ~ '^[+][1-9][0-9]{7,14}$'))
);
--> statement-breakpoint
ALTER TABLE "landlord_profiles" ADD CONSTRAINT "landlord_profiles_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landlord_profiles" ADD CONSTRAINT "landlord_profiles_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Backfill: one profile per residence business with its business workspace. The lease defaults
-- are the column defaults (5 grace days, 15 days' notice, start leases automatically). A business
-- that already has rented units has done its setup, so the app does not offer the setup steps.
INSERT INTO "landlord_profiles" ("org_id", "workspace_id", "setup_completed_at")
SELECT o."id", w."id",
       CASE WHEN EXISTS (
         SELECT 1 FROM "rooms" r JOIN "room_types" rt ON rt."id" = r."room_type_id"
          WHERE r."workspace_id" = w."id" AND rt."domain" = 'residence'
       ) THEN now() END
  FROM "orgs" o
  JOIN "workspaces" w ON w."org_id" = o."id" AND w."kind" = 'business'
 WHERE o."domain" = 'residence';--> statement-breakpoint
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM "landlord_profiles";
  RAISE NOTICE '0074: % landlord profile(s) written', n;
END $$;
