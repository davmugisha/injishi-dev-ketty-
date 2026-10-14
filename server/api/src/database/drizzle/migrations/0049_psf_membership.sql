-- ADR-056: PSF membership application.
--
-- A hospitality business that is not a Private Sector Federation member can
-- apply from the registration wizard or its workspace; a PSF membership officer
-- decides in the oversight console; a Yes becomes a membership with a number
-- and an expiry. Three tables: the tier catalogue admin edits, the application
-- as filed (one row per attempt), and the live membership.
--
-- `oversight_role` gains `psf_membership_officer`. ADD VALUE is safe inside
-- the migrator's transaction because nothing below uses the new value.
--
-- drizzle-kit also emitted `room_types_residence_not_bookable` here, because
-- 0048 was hand written without a snapshot. That constraint already exists, so
-- the line was removed; the new snapshot carries it, so the next generate will
-- not repeat it.
--
-- Numbered 0050, not 0049: the check-in branch holds an unmerged 0049.
CREATE TYPE "public"."psf_application_status" AS ENUM('submitted', 'member', 'declined', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."psf_company_type" AS ENUM('cooperative', 'ngo', 'partly_state_owned', 'private_company', 'public_company', 'sole_trader');--> statement-breakpoint
CREATE TYPE "public"."psf_contact_role" AS ENUM('owner', 'managing_director', 'ceo', 'chairman');--> statement-breakpoint
CREATE TYPE "public"."psf_decline_reason" AS ENUM('details_incomplete', 'not_eligible_for_tier', 'business_not_recognised', 'other');--> statement-breakpoint
CREATE TYPE "public"."psf_membership_family" AS ENUM('golden_circle', 'indashyikirwa', 'ordinary', 'junior_giants');--> statement-breakpoint
CREATE TYPE "public"."psf_membership_source" AS ENUM('psf_confirmed', 'self_declared');--> statement-breakpoint
CREATE TYPE "public"."psf_ownership" AS ENUM('foreign_100', 'rwandan_100', 'franchise', 'joint_venture', 'foreign_representative', 'other');--> statement-breakpoint
CREATE TYPE "public"."psf_price_kind" AS ENUM('fixed', 'range', 'set_by_psf');--> statement-breakpoint
CREATE TYPE "public"."psf_submitted_capacity" AS ENUM('owner', 'on_behalf_of');--> statement-breakpoint
CREATE TYPE "public"."psf_trade_direction" AS ENUM('none', 'export', 'import', 'both');--> statement-breakpoint
ALTER TYPE "public"."oversight_role" ADD VALUE 'psf_membership_officer';--> statement-breakpoint
CREATE TABLE "psf_membership_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"submitted_by_user_id" uuid NOT NULL,
	"submitted_capacity" "psf_submitted_capacity" NOT NULL,
	"status" "psf_application_status" DEFAULT 'submitted' NOT NULL,
	"queued_at" timestamp with time zone,
	"requested_tier_code" text NOT NULL,
	"quoted_price_kind" "psf_price_kind" NOT NULL,
	"quoted_fee_rwf" bigint,
	"quoted_fee_min_rwf" bigint,
	"quoted_fee_max_rwf" bigint,
	"company_name" text NOT NULL,
	"registration_type" text NOT NULL,
	"registration_number" text NOT NULL,
	"website" text,
	"street_address" text NOT NULL,
	"company_type" "psf_company_type" NOT NULL,
	"ownership" "psf_ownership" NOT NULL,
	"ownership_other" text,
	"business_activity" text NOT NULL,
	"trade_direction" "psf_trade_direction" NOT NULL,
	"trade_goods" text,
	"trade_countries" text[] DEFAULT '{}'::text[] NOT NULL,
	"contact_role" "psf_contact_role" NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"gender" "gender" NOT NULL,
	"phone_e164" text NOT NULL,
	"email" text NOT NULL,
	"id_document_type" "document_type" NOT NULL,
	"id_document_number" text NOT NULL,
	"date_of_birth" date NOT NULL,
	"consent_given_at" timestamp with time zone NOT NULL,
	"consent_version" text NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by_user_id" uuid,
	"decision_body_code" text,
	"decline_reason" "psf_decline_reason",
	"decision_note" text,
	"withdrawn_at" timestamp with time zone,
	"withdrawn_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "psf_membership_applications_ownership_shape" CHECK (("psf_membership_applications"."ownership" = 'other') = ("psf_membership_applications"."ownership_other" IS NOT NULL)),
	CONSTRAINT "psf_membership_applications_trade_shape" CHECK (("psf_membership_applications"."trade_direction" = 'none' AND "psf_membership_applications"."trade_goods" IS NULL AND cardinality("psf_membership_applications"."trade_countries") = 0)
          OR ("psf_membership_applications"."trade_direction" <> 'none' AND "psf_membership_applications"."trade_goods" IS NOT NULL AND cardinality("psf_membership_applications"."trade_countries") > 0)),
	CONSTRAINT "psf_membership_applications_person_shape" CHECK ("psf_membership_applications"."gender" IN ('male', 'female') AND "psf_membership_applications"."id_document_type" IN ('national_id', 'passport')),
	CONSTRAINT "psf_membership_applications_decision_shape" CHECK (("psf_membership_applications"."status" IN ('member', 'declined')) = ("psf_membership_applications"."decided_at" IS NOT NULL AND "psf_membership_applications"."decided_by_user_id" IS NOT NULL AND "psf_membership_applications"."decision_body_code" IS NOT NULL)
          AND ("psf_membership_applications"."status" = 'declined') = ("psf_membership_applications"."decline_reason" IS NOT NULL)
          AND ("psf_membership_applications"."decline_reason" IS DISTINCT FROM 'other' OR "psf_membership_applications"."decision_note" IS NOT NULL)
          AND ("psf_membership_applications"."status" = 'withdrawn') = ("psf_membership_applications"."withdrawn_at" IS NOT NULL AND "psf_membership_applications"."withdrawn_by_user_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "psf_membership_tiers" (
	"code" text PRIMARY KEY NOT NULL,
	"family" "psf_membership_family" NOT NULL,
	"name_en" text NOT NULL,
	"name_rw" text,
	"price_kind" "psf_price_kind" NOT NULL,
	"annual_fee_rwf" bigint,
	"annual_fee_min_rwf" bigint,
	"annual_fee_max_rwf" bigint,
	"benefits_en" text[] DEFAULT '{}'::text[] NOT NULL,
	"benefits_rw" text[],
	"sort_order" smallint NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "psf_membership_tiers_price_shape" CHECK (("psf_membership_tiers"."price_kind" = 'fixed' AND "psf_membership_tiers"."annual_fee_rwf" IS NOT NULL AND "psf_membership_tiers"."annual_fee_rwf" > 0
            AND "psf_membership_tiers"."annual_fee_min_rwf" IS NULL AND "psf_membership_tiers"."annual_fee_max_rwf" IS NULL)
          OR ("psf_membership_tiers"."price_kind" = 'range' AND "psf_membership_tiers"."annual_fee_rwf" IS NULL
            AND "psf_membership_tiers"."annual_fee_min_rwf" IS NOT NULL AND "psf_membership_tiers"."annual_fee_max_rwf" IS NOT NULL
            AND "psf_membership_tiers"."annual_fee_min_rwf" > 0 AND "psf_membership_tiers"."annual_fee_min_rwf" < "psf_membership_tiers"."annual_fee_max_rwf")
          OR ("psf_membership_tiers"."price_kind" = 'set_by_psf' AND "psf_membership_tiers"."annual_fee_rwf" IS NULL
            AND "psf_membership_tiers"."annual_fee_min_rwf" IS NULL AND "psf_membership_tiers"."annual_fee_max_rwf" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "psf_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"source" "psf_membership_source" NOT NULL,
	"application_id" uuid,
	"tier_code" text,
	"membership_number" text NOT NULL,
	"annual_fee_rwf" bigint,
	"starts_on" date,
	"expires_on" date,
	"recorded_by_user_id" uuid NOT NULL,
	"expiry_reminded_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "psf_memberships_source_shape" CHECK (("psf_memberships"."source" = 'psf_confirmed' AND "psf_memberships"."application_id" IS NOT NULL AND "psf_memberships"."tier_code" IS NOT NULL
            AND "psf_memberships"."annual_fee_rwf" IS NOT NULL AND "psf_memberships"."starts_on" IS NOT NULL AND "psf_memberships"."expires_on" IS NOT NULL
            AND "psf_memberships"."expires_on" > "psf_memberships"."starts_on")
          OR ("psf_memberships"."source" = 'self_declared' AND "psf_memberships"."application_id" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "psf_membership_applications" ADD CONSTRAINT "psf_membership_applications_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psf_membership_applications" ADD CONSTRAINT "psf_membership_applications_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psf_membership_applications" ADD CONSTRAINT "psf_membership_applications_requested_tier_code_psf_membership_tiers_code_fk" FOREIGN KEY ("requested_tier_code") REFERENCES "public"."psf_membership_tiers"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psf_membership_applications" ADD CONSTRAINT "psf_membership_applications_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psf_membership_applications" ADD CONSTRAINT "psf_membership_applications_withdrawn_by_user_id_users_id_fk" FOREIGN KEY ("withdrawn_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psf_membership_tiers" ADD CONSTRAINT "psf_membership_tiers_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psf_memberships" ADD CONSTRAINT "psf_memberships_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psf_memberships" ADD CONSTRAINT "psf_memberships_application_id_psf_membership_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."psf_membership_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psf_memberships" ADD CONSTRAINT "psf_memberships_tier_code_psf_membership_tiers_code_fk" FOREIGN KEY ("tier_code") REFERENCES "public"."psf_membership_tiers"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psf_memberships" ADD CONSTRAINT "psf_memberships_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "psf_membership_applications_one_open_uk" ON "psf_membership_applications" USING btree ("org_id") WHERE "psf_membership_applications"."status" = 'submitted';--> statement-breakpoint
CREATE INDEX "psf_membership_applications_org_idx" ON "psf_membership_applications" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "psf_membership_applications_queue_idx" ON "psf_membership_applications" USING btree ("status","queued_at");--> statement-breakpoint
CREATE UNIQUE INDEX "psf_memberships_one_current_uk" ON "psf_memberships" USING btree ("org_id") WHERE "psf_memberships"."ended_at" IS NULL;--> statement-breakpoint
CREATE INDEX "psf_memberships_expiry_idx" ON "psf_memberships" USING btree ("expires_on");
